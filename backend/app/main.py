from datetime import datetime, date, timedelta, timezone
from typing import Any, Dict, List
import logging
import hashlib
import json
import io
import csv
import secrets
import uuid

from fastapi import FastAPI, HTTPException, Header, Depends, Request, Response
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from psycopg2.extras import Json
from psycopg2.extras import execute_values

from app import config, db
from app.schemas import (
    AttendanceResponse,
    ClaimRequest,
    ClaimResponse,
    CompensationEnqueueRequest,
    AdminAttendanceAdjustRequest,
    AdminAttendanceAdjustResponse,
    AdminDepositUpdateRequest,
    AdminDepositUpdateResponse,
    AdminStatusUpdateRequest,
    AdminStatusUpdateResponse,
    AdminUserCreateRequest,
    AdminUserUpdateRequest,
    AdminUserResponse,
    AdminNotificationsListResponse,
    AdminNotificationActionResponse,
    AdminAuditLogListResponse,
    AdminJobCreateRequest,
    AdminJobResponse,
    AdminJobsListResponse,
    AdminJobDetailResponse,
    AdminJobItemsListResponse,
    AdminJobItem,
    AdminImportRequest,
    AdminImportResponse,
    ExtendExpiryRequest,
    ExtendExpiryResponse,
    HealthResponse,
    NotifyRequest,
    NotifyResponse,
    UserIdentityBulkRequest,
    UserIdentityBulkResponse,
    DailyUserImportRequest,
    DailyUserImportResponse,
    UserLoginRequest,
    UserLoginResponse,
    AdminSegmentCreateRequest,
    AdminSegmentItem,
    AdminSegmentsListResponse,
    AdminExtendExpiryRequest,
    AdminTargetPreviewRequest,
    AdminTargetPreviewResponse,
    AdminBulkUpdateRequest,
    AdminBulkUpdateResponse,
)

app = FastAPI(title="Vault v2.0 API", version="0.2.0")
logger = logging.getLogger("vault.idempotency")


def _parse_int_optional(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        cleaned = value.strip()
        if not cleaned:
            return None
        return int(cleaned)
    return int(value)


def _parse_date_optional(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, str):
        cleaned = value.strip()
        if not cleaned:
            return None
        # yyyy-mm-dd
        return datetime.fromisoformat(cleaned).date()
    if hasattr(value, "year") and hasattr(value, "month") and hasattr(value, "day"):
        # date-like
        return value
    raise ValueError("INVALID_DATE")


def _build_user_target_sql(target: dict) -> tuple[str, list]:
    """Return (where_sql, params) for vault_status/user_identity/user_admin_snapshot join."""

    where: list[str] = [
        "(vs.gold_status!='CLAIMED' OR vs.platinum_status!='CLAIMED' OR vs.diamond_status!='CLAIMED')"
    ]
    params: list[Any] = []

    mode = (target.get("mode") or "").lower()
    if mode == "filter":
        filt = target.get("filter") or {}
        q = (filt.get("query") or "").strip()
        st = (filt.get("status") or "").strip()
        if q:
            like = f"%{q}%"
            where.append("(ui.external_user_id ILIKE %s OR uas.nickname ILIKE %s)")
            params.extend([like, like])
        if st and st.upper() not in {"ALL", "ANY"}:
            where.append("COALESCE(vs.gold_status, 'LOCKED') = %s")
            params.append(st.upper())
        return " AND ".join(where), params

    if mode == "segment":
        filters = target.get("segment_filters") or {}
        statuses = filters.get("status") or []
        if statuses:
            where.append("COALESCE(vs.gold_status, 'LOCKED') = ANY(%s)")
            params.append([str(s).upper() for s in statuses])

        expires_after = _parse_date_optional(filters.get("expiresAfter"))
        expires_before = _parse_date_optional(filters.get("expiresBefore"))
        if expires_after:
            where.append("vs.expires_at::date >= %s")
            params.append(expires_after)
        if expires_before:
            where.append("vs.expires_at::date <= %s")
            params.append(expires_before)

        deposit_min = _parse_int_optional(filters.get("depositMin"))
        deposit_max = _parse_int_optional(filters.get("depositMax"))
        if deposit_min is not None:
            where.append("uas.deposit_total >= %s")
            params.append(deposit_min)
        if deposit_max is not None:
            where.append("uas.deposit_total <= %s")
            params.append(deposit_max)

        attendance_min = _parse_int_optional(filters.get("attendanceMin"))
        attendance_max = _parse_int_optional(filters.get("attendanceMax"))
        capped_attendance_sql = """
            CASE
              WHEN uas.joined_date IS NULL THEN COALESCE(vs.platinum_attendance_days, 0)
              ELSE LEAST(
                COALESCE(vs.platinum_attendance_days, 0),
                GREATEST(0, (CURRENT_DATE - uas.joined_date))
              )
            END
        """.strip()
        if attendance_min is not None:
            where.append(f"({capped_attendance_sql}) >= %s")
            params.append(attendance_min)
        if attendance_max is not None:
            where.append(f"({capped_attendance_sql}) <= %s")
            params.append(attendance_max)

        if bool(filters.get("telegramOk")):
            where.append("uas.telegram_ok = TRUE")
        if bool(filters.get("reviewOk")):
            where.append("uas.review_ok = TRUE")

        return " AND ".join(where), params

    raise HTTPException(status_code=400, detail="INVALID_TARGET_MODE")


def _apply_job_timeouts(cur):
    cur.execute("SET LOCAL lock_timeout = %s", (f"{config.JOB_LOCK_TIMEOUT_MS}ms",))
    cur.execute("SET LOCAL statement_timeout = %s", (f"{config.JOB_STATEMENT_TIMEOUT_MS}ms",))

# Allow local/dev origins for FE preview and Docker usage.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Admin auth dependency
def verify_admin_password(x_admin_password: str | None = Header(None)):
    if x_admin_password is None:
        if config.ALLOW_INSECURE_ADMIN_BYPASS:
            return "bypass"
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")
    if x_admin_password != config.ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")
    return x_admin_password


def _log_admin_action(
    conn,
    admin_user: str,
    action: str,
    endpoint: str,
    target_user_ids: list[int] | None,
    request_id: str | None,
    request_body: dict | None,
    response_status: str,
    response_summary: dict | None,
    error_message: str | None = None,
    metadata: dict | None = None,
    *,
    job_id: str | None = None,
    idempotency_key: str | None = None,
):
    """어드민 감사 로그 기록"""
    cur = conn.cursor()
    target_user_ids_array = target_user_ids if target_user_ids else []
    target_count = len(target_user_ids_array) if target_user_ids_array else 0
    
    cur.execute(
        """
        INSERT INTO admin_audit_log
            (admin_user, action, endpoint, target_user_ids, target_count,
             request_id, request_body, response_status, response_summary, error_message, metadata,
             job_id, idempotency_key)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            admin_user,
            action,
            endpoint,
            target_user_ids_array,
            target_count,
            request_id,
            Json(request_body) if request_body else None,
            response_status,
            Json(response_summary) if response_summary else None,
            error_message,
            Json(metadata) if metadata else None,
            job_id,
            idempotency_key,
        ),
    )


@app.on_event("startup")
def _startup():
    db.init_pool()
    # In tests we assume migrations (or a prepared DB) are present.
    # Running best-effort DDL here can hang if the DB is busy/locked.
    if config.APP_ENV != "test":
        _ensure_schema()


@app.on_event("shutdown")
def _shutdown():
    db.close_pool()


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok")


@app.post("/api/vault/login", response_model=UserLoginResponse)
async def user_login(body: UserLoginRequest):
    """유저 로그인: 입력값을 external_user_id 우선으로 사용하고, 없으면 스냅샷 닉네임으로 역검색"""
    nickname = body.nickname.strip()
    if not nickname:
        raise HTTPException(status_code=400, detail="INVALID_NICKNAME")

    # 입력값을 external_user_id로 그대로 사용 (CSV와 일치 가정)
    external_user_id = _normalize_external_user_id(nickname)

    with db.get_conn() as conn:
        cur = conn.cursor()
        # 1차: external_user_id 일치 검색
        cur.execute(
            "SELECT user_id, external_user_id FROM user_identity WHERE external_user_id=%s",
            (external_user_id,),
        )
        row = cur.fetchone()

        # 2차: 스냅샷 닉네임으로 역검색 (CSV 닉네임과 동일한 경우)
        if not row:
            cur.execute(
                """
                SELECT ui.user_id, ui.external_user_id
                  FROM user_admin_snapshot uas
                  JOIN user_identity ui ON ui.user_id = uas.user_id
                 WHERE uas.nickname = %s
                 LIMIT 1
                """,
                (nickname,),
            )
            row = cur.fetchone()

        if not row:
            raise HTTPException(
                status_code=403,
                detail="CSV_UPLOAD_REQUIRED: 관리자가 회원 정보를 업로드한 후에 로그인할 수 있습니다.",
            )

        user_id = int(row[0])
        resolved_external_user_id = row[1]

        cur.execute(
            "SELECT nickname, COALESCE(telegram_ok, false) FROM user_admin_snapshot WHERE user_id=%s",
            (user_id,),
        )
        snapshot_row = cur.fetchone()
        if not snapshot_row:
            raise HTTPException(
                status_code=403,
                detail="CSV_UPLOAD_REQUIRED: 관리자가 회원 정보를 업로드한 후에 로그인할 수 있습니다.",
            )

        # CSV에 저장된 닉네임을 신뢰 소스로 사용
        snapshot_nickname = snapshot_row[0] or nickname
        telegram_ok = bool(snapshot_row[1]) if snapshot_row[1] is not None else False

        # vault_status 기본 행이 누락된 경우에만 보정
        now = _now()
        expires_at = now + timedelta(hours=72)
        initial_gold_status = "UNLOCKED" if telegram_ok else "LOCKED"
        cur.execute(
            """
            INSERT INTO vault_status (user_id, expires_at, gold_status, platinum_status, diamond_status)
            VALUES (%s, %s, %s, 'LOCKED', 'LOCKED')
            ON CONFLICT (user_id) DO NOTHING
            """,
            (user_id, expires_at, initial_gold_status),
        )

        conn.commit()

    return UserLoginResponse(
        external_user_id=resolved_external_user_id,
        nickname=snapshot_nickname,
        user_id=user_id,
    )


@app.get("/api/vault/status")
async def vault_status(user_id: int | None = None, external_user_id: str | None = None):
    """Return vault status snapshot for the given user (default demo user).

    This mirrors the FE contract in docs/API_SPEC_VAULT_V2.md and uses
    vault_status table if present; otherwise returns a safe default.
    """
    now = _now()
    with db.get_conn() as conn:
        cur = conn.cursor()
        user_id = _resolve_user_id(cur, user_id=user_id, external_user_id=external_user_id, default_user_id=1, create_if_missing=True)
        review_row = None
        cur.execute(
            """
            SELECT vs.expires_at,
                   vs.gold_status,
                   vs.platinum_status,
                   vs.diamond_status,
                   vs.platinum_attendance_days,
                   vs.platinum_deposit_done,
                   vs.diamond_deposit_current,
                   uas.last_deposit_at
              FROM vault_status vs
              LEFT JOIN user_admin_snapshot uas ON vs.user_id = uas.user_id
             WHERE vs.user_id=%s
            """,
            (user_id,),
        )
        row = cur.fetchone()

        # CSV 업로드된 회원만 접근 가능
        cur.execute(
            """
            SELECT COALESCE(telegram_ok, false),
                   COALESCE(review_ok, false)
              FROM user_admin_snapshot
             WHERE user_id=%s
            """,
            (user_id,),
        )
        review_row = cur.fetchone()
        
        # 프로덕션/로컬에서만 CSV 업로드 필수, 테스트에서는 허용
        if not review_row and config.APP_ENV not in {"test"}:
            raise HTTPException(
                status_code=403,
                detail="CSV_UPLOAD_REQUIRED: 관리자가 회원 정보를 업로드해야 금고에 접근할 수 있습니다."
            )

    # Fallback defaults if user row not found
    last_deposit_at = row[7] if row and row[7] else None
    base_time = last_deposit_at if last_deposit_at else now
    expires_at = row[0] if row else base_time + timedelta(hours=72)
    gold_status = row[1] if row else "LOCKED"
    platinum_status = row[2] if row else "LOCKED"
    diamond_status = row[3] if row else "LOCKED"

    platinum_attendance_days = int(row[4]) if row and row[4] is not None else 0
    platinum_deposit_done = bool(row[5]) if row and row[5] is not None else False
    diamond_deposit_current = int(row[6]) if row and row[6] is not None else 0

    telegram_ok = bool(review_row[0]) if review_row and review_row[0] is not None else False
    platinum_review_done = bool(review_row[1]) if review_row and review_row[1] is not None else False

    remaining_ms = int((expires_at - now).total_seconds() * 1000)
    ms_countdown = {"enabled": remaining_ms < 3600_000, "remaining_ms": max(0, remaining_ms)}

    reward_amounts = {"GOLD": 10000, "PLATINUM": 20000, "DIAMOND": 70000, "BONUS": 0}
    status_by_type = {"GOLD": gold_status, "PLATINUM": platinum_status, "DIAMOND": diamond_status}
    loss_breakdown = {
        k: (0 if status_by_type[k] in {"CLAIMED", "EXPIRED"} else reward_amounts[k])
        for k in ("GOLD", "PLATINUM", "DIAMOND")
    }
    loss_breakdown["BONUS"] = 0
    loss_total = int(sum(loss_breakdown.values()))

    return {
        "gold_status": gold_status,
        "platinum_status": platinum_status,
        "diamond_status": diamond_status,
        "platinum_attendance_days": platinum_attendance_days,
        "platinum_deposit_done": platinum_deposit_done,
        "platinum_review_done": platinum_review_done,
        "telegram_ok": telegram_ok,
        "diamond_deposit_current": diamond_deposit_current,
        "expires_at": expires_at.isoformat(),
        "now": now.isoformat(),
        "loss_total": loss_total,
        "loss_breakdown": loss_breakdown,
        "ms_countdown": ms_countdown,
        "social_proof": {"vault_type": "PLATINUM", "claimed_last_24h": 4231},
        "curation_tier": "PLATINUM_BIASED",
    }


@app.post("/api/vault/claim", response_model=ClaimResponse)
async def claim_vault(body: ClaimRequest, user_id: int | None = None, external_user_id: str | None = None):
    vault_type = body.vault_type.upper()
    if vault_type not in {"GOLD", "PLATINUM", "DIAMOND"}:
        raise HTTPException(status_code=400, detail="INVALID_VAULT_TYPE")

    now = _now()
    status_col = f"{vault_type.lower()}_status"
    claimed_at_col = f"{vault_type.lower()}_claimed_at"

    with db.get_conn() as conn:
        cur = conn.cursor()
        user_id = _resolve_user_id(cur, user_id=user_id, external_user_id=external_user_id, default_user_id=1, create_if_missing=True)
        
        # CSV 업로드된 회원만 금고 수령 가능
        cur.execute(
            "SELECT 1 FROM user_admin_snapshot WHERE user_id=%s",
            (user_id,)
        )
        if not cur.fetchone() and config.APP_ENV not in {"test"}:
            raise HTTPException(
                status_code=403,
                detail="CSV_UPLOAD_REQUIRED: 관리자가 회원 정보를 업로드해야 금고를 수령할 수 있습니다."
            )
        
        cur.execute(
            """
            SELECT expires_at, gold_status, platinum_status, diamond_status
              FROM vault_status
             WHERE user_id=%s
             FOR UPDATE
            """,
            (user_id,),
        )
        row = cur.fetchone()

        if not row:
            # Create a baseline row for demo user.
            expires_at = now + timedelta(hours=72)
            cur.execute(
                """
                INSERT INTO vault_status
                    (user_id, expires_at, gold_status, platinum_status, diamond_status)
                VALUES (%s, %s, 'LOCKED', 'LOCKED', 'LOCKED')
                ON CONFLICT (user_id) DO NOTHING
                """,
                (user_id, expires_at),
            )
            cur.execute(
                """
                SELECT expires_at, gold_status, platinum_status, diamond_status
                  FROM vault_status
                 WHERE user_id=%s
                 FOR UPDATE
                """,
                (user_id,),
            )
            row = cur.fetchone()

        expires_at, gold_status, platinum_status, diamond_status = row
        current_status = {
            "GOLD": gold_status,
            "PLATINUM": platinum_status,
            "DIAMOND": diamond_status,
        }[vault_type]

        if current_status == "CLAIMED":
            raise HTTPException(status_code=409, detail="ALREADY_CLAIMED")
        if current_status != "UNLOCKED":
            raise HTTPException(status_code=403, detail="NOT_CLAIMABLE")

        cur.execute(
            f"""
            UPDATE vault_status
               SET {status_col}='CLAIMED',
                   {claimed_at_col}=%s,
                   updated_at=NOW()
             WHERE user_id=%s
            """,
            (now, user_id),
        )
        conn.commit()

    return ClaimResponse(claimed=True, vault_type=vault_type, now=now.isoformat(), expires_at=expires_at.isoformat())


@app.post("/api/vault/attendance", response_model=AttendanceResponse)
async def attendance(user_id: int | None = None, external_user_id: str | None = None):
    now = _now()
    with db.get_conn() as conn:
        cur = conn.cursor()
        user_id = _resolve_user_id(cur, user_id=user_id, external_user_id=external_user_id, default_user_id=1, create_if_missing=True)
        
        # CSV 업로드된 회원만 출석 체크 가능
        cur.execute(
            "SELECT 1 FROM user_admin_snapshot WHERE user_id=%s",
            (user_id,)
        )
        if not cur.fetchone():
            raise HTTPException(
                status_code=403,
                detail="CSV_UPLOAD_REQUIRED: 관리자가 회원 정보를 업로드해야 출석체크를 할 수 있습니다."
            )
        
        cur.execute(
            """
            SELECT expires_at, platinum_attendance_days, last_attended_at, platinum_deposit_done, platinum_status
              FROM vault_status
             WHERE user_id=%s
             FOR UPDATE
            """,
            (user_id,),
        )
        row = cur.fetchone()

        if not row:
            expires_at = now + timedelta(hours=72)
            cur.execute(
                """
                INSERT INTO vault_status
                    (user_id, expires_at, gold_status, platinum_status, diamond_status, platinum_attendance_days, platinum_deposit_done, last_attended_at)
                VALUES (%s, %s, 'LOCKED', 'LOCKED', 'LOCKED', 0, false, NULL)
                ON CONFLICT (user_id) DO NOTHING
                """,
                (user_id, expires_at),
            )
            cur.execute(
                """
                SELECT expires_at, platinum_attendance_days, last_attended_at, platinum_deposit_done, platinum_status
                  FROM vault_status
                 WHERE user_id=%s
                 FOR UPDATE
                """,
                (user_id,),
            )
            row = cur.fetchone()

        expires_at, days, last_attended_at, deposit_done, platinum_status = row
        days = int(days or 0)
        deposit_done = bool(deposit_done)

        if last_attended_at is not None and last_attended_at.date() == now.date():
            raise HTTPException(status_code=409, detail="ALREADY_ATTENDED")

        new_days = min(3, days + 1)
        new_platinum_status = platinum_status
        if new_days >= 3 and deposit_done and platinum_status == "LOCKED":
            new_platinum_status = "UNLOCKED"

        cur.execute(
            """
            UPDATE vault_status
               SET platinum_attendance_days=%s,
                   last_attended_at=%s,
                   platinum_status=%s,
                   updated_at=NOW()
             WHERE user_id=%s
            """,
            (new_days, now, new_platinum_status, user_id),
        )
        conn.commit()

    return AttendanceResponse(platinum_attendance_days=new_days, now=now.isoformat(), expires_at=expires_at.isoformat())


def _now():
    return datetime.now(timezone.utc)


def _parse_bool(value) -> bool:
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    s = str(value).strip().lower()
    if not s:
        return False
    return s in {"1", "true", "t", "yes", "y", "ok", "o", "ㅇㅇ", "확인", "완료"}


def _parse_int(value, default: int = 0) -> int:
    if value is None:
        return default
    if isinstance(value, int):
        return value
    s = str(value).strip()
    if not s:
        return default
    # Allow numbers like "500,000"
    s = s.replace(",", "")
    digits = "".join(ch for ch in s if ch.isdigit() or ch == "-")
    if not digits or digits == "-":
        return default
    try:
        return int(digits)
    except ValueError:
        return default


def _validate_status(value: str | None, field: str) -> str:
    v = (value or "").strip().upper()
    if not v:
        raise HTTPException(status_code=400, detail=f"INVALID_{field.upper()}")
    if v not in {"LOCKED", "UNLOCKED", "CLAIMED", "EXPIRED"}:
        raise HTTPException(status_code=400, detail=f"INVALID_{field.upper()}")
    return v


def _clamp_attendance_days(value: int) -> int:
    return max(0, min(365, value))


def _parse_iso_datetime(value: str | None) -> datetime | None:
    s = str(value or "").strip()
    if not s:
        return None
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        # date-only
        if len(s) == 10 and s[4] == "-" and s[7] == "-":
            d = datetime.fromisoformat(s)
            return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        return None


def _get_or_create_vault_row(cur, user_id: int, now: datetime):
    cur.execute(
        """
        SELECT expires_at,
               gold_status,
               platinum_status,
               diamond_status,
               platinum_attendance_days,
               platinum_deposit_done,
               diamond_deposit_current
          FROM vault_status
         WHERE user_id=%s
         FOR UPDATE
        """,
        (user_id,),
    )
    row = cur.fetchone()
    if row:
        return row

    expires_at = now + timedelta(hours=72)
    cur.execute(
        """
        INSERT INTO vault_status (user_id, expires_at, gold_status, platinum_status, diamond_status)
        VALUES (%s, %s, 'LOCKED', 'LOCKED', 'LOCKED')
        ON CONFLICT (user_id) DO NOTHING
        """,
        (user_id, expires_at),
    )
    cur.execute(
        """
        SELECT expires_at,
               gold_status,
               platinum_status,
               diamond_status,
               platinum_attendance_days,
               platinum_deposit_done,
               diamond_deposit_current
          FROM vault_status
         WHERE user_id=%s
         FOR UPDATE
        """,
        (user_id,),
    )
    return cur.fetchone()


def _parse_joined_date(value: str | None):
    dt = _parse_iso_datetime(value)
    if dt is None:
        return None
    return dt.date()


def _select_import_date(last_deposit_at: datetime | None) -> datetime.date:
    if last_deposit_at is not None:
        return last_deposit_at.date()
    return _now().date()


def _require_non_empty(value: str | None, *, code: str) -> str:
    v = (value or "").strip()
    if not v:
        raise HTTPException(status_code=400, detail=code)
    return v


def _validate_request_id(value: str | None) -> str:
    request_id = _require_non_empty(value, code="INVALID_REQUEST_ID")
    # Keep it strict enough for ops usage, but not overly opinionated.
    if len(request_id) > 128:
        raise HTTPException(status_code=400, detail="INVALID_REQUEST_ID")
    return request_id


def _validate_idempotency_key(value: str | None) -> str:
    """Return a usable idempotency key, generating one when missing.

    Frontend should always send `x-idempotency-key`, but in case a proxy or
    browser strips the header we generate a key to keep the request from
    failing with 400. This preserves safety while avoiding UX breakage.
    """

    raw = (value or "").strip()
    if not raw:
        raw = f"auto-{uuid.uuid4()}"
    if len(raw) > 128:
        raise HTTPException(status_code=400, detail="INVALID_IDEMPOTENCY_KEY")
    return raw


def _idempotency_scope(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _hash_request_body(body: Dict[str, Any]) -> str:
    payload = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _idempotency_start(cur, *, key: str, scope: str, endpoint: str, request_hash: str) -> Dict[str, Any]:
    cur.execute(
        """
        SELECT request_hash, status, response_status, response_body
          FROM idempotency_keys
         WHERE key=%s AND scope=%s AND endpoint=%s
           AND expires_at > NOW()
        """,
        (key, scope, endpoint),
    )
    row = cur.fetchone()
    if row:
        existing_hash, status, response_status, response_body = row
        if existing_hash != request_hash:
            logger.warning(
                "idempotency_key_reuse endpoint=%s scope=%s key=%s status=%s",
                endpoint,
                scope,
                key,
                status,
            )
            raise HTTPException(status_code=409, detail="IDEMPOTENCY_KEY_REUSE")
        if status == "DONE":
            logger.info(
                "idempotency_replayed endpoint=%s scope=%s key=%s status=%s",
                endpoint,
                scope,
                key,
                status,
            )
            return {
                "status": "replayed",
                "response_status": int(response_status or 200),
                "response_body": response_body,
            }
        logger.info(
            "idempotency_in_progress endpoint=%s scope=%s key=%s status=%s",
            endpoint,
            scope,
            key,
            status,
        )
        return {"status": "in_progress"}

    expires_at = _now() + timedelta(hours=config.IDEMPOTENCY_TTL_HOURS)
    cur.execute(
        """
        INSERT INTO idempotency_keys
            (key, scope, endpoint, request_hash, status, expires_at)
        VALUES (%s, %s, %s, %s, 'IN_PROGRESS', %s)
        """,
        (key, scope, endpoint, request_hash, expires_at),
    )
    logger.info(
        "idempotency_recorded endpoint=%s scope=%s key=%s status=IN_PROGRESS",
        endpoint,
        scope,
        key,
    )
    return {"status": "recorded"}


def _idempotency_finish(cur, *, key: str, scope: str, endpoint: str, response_status: int, response_body: Dict[str, Any]):
    cur.execute(
        """
        UPDATE idempotency_keys
           SET status='DONE',
               response_status=%s,
               response_body=%s,
               updated_at=NOW()
         WHERE key=%s AND scope=%s AND endpoint=%s
        """,
        (response_status, Json(response_body), key, scope, endpoint),
    )
    logger.info(
        "idempotency_done endpoint=%s scope=%s key=%s status=DONE response_status=%s",
        endpoint,
        scope,
        key,
        response_status,
    )


def _generate_job_id() -> str:
    return f"job_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{secrets.token_hex(4)}"


def _dedupe_int_list(values: list[int] | None, *, max_items: int) -> list[int]:
    out: list[int] = []
    seen: set[int] = set()
    for v in values or []:
        try:
            iv = int(v)
        except (TypeError, ValueError):
            continue
        if iv <= 0 or iv in seen:
            continue
        seen.add(iv)
        out.append(iv)
        if len(out) >= max_items:
            break
    return out


def _dedupe_str_list(values: list[str] | None, *, max_items: int) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for v in values or []:
        sv = str(v).strip()
        if not sv or sv in seen:
            continue
        seen.add(sv)
        out.append(sv)
        if len(out) >= max_items:
            break
    return out


@app.post("/api/vault/user-daily-import", response_model=DailyUserImportResponse)
async def user_daily_import(body: DailyUserImportRequest, request: Request, response: Response, _auth: str = Depends(verify_admin_password)):
    """일일 엑셀/CSV 업로드 데이터로 운영 스냅샷 + 조건을 갱신.

    입력(권장): external_user_id, nickname, deposit_total(누적), joined_at, last_deposit_at, telegram_ok

    반영:
    - user_identity: external_user_id → user_id 매핑 생성/해결
    - user_admin_snapshot: 업로드된 운영 컬럼 업서트
    - vault_status:
      - diamond_deposit_current = deposit_total
      - gold_status: LOCKED → UNLOCKED (telegram_ok=true)
      - diamond_status: LOCKED → UNLOCKED (deposit_total>=500000)
    """
    rows = body.rows or []
    if not rows:
        raise HTTPException(status_code=400, detail="EMPTY_ROWS")
    if len(rows) > 10000:
        raise HTTPException(status_code=400, detail="TOO_MANY_ROWS")

    key = _validate_idempotency_key(request.headers.get("x-idempotency-key"))
    scope = _idempotency_scope(request)
    endpoint = "/api/vault/user-daily-import"
    request_hash = _hash_request_body(body.model_dump(by_alias=True))

    cleaned_rows = []
    external_ids = []
    seen = set()
    for r in rows:
        ext = _normalize_external_user_id(getattr(r, "external_user_id", None))
        if not ext:
            continue
        if ext in seen:
            continue
        seen.add(ext)
        external_ids.append(ext)
        cleaned_rows.append(r)

    if not external_ids:
        raise HTTPException(status_code=400, detail="EMPTY_EXTERNAL_USER_IDS")

    with db.get_conn() as conn:
        cur = conn.cursor()
        _apply_job_timeouts(cur)

        idem = _idempotency_start(cur, key=key, scope=scope, endpoint=endpoint, request_hash=request_hash)
        if idem["status"] == "replayed":
            response.headers["Idempotency-Status"] = "replayed"
            return DailyUserImportResponse(**idem["response_body"])
        if idem["status"] == "in_progress":
            raise HTTPException(status_code=409, detail="IDEMPOTENCY_IN_PROGRESS")

        now = _now()
        default_expires = now + timedelta(hours=72)

        mapping = _bulk_get_or_create_user_ids_by_external_user_ids(cur, external_ids)
        identity_created = int(mapping.pop("__created_count__", 0))

        snapshot_values = []
        vault_update_values = []

        for r in cleaned_rows:
            ext = _normalize_external_user_id(getattr(r, "external_user_id", None))
            if not ext:
                continue
            user_id = int(mapping[ext])
            nickname = str(getattr(r, "nickname", "") or "").strip() or None
            joined_date = _parse_joined_date(getattr(r, "joined_at", None))
            deposit_total = max(0, _parse_int(getattr(r, "deposit_total", 0), default=0))
            last_deposit_at = _parse_iso_datetime(getattr(r, "last_deposit_at", None))
            telegram_ok = _parse_bool(getattr(r, "telegram_ok", False))
            review_ok = _parse_bool(getattr(r, "review_ok", False))

            import_date = _select_import_date(last_deposit_at)

            snapshot_values.append((user_id, nickname, joined_date, deposit_total, last_deposit_at, telegram_ok, review_ok))
            vault_update_values.append((user_id, deposit_total, telegram_ok, review_ok, import_date, last_deposit_at))

        if not snapshot_values:
            raise HTTPException(status_code=400, detail="NO_VALID_ROWS")

        execute_values(
            cur,
            """
            INSERT INTO user_admin_snapshot
                (user_id, nickname, joined_date, deposit_total, last_deposit_at, telegram_ok, review_ok, updated_at)
            VALUES %s
            ON CONFLICT (user_id) DO UPDATE
               SET nickname=EXCLUDED.nickname,
                   joined_date=EXCLUDED.joined_date,
                   deposit_total=EXCLUDED.deposit_total,
                   last_deposit_at=EXCLUDED.last_deposit_at,
                   telegram_ok=EXCLUDED.telegram_ok,
                   review_ok=EXCLUDED.review_ok,
                   updated_at=NOW()
            """,
            snapshot_values,
            template="(%s,%s,%s,%s,%s,%s,%s,NOW())",
        )

        ensure_values = [(int(row[0]), default_expires) for row in snapshot_values]
        execute_values(
            cur,
            """
            INSERT INTO vault_status (user_id, expires_at, gold_status, platinum_status, diamond_status)
            VALUES %s
            ON CONFLICT (user_id) DO NOTHING
            """,
            ensure_values,
            template="(%s,%s,'LOCKED','LOCKED','LOCKED')",
        )

        execute_values(
            cur,
            """
            UPDATE vault_status AS vs
               SET diamond_deposit_current = v.deposit_total,
                                     gold_status = CASE
                                         WHEN vs.gold_status='CLAIMED' THEN 'CLAIMED'
                                         WHEN v.telegram_ok THEN 'UNLOCKED'
                                         ELSE 'LOCKED'
                                     END,
                   platinum_deposit_total_last = GREATEST(COALESCE(vs.platinum_deposit_total_last, 0), v.deposit_total),
                   diamond_status = CASE
                       WHEN vs.diamond_status IN ('LOCKED','ACTIVE') AND v.deposit_total >= 500000 THEN 'UNLOCKED'
                       ELSE vs.diamond_status
                   END,
                   expires_at = CASE
                       WHEN v.last_deposit_at IS NOT NULL THEN v.last_deposit_at::timestamptz + INTERVAL '7 days'
                       ELSE vs.expires_at
                   END,
                   updated_at = NOW()
                            FROM (VALUES %s) AS v(user_id, deposit_total, telegram_ok, review_ok, import_date, last_deposit_at)
             WHERE vs.user_id = v.user_id
            """,
            vault_update_values,
                        template="(%s::int,%s::bigint,%s::bool,%s::bool,%s::date,%s::timestamptz)",
        )
        vault_rows_updated = int(cur.rowcount or 0)

        target_user_ids = [int(mapping[ext]) for ext in external_ids]
        _bump_platinum_progress(cur, target_user_ids)

        job_id = _generate_job_id()
        cur.execute(
            """
            INSERT INTO admin_jobs
                (job_id, type, status, request_id, target_count, processed, failed, payload, created_at, updated_at)
            VALUES (%s, %s, 'DONE', %s, %s, %s, 0, %s, NOW(), NOW())
            """,
            (
                job_id,
                "DAILY_IMPORT",
                key,
                len(target_user_ids),
                len(snapshot_values),
                Json({"source": "USER_DAILY_IMPORT", "total_rows": len(rows)}),
            ),
        )

        admin_user = request.client.host if request.client else "unknown"
        _log_admin_action(
            conn=conn,
            admin_user=admin_user,
            action="USER_DAILY_IMPORT",
            endpoint="/api/vault/user-daily-import",
            target_user_ids=target_user_ids,
            request_id=key,
            request_body={"total_rows": len(rows)},
            response_status="SUCCESS",
            response_summary={
                "total": len(rows),
                "processed": len(snapshot_values),
                "identity_created": identity_created,
                "vault_rows_updated": vault_rows_updated,
                "job_id": job_id,
            },
            idempotency_key=key,
            job_id=job_id,
        )

        response_body = {
            "total": len(rows),
            "processed": len(snapshot_values),
            "identity_created": identity_created,
            "vault_rows_updated": vault_rows_updated,
            "job_id": job_id,
        }

        _idempotency_finish(
            cur,
            key=key,
            scope=scope,
            endpoint=endpoint,
            response_status=200,
            response_body=response_body,
        )

        conn.commit()

    response.headers["Idempotency-Status"] = "recorded"
    return DailyUserImportResponse(**response_body)


def _bump_platinum_progress(cur, user_ids: list[int]):
    if not user_ids:
        return
    cur.execute(
        """
        UPDATE vault_status AS vs
           SET platinum_attendance_days = LEAST(3, vs.platinum_attendance_days + 1),
               last_attended_at = COALESCE(vs.last_attended_at, NOW()),
               platinum_deposit_done = CASE
                   WHEN vs.platinum_deposit_done THEN true
                   WHEN uas.deposit_total >= 150000 THEN true
                   ELSE false
               END,
               platinum_status = CASE
                   WHEN vs.platinum_status IN ('LOCKED','ACTIVE')
                        AND uas.review_ok
                        AND (CASE WHEN vs.platinum_deposit_done THEN true ELSE uas.deposit_total >= 150000 END)
                        AND LEAST(3, vs.platinum_attendance_days + 1) >= 3
                   THEN 'UNLOCKED'
                   ELSE vs.platinum_status
               END
          FROM user_admin_snapshot uas
         WHERE vs.user_id = uas.user_id
           AND vs.user_id = ANY(%s)
        """,
        (user_ids,),
    )


def _apply_import_chunk(cur, cleaned_rows: list[tuple[int, Any, str]], request) -> dict[str, Any]:
    """Apply import chunk (<=10k rows) and return stats."""
    if not cleaned_rows:
        return {"processed": 0, "identity_created": 0, "vault_rows_updated": 0, "target_user_ids": []}

    now = _now()
    default_expires = now + timedelta(hours=72)

    external_ids = [ext for (_, _, ext) in cleaned_rows]
    mapping = _bulk_get_or_create_user_ids_by_external_user_ids(cur, external_ids)
    identity_created = int(mapping.pop("__created_count__", 0))

    snapshot_values = []
    vault_update_values = []

    for (_, r, ext) in cleaned_rows:
        user_id = int(mapping[ext])
        nickname = str(getattr(r, "nickname", "") or "").strip() or None
        joined_date = _parse_joined_date(getattr(r, "joined_at", None))
        deposit_total = max(0, _parse_int(getattr(r, "deposit_total", 0), default=0))
        last_deposit_at = _parse_iso_datetime(getattr(r, "last_deposit_at", None))
        telegram_ok = _parse_bool(getattr(r, "telegram_ok", False))
        review_ok = _parse_bool(getattr(r, "review_ok", False))

        import_date = _select_import_date(last_deposit_at)

        snapshot_values.append((user_id, nickname, joined_date, deposit_total, last_deposit_at, telegram_ok, review_ok))
        vault_update_values.append((user_id, deposit_total, telegram_ok, review_ok, import_date, last_deposit_at))

    execute_values(
        cur,
        """
        INSERT INTO user_admin_snapshot
            (user_id, nickname, joined_date, deposit_total, last_deposit_at, telegram_ok, review_ok, updated_at)
        VALUES %s
        ON CONFLICT (user_id) DO UPDATE
           SET nickname=EXCLUDED.nickname,
               joined_date=EXCLUDED.joined_date,
               deposit_total=EXCLUDED.deposit_total,
               last_deposit_at=EXCLUDED.last_deposit_at,
               telegram_ok=EXCLUDED.telegram_ok,
               review_ok=EXCLUDED.review_ok,
               updated_at=NOW()
        """,
        snapshot_values,
        template="(%s,%s,%s,%s,%s,%s,%s,NOW())",
    )

    ensure_values = [(int(row[0]), default_expires) for row in snapshot_values]
    execute_values(
        cur,
        """
        INSERT INTO vault_status (user_id, expires_at, gold_status, platinum_status, diamond_status)
        VALUES %s
        ON CONFLICT (user_id) DO NOTHING
        """,
        ensure_values,
        template="(%s,%s,'LOCKED','LOCKED','LOCKED')",
    )

    execute_values(
        cur,
        """
        UPDATE vault_status AS vs
           SET diamond_deposit_current = v.deposit_total,
                                 gold_status = CASE
                                     WHEN vs.gold_status='CLAIMED' THEN 'CLAIMED'
                                     WHEN v.telegram_ok THEN 'UNLOCKED'
                                     ELSE 'LOCKED'
                                 END,
                   platinum_deposit_total_last = GREATEST(COALESCE(vs.platinum_deposit_total_last, 0), v.deposit_total),
                   diamond_status = CASE
                       WHEN vs.diamond_status IN ('LOCKED','ACTIVE') AND v.deposit_total >= 500000 THEN 'UNLOCKED'
                       ELSE vs.diamond_status
                   END,
               expires_at = CASE
                   WHEN v.last_deposit_at IS NOT NULL THEN v.last_deposit_at::timestamptz + INTERVAL '7 days'
                   ELSE vs.expires_at
               END,
               updated_at = NOW()
                        FROM (VALUES %s) AS v(user_id, deposit_total, telegram_ok, review_ok, import_date, last_deposit_at)
         WHERE vs.user_id = v.user_id
        """,
        vault_update_values,
                    template="(%s::int,%s::bigint,%s::bool,%s::bool,%s::date,%s::timestamptz)",
    )
    vault_rows_updated = int(cur.rowcount or 0)
    target_user_ids = [int(mapping[ext]) for ext in external_ids]
    _bump_platinum_progress(cur, target_user_ids)

    return {
        "processed": len(snapshot_values),
        "identity_created": identity_created,
        "vault_rows_updated": vault_rows_updated,
        "target_user_ids": target_user_ids,
    }


@app.post("/api/vault/admin/imports", response_model=AdminImportResponse)
async def admin_imports(body: AdminImportRequest, request: Request, response: Response, _auth: str = Depends(verify_admin_password)):
    mode = (body.mode or "APPLY").upper()
    if mode not in {"APPLY", "SHADOW"}:
        raise HTTPException(status_code=400, detail="INVALID_MODE")

    rows = body.rows or []
    if not rows:
        raise HTTPException(status_code=400, detail="EMPTY_ROWS")

    key = _validate_idempotency_key(request.headers.get("x-idempotency-key"))
    scope = _idempotency_scope(request)
    endpoint = "/api/vault/admin/imports"
    request_hash = _hash_request_body(body.model_dump(by_alias=True))

    with db.get_conn() as conn:
        cur = conn.cursor()
        _apply_job_timeouts(cur)

        idem = _idempotency_start(cur, key=key, scope=scope, endpoint=endpoint, request_hash=request_hash)
        if idem["status"] == "replayed":
            response.headers["Idempotency-Status"] = "replayed"
            return AdminImportResponse(**idem["response_body"])
        if idem["status"] == "in_progress":
            raise HTTPException(status_code=409, detail="IDEMPOTENCY_IN_PROGRESS")

        errors: list[dict[str, Any]] = []
        dedup_removed = 0
        cleaned: list[tuple[int, Any, str]] = []
        seen: set[str] = set()
        for idx, r in enumerate(rows):
            ext = _normalize_external_user_id(getattr(r, "external_user_id", None))
            if not ext:
                errors.append({"row_index": idx, "external_user_id": None, "code": "MISSING_EXTERNAL_USER_ID", "detail": None})
                continue
            if ext in seen:
                dedup_removed += 1
                continue
            seen.add(ext)
            cleaned.append((idx, r, ext))

        total = len(rows)
        if not cleaned:
            response_body = {
                "shadow": mode == "SHADOW",
                "total": total,
                "processed": 0,
                "identity_created": 0,
                "vault_rows_updated": 0,
                "dedup_removed": dedup_removed,
                "errors": errors,
                "job_ids": None,
            }
            _idempotency_finish(
                cur,
                key=key,
                scope=scope,
                endpoint=endpoint,
                response_status=200,
                response_body=response_body,
            )
            conn.commit()
            response.headers["Idempotency-Status"] = "recorded"
            return AdminImportResponse(**response_body)

        chunk_size = 10000
        chunks: list[list[tuple[int, Any, str]]] = [cleaned[i : i + chunk_size] for i in range(0, len(cleaned), chunk_size)]

        processed_total = 0
        identity_created_total = 0
        vault_rows_updated_total = 0
        target_user_ids: list[int] = []
        job_ids: list[str] = []

        if mode == "SHADOW":
            processed_total = len(cleaned)
        else:
            for chunk_idx, chunk in enumerate(chunks):
                stats = _apply_import_chunk(cur, chunk, request)
                processed_total += stats["processed"]
                identity_created_total += stats["identity_created"]
                vault_rows_updated_total += stats["vault_rows_updated"]
                target_user_ids.extend(stats["target_user_ids"])

                if len(chunks) > 1:
                    job_id = _generate_job_id()
                    payload = {"type": "DAILY_IMPORT", "chunk_index": chunk_idx, "chunk_total": len(chunks), "mode": mode}
                    cur.execute(
                        """
                        INSERT INTO admin_jobs
                            (job_id, type, status, request_id, target_count, processed, failed, payload, created_at, updated_at)
                        VALUES (%s, %s, 'DONE', %s, %s, %s, 0, %s, NOW(), NOW())
                        """,
                        (job_id, "DAILY_IMPORT", key, len(chunk), stats["processed"], Json(payload)),
                    )
                    job_ids.append(job_id)

        admin_user = request.client.host if request.client else "unknown"

        if mode != "SHADOW":
            _log_admin_action(
                conn=conn,
                admin_user=admin_user,
                action="ADMIN_IMPORTS",
                endpoint=endpoint,
                target_user_ids=target_user_ids[:1000],
                request_id=key,
                request_body={"mode": mode, "total": total, "chunks": len(chunks)},
                response_status="SUCCESS",
                response_summary={
                    "processed": processed_total,
                    "identity_created": identity_created_total,
                    "vault_rows_updated": vault_rows_updated_total,
                    "dedup_removed": dedup_removed,
                    "job_ids": job_ids or None,
                },
            )

        response_body = {
            "shadow": mode == "SHADOW",
            "total": total,
            "processed": processed_total,
            "identity_created": identity_created_total,
            "vault_rows_updated": vault_rows_updated_total,
            "dedup_removed": dedup_removed,
            "errors": errors,
            "job_ids": job_ids or None,
        }

        status_code = 202 if len(chunks) > 1 else 200
        _idempotency_finish(
            cur,
            key=key,
            scope=scope,
            endpoint=endpoint,
            response_status=status_code,
            response_body=response_body,
        )
        conn.commit()

    response.status_code = status_code
    response.headers["Idempotency-Status"] = "recorded"
    return AdminImportResponse(**response_body)


def _normalize_external_user_id(value: str | None) -> str | None:
    if value is None:
        return None
    v = str(value).strip()
    return v or None


def _get_user_id_by_external_user_id(cur, external_user_id: str) -> int | None:
    cur.execute(
        """
        SELECT user_id
          FROM user_identity
         WHERE external_user_id=%s
        """,
        (external_user_id,),
    )
    row = cur.fetchone()
    return int(row[0]) if row else None


def _get_or_create_user_id_by_external_user_id(cur, external_user_id: str) -> int:
    cur.execute(
        """
        INSERT INTO user_identity (external_user_id)
        VALUES (%s)
        ON CONFLICT (external_user_id) DO NOTHING
        RETURNING user_id
        """,
        (external_user_id,),
    )
    row = cur.fetchone()
    if row:
        return int(row[0])
    user_id = _get_user_id_by_external_user_id(cur, external_user_id)
    if user_id is None:
        raise RuntimeError("failed to resolve user_id for external_user_id")
    return user_id


def _parse_joined_date(value: str | None):
    if value is None:
        return None
    v = str(value).strip()
    if not v:
        return None
    try:
        from datetime import date

        return date.fromisoformat(v)
    except Exception:
        raise HTTPException(status_code=400, detail="INVALID_JOINED_DATE")


def _resolve_user_id(
    cur,
    *,
    user_id: int | None,
    external_user_id: str | None,
    default_user_id: int | None,
    create_if_missing: bool,
) -> int:
    ext = _normalize_external_user_id(external_user_id)
    if ext:
        if create_if_missing:
            return _get_or_create_user_id_by_external_user_id(cur, ext)
        resolved = _get_user_id_by_external_user_id(cur, ext)
        if resolved is None:
            raise HTTPException(status_code=404, detail="EXTERNAL_USER_NOT_FOUND")
        return resolved

    if user_id is not None:
        return int(user_id)
    if default_user_id is None:
        raise HTTPException(status_code=400, detail="USER_REQUIRED")
    return int(default_user_id)


def _resolve_user_ids_by_external_user_ids(cur, external_user_ids: list[str]) -> list[int]:
    cleaned = [str(v).strip() for v in (external_user_ids or []) if str(v).strip()]
    if not cleaned:
        return []

    cur.execute(
        """
        SELECT external_user_id, user_id
          FROM user_identity
         WHERE external_user_id = ANY(%s)
        """,
        (cleaned,),
    )
    rows = cur.fetchall() or []
    mapping = {str(ext): int(uid) for ext, uid in rows}
    missing = [ext for ext in cleaned if ext not in mapping]
    if missing:
        raise HTTPException(status_code=404, detail="EXTERNAL_USER_IDS_NOT_FOUND")
    return [mapping[ext] for ext in cleaned]


def _bulk_get_or_create_user_ids_by_external_user_ids(cur, external_user_ids: list[str]) -> dict[str, int]:
    cleaned = [str(v).strip() for v in (external_user_ids or []) if str(v).strip()]
    if not cleaned:
        return {}

    # Insert missing mappings (idempotent)
    cur.execute(
        """
        INSERT INTO user_identity (external_user_id)
        SELECT DISTINCT x
          FROM unnest(%s::text[]) AS x
         WHERE x IS NOT NULL AND btrim(x) <> ''
        ON CONFLICT (external_user_id) DO NOTHING
        """,
        (cleaned,),
    )
    created = int(cur.rowcount or 0)

    cur.execute(
        """
        SELECT external_user_id, user_id
          FROM user_identity
         WHERE external_user_id = ANY(%s)
        """,
        (cleaned,),
    )
    rows = cur.fetchall() or []
    mapping = {str(ext): int(uid) for ext, uid in rows}

    missing = [ext for ext in cleaned if ext not in mapping]
    if missing:
        raise HTTPException(status_code=500, detail="IDENTITY_BULK_RESOLVE_FAILED")

    mapping["__created_count__"] = created
    return mapping


@app.post("/api/vault/user-identity/bulk", response_model=UserIdentityBulkResponse)
async def user_identity_bulk(body: UserIdentityBulkRequest):
    """외부 아이디 목록을 user_identity에 일괄 등록/해결.

    - 입력: external_user_ids (CSV 업로드 결과)
    - 동작: 없으면 생성, 있으면 그대로 사용 (멱등)
    """
    cleaned = [str(v).strip() for v in (body.external_user_ids or []) if str(v).strip()]
    cleaned = cleaned[:10000]
    if not cleaned:
        raise HTTPException(status_code=400, detail="EMPTY_EXTERNAL_USER_IDS")

    with db.get_conn() as conn:
        cur = conn.cursor()
        mapping = _bulk_get_or_create_user_ids_by_external_user_ids(cur, cleaned)
        created = int(mapping.pop("__created_count__", 0))
        conn.commit()

    return UserIdentityBulkResponse(
        total=len(cleaned),
        created=created,
        resolved=len(mapping),
        mappings=mapping,
    )


def _ensure_schema():
    """Best-effort schema bootstrap for local/dev.

    Keeps API endpoints usable even if migrations were not applied.
    """
    with db.get_conn() as conn:
        cur = conn.cursor()

        # Extensions (best-effort for local/dev). pg_trgm enables fast ILIKE '%q%' search.
        try:
            cur.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
        except Exception:
            # Ignore if the DB user lacks permission; system still works without it.
            conn.rollback()

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS user_identity (
                user_id BIGSERIAL PRIMARY KEY,
                external_user_id TEXT NOT NULL UNIQUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )

        # Users list performance indexes (query/status/sort_by).
        cur.execute("CREATE INDEX IF NOT EXISTS idx_user_identity_created_at ON user_identity (created_at DESC)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_user_identity_external_user_id_btree ON user_identity (external_user_id)")
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_user_identity_external_user_id_trgm ON user_identity USING GIN (external_user_id gin_trgm_ops)"
        )

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS vault_status (
                user_id INTEGER PRIMARY KEY,
                expires_at TIMESTAMPTZ NOT NULL,
                gold_status TEXT NOT NULL DEFAULT 'LOCKED',
                platinum_status TEXT NOT NULL DEFAULT 'LOCKED',
                diamond_status TEXT NOT NULL DEFAULT 'LOCKED',
                expiry_extend_count INTEGER NOT NULL DEFAULT 0,
                last_extension_reason TEXT,
                last_extension_at TIMESTAMPTZ,
                gold_claimed_at TIMESTAMPTZ,
                platinum_claimed_at TIMESTAMPTZ,
                diamond_claimed_at TIMESTAMPTZ,
                platinum_attendance_days INTEGER NOT NULL DEFAULT 0,
                platinum_deposit_done BOOLEAN NOT NULL DEFAULT FALSE,
                platinum_deposit_total_last BIGINT NOT NULL DEFAULT 0,
                diamond_deposit_current INTEGER NOT NULL DEFAULT 0,
                last_attended_at TIMESTAMPTZ,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )

        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_vault_status_coalesced_gold_status ON vault_status ((COALESCE(gold_status, 'LOCKED')))"
        )
        cur.execute("CREATE INDEX IF NOT EXISTS idx_vault_status_expires_at ON vault_status (expires_at DESC)")
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_vault_status_gold_status_expires_at ON vault_status (gold_status, expires_at DESC)"
        )

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS user_admin_snapshot (
                user_id INTEGER PRIMARY KEY,
                nickname TEXT,
                joined_date DATE,
                deposit_total BIGINT NOT NULL DEFAULT 0,
                last_deposit_at TIMESTAMPTZ,
                telegram_ok BOOLEAN NOT NULL DEFAULT FALSE,
                review_ok BOOLEAN NOT NULL DEFAULT FALSE,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )

        cur.execute("CREATE INDEX IF NOT EXISTS idx_user_admin_snapshot_deposit_total ON user_admin_snapshot (deposit_total DESC)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_user_admin_snapshot_nickname_btree ON user_admin_snapshot (nickname)")
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_user_admin_snapshot_nickname_trgm ON user_admin_snapshot USING GIN (nickname gin_trgm_ops)"
        )

        cur.execute("ALTER TABLE user_admin_snapshot ADD COLUMN IF NOT EXISTS nickname TEXT")
        cur.execute("ALTER TABLE user_admin_snapshot ADD COLUMN IF NOT EXISTS joined_date DATE")
        cur.execute("ALTER TABLE user_admin_snapshot ADD COLUMN IF NOT EXISTS deposit_total BIGINT NOT NULL DEFAULT 0")
        cur.execute("ALTER TABLE user_admin_snapshot ADD COLUMN IF NOT EXISTS last_deposit_at TIMESTAMPTZ")
        cur.execute("ALTER TABLE user_admin_snapshot ADD COLUMN IF NOT EXISTS telegram_ok BOOLEAN NOT NULL DEFAULT FALSE")
        cur.execute("ALTER TABLE user_admin_snapshot ADD COLUMN IF NOT EXISTS review_ok BOOLEAN NOT NULL DEFAULT FALSE")
        cur.execute("ALTER TABLE user_admin_snapshot ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()")

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS admin_audit_log (
                id BIGSERIAL PRIMARY KEY,
                admin_user TEXT NOT NULL,
                action TEXT NOT NULL,
                endpoint TEXT,
                target_user_ids INTEGER[],
                target_count INTEGER,
                request_id TEXT,
                request_body JSONB,
                response_status TEXT,
                response_summary JSONB,
                error_message TEXT,
                metadata JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )

        cur.execute("ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS job_id TEXT")
        cur.execute("ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS idempotency_key TEXT")

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS idempotency_keys (
                key TEXT NOT NULL,
                scope TEXT NOT NULL,
                endpoint TEXT NOT NULL,
                request_hash TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
                response_status INTEGER,
                response_body JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
                PRIMARY KEY (key, scope, endpoint)
            );
            """
        )
        cur.execute("CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys (expires_at)")

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS admin_jobs (
                job_id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'PENDING',
                request_id TEXT NOT NULL,
                target_count INTEGER NOT NULL DEFAULT 0,
                processed INTEGER NOT NULL DEFAULT 0,
                failed INTEGER NOT NULL DEFAULT 0,
                payload JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )
        cur.execute("CREATE INDEX IF NOT EXISTS idx_admin_jobs_status ON admin_jobs (status)")

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS admin_job_items (
                id BIGSERIAL PRIMARY KEY,
                job_id TEXT NOT NULL REFERENCES admin_jobs(job_id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'PENDING',
                error_message TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )
        cur.execute("CREATE INDEX IF NOT EXISTS idx_admin_job_items_job_id ON admin_job_items (job_id)")

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS admin_segments (
                segment_id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                filters JSONB NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )
        cur.execute("CREATE INDEX IF NOT EXISTS idx_admin_segments_updated_at ON admin_segments (updated_at)")

        # Backward compatible adds if the table already exists with older schema.
        cur.execute("ALTER TABLE vault_status ALTER COLUMN gold_status SET DEFAULT 'LOCKED'")
        cur.execute("ALTER TABLE vault_status ADD COLUMN IF NOT EXISTS expiry_extend_count INTEGER NOT NULL DEFAULT 0")
        cur.execute("ALTER TABLE vault_status ADD COLUMN IF NOT EXISTS last_extension_reason TEXT")
        cur.execute("ALTER TABLE vault_status ADD COLUMN IF NOT EXISTS last_extension_at TIMESTAMPTZ")
        cur.execute("ALTER TABLE vault_status ADD COLUMN IF NOT EXISTS gold_claimed_at TIMESTAMPTZ")
        cur.execute("ALTER TABLE vault_status ADD COLUMN IF NOT EXISTS platinum_claimed_at TIMESTAMPTZ")
        cur.execute("ALTER TABLE vault_status ADD COLUMN IF NOT EXISTS diamond_claimed_at TIMESTAMPTZ")
        cur.execute("ALTER TABLE vault_status ADD COLUMN IF NOT EXISTS platinum_attendance_days INTEGER NOT NULL DEFAULT 0")
        cur.execute("ALTER TABLE vault_status ADD COLUMN IF NOT EXISTS platinum_deposit_done BOOLEAN NOT NULL DEFAULT FALSE")
        cur.execute("ALTER TABLE vault_status ADD COLUMN IF NOT EXISTS platinum_deposit_total_last BIGINT NOT NULL DEFAULT 0")
        cur.execute("ALTER TABLE vault_status ADD COLUMN IF NOT EXISTS diamond_deposit_current INTEGER NOT NULL DEFAULT 0")
        cur.execute("ALTER TABLE vault_status ADD COLUMN IF NOT EXISTS last_attended_at TIMESTAMPTZ")
        cur.execute("ALTER TABLE vault_status ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()")

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS vault_expiry_extension_log (
                id BIGSERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                prev_expires_at TIMESTAMPTZ,
                new_expires_at TIMESTAMPTZ,
                reason TEXT NOT NULL,
                request_id TEXT NOT NULL,
                shadow BOOLEAN NOT NULL DEFAULT FALSE,
                metadata JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )
        cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS ux_vault_expiry_extension_log_request_id ON vault_expiry_extension_log (request_id)")

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS notifications_queue (
                id BIGSERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                vault_type TEXT,
                variant_id TEXT,
                dedup_key TEXT NOT NULL,
                payload JSONB,
                scheduled_at TIMESTAMPTZ,
                status TEXT NOT NULL DEFAULT 'PENDING',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )
        cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS ux_notifications_queue_dedup_key ON notifications_queue (dedup_key)")

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS compensation_queue (
                id BIGSERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                vault_type TEXT NOT NULL,
                request_id TEXT NOT NULL,
                external_service TEXT NOT NULL,
                payload JSONB,
                status TEXT NOT NULL DEFAULT 'PENDING',
                retry_count INTEGER NOT NULL DEFAULT 0,
                next_retry_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )
        cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS ux_compensation_queue_req_ext ON compensation_queue (request_id, external_service)")

        conn.commit()

@app.post("/api/vault/extend-expiry", response_model=ExtendExpiryResponse)
async def extend_expiry(body: ExtendExpiryRequest, request: Request, response: Response, _auth: str = Depends(verify_admin_password)):
    """운영/프로모션 만료 연장. shadow=true면 미적용 프리뷰."""
    request_id = _validate_request_id(getattr(body, "request_id", None))
    if body.scope not in {"ALL_ACTIVE", "USER_IDS"}:
        raise HTTPException(status_code=400, detail="INVALID_SCOPE")
    if body.reason not in {"OPS", "PROMO", "ADMIN"}:
        raise HTTPException(status_code=400, detail="INVALID_REASON")
    user_ids = _dedupe_int_list(list(body.user_ids) if body.user_ids else None, max_items=10000)
    external_user_ids = _dedupe_str_list(list(body.external_user_ids) if body.external_user_ids else None, max_items=10000)
    if body.scope == "USER_IDS" and not (user_ids or external_user_ids):
        raise HTTPException(status_code=400, detail="USER_IDS_REQUIRED")
    if not (1 <= body.extend_hours <= 72):
        raise HTTPException(status_code=400, detail="INVALID_EXTEND_HOURS")

    key = _validate_idempotency_key(request_id)
    scope = _idempotency_scope(request)
    endpoint = "/api/vault/extend-expiry"
    request_hash = _hash_request_body(body.dict())

    with db.get_conn() as conn:
        cur = conn.cursor()
        _apply_job_timeouts(cur)
        now = _now()

        idem = _idempotency_start(cur, key=key, scope=scope, endpoint=endpoint, request_hash=request_hash)
        if idem["status"] == "replayed":
            response.headers["Idempotency-Status"] = "replayed"
            return ExtendExpiryResponse(**idem["response_body"])
        if idem["status"] == "in_progress":
            raise HTTPException(status_code=409, detail="IDEMPOTENCY_IN_PROGRESS")

        if body.scope == "USER_IDS":
            resolved_user_ids: list[int] = []
            if user_ids:
                resolved_user_ids.extend(user_ids)
            if external_user_ids:
                resolved_user_ids.extend(_resolve_user_ids_by_external_user_ids(cur, external_user_ids))
            resolved_user_ids = _dedupe_int_list(resolved_user_ids, max_items=10000)
            cur.execute(
                """
                SELECT user_id, expires_at
                  FROM vault_status
                 WHERE user_id = ANY(%s)
                   AND (gold_status!='CLAIMED' OR platinum_status!='CLAIMED' OR diamond_status!='CLAIMED')
                """,
                (resolved_user_ids,),
            )
            rows = cur.fetchall()
        else:
            cur.execute(
                """
                SELECT user_id, expires_at
                  FROM vault_status
                 WHERE (gold_status!='CLAIMED' OR platinum_status!='CLAIMED' OR diamond_status!='CLAIMED')
                """,
            )
            rows = cur.fetchall()

        if body.shadow:
            sample_ids = [r[0] for r in rows[:10]]
            response_body = {"shadow": True, "candidates": len(rows), "sample_user_ids": sample_ids}
            _idempotency_finish(
                cur,
                key=key,
                scope=scope,
                endpoint=endpoint,
                response_status=200,
                response_body=response_body,
            )
            conn.commit()
            response.headers["Idempotency-Status"] = "recorded"
            return ExtendExpiryResponse(**response_body)

        if not rows:
            response_body = {"shadow": False, "updated": 0, "new_expires_at": None}
            _idempotency_finish(
                cur,
                key=key,
                scope=scope,
                endpoint=endpoint,
                response_status=200,
                response_body=response_body,
            )
            conn.commit()
            response.headers["Idempotency-Status"] = "recorded"
            return ExtendExpiryResponse(**response_body)

        update_values = []
        log_values = []
        new_expires_at = None
        for user_id, expires_at in rows:
            new_expires = expires_at + timedelta(hours=body.extend_hours)
            new_expires_at = new_expires
            update_values.append((user_id, new_expires, body.reason, now))
            log_values.append(
                (
                    user_id,
                    expires_at,
                    new_expires,
                    body.reason,
                    f"{request_id}:{user_id}",
                    Json(
                        {
                            "base_request_id": request_id,
                            "scope": body.scope,
                            "extend_hours": body.extend_hours,
                        }
                    ),
                )
            )

        execute_values(
            cur,
            """
            UPDATE vault_status AS vs
               SET expires_at=data.new_expires_at,
                   expiry_extend_count=vs.expiry_extend_count+1,
                   last_extension_reason=data.reason,
                   last_extension_at=data.now
              FROM (VALUES %s) AS data(user_id, new_expires_at, reason, now)
             WHERE vs.user_id = data.user_id
            """,
            update_values,
            template="(%s,%s,%s,%s)",
        )

        execute_values(
            cur,
            """
            INSERT INTO vault_expiry_extension_log
                (user_id, prev_expires_at, new_expires_at, reason, request_id, shadow, metadata)
            VALUES %s
            ON CONFLICT (request_id) DO NOTHING
            """,
            log_values,
            template="(%s,%s,%s,%s,%s,false,%s)",
        )

        updated = len(update_values)
        
        # 감사 로그 기록
        admin_user = request.client.host if request.client else "unknown"
        target_ids = [r[0] for r in rows]
        _log_admin_action(
            conn=conn,
            admin_user=admin_user,
            action="EXTEND_EXPIRY",
            endpoint="/api/vault/extend-expiry",
            target_user_ids=target_ids[:1000],  # 최대 1000개만 저장 (샘플링)
            request_id=key,
            request_body={"scope": body.scope, "extend_hours": body.extend_hours, "reason": body.reason, "shadow": body.shadow},
            response_status="SUCCESS",
            response_summary={"updated": updated, "new_expires_at": new_expires_at.isoformat() if new_expires_at else None},
            idempotency_key=key,
        )

        response_body = {
            "shadow": False,
            "updated": updated,
            "new_expires_at": new_expires_at.isoformat() if new_expires_at else None,
        }

        _idempotency_finish(
            cur,
            key=key,
            scope=scope,
            endpoint=endpoint,
            response_status=200,
            response_body=response_body,
        )
        
        conn.commit()
        response.headers["Idempotency-Status"] = "recorded"
        return ExtendExpiryResponse(**response_body)


@app.post("/api/vault/notify", response_model=NotifyResponse)
async def notify(body: NotifyRequest, request: Request, response: Response, _auth: str = Depends(verify_admin_password)):
    if body.type not in config.ALLOWED_NOTIFY_TYPES:
        raise HTTPException(status_code=400, detail="INVALID_NOTIFY_TYPE")

    user_ids = _dedupe_int_list(list(body.user_ids) if body.user_ids else None, max_items=10000)
    external_user_ids = _dedupe_str_list(list(body.external_user_ids) if body.external_user_ids else None, max_items=10000)
    if not (user_ids or external_user_ids):
        raise HTTPException(status_code=400, detail="EMPTY_USER_IDS")
    if body.variant_id and body.variant_id not in config.ALLOWED_VARIANT_IDS:
        raise HTTPException(status_code=400, detail="VARIANT_NOT_FOUND")

    key = _validate_idempotency_key(request.headers.get("x-idempotency-key"))
    scope = _idempotency_scope(request)
    endpoint = "/api/vault/notify"
    request_hash = _hash_request_body(body.model_dump(by_alias=True))

    now = _now()
    scheduled_at = None
    if getattr(body, "scheduled_at", None):
        scheduled_at = _parse_iso_datetime(getattr(body, "scheduled_at", None))
        if scheduled_at is None:
            raise HTTPException(status_code=400, detail="INVALID_SCHEDULED_AT")
    if scheduled_at is None:
        scheduled_at = now
    dedup_suffix = body.variant_id or "base"
    dedup_day = scheduled_at.date()
    inserted = 0
    
    # 메시지 템플릿 로드
    template_message = None
    with db.get_conn() as template_conn:
        tc = template_conn.cursor()
        tc.execute(
            "SELECT title, body, cta_text, icon_emoji, category FROM notification_templates WHERE type=%s AND enabled=TRUE",
            (body.type,)
        )
        template_row = tc.fetchone()
        if template_row:
            template_message = {
                "title": template_row[0],
                "body": template_row[1],
                "cta_text": template_row[2],
                "icon_emoji": template_row[3],
                "category": template_row[4]
            }
    
    with db.get_conn() as conn:
        cur = conn.cursor()
        _apply_job_timeouts(cur)

        idem = _idempotency_start(cur, key=key, scope=scope, endpoint=endpoint, request_hash=request_hash)
        if idem["status"] == "replayed":
            response.headers["Idempotency-Status"] = "replayed"
            return NotifyResponse(**idem["response_body"])
        if idem["status"] == "in_progress":
            raise HTTPException(status_code=409, detail="IDEMPOTENCY_IN_PROGRESS")
        resolved_user_ids: list[int] = []
        if user_ids:
            resolved_user_ids.extend(user_ids)
        if external_user_ids:
            resolved_user_ids.extend(_resolve_user_ids_by_external_user_ids(cur, external_user_ids))
        resolved_user_ids = _dedupe_int_list(resolved_user_ids, max_items=10000)
        for uid in resolved_user_ids or []:
            dedup_key = f"{body.type}:{uid}:{dedup_suffix}:{dedup_day}"
            # 커스텀 메시지 또는 템플릿 메시지 사용
            payload_dict = {
                "type": body.type,
                "variant_id": body.variant_id,
            }
            if getattr(body, "message_override", None):
                payload_dict["message"] = body.message_override
            elif template_message:
                payload_dict.update(template_message)
            
            cur.execute(
                """
                INSERT INTO notifications_queue
                    (user_id, type, vault_type, variant_id, dedup_key, payload, scheduled_at, status)
                VALUES (%s, %s, NULL, %s, %s, %s, %s, 'PENDING')
                ON CONFLICT (dedup_key) DO NOTHING
                """,
                (uid, body.type, body.variant_id, dedup_key, Json(payload_dict), scheduled_at),
            )
            if cur.rowcount > 0:
                inserted += 1
        
        # 감사 로그 기록
        admin_user = request.client.host if request.client else "unknown"
        _log_admin_action(
            conn=conn,
            admin_user=admin_user,
            action="NOTIFY",
            endpoint="/api/vault/notify",
            target_user_ids=resolved_user_ids[:1000],  # 최대 1000개만 저장
            request_id=key,
            request_body={"type": body.type, "variant_id": body.variant_id, "scheduled_at": scheduled_at.isoformat() if scheduled_at else None},
            response_status="SUCCESS",
            response_summary={"enqueued": inserted, "total_targets": len(resolved_user_ids)},
            idempotency_key=key,
        )
        
        response_body = {"enqueued": inserted}
        _idempotency_finish(
            cur,
            key=key,
            scope=scope,
            endpoint=endpoint,
            response_status=200,
            response_body=response_body,
        )
        
        conn.commit()
    response.headers["Idempotency-Status"] = "recorded"
    return NotifyResponse(**response_body)


@app.get("/api/vault/admin/notifications", response_model=AdminNotificationsListResponse)
async def list_notifications(
    status: str | None = None,
    type: str | None = None,
    variant_id: str | None = None,
    user_id: int | None = None,
    external_user_id: str | None = None,
    page: int = 1,
    page_size: int = 50,
    order: str = "desc",
    _auth: str = Depends(verify_admin_password),
):
    allowed_status = {"PENDING", "SENT", "FAILED", "DLQ", "RETRYING", "CANCELED"}
    if status and status not in allowed_status:
        raise HTTPException(status_code=400, detail="INVALID_STATUS")
    if type and type not in config.ALLOWED_NOTIFY_TYPES:
        raise HTTPException(status_code=400, detail="INVALID_NOTIFY_TYPE")
    if variant_id and variant_id not in config.ALLOWED_VARIANT_IDS:
        raise HTTPException(status_code=400, detail="VARIANT_NOT_FOUND")

    page = 1 if page < 1 else page
    page_size = 1 if page_size < 1 else page_size
    page_size = 200 if page_size > 200 else page_size
    offset = (page - 1) * page_size
    order_sql = "DESC" if order.lower() != "asc" else "ASC"

    conditions: list[str] = []
    params: list = []

    with db.get_conn() as conn:
        cur = conn.cursor()

        resolved_user_id = user_id
        if external_user_id:
            resolved_user_id = _get_user_id_by_external_user_id(cur, external_user_id)
            if resolved_user_id is None:
                return AdminNotificationsListResponse(total=0, page=page, page_size=page_size, has_more=False, items=[])

        if status:
            conditions.append("nq.status=%s")
            params.append(status)
        if type:
            conditions.append("nq.type=%s")
            params.append(type)
        if variant_id:
            conditions.append("nq.variant_id=%s")
            params.append(variant_id)
        if resolved_user_id:
            conditions.append("nq.user_id=%s")
            params.append(resolved_user_id)

        where_sql = ""
        if conditions:
            where_sql = " WHERE " + " AND ".join(conditions)

        cur.execute(
            f"SELECT COUNT(*) FROM notifications_queue nq {where_sql}",
            tuple(params),
        )
        total = int(cur.fetchone()[0])

        cur.execute(
            f"""
            SELECT nq.id,
                   nq.user_id,
                   ui.external_user_id,
                   nq.type,
                   nq.variant_id,
                   nq.status,
                   nq.scheduled_at,
                   nq.created_at,
                   nq.payload
              FROM notifications_queue nq
         LEFT JOIN user_identity ui ON ui.user_id = nq.user_id
            {where_sql}
          ORDER BY nq.id {order_sql}
             LIMIT %s OFFSET %s
            """,
            tuple(params + [page_size, offset]),
        )
        rows = cur.fetchall() or []

    items = []
    for row in rows:
        payload = row[8] or {}
        item = {
            "id": row[0],
            "user_id": row[1],
            "external_user_id": row[2],
            "type": row[3],
            "variant_id": row[4],
            "status": row[5],
            "scheduled_at": row[6].isoformat() if row[6] else None,
            "created_at": row[7].isoformat() if row[7] else None,
            "payload": payload,
            # payload에서 메시지 필드 추출
            "title": payload.get("title"),
            "body": payload.get("body"),
            "cta_text": payload.get("cta_text"),
            "icon_emoji": payload.get("icon_emoji"),
            "category": payload.get("category"),
        }
        items.append(item)

    has_more = (offset + len(items)) < total
    return AdminNotificationsListResponse(total=total, page=page, page_size=page_size, has_more=has_more, items=items)


@app.post("/api/vault/admin/notifications/{notification_id}/retry", response_model=AdminNotificationActionResponse)
async def retry_notification(
    notification_id: int,
    request: Request,
    _auth: str = Depends(verify_admin_password),
):
    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT status FROM notifications_queue WHERE id=%s", (notification_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="NOTIFICATION_NOT_FOUND")
        status = row[0]
        if status not in {"FAILED", "DLQ"}:
            raise HTTPException(status_code=409, detail="NOTIFICATION_INVALID_STATE")

        cur.execute(
            """
            UPDATE notifications_queue
               SET status='PENDING',
                   scheduled_at=NOW()
             WHERE id=%s
            """,
            (notification_id,),
        )
        conn.commit()

        admin_user = request.client.host if request.client else "unknown"
        _log_admin_action(
            conn=conn,
            admin_user=admin_user,
            action="NOTIFY_RETRY",
            endpoint=f"/api/vault/admin/notifications/{notification_id}/retry",
            target_user_ids=[],
            request_id=None,
            request_body={"notification_id": notification_id},
            response_status="SUCCESS",
            response_summary={"status": "PENDING"},
            idempotency_key=None,
        )

    return AdminNotificationActionResponse(id=notification_id, status="PENDING")


@app.post("/api/vault/admin/notifications/{notification_id}/cancel", response_model=AdminNotificationActionResponse)
async def cancel_notification(
    notification_id: int,
    request: Request,
    _auth: str = Depends(verify_admin_password),
):
    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT status FROM notifications_queue WHERE id=%s", (notification_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="NOTIFICATION_NOT_FOUND")
        status = row[0]
        if status not in {"PENDING", "RETRYING"}:
            raise HTTPException(status_code=409, detail="NOTIFICATION_INVALID_STATE")

        cur.execute(
            """
            UPDATE notifications_queue
               SET status='CANCELED'
             WHERE id=%s
            """,
            (notification_id,),
        )
        conn.commit()

        admin_user = request.client.host if request.client else "unknown"
        _log_admin_action(
            conn=conn,
            admin_user=admin_user,
            action="NOTIFY_CANCEL",
            endpoint=f"/api/vault/admin/notifications/{notification_id}/cancel",
            target_user_ids=[],
            request_id=None,
            request_body={"notification_id": notification_id},
            response_status="SUCCESS",
            response_summary={"status": "CANCELED"},
            idempotency_key=None,
        )

    return AdminNotificationActionResponse(id=notification_id, status="CANCELED")


@app.post("/api/vault/admin/jobs", response_model=AdminJobResponse, status_code=202)
async def admin_create_job(
    body: AdminJobCreateRequest,
    request: Request,
    response: Response,
    _auth: str = Depends(verify_admin_password),
):
    job_type = (body.type or "").strip().upper()
    if job_type not in config.ALLOWED_ADMIN_JOB_TYPES:
        raise HTTPException(status_code=400, detail="INVALID_JOB_TYPE")

    key = _validate_idempotency_key(request.headers.get("x-idempotency-key"))
    scope = _idempotency_scope(request)
    endpoint = "/api/vault/admin/jobs"
    request_hash = _hash_request_body(body.dict())

    with db.get_conn() as conn:
        cur = conn.cursor()
        _apply_job_timeouts(cur)

        idem = _idempotency_start(cur, key=key, scope=scope, endpoint=endpoint, request_hash=request_hash)
        if idem["status"] == "replayed":
            response.headers["Idempotency-Status"] = "replayed"
            return AdminJobResponse(**idem["response_body"])
        if idem["status"] == "in_progress":
            raise HTTPException(status_code=409, detail="IDEMPOTENCY_IN_PROGRESS")

        target = body.target
        user_ids = _dedupe_int_list(list(target.user_ids) if target and target.user_ids else None, max_items=10000)
        external_user_ids = _dedupe_str_list(list(target.external_user_ids) if target and target.external_user_ids else None, max_items=10000)
        resolved_user_ids: list[int] = []
        if user_ids:
            resolved_user_ids.extend(user_ids)
        if external_user_ids:
            resolved_user_ids.extend(_resolve_user_ids_by_external_user_ids(cur, external_user_ids))
        resolved_user_ids = _dedupe_int_list(resolved_user_ids, max_items=10000)
        target_count = len(resolved_user_ids)

        job_id = _generate_job_id()
        payload: Dict[str, Any] = {
            "type": job_type,
            "target": target.dict(exclude_none=True) if target else {},
            "payload": body.payload or {},
            "dry_run": bool(body.dry_run),
        }

        cur.execute(
            """
            INSERT INTO admin_jobs
                (job_id, type, status, request_id, target_count, payload, created_at, updated_at)
            VALUES (%s, %s, 'PENDING', %s, %s, %s, NOW(), NOW())
            """,
            (job_id, job_type, key, target_count, Json(payload)),
        )

        if resolved_user_ids:
            execute_values(
                cur,
                """
                INSERT INTO admin_job_items (job_id, user_id, status)
                VALUES %s
                """,
                [(job_id, uid, "PENDING") for uid in resolved_user_ids],
                template="(%s,%s,%s)",
            )

        admin_user = request.client.host if request.client else "unknown"
        _log_admin_action(
            conn=conn,
            admin_user=admin_user,
            action="ADMIN_JOB_CREATE",
            endpoint=endpoint,
            target_user_ids=resolved_user_ids[:1000],
            request_id=key,
            request_body=payload,
            response_status="SUCCESS",
            response_summary={"job_id": job_id, "target_count": target_count},
            job_id=job_id,
            idempotency_key=key,
        )

        response_body = {
            "job_id": job_id,
            "type": job_type,
            "status": "PENDING",
            "request_id": key,
            "target_count": target_count,
        }
        _idempotency_finish(
            cur,
            key=key,
            scope=scope,
            endpoint=endpoint,
            response_status=202,
            response_body=response_body,
        )
        conn.commit()

    response.headers["Idempotency-Status"] = "recorded"
    return AdminJobResponse(**response_body)


@app.get("/api/vault/admin/jobs", response_model=AdminJobsListResponse)
async def list_admin_jobs(
    status: str | None = None,
    type: str | None = None,
    page: int = 1,
    page_size: int = 50,
    order: str = "desc",
    _auth: str = Depends(verify_admin_password),
):
    allowed_status = {"PENDING", "RUNNING", "DONE", "FAILED", "CANCELED"}
    if status and status not in allowed_status:
        raise HTTPException(status_code=400, detail="INVALID_STATUS")
    if type and type not in config.ALLOWED_ADMIN_JOB_TYPES:
        raise HTTPException(status_code=400, detail="INVALID_JOB_TYPE")

    page = 1 if page < 1 else page
    page_size = 1 if page_size < 1 else page_size
    page_size = 200 if page_size > 200 else page_size
    offset = (page - 1) * page_size
    order_sql = "DESC" if order.lower() != "asc" else "ASC"

    conditions: list[str] = []
    params: list = []
    if status:
        conditions.append("status=%s")
        params.append(status)
    if type:
        conditions.append("type=%s")
        params.append(type)

    where_sql = ""
    if conditions:
        where_sql = " WHERE " + " AND ".join(conditions)

    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT COUNT(*) FROM admin_jobs {where_sql}", tuple(params))
        total = int(cur.fetchone()[0])
        cur.execute(
            f"""
            SELECT job_id, type, status, request_id, target_count
              FROM admin_jobs
              {where_sql}
          ORDER BY created_at {order_sql}
             LIMIT %s OFFSET %s
            """,
            tuple(params + [page_size, offset]),
        )
        rows = cur.fetchall() or []

    items = [
        {
            "job_id": row[0],
            "type": row[1],
            "status": row[2],
            "request_id": row[3],
            "target_count": int(row[4] or 0),
        }
        for row in rows
    ]
    has_more = (offset + len(items)) < total
    return AdminJobsListResponse(total=total, page=page, page_size=page_size, has_more=has_more, items=items)


@app.get("/api/vault/admin/jobs/{job_id}", response_model=AdminJobDetailResponse)
async def get_admin_job(job_id: str, _auth: str = Depends(verify_admin_password)):
    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT job_id, type, status, request_id, target_count, processed, failed, payload, created_at, updated_at
              FROM admin_jobs
             WHERE job_id=%s
            """,
            (job_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="JOB_NOT_FOUND")

    return AdminJobDetailResponse(
        job_id=row[0],
        type=row[1],
        status=row[2],
        request_id=row[3],
        target_count=int(row[4] or 0),
        processed=int(row[5] or 0),
        failed=int(row[6] or 0),
        payload=row[7],
        created_at=row[8].isoformat() if row[8] else None,
        updated_at=row[9].isoformat() if row[9] else None,
    )


@app.get("/api/vault/admin/jobs/{job_id}/items", response_model=AdminJobItemsListResponse)
async def list_admin_job_items(
    job_id: str,
    format: str = "json",
    failed_only: bool = False,
    page: int = 1,
    page_size: int = 50,
    _auth: str = Depends(verify_admin_password),
):
    fmt = (format or "json").lower()
    if fmt not in {"json", "csv"}:
        raise HTTPException(status_code=400, detail="INVALID_FORMAT")

    page = 1 if page < 1 else page
    page_size = 1 if page_size < 1 else page_size
    page_size = 200 if page_size > 200 else page_size
    offset = (page - 1) * page_size

    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM admin_jobs WHERE job_id=%s", (job_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="JOB_NOT_FOUND")

        where_sql = "WHERE job_id=%s"
        params: list[Any] = [job_id]
        if failed_only:
            where_sql += " AND status='FAILED'"

        cur.execute(f"SELECT COUNT(*) FROM admin_job_items {where_sql}", tuple(params))
        total = int(cur.fetchone()[0])

        if fmt == "csv":
            cur.execute(
                f"""
                SELECT id, job_id, user_id, status, error_message, created_at
                  FROM admin_job_items
                 {where_sql}
              ORDER BY id ASC
                """,
                tuple(params),
            )
            rows = cur.fetchall() or []
        else:
            cur.execute(
                f"""
                SELECT id, job_id, user_id, status, error_message, created_at
                  FROM admin_job_items
                 {where_sql}
              ORDER BY id ASC
                 LIMIT %s OFFSET %s
                """,
                tuple(params + [page_size, offset]),
            )
            rows = cur.fetchall() or []

    if fmt == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["job_item_id", "job_id", "user_id", "status", "error_message", "created_at"])
        for row in rows:
            writer.writerow(
                [
                    row[0],
                    row[1],
                    int(row[2]),
                    row[3],
                    row[4] or "",
                    row[5].isoformat() if row[5] else "",
                ]
            )

        payload = buf.getvalue()
        filename = f"{job_id}-items{'-failed' if failed_only else ''}.csv"
        headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
        return StreamingResponse(iter([payload]), media_type="text/csv; charset=utf-8", headers=headers)

    items = [
        {
            "job_item_id": row[0],
            "job_id": row[1],
            "user_id": int(row[2]),
            "status": row[3],
            "error_message": row[4],
            "created_at": row[5].isoformat() if row[5] else None,
        }
        for row in rows
    ]
    has_more = (offset + len(items)) < total
    return AdminJobItemsListResponse(total=total, page=page, page_size=page_size, has_more=has_more, items=items)


@app.post("/api/vault/admin/jobs/{job_id}/retry", response_model=AdminJobDetailResponse)
async def retry_admin_job(job_id: str, request: Request, _auth: str = Depends(verify_admin_password)):
    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT status FROM admin_jobs WHERE job_id=%s", (job_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="JOB_NOT_FOUND")
        status = row[0]
        if status not in {"FAILED", "CANCELED"}:
            raise HTTPException(status_code=409, detail="JOB_INVALID_STATE")

        cur.execute(
            """
            UPDATE admin_jobs
               SET status='PENDING',
                   updated_at=NOW()
             WHERE job_id=%s
            """,
            (job_id,),
        )
        cur.execute(
            """
            UPDATE admin_job_items
               SET status='PENDING',
                   error_message=NULL
             WHERE job_id=%s AND status='FAILED'
            """,
            (job_id,),
        )

        admin_user = request.client.host if request.client else "unknown"
        _log_admin_action(
            conn=conn,
            admin_user=admin_user,
            action="ADMIN_JOB_RETRY",
            endpoint=f"/api/vault/admin/jobs/{job_id}/retry",
            target_user_ids=None,
            request_id=None,
            request_body={"job_id": job_id},
            response_status="SUCCESS",
            response_summary={"job_id": job_id, "status": "PENDING"},
            job_id=job_id,
        )
        conn.commit()

        cur.execute(
            """
            SELECT job_id, type, status, request_id, target_count, processed, failed, payload, created_at, updated_at
              FROM admin_jobs
             WHERE job_id=%s
            """,
            (job_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="JOB_NOT_FOUND")

    return AdminJobDetailResponse(
        job_id=row[0],
        type=row[1],
        status=row[2],
        request_id=row[3],
        target_count=int(row[4] or 0),
        processed=int(row[5] or 0),
        failed=int(row[6] or 0),
        payload=row[7],
        created_at=row[8].isoformat() if row[8] else None,
        updated_at=row[9].isoformat() if row[9] else None,
    )


@app.get("/api/vault/admin/audit-log", response_model=AdminAuditLogListResponse)
async def list_admin_audit_log(
    action: str | None = None,
    endpoint: str | None = None,
    request_id: str | None = None,
    job_id: str | None = None,
    idempotency_key: str | None = None,
    response_status: str | None = None,
    page: int = 1,
    page_size: int = 50,
    order: str = "desc",
    _auth: str = Depends(verify_admin_password),
):
    page = 1 if page < 1 else page
    page_size = 1 if page_size < 1 else page_size
    page_size = 200 if page_size > 200 else page_size
    offset = (page - 1) * page_size
    order_sql = "DESC" if order.lower() != "asc" else "ASC"

    conditions: list[str] = []
    params: list = []
    if action:
        conditions.append("action=%s")
        params.append(action)
    if endpoint:
        conditions.append("endpoint=%s")
        params.append(endpoint)
    if request_id:
        conditions.append("request_id=%s")
        params.append(request_id)
    if job_id:
        conditions.append("job_id=%s")
        params.append(job_id)
    if idempotency_key:
        conditions.append("idempotency_key=%s")
        params.append(idempotency_key)
    if response_status:
        conditions.append("response_status=%s")
        params.append(response_status)

    where_sql = ""
    if conditions:
        where_sql = " WHERE " + " AND ".join(conditions)

    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT COUNT(*) FROM admin_audit_log {where_sql}", tuple(params))
        total = int(cur.fetchone()[0])
        cur.execute(
            f"""
            SELECT id, admin_user, action, endpoint, target_count, request_id, response_status, error_message, job_id, idempotency_key, created_at
              FROM admin_audit_log
              {where_sql}
          ORDER BY created_at {order_sql}
             LIMIT %s OFFSET %s
            """,
            tuple(params + [page_size, offset]),
        )
        rows = cur.fetchall() or []

    items = [
        {
            "id": row[0],
            "admin_user": row[1],
            "action": row[2],
            "endpoint": row[3],
            "target_count": row[4],
            "request_id": row[5],
            "response_status": row[6],
            "error_message": row[7],
            "job_id": row[8],
            "idempotency_key": row[9],
            "created_at": row[10].isoformat() if row[10] else None,
        }
        for row in rows
    ]
    has_more = (offset + len(items)) < total
    return AdminAuditLogListResponse(total=total, page=page, page_size=page_size, has_more=has_more, items=items)


@app.get("/api/vault/admin/users")
async def get_all_users(
    query: str | None = None,
    status: str | None = None,
    sort_by: str | None = None,
    sort_dir: str | None = None,
    page: int = 1,
    page_size: int = 50,
    _auth: str = Depends(verify_admin_password),
):
    """회원 리스트 조회 (서버 페이징/정렬/필터).

    - query: external_user_id 또는 nickname 부분 일치
    - status: gold_status 기준 필터 (LOCKED/UNLOCKED/CLAIMED/EXPIRED)
    - sort_by: created_at/expires_at/deposit_total/external_user_id/nickname
    - sort_dir: asc|desc
    - page/page_size: 최대 200
    """

    if page < 1:
        page = 1
    page_size = max(1, min(page_size, 200))

    sort_by = (sort_by or "created_at").lower()
    sort_dir = (sort_dir or "desc").lower()
    sort_map = {
        "created_at": "ui.created_at",
        "expires_at": "vs.expires_at",
        "deposit_total": "uas.deposit_total",
        "external_user_id": "ui.external_user_id",
        "nickname": "uas.nickname",
    }
    order_col = sort_map.get(sort_by, "ui.created_at")
    order_dir = "ASC" if sort_dir == "asc" else "DESC"

    with db.get_conn() as conn:
        cur = conn.cursor()
        _apply_job_timeouts(cur)

        base_sql = [
            """
            FROM user_identity ui
            LEFT JOIN vault_status vs ON ui.user_id = vs.user_id
            INNER JOIN user_admin_snapshot uas ON ui.user_id = uas.user_id
            """
        ]
        where = []
        params = []
        if query:
            where.append("(ui.external_user_id ILIKE %s OR uas.nickname ILIKE %s)")
            like = f"%{query}%"
            params.extend([like, like])
        if status:
            where.append("COALESCE(vs.gold_status, 'LOCKED') = %s")
            params.append(status)
        if where:
            base_sql.append("WHERE " + " AND ".join(where))

        # total count
        cur.execute("SELECT COUNT(*) " + "\n".join(base_sql), params)
        total = cur.fetchone()[0]

        offset = (page - 1) * page_size
        cur.execute(
            """
            SELECT
                ui.user_id,
                ui.external_user_id,
                ui.created_at,
                vs.expires_at,
                vs.gold_status,
                vs.platinum_status,
                vs.diamond_status,
                vs.platinum_attendance_days,
                vs.platinum_deposit_done,
                vs.diamond_deposit_current,
                uas.review_ok,
                uas.deposit_total,
                uas.nickname,
                uas.telegram_ok,
                uas.joined_date
            """
            + "\n".join(base_sql)
            + f"\nORDER BY {order_col} {order_dir} NULLS LAST LIMIT %s OFFSET %s",
            params + [page_size, offset],
        )
        rows = cur.fetchall()

        from datetime import date
        today = date.today()

        users = []
        for row in rows:
            joined_date = row[14]
            max_attendance_days = 0
            if joined_date:
                days_since_join = (today - joined_date).days
                max_attendance_days = max(0, days_since_join)

            actual_attendance = row[7] or 0
            capped_attendance = min(actual_attendance, max_attendance_days) if joined_date else actual_attendance

            deposit_total = int(row[11] or 0)
            platinum_deposit_done = bool(row[8])
            diamond_deposit_current = int(row[9] or 0) or deposit_total

            users.append({
                "user_id": row[0],
                "external_user_id": row[1],
                "created_at": row[2].isoformat() if row[2] else None,
                "expires_at": row[3].isoformat() if row[3] else None,
                "gold_status": row[4] or "LOCKED",
                "platinum_status": row[5] or "LOCKED",
                "diamond_status": row[6] or "LOCKED",
                "platinum_attendance_days": capped_attendance,
                "max_attendance_days": max_attendance_days,
                "joined_date": joined_date.isoformat() if joined_date else None,
                "platinum_deposit_done": platinum_deposit_done,
                "diamond_deposit_current": diamond_deposit_current,
                "review_ok": row[10] or False,
                "deposit_total": deposit_total,
                "nickname": row[12] or "",
                "telegram_ok": row[13] or False,
            })

        return {"users": users, "total": total, "page": page, "page_size": page_size}


@app.get("/api/vault/admin/segments", response_model=AdminSegmentsListResponse)
async def list_admin_segments(_auth: str = Depends(verify_admin_password)):
    with db.get_conn() as conn:
        cur = conn.cursor()
        _apply_job_timeouts(cur)
        cur.execute(
            """
            SELECT segment_id, name, filters, created_at, updated_at
              FROM admin_segments
             ORDER BY updated_at DESC, created_at DESC
            """
        )
        rows = cur.fetchall()
        items = [
            {
                "segment_id": r[0],
                "name": r[1],
                "filters": r[2] or {},
                "created_at": r[3].isoformat() if r[3] else None,
                "updated_at": r[4].isoformat() if r[4] else None,
            }
            for r in rows
        ]
        return AdminSegmentsListResponse(items=[AdminSegmentItem(**i) for i in items])


@app.post("/api/vault/admin/segments", response_model=AdminSegmentItem)
async def upsert_admin_segment(body: AdminSegmentCreateRequest, request: Request, _auth: str = Depends(verify_admin_password)):
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="SEGMENT_NAME_REQUIRED")

    with db.get_conn() as conn:
        cur = conn.cursor()
        _apply_job_timeouts(cur)
        seg_id = str(uuid.uuid4())
        cur.execute(
            """
            INSERT INTO admin_segments (segment_id, name, filters)
            VALUES (%s, %s, %s)
            ON CONFLICT (name) DO UPDATE SET
                filters = EXCLUDED.filters,
                updated_at = NOW()
            RETURNING segment_id, name, filters, created_at, updated_at
            """,
            (seg_id, name, Json(body.filters.model_dump() if hasattr(body.filters, "model_dump") else body.filters.dict())),
        )
        row = cur.fetchone()

        admin_user = request.client.host if request.client else "unknown"
        _log_admin_action(
            conn=conn,
            admin_user=admin_user,
            action="SEGMENT_UPSERT",
            endpoint="/api/vault/admin/segments",
            target_user_ids=None,
            request_id=None,
            request_body={"name": name},
            response_status="SUCCESS",
            response_summary={"segment_id": row[0], "name": row[1]},
        )

        conn.commit()

    return AdminSegmentItem(
        segment_id=row[0],
        name=row[1],
        filters=row[2] or {},
        created_at=row[3].isoformat() if row[3] else None,
        updated_at=row[4].isoformat() if row[4] else None,
    )


@app.delete("/api/vault/admin/segments/{segment_id}")
async def delete_admin_segment(segment_id: str, request: Request, _auth: str = Depends(verify_admin_password)):
    segment_id = (segment_id or "").strip()
    if not segment_id:
        raise HTTPException(status_code=400, detail="SEGMENT_ID_REQUIRED")
    with db.get_conn() as conn:
        cur = conn.cursor()
        _apply_job_timeouts(cur)
        cur.execute("DELETE FROM admin_segments WHERE segment_id=%s", (segment_id,))
        deleted = cur.rowcount
        conn.commit()
    if deleted == 0:
        raise HTTPException(status_code=404, detail="SEGMENT_NOT_FOUND")

    admin_user = request.client.host if request.client else "unknown"
    with db.get_conn() as conn2:
        _log_admin_action(
            conn=conn2,
            admin_user=admin_user,
            action="SEGMENT_DELETE",
            endpoint="/api/vault/admin/segments",
            target_user_ids=None,
            request_id=None,
            request_body={"segment_id": segment_id},
            response_status="SUCCESS",
            response_summary={"deleted": True},
        )
        conn2.commit()
    return {"deleted": True}


@app.post("/api/vault/admin/operations/extend-expiry", response_model=ExtendExpiryResponse)
async def admin_extend_expiry(body: AdminExtendExpiryRequest, request: Request, response: Response, _auth: str = Depends(verify_admin_password)):
    request_id = _validate_request_id(getattr(body, "request_id", None))
    if body.reason not in {"OPS", "PROMO", "ADMIN"}:
        raise HTTPException(status_code=400, detail="INVALID_REASON")
    if not (1 <= body.extend_hours <= 72):
        raise HTTPException(status_code=400, detail="INVALID_EXTEND_HOURS")

    key = _validate_idempotency_key(request_id)
    scope = _idempotency_scope(request)
    endpoint = "/api/vault/admin/operations/extend-expiry"
    request_hash = _hash_request_body(body.model_dump() if hasattr(body, "model_dump") else body.dict())

    target_mode = (body.target.mode or "").lower()
    target_dict: dict = {"mode": target_mode}
    user_ids = _dedupe_int_list(list(body.target.user_ids) if body.target.user_ids else None, max_items=10000)
    if target_mode == "user_ids":
        if not user_ids:
            raise HTTPException(status_code=400, detail="USER_IDS_REQUIRED")
    elif target_mode == "filter":
        target_dict["filter"] = body.target.filter.model_dump() if body.target.filter else {}
    elif target_mode == "segment":
        seg_id = (body.target.segment_id or "").strip()
        if not seg_id:
            raise HTTPException(status_code=400, detail="SEGMENT_ID_REQUIRED")
        target_dict["segment_id"] = seg_id
    else:
        raise HTTPException(status_code=400, detail="INVALID_TARGET_MODE")

    with db.get_conn() as conn:
        cur = conn.cursor()
        _apply_job_timeouts(cur)
        now = _now()

        idem = _idempotency_start(cur, key=key, scope=scope, endpoint=endpoint, request_hash=request_hash)
        if idem["status"] == "replayed":
            response.headers["Idempotency-Status"] = "replayed"
            return ExtendExpiryResponse(**idem["response_body"])
        if idem["status"] == "in_progress":
            raise HTTPException(status_code=409, detail="IDEMPOTENCY_IN_PROGRESS")

        rows: list[tuple[int, datetime]] = []
        resolved_meta: dict[str, Any] = {"mode": target_mode}
        if target_mode == "user_ids":
            cur.execute(
                """
                SELECT user_id, expires_at
                  FROM vault_status
                 WHERE user_id = ANY(%s)
                   AND (gold_status!='CLAIMED' OR platinum_status!='CLAIMED' OR diamond_status!='CLAIMED')
                """,
                (user_ids,),
            )
            rows = cur.fetchall()
            resolved_meta["user_ids_count"] = len(user_ids)
        else:
            if target_mode == "segment":
                cur.execute("SELECT name, filters FROM admin_segments WHERE segment_id=%s", (target_dict["segment_id"],))
                seg_row = cur.fetchone()
                if not seg_row:
                    raise HTTPException(status_code=404, detail="SEGMENT_NOT_FOUND")
                target_dict["segment_filters"] = seg_row[1] or {}
                resolved_meta["segment_name"] = seg_row[0]

            where_sql, params = _build_user_target_sql(target_dict)
            cur.execute(
                """
                SELECT vs.user_id, vs.expires_at
                  FROM vault_status vs
                  JOIN user_identity ui ON ui.user_id = vs.user_id
                  JOIN user_admin_snapshot uas ON uas.user_id = vs.user_id
                 WHERE """
                + where_sql,
                tuple(params),
            )
            rows = cur.fetchall()
            resolved_meta["candidates"] = len(rows)

        if body.shadow:
            sample_ids = [r[0] for r in rows[:10]]
            response_body = {"shadow": True, "candidates": len(rows), "sample_user_ids": sample_ids}
            _idempotency_finish(
                cur,
                key=key,
                scope=scope,
                endpoint=endpoint,
                response_status=200,
                response_body=response_body,
            )
            conn.commit()
            response.headers["Idempotency-Status"] = "recorded"
            return ExtendExpiryResponse(**response_body)

        if not rows:
            response_body = {"shadow": False, "updated": 0, "new_expires_at": None}
            _idempotency_finish(
                cur,
                key=key,
                scope=scope,
                endpoint=endpoint,
                response_status=200,
                response_body=response_body,
            )
            conn.commit()
            response.headers["Idempotency-Status"] = "recorded"
            return ExtendExpiryResponse(**response_body)

        update_values = []
        log_values = []
        new_expires_at = None
        for user_id, expires_at in rows:
            new_expires = expires_at + timedelta(hours=body.extend_hours)
            new_expires_at = new_expires
            update_values.append((user_id, new_expires, body.reason, now))
            log_values.append(
                (
                    user_id,
                    expires_at,
                    new_expires,
                    body.reason,
                    f"{request_id}:{user_id}",
                    Json(
                        {
                            "base_request_id": request_id,
                            "target": resolved_meta,
                            "extend_hours": body.extend_hours,
                        }
                    ),
                )
            )

        execute_values(
            cur,
            """
            UPDATE vault_status AS vs
               SET expires_at=data.new_expires_at,
                   expiry_extend_count=vs.expiry_extend_count+1,
                   last_extension_reason=data.reason,
                   last_extension_at=data.now
              FROM (VALUES %s) AS data(user_id, new_expires_at, reason, now)
             WHERE vs.user_id = data.user_id
            """,
            update_values,
            template="(%s,%s,%s,%s)",
        )

        execute_values(
            cur,
            """
            INSERT INTO vault_expiry_extension_log
                (user_id, prev_expires_at, new_expires_at, reason, request_id, shadow, metadata)
            VALUES %s
            ON CONFLICT (request_id) DO NOTHING
            """,
            log_values,
            template="(%s,%s,%s,%s,%s,false,%s)",
        )

        updated = len(update_values)

        admin_user = request.client.host if request.client else "unknown"
        _log_admin_action(
            conn=conn,
            admin_user=admin_user,
            action="EXTEND_EXPIRY",
            endpoint=endpoint,
            target_user_ids=[r[0] for r in rows[:1000]],
            request_id=key,
            request_body={
                "target": resolved_meta,
                "extend_hours": body.extend_hours,
                "reason": body.reason,
                "shadow": body.shadow,
            },
            response_status="SUCCESS",
            response_summary={"updated": updated, "new_expires_at": new_expires_at.isoformat() if new_expires_at else None},
            idempotency_key=key,
        )

        response_body = {
            "shadow": False,
            "updated": updated,
            "new_expires_at": new_expires_at.isoformat() if new_expires_at else None,
        }
        _idempotency_finish(
            cur,
            key=key,
            scope=scope,
            endpoint=endpoint,
            response_status=200,
            response_body=response_body,
        )
        conn.commit()
        response.headers["Idempotency-Status"] = "recorded"
        return ExtendExpiryResponse(**response_body)


@app.post("/api/vault/admin/targets/preview", response_model=AdminTargetPreviewResponse)
async def admin_targets_preview(body: AdminTargetPreviewRequest, _auth: str = Depends(verify_admin_password)):
    """Resolve IDs/filter/segment targets and return exact candidate count + sample user IDs.

    Intended for UI impact preview.
    """

    target_mode = (body.target.mode or "").lower()
    target_dict: dict = {"mode": target_mode}
    user_ids = _dedupe_int_list(list(body.target.user_ids) if body.target.user_ids else None, max_items=10000)

    if target_mode == "user_ids":
        if not user_ids:
            raise HTTPException(status_code=400, detail="USER_IDS_REQUIRED")
    elif target_mode == "filter":
        target_dict["filter"] = body.target.filter.model_dump() if body.target.filter else {}
    elif target_mode == "segment":
        seg_id = (body.target.segment_id or "").strip()
        if not seg_id:
            raise HTTPException(status_code=400, detail="SEGMENT_ID_REQUIRED")
        target_dict["segment_id"] = seg_id
    else:
        raise HTTPException(status_code=400, detail="INVALID_TARGET_MODE")

    with db.get_conn() as conn:
        cur = conn.cursor()
        _apply_job_timeouts(cur)

        if target_mode == "user_ids":
            cur.execute(
                """
                SELECT COUNT(*)
                  FROM vault_status
                 WHERE user_id = ANY(%s)
                   AND (gold_status!='CLAIMED' OR platinum_status!='CLAIMED' OR diamond_status!='CLAIMED')
                """,
                (user_ids,),
            )
            total = int(cur.fetchone()[0] or 0)

            cur.execute(
                """
                SELECT user_id
                  FROM vault_status
                 WHERE user_id = ANY(%s)
                   AND (gold_status!='CLAIMED' OR platinum_status!='CLAIMED' OR diamond_status!='CLAIMED')
                 ORDER BY user_id
                 LIMIT 10
                """,
                (user_ids,),
            )
            sample_ids = [int(r[0]) for r in (cur.fetchall() or [])]
            return AdminTargetPreviewResponse(candidates=total, sample_user_ids=sample_ids)

        if target_mode == "segment":
            cur.execute("SELECT filters FROM admin_segments WHERE segment_id=%s", (target_dict["segment_id"],))
            seg_row = cur.fetchone()
            if not seg_row:
                raise HTTPException(status_code=404, detail="SEGMENT_NOT_FOUND")
            target_dict["segment_filters"] = seg_row[0] or {}

        where_sql, params = _build_user_target_sql(target_dict)

        cur.execute(
            """
            SELECT COUNT(*)
              FROM vault_status vs
              JOIN user_identity ui ON ui.user_id = vs.user_id
              JOIN user_admin_snapshot uas ON uas.user_id = vs.user_id
             WHERE """
            + where_sql,
            tuple(params),
        )
        total = int(cur.fetchone()[0] or 0)

        cur.execute(
            """
            SELECT vs.user_id
              FROM vault_status vs
              JOIN user_identity ui ON ui.user_id = vs.user_id
              JOIN user_admin_snapshot uas ON uas.user_id = vs.user_id
             WHERE """
            + where_sql
            + "\n ORDER BY vs.user_id LIMIT 10",
            tuple(params),
        )
        sample_ids = [int(r[0]) for r in (cur.fetchall() or [])]
        return AdminTargetPreviewResponse(candidates=total, sample_user_ids=sample_ids)


@app.post("/api/vault/admin/operations/bulk-update", response_model=AdminBulkUpdateResponse, status_code=202)
async def admin_bulk_update(body: AdminBulkUpdateRequest, request: Request, response: Response, _auth: str = Depends(verify_admin_password)):
    """Bulk apply status/attendance/deposit updates for IDs/filter/segment targets.

    This runs synchronously (no worker) but records results into admin_jobs/admin_job_items.
    """

    request_id = _validate_request_id(getattr(body, "request_id", None))

    has_status = body.status is not None and any(
        getattr(body.status, k) is not None for k in ("gold_status", "platinum_status", "diamond_status")
    )
    has_attendance = body.attendance is not None and (body.attendance.delta_days is not None or body.attendance.set_days is not None)
    has_deposit = body.deposit is not None and (body.deposit.platinum_deposit_done is not None or body.deposit.diamond_deposit_current is not None)
    if not (has_status or has_attendance or has_deposit):
        raise HTTPException(status_code=400, detail="NO_FIELDS")

    key = _validate_idempotency_key(request_id)
    scope = _idempotency_scope(request)
    endpoint = "/api/vault/admin/operations/bulk-update"
    request_hash = _hash_request_body(body.model_dump() if hasattr(body, "model_dump") else body.dict())

    target_mode = (body.target.mode or "").lower()
    target_dict: dict = {"mode": target_mode}
    user_ids = _dedupe_int_list(list(body.target.user_ids) if body.target.user_ids else None, max_items=10000)

    if target_mode == "user_ids":
        if not user_ids:
            raise HTTPException(status_code=400, detail="USER_IDS_REQUIRED")
    elif target_mode == "filter":
        target_dict["filter"] = body.target.filter.model_dump() if body.target.filter else {}
    elif target_mode == "segment":
        seg_id = (body.target.segment_id or "").strip()
        if not seg_id:
            raise HTTPException(status_code=400, detail="SEGMENT_ID_REQUIRED")
        target_dict["segment_id"] = seg_id
    else:
        raise HTTPException(status_code=400, detail="INVALID_TARGET_MODE")

    def _apply_updates_for_user(cur, user_id: int, now: datetime):
        cur.execute("SELECT review_ok FROM user_admin_snapshot WHERE user_id=%s", (user_id,))
        snap_row = cur.fetchone()
        review_ok = bool(snap_row[0]) if snap_row and snap_row[0] is not None else False

        row = _get_or_create_vault_row(cur, user_id, now)
        if not row:
            raise HTTPException(status_code=404, detail="VAULT_NOT_FOUND")

        expires_at, gold_status, platinum_status, diamond_status, attendance_days, platinum_deposit_done, diamond_deposit_current = row
        current = {
            "gold_status": gold_status,
            "platinum_status": platinum_status,
            "diamond_status": diamond_status,
        }

        new_attendance_days = int(attendance_days or 0)
        new_platinum_deposit_done = bool(platinum_deposit_done)
        new_diamond_deposit_current = int(diamond_deposit_current or 0)
        new_platinum_status = platinum_status
        new_diamond_status = diamond_status

        if has_attendance:
            if body.attendance.set_days is not None:
                new_attendance_days = _clamp_attendance_days(int(body.attendance.set_days))
            else:
                new_attendance_days = _clamp_attendance_days(int(attendance_days or 0) + int(body.attendance.delta_days or 0))

        if has_deposit:
            if body.deposit.platinum_deposit_done is not None:
                new_platinum_deposit_done = bool(body.deposit.platinum_deposit_done)
            if body.deposit.diamond_deposit_current is not None:
                new_diamond_deposit_current = int(body.deposit.diamond_deposit_current)

        # Recompute unlock statuses from attendance/deposit where applicable.
        if has_attendance or has_deposit:
            if new_platinum_status not in {"CLAIMED", "EXPIRED"}:
                if new_attendance_days >= 3 and new_platinum_deposit_done and review_ok:
                    new_platinum_status = "UNLOCKED"
            if new_diamond_status not in {"CLAIMED", "EXPIRED"}:
                if new_diamond_deposit_current >= 500000:
                    new_diamond_status = "UNLOCKED"

        # Apply explicit status overrides last.
        explicit_updates: dict[str, str] = {}
        if has_status:
            if body.status.gold_status is not None:
                explicit_updates["gold_status"] = _validate_status(body.status.gold_status, "gold_status")
            if body.status.platinum_status is not None:
                explicit_updates["platinum_status"] = _validate_status(body.status.platinum_status, "platinum_status")
            if body.status.diamond_status is not None:
                explicit_updates["diamond_status"] = _validate_status(body.status.diamond_status, "diamond_status")

        # CLAIMED은 되돌리지 않음 (per single-user behavior)
        for col, new_val in explicit_updates.items():
            if current.get(col) == "CLAIMED" and new_val != "CLAIMED":
                raise HTTPException(status_code=409, detail="CANNOT_MODIFY_CLAIMED")

        new_gold_status = explicit_updates.get("gold_status", gold_status)
        new_platinum_status = explicit_updates.get("platinum_status", new_platinum_status)
        new_diamond_status = explicit_updates.get("diamond_status", new_diamond_status)

        # Update vault_status row.
        set_cols: list[str] = [
            "gold_status=%s",
            "platinum_status=%s",
            "diamond_status=%s",
        ]
        params: list[Any] = [new_gold_status, new_platinum_status, new_diamond_status]

        if has_attendance:
            set_cols.extend(["platinum_attendance_days=%s", "last_attended_at=%s"])
            params.extend([new_attendance_days, now])
        if has_deposit:
            set_cols.extend(["platinum_deposit_done=%s", "diamond_deposit_current=%s"])
            params.extend([new_platinum_deposit_done, new_diamond_deposit_current])

        set_cols.append("updated_at=%s")
        params.append(now)
        params.append(user_id)

        cur.execute(
            f"""
            UPDATE vault_status
               SET {', '.join(set_cols)}
             WHERE user_id=%s
            """,
            params,
        )

        return {
            "expires_at": expires_at.isoformat() if expires_at else None,
            "gold_status": new_gold_status,
            "platinum_status": new_platinum_status,
            "diamond_status": new_diamond_status,
        }

    with db.get_conn() as conn:
        cur = conn.cursor()
        _apply_job_timeouts(cur)
        now = _now()

        idem = _idempotency_start(cur, key=key, scope=scope, endpoint=endpoint, request_hash=request_hash)
        if idem["status"] == "replayed":
            response.headers["Idempotency-Status"] = "replayed"
            return AdminBulkUpdateResponse(**idem["response_body"])
        if idem["status"] == "in_progress":
            raise HTTPException(status_code=409, detail="IDEMPOTENCY_IN_PROGRESS")

        resolved_user_ids: list[int] = []
        resolved_meta: dict[str, Any] = {"mode": target_mode}
        if target_mode == "user_ids":
            resolved_user_ids = user_ids
            resolved_meta["user_ids_count"] = len(user_ids)
        else:
            if target_mode == "segment":
                cur.execute("SELECT name, filters FROM admin_segments WHERE segment_id=%s", (target_dict["segment_id"],))
                seg_row = cur.fetchone()
                if not seg_row:
                    raise HTTPException(status_code=404, detail="SEGMENT_NOT_FOUND")
                target_dict["segment_filters"] = seg_row[1] or {}
                resolved_meta["segment_name"] = seg_row[0]

            where_sql, params = _build_user_target_sql(target_dict)
            cur.execute(
                """
                SELECT vs.user_id
                  FROM vault_status vs
                  JOIN user_identity ui ON ui.user_id = vs.user_id
                  JOIN user_admin_snapshot uas ON uas.user_id = vs.user_id
                 WHERE """
                + where_sql,
                tuple(params),
            )
            resolved_user_ids = [int(r[0]) for r in (cur.fetchall() or [])]
            resolved_meta["candidates"] = len(resolved_user_ids)

        resolved_user_ids = _dedupe_int_list(resolved_user_ids, max_items=10000)
        target_count = len(resolved_user_ids)

        job_id = _generate_job_id()
        payload: Dict[str, Any] = {
            "type": "BULK_UPDATE",
            "target": body.target.model_dump(exclude_none=True) if hasattr(body.target, "model_dump") else body.target.dict(exclude_none=True),
            "resolved": resolved_meta,
            "status": body.status.model_dump(exclude_none=True) if body.status and hasattr(body.status, "model_dump") else (body.status.dict(exclude_none=True) if body.status else None),
            "attendance": body.attendance.model_dump(exclude_none=True) if body.attendance and hasattr(body.attendance, "model_dump") else (body.attendance.dict(exclude_none=True) if body.attendance else None),
            "deposit": body.deposit.model_dump(exclude_none=True) if body.deposit and hasattr(body.deposit, "model_dump") else (body.deposit.dict(exclude_none=True) if body.deposit else None),
        }

        cur.execute(
            """
            INSERT INTO admin_jobs
                (job_id, type, status, request_id, target_count, processed, failed, payload, created_at, updated_at)
            VALUES (%s, %s, 'RUNNING', %s, %s, 0, 0, %s, NOW(), NOW())
            """,
            (job_id, "BULK_UPDATE", key, target_count, Json(payload)),
        )

        if resolved_user_ids:
            execute_values(
                cur,
                """
                INSERT INTO admin_job_items (job_id, user_id, status)
                VALUES %s
                """,
                [(job_id, uid, "PENDING") for uid in resolved_user_ids],
                template="(%s,%s,%s)",
            )

        processed = 0
        failed = 0
        for uid in resolved_user_ids:
            processed += 1
            try:
                _apply_updates_for_user(cur, uid, now)
                cur.execute(
                    """
                    UPDATE admin_job_items
                       SET status='DONE',
                           error_message=NULL
                     WHERE job_id=%s AND user_id=%s
                    """,
                    (job_id, uid),
                )
            except HTTPException as e:
                failed += 1
                msg = str(getattr(e, "detail", None) or "ERROR")
                cur.execute(
                    """
                    UPDATE admin_job_items
                       SET status='FAILED',
                           error_message=%s
                     WHERE job_id=%s AND user_id=%s
                    """,
                    (msg[:500], job_id, uid),
                )
            except Exception as e:
                failed += 1
                msg = str(e) or "ERROR"
                cur.execute(
                    """
                    UPDATE admin_job_items
                       SET status='FAILED',
                           error_message=%s
                     WHERE job_id=%s AND user_id=%s
                    """,
                    (msg[:500], job_id, uid),
                )

        final_status = "DONE" if failed == 0 else "FAILED"
        cur.execute(
            """
            UPDATE admin_jobs
               SET status=%s,
                   processed=%s,
                   failed=%s,
                   updated_at=NOW()
             WHERE job_id=%s
            """,
            (final_status, processed, failed, job_id),
        )

        admin_user = request.client.host if request.client else "unknown"
        _log_admin_action(
            conn=conn,
            admin_user=admin_user,
            action="ADMIN_BULK_UPDATE",
            endpoint=endpoint,
            target_user_ids=resolved_user_ids[:1000],
            request_id=request_id,
            request_body=payload,
            response_status="SUCCESS" if failed == 0 else "PARTIAL_FAILURE",
            response_summary={"job_id": job_id, "target_count": target_count, "processed": processed, "failed": failed},
            job_id=job_id,
            idempotency_key=key,
        )

        response_body = {
            "job_id": job_id,
            "status": final_status,
            "request_id": key,
            "target_count": target_count,
            "processed": processed,
            "failed": failed,
        }
        _idempotency_finish(
            cur,
            key=key,
            scope=scope,
            endpoint=endpoint,
            response_status=202,
            response_body=response_body,
        )
        conn.commit()

    response.headers["Idempotency-Status"] = "recorded"
    return AdminBulkUpdateResponse(**response_body)


@app.post("/api/vault/admin/users", response_model=AdminUserResponse)
async def admin_create_user(body: AdminUserCreateRequest, request: Request, response: Response, _auth: str = Depends(verify_admin_password)):
    ext = _normalize_external_user_id(body.external_user_id)
    if not ext:
        raise HTTPException(status_code=400, detail="EXTERNAL_USER_ID_REQUIRED")

    joined_date = _parse_joined_date(body.joined_date)
    nickname = (body.nickname or "").strip() or None
    deposit_total = int(body.deposit_total or 0)
    telegram_ok = bool(body.telegram_ok)
    review_ok = bool(body.review_ok)

    key = _validate_idempotency_key(request.headers.get("x-idempotency-key"))
    scope = _idempotency_scope(request)
    endpoint = "/api/vault/admin/users"
    request_hash = _hash_request_body(body.dict())

    now = _now()
    with db.get_conn() as conn:
        cur = conn.cursor()
        idem = _idempotency_start(cur, key=key, scope=scope, endpoint=endpoint, request_hash=request_hash)
        if idem["status"] == "replayed":
            response.headers["Idempotency-Status"] = "replayed"
            return AdminUserResponse(**idem["response_body"])
        if idem["status"] == "in_progress":
            raise HTTPException(status_code=409, detail="IDEMPOTENCY_IN_PROGRESS")
        try:
            cur.execute(
                """
                INSERT INTO user_identity (external_user_id, created_at)
                VALUES (%s, %s)
                ON CONFLICT (external_user_id) DO NOTHING
                RETURNING user_id, created_at
                """,
                (ext, now),
            )
            row = cur.fetchone()
            if not row:
                cur.execute(
                    "SELECT user_id, created_at FROM user_identity WHERE external_user_id=%s",
                    (ext,),
                )
                row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=500, detail="USER_CREATE_FAILED")

            user_id, created_at = int(row[0]), row[1]

            cur.execute(
                """
                INSERT INTO user_admin_snapshot (user_id, nickname, joined_date, deposit_total, telegram_ok, review_ok)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (user_id) DO UPDATE SET
                    nickname = EXCLUDED.nickname,
                    joined_date = EXCLUDED.joined_date,
                    deposit_total = EXCLUDED.deposit_total,
                    telegram_ok = EXCLUDED.telegram_ok,
                    review_ok = EXCLUDED.review_ok,
                    updated_at = NOW()
                """,
                (user_id, nickname, joined_date, deposit_total, telegram_ok, review_ok),
            )

            cur.execute(
                """
                INSERT INTO vault_status (user_id, expires_at, gold_status, platinum_status, diamond_status)
                VALUES (%s, %s, %s, 'LOCKED', 'LOCKED')
                ON CONFLICT (user_id) DO NOTHING
                """,
                (user_id, now + timedelta(hours=72), ("UNLOCKED" if telegram_ok else "LOCKED")),
            )

            admin_user = request.client.host if request.client else "unknown"
            _log_admin_action(
                conn=conn,
                admin_user=admin_user,
                action="ADMIN_USER_CREATE",
                endpoint="/api/vault/admin/users",
                target_user_ids=[user_id],
                request_id=key,
                request_body={
                    "external_user_id": ext,
                    "nickname": nickname,
                    "joined_date": body.joined_date,
                    "deposit_total": deposit_total,
                    "telegram_ok": telegram_ok,
                    "review_ok": review_ok,
                },
                response_status="SUCCESS",
                response_summary={"created": True},
                idempotency_key=key,
            )

            cur.execute(
                "SELECT expires_at FROM vault_status WHERE user_id=%s",
                (user_id,),
            )
            vs_row = cur.fetchone()
            expires_at = vs_row[0] if vs_row else None

            response_body = {
                "user_id": user_id,
                "external_user_id": ext,
                "nickname": nickname,
                "joined_date": joined_date.isoformat() if joined_date else None,
                "created_at": created_at.isoformat() if created_at else None,
                "expires_at": expires_at.isoformat() if expires_at else None,
                "deposit_total": deposit_total,
                "telegram_ok": telegram_ok,
                "review_ok": review_ok,
            }

            _idempotency_finish(
                cur,
                key=key,
                scope=scope,
                endpoint=endpoint,
                response_status=200,
                response_body=response_body,
            )

            conn.commit()
            response.headers["Idempotency-Status"] = "recorded"
            return AdminUserResponse(**response_body)
        except HTTPException:
            conn.rollback()
            raise
        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail="ADMIN_USER_CREATE_ERROR") from e


@app.patch("/api/vault/admin/users/{user_id}", response_model=AdminUserResponse)
async def admin_update_user(user_id: int, body: AdminUserUpdateRequest, request: Request, response: Response, _auth: str = Depends(verify_admin_password)):
    if all(
        getattr(body, field) is None
        for field in ("nickname", "joined_date", "deposit_total", "telegram_ok", "review_ok")
    ):
        raise HTTPException(status_code=400, detail="NO_FIELDS")

    nickname = None if body.nickname is None else (body.nickname or "").strip() or None
    joined_date = _parse_joined_date(body.joined_date) if body.joined_date is not None else None
    deposit_total = None if body.deposit_total is None else int(body.deposit_total)
    telegram_ok = None if body.telegram_ok is None else bool(body.telegram_ok)
    review_ok = None if body.review_ok is None else bool(body.review_ok)

    now = _now()
    key = _validate_idempotency_key(request.headers.get("x-idempotency-key"))
    scope = _idempotency_scope(request)
    endpoint = f"/api/vault/admin/users/{user_id}"
    request_hash = _hash_request_body({"user_id": user_id, **body.dict()})

    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT external_user_id, created_at FROM user_identity WHERE user_id=%s", (user_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="USER_NOT_FOUND")
        external_user_id, created_at = row[0], row[1]

        idem = _idempotency_start(cur, key=key, scope=scope, endpoint=endpoint, request_hash=request_hash)
        if idem["status"] == "replayed":
            response.headers["Idempotency-Status"] = "replayed"
            return AdminUserResponse(**idem["response_body"])
        if idem["status"] == "in_progress":
            raise HTTPException(status_code=409, detail="IDEMPOTENCY_IN_PROGRESS")

        set_parts = []
        params = []
        if nickname is not None:
            set_parts.append("nickname=%s")
            params.append(nickname)
        if joined_date is not None:
            set_parts.append("joined_date=%s")
            params.append(joined_date)
        if deposit_total is not None:
            set_parts.append("deposit_total=%s")
            params.append(deposit_total)
        if telegram_ok is not None:
            set_parts.append("telegram_ok=%s")
            params.append(telegram_ok)
        if review_ok is not None:
            set_parts.append("review_ok=%s")
            params.append(review_ok)
        set_parts.append("updated_at=%s")
        params.append(now)
        params.append(user_id)

        cur.execute(
            f"""
            UPDATE user_admin_snapshot
               SET {', '.join(set_parts)}
             WHERE user_id=%s
            """,
            params,
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="SNAPSHOT_NOT_FOUND")

        if telegram_ok is not None:
            row = _get_or_create_vault_row(cur, user_id, now)
            if row:
                _expires_at, gold_status, *_rest = row
                if gold_status != "CLAIMED":
                    new_gold_status = "UNLOCKED" if telegram_ok else "LOCKED"
                    cur.execute(
                        """
                        UPDATE vault_status
                           SET gold_status=%s,
                               updated_at=%s
                         WHERE user_id=%s
                        """,
                        (new_gold_status, now, user_id),
                    )

        admin_user = request.client.host if request.client else "unknown"
        _log_admin_action(
            conn=conn,
            admin_user=admin_user,
            action="ADMIN_USER_UPDATE",
            endpoint=f"/api/vault/admin/users/{user_id}",
            target_user_ids=[user_id],
            request_id=key,
            request_body=body.dict(),
            response_status="SUCCESS",
            response_summary={"updated": True},
            idempotency_key=key,
        )

        cur.execute(
            """
            SELECT nickname, joined_date, deposit_total, telegram_ok, review_ok
              FROM user_admin_snapshot
             WHERE user_id=%s
            """,
            (user_id,),
        )
        snap = cur.fetchone()

        cur.execute(
            "SELECT expires_at FROM vault_status WHERE user_id=%s",
            (user_id,),
        )
        vs_row = cur.fetchone()
        expires_at = vs_row[0] if vs_row else None

        response_body = {
            "user_id": user_id,
            "external_user_id": external_user_id,
            "nickname": snap[0] if snap else nickname,
            "joined_date": snap[1].isoformat() if snap and snap[1] else (joined_date.isoformat() if joined_date else None),
            "created_at": created_at.isoformat() if created_at else None,
            "expires_at": expires_at.isoformat() if expires_at else None,
            "deposit_total": snap[2] if snap else (deposit_total or 0),
            "telegram_ok": snap[3] if snap else (telegram_ok or False),
            "review_ok": snap[4] if snap else (review_ok or False),
        }

        _idempotency_finish(
            cur,
            key=key,
            scope=scope,
            endpoint=endpoint,
            response_status=200,
            response_body=response_body,
        )

        conn.commit()

        response.headers["Idempotency-Status"] = "recorded"
        return AdminUserResponse(**response_body)


@app.delete("/api/vault/admin/users/{user_id}")
async def admin_delete_user(user_id: int, request: Request, response: Response, _auth: str = Depends(verify_admin_password)):
    key = _validate_idempotency_key(request.headers.get("x-idempotency-key"))
    scope = _idempotency_scope(request)
    endpoint = f"/api/vault/admin/users/{user_id}"
    request_hash = _hash_request_body({"user_id": user_id})

    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT external_user_id FROM user_identity WHERE user_id=%s", (user_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="USER_NOT_FOUND")
        external_user_id = row[0]

        idem = _idempotency_start(cur, key=key, scope=scope, endpoint=endpoint, request_hash=request_hash)
        if idem["status"] == "replayed":
            response.headers["Idempotency-Status"] = "replayed"
            return idem["response_body"]
        if idem["status"] == "in_progress":
            raise HTTPException(status_code=409, detail="IDEMPOTENCY_IN_PROGRESS")

        cur.execute("DELETE FROM vault_status WHERE user_id=%s", (user_id,))
        cur.execute("DELETE FROM user_admin_snapshot WHERE user_id=%s", (user_id,))
        cur.execute("DELETE FROM user_identity WHERE user_id=%s", (user_id,))

        admin_user = request.client.host if request.client else "unknown"
        _log_admin_action(
            conn=conn,
            admin_user=admin_user,
            action="ADMIN_USER_DELETE",
            endpoint=f"/api/vault/admin/users/{user_id}",
            target_user_ids=[user_id],
            request_id=key,
            request_body={"user_id": user_id, "external_user_id": external_user_id},
            response_status="SUCCESS",
            response_summary={"deleted": True},
            idempotency_key=key,
        )

        response_body = {"deleted": True, "user_id": user_id, "external_user_id": external_user_id}
        _idempotency_finish(
            cur,
            key=key,
            scope=scope,
            endpoint=endpoint,
            response_status=200,
            response_body=response_body,
        )

        conn.commit()
        response.headers["Idempotency-Status"] = "recorded"
        return response_body


@app.post("/api/vault/admin/users/{user_id}/vault/status", response_model=AdminStatusUpdateResponse)
async def admin_update_vault_status(user_id: int, body: AdminStatusUpdateRequest, request: Request, response: Response, _auth: str = Depends(verify_admin_password)):
    now = _now()
    updates = {}
    if body.gold_status is not None:
        updates["gold_status"] = _validate_status(body.gold_status, "gold_status")
    if body.platinum_status is not None:
        updates["platinum_status"] = _validate_status(body.platinum_status, "platinum_status")
    if body.diamond_status is not None:
        updates["diamond_status"] = _validate_status(body.diamond_status, "diamond_status")
    if not updates:
        raise HTTPException(status_code=400, detail="NO_FIELDS")

    key = _validate_idempotency_key(request.headers.get("x-idempotency-key"))
    scope = _idempotency_scope(request)
    endpoint = f"/api/vault/admin/users/{user_id}/vault/status"
    request_hash = _hash_request_body({"user_id": user_id, **body.dict()})

    with db.get_conn() as conn:
        cur = conn.cursor()
        _apply_job_timeouts(cur)

        cur.execute("SELECT 1 FROM user_identity WHERE user_id=%s", (user_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="USER_NOT_FOUND")

        idem = _idempotency_start(cur, key=key, scope=scope, endpoint=endpoint, request_hash=request_hash)
        if idem["status"] == "replayed":
            response.headers["Idempotency-Status"] = "replayed"
            return AdminStatusUpdateResponse(**idem["response_body"])
        if idem["status"] == "in_progress":
            raise HTTPException(status_code=409, detail="IDEMPOTENCY_IN_PROGRESS")

        row = _get_or_create_vault_row(cur, user_id, now)
        if not row:
            raise HTTPException(status_code=404, detail="VAULT_NOT_FOUND")

        expires_at, gold_status, platinum_status, diamond_status, *_ = row
        current = {
            "gold_status": gold_status,
            "platinum_status": platinum_status,
            "diamond_status": diamond_status,
        }

        # CLAIMED은 되돌리지 않음
        for key, new_val in updates.items():
            if current.get(key) == "CLAIMED" and new_val != "CLAIMED":
                raise HTTPException(status_code=409, detail="CANNOT_MODIFY_CLAIMED")

        set_clauses = []
        params = []
        for col in ("gold_status", "platinum_status", "diamond_status"):
            if col in updates:
                set_clauses.append(f"{col}=%s")
                params.append(updates[col])
        set_clauses.append("updated_at=%s")
        params.append(now)
        params.append(user_id)

        cur.execute(
            f"""
            UPDATE vault_status
               SET {', '.join(set_clauses)}
             WHERE user_id=%s
            """,
            params,
        )

        admin_user = request.client.host if request.client else "unknown"
        _log_admin_action(
            conn=conn,
            admin_user=admin_user,
            action="ADMIN_STATUS_UPDATE",
            endpoint=f"/api/vault/admin/users/{user_id}/vault/status",
            target_user_ids=[user_id],
            request_id=key,
            request_body=updates,
            response_status="SUCCESS",
            response_summary={"updated": True},
            idempotency_key=key,
        )

        response_body = {
            "updated": True,
            "gold_status": updates.get("gold_status", gold_status),
            "platinum_status": updates.get("platinum_status", platinum_status),
            "diamond_status": updates.get("diamond_status", diamond_status),
            "expires_at": expires_at.isoformat() if expires_at else None,
        }

        _idempotency_finish(
            cur,
            key=key,
            scope=scope,
            endpoint=endpoint,
            response_status=200,
            response_body=response_body,
        )

        conn.commit()

        response.headers["Idempotency-Status"] = "recorded"
        return AdminStatusUpdateResponse(**response_body)


@app.post("/api/vault/admin/users/{user_id}/vault/attendance", response_model=AdminAttendanceAdjustResponse)
async def admin_adjust_attendance(user_id: int, body: AdminAttendanceAdjustRequest, request: Request, response: Response, _auth: str = Depends(verify_admin_password)):
    if body.delta_days is None and body.set_days is None:
        raise HTTPException(status_code=400, detail="NO_FIELDS")

    key = _validate_idempotency_key(request.headers.get("x-idempotency-key"))
    scope = _idempotency_scope(request)
    endpoint = f"/api/vault/admin/users/{user_id}/vault/attendance"
    request_hash = _hash_request_body({"user_id": user_id, **body.dict()})

    delta_days = int(body.delta_days or 0)
    with db.get_conn() as conn:
        cur = conn.cursor()
        _apply_job_timeouts(cur)

        cur.execute("SELECT review_ok FROM user_admin_snapshot WHERE user_id=%s", (user_id,))
        snap_row = cur.fetchone()
        review_ok = bool(snap_row[0]) if snap_row and snap_row[0] is not None else False

        idem = _idempotency_start(cur, key=key, scope=scope, endpoint=endpoint, request_hash=request_hash)
        if idem["status"] == "replayed":
            response.headers["Idempotency-Status"] = "replayed"
            return AdminAttendanceAdjustResponse(**idem["response_body"])
        if idem["status"] == "in_progress":
            raise HTTPException(status_code=409, detail="IDEMPOTENCY_IN_PROGRESS")

        row = _get_or_create_vault_row(cur, user_id, _now())
        if not row:
            raise HTTPException(status_code=404, detail="VAULT_NOT_FOUND")

        expires_at, gold_status, platinum_status, diamond_status, attendance_days, platinum_deposit_done, _diamond_deposit_current = row
        current_days = int(attendance_days or 0)

        if body.set_days is not None:
            target_days = _clamp_attendance_days(int(body.set_days))
        else:
            target_days = _clamp_attendance_days(current_days + delta_days)

        new_platinum_status = platinum_status
        if platinum_status not in {"CLAIMED", "EXPIRED"}:
            if target_days >= 3 and bool(platinum_deposit_done) and review_ok:
                new_platinum_status = "UNLOCKED"

        now = _now()
        cur.execute(
            """
            UPDATE vault_status
               SET platinum_attendance_days=%s,
                   last_attended_at=%s,
                   platinum_status=%s,
                   updated_at=%s
             WHERE user_id=%s
            """,
            (target_days, now, new_platinum_status, now, user_id),
        )

        admin_user = request.client.host if request.client else "unknown"
        _log_admin_action(
            conn=conn,
            admin_user=admin_user,
            action="ADMIN_ATTENDANCE_ADJUST",
            endpoint=f"/api/vault/admin/users/{user_id}/vault/attendance",
            target_user_ids=[user_id],
            request_id=key,
            request_body={"delta_days": body.delta_days, "set_days": body.set_days},
            response_status="SUCCESS",
            response_summary={"platinum_attendance_days": target_days, "platinum_status": new_platinum_status},
            idempotency_key=key,
        )

        response_body = {
            "platinum_attendance_days": target_days,
            "platinum_status": new_platinum_status,
            "last_attended_at": now.isoformat(),
            "expires_at": expires_at.isoformat() if expires_at else None,
        }

        _idempotency_finish(
            cur,
            key=key,
            scope=scope,
            endpoint=endpoint,
            response_status=200,
            response_body=response_body,
        )

        conn.commit()

        response.headers["Idempotency-Status"] = "recorded"
        return AdminAttendanceAdjustResponse(**response_body)


@app.post("/api/vault/admin/users/{user_id}/vault/deposit", response_model=AdminDepositUpdateResponse)
async def admin_update_deposit(user_id: int, body: AdminDepositUpdateRequest, request: Request, response: Response, _auth: str = Depends(verify_admin_password)):
    if body.platinum_deposit_done is None and body.diamond_deposit_current is None:
        raise HTTPException(status_code=400, detail="NO_FIELDS")

    key = _validate_idempotency_key(request.headers.get("x-idempotency-key"))
    scope = _idempotency_scope(request)
    endpoint = f"/api/vault/admin/users/{user_id}/vault/deposit"
    request_hash = _hash_request_body({"user_id": user_id, **body.dict()})

    with db.get_conn() as conn:
        cur = conn.cursor()
        _apply_job_timeouts(cur)

        cur.execute("SELECT review_ok FROM user_admin_snapshot WHERE user_id=%s", (user_id,))
        snap_row = cur.fetchone()
        review_ok = bool(snap_row[0]) if snap_row and snap_row[0] is not None else False

        idem = _idempotency_start(cur, key=key, scope=scope, endpoint=endpoint, request_hash=request_hash)
        if idem["status"] == "replayed":
            response.headers["Idempotency-Status"] = "replayed"
            return AdminDepositUpdateResponse(**idem["response_body"])
        if idem["status"] == "in_progress":
            raise HTTPException(status_code=409, detail="IDEMPOTENCY_IN_PROGRESS")

        row = _get_or_create_vault_row(cur, user_id, _now())
        if not row:
            raise HTTPException(status_code=404, detail="VAULT_NOT_FOUND")

        expires_at, gold_status, platinum_status, diamond_status, attendance_days, platinum_deposit_done, diamond_deposit_current = row
        new_platinum_deposit_done = bool(body.platinum_deposit_done) if body.platinum_deposit_done is not None else bool(platinum_deposit_done)
        new_diamond_deposit_current = int(body.diamond_deposit_current) if body.diamond_deposit_current is not None else int(diamond_deposit_current or 0)

        new_platinum_status = platinum_status
        if platinum_status not in {"CLAIMED", "EXPIRED"}:
            if new_platinum_deposit_done:
                new_platinum_status = "UNLOCKED"

        new_diamond_status = diamond_status
        if diamond_status not in {"CLAIMED", "EXPIRED"}:
            if new_diamond_deposit_current >= 500000:
                new_diamond_status = "UNLOCKED"

        now = _now()
        cur.execute(
            """
            UPDATE vault_status
               SET platinum_deposit_done=%s,
                   diamond_deposit_current=%s,
                   platinum_status=%s,
                   diamond_status=%s,
                   updated_at=%s
             WHERE user_id=%s
            """,
            (
                new_platinum_deposit_done,
                new_diamond_deposit_current,
                new_platinum_status,
                new_diamond_status,
                now,
                user_id,
            ),
        )

        admin_user = request.client.host if request.client else "unknown"
        _log_admin_action(
            conn=conn,
            admin_user=admin_user,
            action="ADMIN_DEPOSIT_UPDATE",
            endpoint=f"/api/vault/admin/users/{user_id}/vault/deposit",
            target_user_ids=[user_id],
            request_id=key,
            request_body={
                "platinum_deposit_done": body.platinum_deposit_done,
                "diamond_deposit_current": body.diamond_deposit_current,
            },
            response_status="SUCCESS",
            response_summary={
                "platinum_status": new_platinum_status,
                "diamond_status": new_diamond_status,
            },
            idempotency_key=key,
        )

        response_body = {
            "platinum_deposit_done": new_platinum_deposit_done,
            "diamond_deposit_current": new_diamond_deposit_current,
            "platinum_status": new_platinum_status,
            "diamond_status": new_diamond_status,
            "expires_at": expires_at.isoformat() if expires_at else None,
        }

        _idempotency_finish(
            cur,
            key=key,
            scope=scope,
            endpoint=endpoint,
            response_status=200,
            response_body=response_body,
        )

        conn.commit()

        response.headers["Idempotency-Status"] = "recorded"
        return AdminDepositUpdateResponse(**response_body)


@app.post("/api/vault/compensation-enqueue")
async def compensation_enqueue(body: CompensationEnqueueRequest, request: Request, _auth: str = Depends(verify_admin_password)):
    with db.get_conn() as conn:
        cur = conn.cursor()
        _apply_job_timeouts(cur)
        user_id = body.user_id
        if user_id is None:
            user_id = _resolve_user_id(cur, user_id=None, external_user_id=body.external_user_id, default_user_id=None, create_if_missing=True)
        cur.execute(
            """
            INSERT INTO compensation_queue
                (user_id, vault_type, request_id, external_service, payload, status, retry_count, next_retry_at)
            VALUES (%s, %s, %s, %s, %s, 'PENDING', 0, NOW())
            ON CONFLICT (request_id, external_service) DO NOTHING
            """,
            (user_id, body.vault_type, body.request_id, body.external_service, Json(body.payload)),
        )
        
        # 감사 로그 기록
        admin_user = request.client.host if request.client else "unknown"
        _log_admin_action(
            conn=conn,
            admin_user=admin_user,
            action="COMPENSATION_ENQUEUE",
            endpoint="/api/vault/compensation-enqueue",
            target_user_ids=[user_id],
            request_id=body.request_id,
            request_body={"vault_type": body.vault_type, "external_service": body.external_service},
            response_status="SUCCESS",
            response_summary={"enqueued": True},
            metadata={"external_user_id": body.external_user_id} if body.external_user_id else None,
        )
        
        conn.commit()
    return JSONResponse(status_code=202, content={"enqueued": True})
