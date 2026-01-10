"""Vault service layer.

Handles vault status operations, unlock conditions, and state transitions.
"""

from datetime import datetime, timedelta
from typing import Any, Dict, Tuple

from fastapi import HTTPException

from app import config, db
from app.services.common import now_utc, validate_status, clamp_attendance_days
from app.services.user_identity_service import resolve_user_id
from app.constants.vault_config import (
    DEFAULT_EXPIRY_HOURS,
    PLATINUM_UNLOCK,
    DIAMOND_UNLOCK,
)


def get_or_create_vault_row(cur, user_id: int, now: datetime) -> Tuple | None:
    """Get or create vault_status row for user."""
    cur.execute(
        """
        SELECT expires_at,
               gold_status,
               platinum_status,
               diamond_status,
               platinum_attendance_days,
               platinum_deposit_total,
               platinum_deposit_count,
               diamond_deposit_total,
               gold_mission_1_done,
               gold_mission_2_done,
               gold_mission_3_done,
               diamond_attendance_days,
               platinum_mission_1_done,
               platinum_mission_2_done,
               diamond_mission_1_done,
               diamond_mission_2_done
          FROM vault_status
         WHERE user_id=%s
         FOR UPDATE
        """,
        (user_id,),
    )
    row = cur.fetchone()
    if row:
        return row

    # Try to get joined_date from snapshot to set initial expiry
    cur.execute("SELECT joined_date FROM user_admin_snapshot WHERE user_id=%s", (user_id,))
    snap_row = cur.fetchone()
    joined_date = snap_row[0] if snap_row else None

    if joined_date:
        # If we have a joined_date, expiry is 120h (5 days) from that date
        # Note: joined_date is a date object, we treat it as the start of that day in UTC
        from datetime import time, timezone
        base_time = datetime.combine(joined_date, time.min).replace(tzinfo=timezone.utc)
        expires_at = base_time + timedelta(hours=DEFAULT_EXPIRY_HOURS)
    else:
        expires_at = now + timedelta(hours=DEFAULT_EXPIRY_HOURS)

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
               platinum_deposit_total,
               platinum_deposit_count,
               diamond_deposit_total,
               gold_mission_1_done,
               gold_mission_2_done,
               gold_mission_3_done,
               diamond_attendance_days,
               platinum_mission_1_done,
               platinum_mission_2_done,
               diamond_mission_1_done,
               diamond_mission_2_done
          FROM vault_status
         WHERE user_id=%s
         FOR UPDATE
        """,
        (user_id,),
    )
    return cur.fetchone()


def compute_gold_status(m1: bool, m2: bool, m3: bool, current_status: str) -> str:
    """Compute gold status based on missions and current status.
    
    Rules:
    - If current status is CLAIMED or EXPIRED, don't change
    - If all 3 missions are done, status is UNLOCKED
    - Otherwise, status is LOCKED
    """
    if current_status in {"CLAIMED", "EXPIRED"}:
        return current_status
    return "UNLOCKED" if (m1 and m2 and m3) else "LOCKED"


def compute_platinum_status(
    deposit_total: int,
    deposit_count: int,
    attendance_days: int,
    review_ok: bool,
    m1: bool,
    m2: bool,
    gold_status: str,
    current_status: str,
) -> str:
    """Compute platinum status based on conditions.
    
    Rules (SOT SEQUENCE_STATE_VAULT_V2.md):
    - If current status is CLAIMED or EXPIRED, don't change
    - 어드민 미션 토글은 조건 충족을 수동 확인한 것이므로 m1+m2=true면 UNLOCKED
    - 선행 조건(골드 CLAIMED)은 어드민 강제 토글이므로 체크 안 함
    """
    if current_status in {"CLAIMED", "EXPIRED"}:
        return current_status
    
    # 미션 토글이 모두 ON이면 UNLOCKED (어드민 강제 토글)
    if m1 and m2:
        return "UNLOCKED"
    
    return current_status


def compute_diamond_status(
    deposit_total: int,
    attendance_days: int,
    m1: bool,
    m2: bool,
    platinum_status: str,
    current_status: str
) -> str:
    """Compute diamond status based on conditions.
    
    Rules (SOT SEQUENCE_STATE_VAULT_V2.md):
    - If current status is CLAIMED or EXPIRED, don't change
    - 어드민 미션 토글은 조건 충족을 수동 확인한 것이므로 m1+m2=true면 UNLOCKED
    - 선행 조건(플래티넘 CLAIMED)은 어드민 강제 토글이므로 체크 안 함
    """
    if current_status in {"CLAIMED", "EXPIRED"}:
        return current_status
    
    # 미션 토글이 모두 ON이면 UNLOCKED (어드민 강제 토글)
    if m1 and m2:
        return "UNLOCKED"
    
    return current_status


def check_user_csv_uploaded(cur, user_id: int) -> bool:
    """Check if user has CSV snapshot data."""
    cur.execute(
        "SELECT 1 FROM user_admin_snapshot WHERE user_id=%s",
        (user_id,),
    )
    return cur.fetchone() is not None


def get_user_snapshot(cur, user_id: int) -> dict | None:
    """Get user admin snapshot."""
    cur.execute(
        """
        SELECT COALESCE(telegram_ok, false),
               COALESCE(review_ok, false)
          FROM user_admin_snapshot
         WHERE user_id=%s
        """,
        (user_id,),
    )
    row = cur.fetchone()
    if not row:
        return None
    return {
        "telegram_ok": bool(row[0]) if row[0] is not None else False,
        "review_ok": bool(row[1]) if row[1] is not None else False,
    }


def validate_claim_request(
    vault_type: str,
    current_status: str,
) -> None:
    """Validate claim request.
    
    Raises HTTPException if claim is not allowed.
    """
    if current_status == "CLAIMED":
        raise HTTPException(status_code=409, detail="ALREADY_CLAIMED")
    if current_status != "UNLOCKED":
        raise HTTPException(status_code=403, detail="NOT_CLAIMABLE")


def validate_status_modification(current_status: str, new_status: str, field: str) -> None:
    """Validate status modification.
    
    Rules:
    - CLAIMED status cannot be changed to anything else
    """
    if current_status == "CLAIMED" and new_status != "CLAIMED":
        raise HTTPException(status_code=409, detail="CANNOT_MODIFY_CLAIMED")


def apply_bulk_updates_for_user(
    cur,
    user_id: int,
    now: datetime,
    *,
    status_updates: dict | None = None,
    attendance_delta: int | None = None,
    attendance_set: int | None = None,
    deposit_platinum_total: int | None = None,
    deposit_platinum_count: int | None = None,
    deposit_diamond_total: int | None = None,
) -> dict:
    """Apply bulk updates to a single user's vault status.
    
    Returns the updated status dict.
    """
    # Get review_ok from snapshot
    cur.execute("SELECT review_ok FROM user_admin_snapshot WHERE user_id=%s", (user_id,))
    snap_row = cur.fetchone()
    review_ok = bool(snap_row[0]) if snap_row and snap_row[0] is not None else False

    # Get current vault row
    row = get_or_create_vault_row(cur, user_id, now)
    if not row:
        raise HTTPException(status_code=404, detail="VAULT_NOT_FOUND")

    (
        expires_at, gold_status, platinum_status, diamond_status,
        _unused_plat_att, platinum_deposit_total, platinum_deposit_count, diamond_deposit_total,
        *rest
    ) = row
    
    # row unpacking depends on select order in get_or_create_vault_row
    # 0:expires_at, 1:gold, 2:platinum, 3:diamond, 
    # 4:platinum_attendance(unused), 5:plat_dep_total, 6:plat_dep_count, 7:dia_dep_total, 
    # 8:m1, 9:m2, 10:m3, 11:diamond_attendance_days
    
    # We must ensure robust unpacking. The simpler way given the SELECT:
    # SELECT expires, gold, plat, dia, plat_att, plat_dep_tot, plat_dep_cnt, dia_dep_tot, m1, m2, m3, dia_att
    gold_mission_1 = rest[0]
    gold_mission_2 = rest[1]
    gold_mission_3 = rest[2]
    diamond_attendance_days = rest[3]
    
    current = {
        "gold_status": gold_status,
        "platinum_status": platinum_status,
        "diamond_status": diamond_status,
    }

    # Apply attendance changes (Now affects DIAMOND attendance)
    new_attendance_days = int(diamond_attendance_days or 0)
    if attendance_set is not None:
        new_attendance_days = clamp_attendance_days(int(attendance_set))
    elif attendance_delta is not None:
        new_attendance_days = clamp_attendance_days(int(diamond_attendance_days or 0) + int(attendance_delta))

    # Apply deposit changes
    new_platinum_deposit_total = int(platinum_deposit_total or 0)
    new_platinum_deposit_count = int(platinum_deposit_count or 0)
    new_diamond_deposit_total = int(diamond_deposit_total or 0)

    if deposit_platinum_total is not None:
        new_platinum_deposit_total = int(deposit_platinum_total)
    if deposit_platinum_count is not None:
        new_platinum_deposit_count = int(deposit_platinum_count)
    if deposit_diamond_total is not None:
        new_diamond_deposit_total = int(deposit_diamond_total)

    # Recompute unlock statuses
    # Platinum no longer needs attendance (correction: it still needs m1, m2)
    new_platinum_status = compute_platinum_status(
        new_platinum_deposit_total,
        new_platinum_deposit_count,
        3, # attendance dummy for now if unused or pass actual diamond_attendance if shared
        review_ok,
        bool(rest[4]), # plat_m1
        bool(rest[5]), # plat_m2
        gold_status,
        platinum_status
    )
    # Diamond now needs attendance and platinum status and missions
    new_diamond_status = compute_diamond_status(
        new_diamond_deposit_total,
        new_attendance_days,
        bool(rest[6]), # dia_m1
        bool(rest[7]), # dia_m2
        new_platinum_status,
        diamond_status
    )

    # Apply explicit status overrides
    explicit_updates: dict[str, str] = {}
    if status_updates:
        for col in ("gold_status", "platinum_status", "diamond_status"):
            if status_updates.get(col) is not None:
                validated = validate_status(status_updates[col], col)
                validate_status_modification(current[col], validated, col)
                explicit_updates[col] = validated

    new_gold_status = explicit_updates.get("gold_status", gold_status)
    new_platinum_status = explicit_updates.get("platinum_status", new_platinum_status)
    new_diamond_status = explicit_updates.get("diamond_status", new_diamond_status)

    # Build update query
    set_cols = ["gold_status=%s", "platinum_status=%s", "diamond_status=%s"]
    params = [new_gold_status, new_platinum_status, new_diamond_status]

    if attendance_delta is not None or attendance_set is not None:
        set_cols.extend(["diamond_attendance_days=%s", "last_attended_at=%s"])
        params.extend([new_attendance_days, now])
    
    if deposit_platinum_total is not None:
        set_cols.append("platinum_deposit_total=%s")
        params.append(new_platinum_deposit_total)
    if deposit_platinum_count is not None:
        set_cols.append("platinum_deposit_count=%s")
        params.append(new_platinum_deposit_count)
    if deposit_diamond_total is not None:
        set_cols.append("diamond_deposit_total=%s")
        params.append(new_diamond_deposit_total)

    set_cols.append("updated_at=%s")
    params.append(now)
    params.append(user_id)

    cur.execute(
        f"UPDATE vault_status SET {', '.join(set_cols)} WHERE user_id=%s",
        params,
    )

    return {
        "expires_at": expires_at.isoformat() if expires_at else None,
        "gold_status": new_gold_status,
        "platinum_status": new_platinum_status,
        "diamond_status": new_diamond_status,
    }
