"""Vault user-facing router.

Endpoints for user login, status, claim, and attendance.
"""

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Depends, Request, Response

from app import config, db
from app.schemas import (
    AttendanceResponse,
    ClaimRequest,
    ClaimResponse,
    UserLoginRequest,
    UserLoginResponse,
)
from app.services.common import now_utc, normalize_external_user_id
from app.services.user_identity_service import resolve_user_id
from app.services.vault_service import (
    get_or_create_vault_row,
    check_user_csv_uploaded,
    get_user_snapshot,
    validate_claim_request,
    compute_platinum_status,
)
from app.constants.vault_config import (
    VAULT_REWARDS,
    DEFAULT_EXPIRY_HOURS,
)

router = APIRouter(prefix="/api/vault", tags=["vault"])


@router.post("/login", response_model=UserLoginResponse)
async def user_login(body: UserLoginRequest):
    """유저 로그인: 입력값을 external_user_id 우선으로 사용하고, 없으면 스냅샷 닉네임으로 역검색"""
    nickname = body.nickname.strip()
    if not nickname:
        raise HTTPException(status_code=400, detail="INVALID_NICKNAME")

    external_user_id = normalize_external_user_id(nickname)

    with db.get_conn() as conn:
        cur = conn.cursor()
        # 1차: external_user_id 일치 검색
        cur.execute(
            "SELECT user_id, external_user_id FROM user_identity WHERE external_user_id=%s",
            (external_user_id,),
        )
        row = cur.fetchone()

        # 2차: 스냅샷 닉네임으로 역검색
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

        snapshot_nickname = snapshot_row[0] or nickname
        telegram_ok = bool(snapshot_row[1]) if snapshot_row[1] is not None else False

        now = now_utc()
        expires_at = now + timedelta(hours=DEFAULT_EXPIRY_HOURS)
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


@router.get("/status")
async def vault_status(user_id: int | None = None, external_user_id: str | None = None):
    """Return vault status snapshot for the given user."""
    now = now_utc()
    with db.get_conn() as conn:
        cur = conn.cursor()
        user_id = resolve_user_id(
            cur, user_id=user_id, external_user_id=external_user_id,
            default_user_id=1, create_if_missing=True
        )
        
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

        review_row = get_user_snapshot(cur, user_id)
        
        # 프로덕션/로컬에서만 CSV 업로드 필수
        if not review_row and config.APP_ENV not in {"test"}:
            raise HTTPException(
                status_code=403,
                detail="CSV_UPLOAD_REQUIRED: 관리자가 회원 정보를 업로드해야 금고에 접근할 수 있습니다."
            )

    # Fallback defaults
    last_deposit_at = row[7] if row and row[7] else None
    base_time = last_deposit_at if last_deposit_at else now
    expires_at = row[0] if row else base_time + timedelta(hours=DEFAULT_EXPIRY_HOURS)
    gold_status = row[1] if row else "LOCKED"
    platinum_status = row[2] if row else "LOCKED"
    diamond_status = row[3] if row else "LOCKED"

    platinum_attendance_days = int(row[4]) if row and row[4] is not None else 0
    platinum_deposit_done = bool(row[5]) if row and row[5] is not None else False
    diamond_deposit_current = int(row[6]) if row and row[6] is not None else 0

    telegram_ok = review_row["telegram_ok"] if review_row else False
    platinum_review_done = review_row["review_ok"] if review_row else False

    remaining_ms = int((expires_at - now).total_seconds() * 1000)
    ms_countdown = {"enabled": remaining_ms < 3600_000, "remaining_ms": max(0, remaining_ms)}

    reward_amounts = VAULT_REWARDS
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


@router.post("/claim", response_model=ClaimResponse)
async def claim_vault(body: ClaimRequest, user_id: int | None = None, external_user_id: str | None = None):
    """Claim a vault reward."""
    vault_type = body.vault_type.upper()
    if vault_type not in {"GOLD", "PLATINUM", "DIAMOND"}:
        raise HTTPException(status_code=400, detail="INVALID_VAULT_TYPE")

    now = now_utc()
    status_col = f"{vault_type.lower()}_status"
    claimed_at_col = f"{vault_type.lower()}_claimed_at"

    with db.get_conn() as conn:
        cur = conn.cursor()
        user_id = resolve_user_id(
            cur, user_id=user_id, external_user_id=external_user_id,
            default_user_id=1, create_if_missing=True
        )
        
        # CSV 업로드 확인
        if not check_user_csv_uploaded(cur, user_id) and config.APP_ENV not in {"test"}:
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

        validate_claim_request(vault_type, current_status)

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


@router.post("/attendance", response_model=AttendanceResponse)
async def attendance(user_id: int | None = None, external_user_id: str | None = None):
    """Record attendance for platinum vault."""
    now = now_utc()
    with db.get_conn() as conn:
        cur = conn.cursor()
        user_id = resolve_user_id(
            cur, user_id=user_id, external_user_id=external_user_id,
            default_user_id=1, create_if_missing=True
        )
        
        # CSV 업로드 확인
        if not check_user_csv_uploaded(cur, user_id):
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
                    (user_id, expires_at, gold_status, platinum_status, diamond_status, 
                     platinum_attendance_days, platinum_deposit_done, last_attended_at)
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

    return AttendanceResponse(
        platinum_attendance_days=new_days,
        now=now.isoformat(),
        expires_at=expires_at.isoformat()
    )
