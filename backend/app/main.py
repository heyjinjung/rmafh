from datetime import datetime, timedelta, timezone
from typing import List
import json

from fastapi import FastAPI, HTTPException, Header, Depends, Request
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
    ExtendExpiryRequest,
    ExtendExpiryResponse,
    HealthResponse,
    NotifyRequest,
    NotifyResponse,
    ReferralReviveRequest,
    ReferralReviveResponse,
    UserIdentityBulkRequest,
    UserIdentityBulkResponse,
    DailyUserImportRequest,
    DailyUserImportResponse,
    UserLoginRequest,
    UserLoginResponse,
)

app = FastAPI(title="Vault v2.0 API", version="0.2.0")

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
):
    """어드민 감사 로그 기록"""
    cur = conn.cursor()
    target_user_ids_array = target_user_ids if target_user_ids else []
    target_count = len(target_user_ids_array) if target_user_ids_array else 0
    
    cur.execute(
        """
        INSERT INTO admin_audit_log
            (admin_user, action, endpoint, target_user_ids, target_count,
             request_id, request_body, response_status, response_summary, error_message, metadata)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
    """유저 로그인: 닉네임으로 external_user_id 생성 및 user_id 매핑"""
    nickname = body.nickname.strip()
    if not nickname:
        raise HTTPException(status_code=400, detail="INVALID_NICKNAME")
    
    # external_user_id는 nickname 기반으로 생성 (실제 환경에서는 더 안전한 방식 사용)
    external_user_id = f"user_{nickname.lower().replace(' ', '_')}"
    
    with db.get_conn() as conn:
        cur = conn.cursor()
        
        # user_identity에서 기존 유저 확인 또는 생성
        cur.execute(
            """
            INSERT INTO user_identity (external_user_id)
            VALUES (%s)
            ON CONFLICT (external_user_id) DO NOTHING
            RETURNING user_id
            """,
            (external_user_id,)
        )
        row = cur.fetchone()
        
        if not row:
            # 이미 존재하는 유저, 조회
            cur.execute(
                "SELECT user_id FROM user_identity WHERE external_user_id=%s",
                (external_user_id,)
            )
            row = cur.fetchone()
        
        user_id = int(row[0])
        
        # user_admin_snapshot에 닉네임 저장/업데이트
        cur.execute(
            """
            INSERT INTO user_admin_snapshot (user_id, nickname, updated_at)
            VALUES (%s, %s, NOW())
            ON CONFLICT (user_id) DO UPDATE
                SET nickname = EXCLUDED.nickname,
                    updated_at = NOW()
            """,
            (user_id, nickname)
        )
        
        # vault_status 기본 행 생성 (72시간 만료)
        now = _now()
        expires_at = now + timedelta(hours=72)
        cur.execute(
            """
            INSERT INTO vault_status (user_id, expires_at, gold_status, platinum_status, diamond_status)
            VALUES (%s, %s, 'UNLOCKED', 'LOCKED', 'LOCKED')
            ON CONFLICT (user_id) DO NOTHING
            """,
            (user_id, expires_at)
        )
        
        conn.commit()
    
    return UserLoginResponse(
        external_user_id=external_user_id,
        nickname=nickname,
        user_id=user_id
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
            SELECT expires_at,
                   gold_status,
                   platinum_status,
                   diamond_status,
                   platinum_attendance_days,
                   platinum_deposit_done,
                   diamond_deposit_current
              FROM vault_status
             WHERE user_id=%s
            """,
            (user_id,),
        )
        row = cur.fetchone()

        cur.execute(
            """
            SELECT COALESCE(review_ok, false)
              FROM user_admin_snapshot
             WHERE user_id=%s
            """,
            (user_id,),
        )
        review_row = cur.fetchone()

    # Fallback defaults if user row not found
    expires_at = row[0] if row else now + timedelta(hours=72)
    gold_status = row[1] if row else "UNLOCKED"
    platinum_status = row[2] if row else "LOCKED"
    diamond_status = row[3] if row else "LOCKED"

    platinum_attendance_days = int(row[4]) if row and row[4] is not None else 0
    platinum_deposit_done = bool(row[5]) if row and row[5] is not None else False
    diamond_deposit_current = int(row[6]) if row and row[6] is not None else 0

    platinum_review_done = bool(review_row[0]) if review_row and review_row[0] is not None else False

    remaining_ms = int((expires_at - now).total_seconds() * 1000)
    ms_countdown = {"enabled": remaining_ms < 3600_000, "remaining_ms": max(0, remaining_ms)}

    reward_amounts = {"GOLD": 10000, "PLATINUM": 20000, "DIAMOND": 100000, "BONUS": 0}
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
        "diamond_deposit_current": diamond_deposit_current,
        "expires_at": expires_at.isoformat(),
        "now": now.isoformat(),
        "loss_total": loss_total,
        "loss_breakdown": loss_breakdown,
        "ms_countdown": ms_countdown,
        "referral_revive_available": True,
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
                VALUES (%s, %s, 'UNLOCKED', 'LOCKED', 'LOCKED')
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
                VALUES (%s, %s, 'UNLOCKED', 'LOCKED', 'LOCKED', 0, false, NULL)
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
async def user_daily_import(body: DailyUserImportRequest, request: Request, _auth: str = Depends(verify_admin_password)):
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

    now = _now()
    default_expires = now + timedelta(hours=72)

    with db.get_conn() as conn:
        cur = conn.cursor()
        if config.APP_ENV == "test":
            cur.execute("SET LOCAL lock_timeout = '2s'")
            cur.execute("SET LOCAL statement_timeout = '20s'")
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
            vault_update_values.append((user_id, deposit_total, telegram_ok, review_ok, import_date))

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

        # Ensure baseline rows exist
        ensure_values = [(int(row[0]), default_expires) for row in snapshot_values]
        execute_values(
            cur,
            """
            INSERT INTO vault_status (user_id, expires_at, gold_status, platinum_status, diamond_status)
            VALUES %s
            ON CONFLICT (user_id) DO NOTHING
            """,
            ensure_values,
            template="(%s,%s,'UNLOCKED','LOCKED','LOCKED')",
        )

        execute_values(
            cur,
            """
            UPDATE vault_status AS vs
               SET diamond_deposit_current = v.deposit_total,
                                     gold_status = CASE
                                                                    WHEN vs.gold_status='CLAIMED' THEN 'CLAIMED'
                                                                    ELSE 'UNLOCKED'
                                                                END,
                                     platinum_attendance_days = CASE
                                         WHEN (
                                             (v.deposit_total - COALESCE(vs.platinum_deposit_total_last, 0)) >= 50000
                                             AND (vs.last_attended_at IS NULL OR vs.last_attended_at::date < v.import_date)
                                         )
                                         THEN CASE
                                             WHEN vs.last_attended_at IS NOT NULL AND vs.last_attended_at::date = (v.import_date - INTERVAL '1 day')
                                                 THEN LEAST(3, COALESCE(vs.platinum_attendance_days, 0) + 1)
                                             ELSE 1
                                         END
                                         ELSE vs.platinum_attendance_days
                                     END,
                                     last_attended_at = CASE
                                         WHEN (
                                             (v.deposit_total - COALESCE(vs.platinum_deposit_total_last, 0)) >= 50000
                                             AND (vs.last_attended_at IS NULL OR vs.last_attended_at::date < v.import_date)
                                         )
                                         THEN (v.import_date::timestamp AT TIME ZONE 'UTC')
                                         ELSE vs.last_attended_at
                                     END,
                                     platinum_deposit_total_last = GREATEST(COALESCE(vs.platinum_deposit_total_last, 0), v.deposit_total),
                                     platinum_status = CASE
                                         WHEN vs.platinum_status IN ('LOCKED','ACTIVE') AND v.review_ok AND (
                                             CASE
                                                 WHEN (
                                                     (v.deposit_total - COALESCE(vs.platinum_deposit_total_last, 0)) >= 50000
                                                     AND (vs.last_attended_at IS NULL OR vs.last_attended_at::date < v.import_date)
                                                 )
                                                 THEN CASE
                                                     WHEN vs.last_attended_at IS NOT NULL AND vs.last_attended_at::date = (v.import_date - INTERVAL '1 day')
                                                         THEN LEAST(3, COALESCE(vs.platinum_attendance_days, 0) + 1)
                                                     ELSE 1
                                                 END
                                                 ELSE COALESCE(vs.platinum_attendance_days, 0)
                                             END
                                         ) >= 3 THEN 'UNLOCKED'
                                         ELSE vs.platinum_status
                                     END,
                   diamond_status = CASE
                                                                         WHEN vs.diamond_status IN ('LOCKED','ACTIVE') AND v.deposit_total >= 500000 THEN 'UNLOCKED'
                                     ELSE vs.diamond_status
                                   END,
                   updated_at = NOW()
                            FROM (VALUES %s) AS v(user_id, deposit_total, telegram_ok, review_ok, import_date)
             WHERE vs.user_id = v.user_id
            """,
            vault_update_values,
                        template="(%s,%s,%s,%s,%s)",
        )
        vault_rows_updated = int(cur.rowcount or 0)

        # 감사 로그 기록
        admin_user = request.client.host if request.client else "unknown"
        _log_admin_action(
            conn=conn,
            admin_user=admin_user,
            action="USER_DAILY_IMPORT",
            endpoint="/api/vault/user-daily-import",
            target_user_ids=[int(mapping[ext]) for ext in external_ids],
            request_id=None,
            request_body={"total_rows": len(rows)},
            response_status="SUCCESS",
            response_summary={
                "total": len(rows),
                "processed": len(snapshot_values),
                "identity_created": identity_created,
                "vault_rows_updated": vault_rows_updated,
            },
        )

        conn.commit()

    return DailyUserImportResponse(
        total=len(rows),
        processed=len(snapshot_values),
        identity_created=identity_created,
        vault_rows_updated=vault_rows_updated,
    )


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

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS user_identity (
                user_id BIGSERIAL PRIMARY KEY,
                external_user_id TEXT NOT NULL UNIQUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS vault_status (
                user_id INTEGER PRIMARY KEY,
                expires_at TIMESTAMPTZ NOT NULL,
                gold_status TEXT NOT NULL DEFAULT 'UNLOCKED',
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

        cur.execute("ALTER TABLE user_admin_snapshot ADD COLUMN IF NOT EXISTS nickname TEXT")
        cur.execute("ALTER TABLE user_admin_snapshot ADD COLUMN IF NOT EXISTS joined_date DATE")
        cur.execute("ALTER TABLE user_admin_snapshot ADD COLUMN IF NOT EXISTS deposit_total BIGINT NOT NULL DEFAULT 0")
        cur.execute("ALTER TABLE user_admin_snapshot ADD COLUMN IF NOT EXISTS last_deposit_at TIMESTAMPTZ")
        cur.execute("ALTER TABLE user_admin_snapshot ADD COLUMN IF NOT EXISTS telegram_ok BOOLEAN NOT NULL DEFAULT FALSE")
        cur.execute("ALTER TABLE user_admin_snapshot ADD COLUMN IF NOT EXISTS review_ok BOOLEAN NOT NULL DEFAULT FALSE")
        cur.execute("ALTER TABLE user_admin_snapshot ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()")

        # Backward compatible adds if the table already exists with older schema.
        cur.execute("ALTER TABLE vault_status ALTER COLUMN gold_status SET DEFAULT 'UNLOCKED'")
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


@app.post("/api/vault/referral-revive", response_model=ReferralReviveResponse)
async def referral_revive(body: ReferralReviveRequest, request: Request, user_id: int | None = None, external_user_id: str | None = None, _auth: str = Depends(verify_admin_password)):
    """만료 D-1 구간에서 24h 연장 (1회 제한)."""
    request_id = _validate_request_id(getattr(body, "request_id", None))
    channel = _require_non_empty(getattr(body, "channel", None), code="INVALID_CHANNEL")
    invite_code = _require_non_empty(getattr(body, "invite_code", None), code="INVALID_INVITE_CODE")
    with db.get_conn() as conn:
        cur = conn.cursor()
        if config.APP_ENV == "test":
            cur.execute("SET LOCAL lock_timeout = '2s'")
            cur.execute("SET LOCAL statement_timeout = '20s'")
        user_id = _resolve_user_id(cur, user_id=user_id, external_user_id=external_user_id, default_user_id=None, create_if_missing=True)

        # Idempotency: if we already processed this request_id, return the recorded result.
        cur.execute(
            """
            SELECT new_expires_at
              FROM vault_expiry_extension_log
             WHERE request_id=%s
               AND reason='REFERRAL'
               AND shadow=false
             ORDER BY id DESC
             LIMIT 1
            """,
            (request_id,),
        )
        idem = cur.fetchone()
        if idem and idem[0] is not None:
            return ReferralReviveResponse(revived=True, expires_at=idem[0].isoformat())

        cur.execute(
            """
            SELECT expires_at, expiry_extend_count
            FROM vault_status
            WHERE user_id=%s
            FOR UPDATE
            """,
            (user_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="NOT_FOUND")
        expires_at, extend_count = row
        now = _now()
        if not (now + timedelta(hours=24) <= expires_at <= now + timedelta(hours=48)):
            raise HTTPException(status_code=403, detail="EXTENSION_FORBIDDEN")
        if extend_count > 0:
            raise HTTPException(status_code=409, detail="EXTENSION_LIMIT")

        new_expires = expires_at + timedelta(hours=24)
        cur.execute(
            """
            UPDATE vault_status
               SET expires_at=%s,
                   expiry_extend_count=expiry_extend_count+1,
                   last_extension_reason='REFERRAL',
                   last_extension_at=%s
             WHERE user_id=%s
            """,
            (new_expires, now, user_id),
        )
        cur.execute(
            """
            INSERT INTO vault_expiry_extension_log
                (user_id, prev_expires_at, new_expires_at, reason, request_id, shadow, metadata)
            VALUES (%s, %s, %s, %s, %s, false, jsonb_build_object('channel', %s, 'invite_code', %s))
            ON CONFLICT (request_id) DO NOTHING
            """,
            (user_id, expires_at, new_expires, "REFERRAL", request_id, channel, invite_code),
        )
        
        # 감사 로그 기록
        admin_user = request.client.host if request.client else "unknown"
        _log_admin_action(
            conn=conn,
            admin_user=admin_user,
            action="REFERRAL_REVIVE",
            endpoint="/api/vault/referral-revive",
            target_user_ids=[user_id],
            request_id=request_id,
            request_body={"channel": channel, "invite_code": invite_code},
            response_status="SUCCESS",
            response_summary={"revived": True, "new_expires_at": new_expires.isoformat()},
            metadata={"external_user_id": external_user_id} if external_user_id else None,
        )
        
        conn.commit()
        return ReferralReviveResponse(revived=True, expires_at=new_expires.isoformat())


@app.post("/api/vault/extend-expiry", response_model=ExtendExpiryResponse)
async def extend_expiry(body: ExtendExpiryRequest, request: Request, _auth: str = Depends(verify_admin_password)):
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

    with db.get_conn() as conn:
        cur = conn.cursor()
        if config.APP_ENV == "test":
            cur.execute("SET LOCAL lock_timeout = '2s'")
            cur.execute("SET LOCAL statement_timeout = '20s'")
        now = _now()

        # Best-effort idempotency on request_id (for ops retries).
        # Older rows may have metadata=NULL; this only guarantees idempotency for runs after this change.
        if not body.shadow:
            cur.execute(
                """
                SELECT 1
                  FROM vault_expiry_extension_log
                 WHERE metadata->>'base_request_id'=%s
                   AND shadow=false
                 LIMIT 1
                """,
                (request_id,),
            )
            if cur.fetchone() is not None:
                return ExtendExpiryResponse(shadow=False, updated=0)

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
            return ExtendExpiryResponse(shadow=True, candidates=len(rows), sample_user_ids=sample_ids)

        new_expires_at = None
        updated = 0
        for user_id, expires_at in rows:
            new_expires = expires_at + timedelta(hours=body.extend_hours)
            new_expires_at = new_expires
            cur.execute(
                """
                UPDATE vault_status
                   SET expires_at=%s,
                       expiry_extend_count=expiry_extend_count+1,
                       last_extension_reason=%s,
                       last_extension_at=%s
                 WHERE user_id=%s
                """,
                (new_expires, body.reason, now, user_id),
            )
            cur.execute(
                """
                INSERT INTO vault_expiry_extension_log
                    (user_id, prev_expires_at, new_expires_at, reason, request_id, shadow, metadata)
                VALUES (%s, %s, %s, %s, %s, false, %s)
                ON CONFLICT (request_id) DO NOTHING
                """,
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
                ),
            )
            updated += 1
        
        # 감사 로그 기록
        admin_user = request.client.host if request.client else "unknown"
        target_ids = [r[0] for r in rows]
        _log_admin_action(
            conn=conn,
            admin_user=admin_user,
            action="EXTEND_EXPIRY",
            endpoint="/api/vault/extend-expiry",
            target_user_ids=target_ids[:1000],  # 최대 1000개만 저장 (샘플링)
            request_id=request_id,
            request_body={"scope": body.scope, "extend_hours": body.extend_hours, "reason": body.reason, "shadow": body.shadow},
            response_status="SUCCESS",
            response_summary={"updated": updated, "new_expires_at": new_expires_at.isoformat() if new_expires_at else None},
        )
        
        conn.commit()
        return ExtendExpiryResponse(shadow=False, updated=updated, new_expires_at=new_expires_at.isoformat() if new_expires_at else None)


@app.post("/api/vault/notify", response_model=NotifyResponse)
async def notify(body: NotifyRequest, request: Request, _auth: str = Depends(verify_admin_password)):
    if body.type not in config.ALLOWED_NOTIFY_TYPES:
        raise HTTPException(status_code=400, detail="INVALID_NOTIFY_TYPE")

    user_ids = _dedupe_int_list(list(body.user_ids) if body.user_ids else None, max_items=10000)
    external_user_ids = _dedupe_str_list(list(body.external_user_ids) if body.external_user_ids else None, max_items=10000)
    if not (user_ids or external_user_ids):
        raise HTTPException(status_code=400, detail="EMPTY_USER_IDS")
    if body.variant_id and body.variant_id not in config.ALLOWED_VARIANT_IDS:
        raise HTTPException(status_code=400, detail="VARIANT_NOT_FOUND")

    now = _now()
    dedup_suffix = body.variant_id or "base"
    inserted = 0
    with db.get_conn() as conn:
        cur = conn.cursor()
        if config.APP_ENV == "test":
            cur.execute("SET LOCAL lock_timeout = '2s'")
            cur.execute("SET LOCAL statement_timeout = '20s'")
        resolved_user_ids: list[int] = []
        if user_ids:
            resolved_user_ids.extend(user_ids)
        if external_user_ids:
            resolved_user_ids.extend(_resolve_user_ids_by_external_user_ids(cur, external_user_ids))
        resolved_user_ids = _dedupe_int_list(resolved_user_ids, max_items=10000)
        for uid in resolved_user_ids or []:
            dedup_key = f"{body.type}:{uid}:{dedup_suffix}:{now.date()}"
            cur.execute(
                """
                INSERT INTO notifications_queue
                    (user_id, type, vault_type, variant_id, dedup_key, payload, scheduled_at, status)
                VALUES (%s, %s, NULL, %s, %s, %s, %s, 'PENDING')
                ON CONFLICT (dedup_key) DO NOTHING
                """,
                (uid, body.type, body.variant_id, dedup_key, Json({"type": body.type, "variant_id": body.variant_id}), now),
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
            request_id=None,
            request_body={"type": body.type, "variant_id": body.variant_id},
            response_status="SUCCESS",
            response_summary={"enqueued": inserted, "total_targets": len(resolved_user_ids)},
        )
        
        conn.commit()
    return NotifyResponse(enqueued=inserted)


@app.get("/api/vault/admin/users")
async def get_all_users(_auth: str = Depends(verify_admin_password)):
    """전체 회원 리스트와 각 회원의 금고 상태 조회"""
    with db.get_conn() as conn:
        cur = conn.cursor()
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
                uas.last_deposit_won
            FROM user_identity ui
            LEFT JOIN vault_status vs ON ui.user_id = vs.user_id
            LEFT JOIN user_admin_snapshot uas ON ui.user_id = uas.user_id
            ORDER BY ui.user_id DESC
            LIMIT 1000
            """
        )
        rows = cur.fetchall()
        
        users = []
        for row in rows:
            users.append({
                "user_id": row[0],
                "external_user_id": row[1],
                "created_at": row[2].isoformat() if row[2] else None,
                "expires_at": row[3].isoformat() if row[3] else None,
                "gold_status": row[4] or "UNLOCKED",
                "platinum_status": row[5] or "LOCKED",
                "diamond_status": row[6] or "LOCKED",
                "platinum_attendance_days": row[7] or 0,
                "platinum_deposit_done": row[8] or False,
                "diamond_deposit_current": row[9] or 0,
                "review_ok": row[10] or False,
                "last_deposit_won": row[11] or 0,
            })
        
        return {"users": users, "total": len(users)}


@app.post("/api/vault/compensation-enqueue")
async def compensation_enqueue(body: CompensationEnqueueRequest, request: Request, _auth: str = Depends(verify_admin_password)):
    with db.get_conn() as conn:
        cur = conn.cursor()
        if config.APP_ENV == "test":
            cur.execute("SET LOCAL lock_timeout = '2s'")
            cur.execute("SET LOCAL statement_timeout = '10s'")
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
