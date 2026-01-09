"""Admin vault operations router.

Endpoints for admin vault status, missions, attendance, and deposit updates.
"""

from typing import Any

from fastapi import APIRouter, HTTPException, Depends, Request, Response
from psycopg2.extras import Json

from app import db
from app.schemas import (
    AdminStatusUpdateRequest,
    AdminStatusUpdateResponse,
    AdminGoldMissionsUpdateRequest,
    AdminGoldMissionsUpdateResponse,
    AdminPlatinumMissionsUpdateRequest,
    AdminPlatinumMissionsUpdateResponse,
    AdminDiamondMissionsUpdateRequest,
    AdminDiamondMissionsUpdateResponse,
    AdminAttendanceAdjustRequest,
    AdminAttendanceAdjustResponse,
)
from app.routers.dependencies import verify_admin_password
from app.utils.audit import _log_admin_action
from app.utils.sql_builders import _apply_job_timeouts
from app.services.common import (
    now_utc,
    validate_idempotency_key,
    hash_request_body,
    idempotency_scope,
    idempotency_start,
    idempotency_finish,
    validate_status,
    clamp_attendance_days,
)
from app.services.vault_service import (
    get_or_create_vault_row,
    compute_gold_status,
    compute_platinum_status,
    compute_diamond_status,
    validate_status_modification,
)

router = APIRouter(prefix="/api/vault/admin/users", tags=["admin-vault"])


@router.post("/{user_id}/vault/gold-missions", response_model=AdminGoldMissionsUpdateResponse)
async def admin_update_gold_missions(
    user_id: int,
    body: AdminGoldMissionsUpdateRequest,
    request: Request,
    response: Response,
    _auth: str = Depends(verify_admin_password),
):
    """Update gold mission completion status."""
    if all(
        getattr(body, field) is None
        for field in ("gold_mission_1_done", "gold_mission_2_done", "gold_mission_3_done")
    ):
        raise HTTPException(status_code=400, detail="NO_FIELDS")

    updates: dict[str, bool] = {}
    if body.gold_mission_1_done is not None:
        updates["gold_mission_1_done"] = bool(body.gold_mission_1_done)
    if body.gold_mission_2_done is not None:
        updates["gold_mission_2_done"] = bool(body.gold_mission_2_done)
    if body.gold_mission_3_done is not None:
        updates["gold_mission_3_done"] = bool(body.gold_mission_3_done)

    key = validate_idempotency_key(request.headers.get("x-idempotency-key"))
    scope = idempotency_scope(request)
    endpoint = f"/api/vault/admin/users/{user_id}/vault/gold-missions"
    request_hash = hash_request_body({"user_id": user_id, **body.dict()})

    now = now_utc()
    with db.get_conn() as conn:
        cur = conn.cursor()
        _apply_job_timeouts(cur)

        cur.execute("SELECT 1 FROM user_identity WHERE user_id=%s", (user_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="USER_NOT_FOUND")

        idem = idempotency_start(cur, key=key, scope=scope, endpoint=endpoint, request_hash=request_hash)
        if idem["status"] == "replayed":
            response.headers["Idempotency-Status"] = "replayed"
            return AdminGoldMissionsUpdateResponse(**idem["response_body"])
        if idem["status"] == "in_progress":
            raise HTTPException(status_code=409, detail="IDEMPOTENCY_IN_PROGRESS")

        row = get_or_create_vault_row(cur, user_id, now)
        if not row:
            raise HTTPException(status_code=404, detail="VAULT_NOT_FOUND")

        (
            expires_at, gold_status, platinum_status, diamond_status,
            attendance_days, platinum_deposit_total, platinum_deposit_count, diamond_deposit_total,
            gold_mission_1_done, gold_mission_2_done, gold_mission_3_done, diamond_attendance_days,
            plat_m1, plat_m2,
            dia_m1, dia_m2,
        ) = row

        new_m1 = updates.get("gold_mission_1_done", bool(gold_mission_1_done))
        new_m2 = updates.get("gold_mission_2_done", bool(gold_mission_2_done))
        new_m3 = updates.get("gold_mission_3_done", bool(gold_mission_3_done))

        new_gold_status = compute_gold_status(new_m1, new_m2, new_m3, gold_status)

        set_clauses = []
        params: list[Any] = []
        if "gold_mission_1_done" in updates:
            set_clauses.append("gold_mission_1_done=%s")
            params.append(new_m1)
        if "gold_mission_2_done" in updates:
            set_clauses.append("gold_mission_2_done=%s")
            params.append(new_m2)
        if "gold_mission_3_done" in updates:
            set_clauses.append("gold_mission_3_done=%s")
            params.append(new_m3)
        if gold_status not in {"CLAIMED", "EXPIRED"}:
            set_clauses.append("gold_status=%s")
            params.append(new_gold_status)
        set_clauses.append("updated_at=%s")
        params.append(now)
        params.append(user_id)

        cur.execute(
            f"UPDATE vault_status SET {', '.join(set_clauses)} WHERE user_id=%s",
            params,
        )

        admin_user = request.client.host if request.client else "unknown"
        _log_admin_action(
            conn=conn,
            admin_user=admin_user,
            action="ADMIN_GOLD_MISSIONS_UPDATE",
            endpoint=endpoint,
            target_user_ids=[user_id],
            request_id=key,
            request_body=updates,
            response_status="SUCCESS",
            response_summary={
                "gold_mission_1_done": new_m1,
                "gold_mission_2_done": new_m2,
                "gold_mission_3_done": new_m3,
                "gold_status": new_gold_status,
            },
            idempotency_key=key,
        )

        response_body = {
            "updated": True,
            "gold_mission_1_done": new_m1,
            "gold_mission_2_done": new_m2,
            "gold_mission_3_done": new_m3,
            "gold_status": new_gold_status,
            "expires_at": expires_at.isoformat() if expires_at else None,
        }

        idempotency_finish(
            cur, key=key, scope=scope, endpoint=endpoint,
            response_status=200, response_body=response_body,
        )

        conn.commit()
        response.headers["Idempotency-Status"] = "recorded"
        return AdminGoldMissionsUpdateResponse(**response_body)


@router.post("/{user_id}/vault/platinum-missions", response_model=AdminPlatinumMissionsUpdateResponse)
async def admin_update_platinum_missions(
    user_id: int,
    body: AdminPlatinumMissionsUpdateRequest,
    request: Request,
    response: Response,
    _auth: str = Depends(verify_admin_password),
):
    """Update platinum mission completion status."""
    if all(
        getattr(body, field) is None
        for field in ("platinum_mission_1_done", "platinum_mission_2_done")
    ):
        raise HTTPException(status_code=400, detail="NO_FIELDS")

    updates: dict[str, bool] = {}
    if body.platinum_mission_1_done is not None:
        updates["platinum_mission_1_done"] = bool(body.platinum_mission_1_done)
    if body.platinum_mission_2_done is not None:
        updates["platinum_mission_2_done"] = bool(body.platinum_mission_2_done)

    key = validate_idempotency_key(request.headers.get("x-idempotency-key"))
    scope = idempotency_scope(request)
    endpoint = f"/api/vault/admin/users/{user_id}/vault/platinum-missions"
    request_hash = hash_request_body({"user_id": user_id, **body.dict()})

    now = now_utc()
    with db.get_conn() as conn:
        cur = conn.cursor()
        _apply_job_timeouts(cur)

        cur.execute("SELECT 1 FROM user_identity WHERE user_id=%s", (user_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="USER_NOT_FOUND")

        idem = idempotency_start(cur, key=key, scope=scope, endpoint=endpoint, request_hash=request_hash)
        if idem["status"] == "replayed":
            response.headers["Idempotency-Status"] = "replayed"
            return AdminPlatinumMissionsUpdateResponse(**idem["response_body"])
        if idem["status"] == "in_progress":
            raise HTTPException(status_code=409, detail="IDEMPOTENCY_IN_PROGRESS")

        row = get_or_create_vault_row(cur, user_id, now)
        if not row:
            raise HTTPException(status_code=404, detail="VAULT_NOT_FOUND")

        (
            expires_at, _gold_status, platinum_status, _diamond_status,
            _attendance_days, _platinum_deposit_total, _platinum_deposit_count, _diamond_deposit_total,
            _gold_m1, _gold_m2, _gold_m3, _diamond_attendance_days,
            plat_m1, plat_m2,
            dia_m1, dia_m2,
        ) = row

        new_m1 = updates.get("platinum_mission_1_done", bool(plat_m1))
        new_m2 = updates.get("platinum_mission_2_done", bool(plat_m2))

        # Recompute status
        # Note: We need some data from the row for computation
        # (expires_at, gold_status, plat_status, dia_status, att, dep_tot, dep_cnt, dia_dep, ...)
        # In admin_update_platinum_missions, we unpacked:
        # (expires_at, _gold_status, platinum_status, _diamond_status, _att, _plat_dep_tot, _plat_dep_cnt, ...)
        
        # We need to re-fetch or use what we have. Let's look at the SELECT in get_or_create_vault_row:
        # 0:expires, 1:gold, 2:plat, 3:dia, 4:plat_att, 5:plat_dep_tot, 6:plat_dep_cnt, 7:dia_dep_tot
        
        gold_status = row[1]
        attendance_days = row[4]
        plat_dep_tot = row[5]
        plat_dep_cnt = row[6]

        # Get review_ok from snapshot
        cur.execute("SELECT review_ok FROM user_admin_snapshot WHERE user_id=%s", (user_id,))
        snap_row = cur.fetchone()
        review_ok = bool(snap_row[0]) if snap_row and snap_row[0] is not None else False

        new_platinum_status = compute_platinum_status(
            deposit_total=int(plat_dep_tot or 0),
            deposit_count=int(plat_dep_cnt or 0),
            attendance_days=int(attendance_days or 0),
            review_ok=review_ok,
            m1=new_m1,
            m2=new_m2,
            gold_status=gold_status,
            current_status=platinum_status,
        )

        set_clauses = ["updated_at=%s"]
        params: list[Any] = [now]
        if "platinum_mission_1_done" in updates:
            set_clauses.append("platinum_mission_1_done=%s")
            params.append(new_m1)
        if "platinum_mission_2_done" in updates:
            set_clauses.append("platinum_mission_2_done=%s")
            params.append(new_m2)
        
        if new_platinum_status != platinum_status:
            set_clauses.append("platinum_status=%s")
            params.append(new_platinum_status)

        params.append(user_id)

        cur.execute(
            f"UPDATE vault_status SET {', '.join(set_clauses)} WHERE user_id=%s",
            params,
        )

        admin_user = request.client.host if request.client else "unknown"
        _log_admin_action(
            conn=conn,
            admin_user=admin_user,
            action="ADMIN_PLATINUM_MISSIONS_UPDATE",
            endpoint=endpoint,
            target_user_ids=[user_id],
            request_id=key,
            request_body=updates,
            response_status="SUCCESS",
            response_summary={
                "platinum_mission_1_done": new_m1,
                "platinum_mission_2_done": new_m2,
                "platinum_status": platinum_status,
            },
            idempotency_key=key,
        )

        response_body = {
            "updated": True,
            "platinum_mission_1_done": new_m1,
            "platinum_mission_2_done": new_m2,
            "platinum_status": new_platinum_status,
            "expires_at": expires_at.isoformat() if expires_at else None,
        }

        idempotency_finish(
            cur, key=key, scope=scope, endpoint=endpoint,
            response_status=200, response_body=response_body,
        )

        conn.commit()
        response.headers["Idempotency-Status"] = "recorded"
        return AdminPlatinumMissionsUpdateResponse(**response_body)


@router.post("/{user_id}/vault/diamond-missions", response_model=AdminDiamondMissionsUpdateResponse)
async def admin_update_diamond_missions(
    user_id: int,
    body: AdminDiamondMissionsUpdateRequest,
    request: Request,
    response: Response,
    _auth: str = Depends(verify_admin_password),
):
    """Update diamond mission completion status."""
    if all(
        getattr(body, field) is None
        for field in ("diamond_mission_1_done", "diamond_mission_2_done")
    ):
        raise HTTPException(status_code=400, detail="NO_FIELDS")

    updates: dict[str, bool] = {}
    if body.diamond_mission_1_done is not None:
        updates["diamond_mission_1_done"] = bool(body.diamond_mission_1_done)
    if body.diamond_mission_2_done is not None:
        updates["diamond_mission_2_done"] = bool(body.diamond_mission_2_done)

    key = validate_idempotency_key(request.headers.get("x-idempotency-key"))
    scope = idempotency_scope(request)
    endpoint = f"/api/vault/admin/users/{user_id}/vault/diamond-missions"
    request_hash = hash_request_body({"user_id": user_id, **body.dict()})

    now = now_utc()
    with db.get_conn() as conn:
        cur = conn.cursor()
        _apply_job_timeouts(cur)

        cur.execute("SELECT 1 FROM user_identity WHERE user_id=%s", (user_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="USER_NOT_FOUND")

        idem = idempotency_start(cur, key=key, scope=scope, endpoint=endpoint, request_hash=request_hash)
        if idem["status"] == "replayed":
            response.headers["Idempotency-Status"] = "replayed"
            return AdminDiamondMissionsUpdateResponse(**idem["response_body"])
        if idem["status"] == "in_progress":
            raise HTTPException(status_code=409, detail="IDEMPOTENCY_IN_PROGRESS")

        row = get_or_create_vault_row(cur, user_id, now)
        if not row:
            raise HTTPException(status_code=404, detail="VAULT_NOT_FOUND")

        (
            expires_at, _gold_status, _platinum_status, diamond_status,
            _attendance_days, _platinum_deposit_total, _platinum_deposit_count, _diamond_deposit_total,
            _gold_m1, _gold_m2, _gold_m3, _diamond_attendance_days,
            _plat_m1, _plat_m2,
            dia_m1, dia_m2,
        ) = row

        new_m1 = updates.get("diamond_mission_1_done", bool(dia_m1))
        new_m2 = updates.get("diamond_mission_2_done", bool(dia_m2))

        # Recompute status
        # 0:expires, 1:gold, 2:plat, 3:dia, 4:att, 7:dia_dep_tot
        platinum_status = row[2]
        dia_dep_tot = row[7]
        dia_att = row[11]

        new_diamond_status = compute_diamond_status(
            deposit_total=int(dia_dep_tot or 0),
            attendance_days=int(dia_att or 0),
            m1=new_m1,
            m2=new_m2,
            platinum_status=platinum_status,
            current_status=diamond_status,
        )

        set_clauses = ["updated_at=%s"]
        params: list[Any] = [now]
        if "diamond_mission_1_done" in updates:
            set_clauses.append("diamond_mission_1_done=%s")
            params.append(new_m1)
        if "diamond_mission_2_done" in updates:
            set_clauses.append("diamond_mission_2_done=%s")
            params.append(new_m2)
        
        if new_diamond_status != diamond_status:
            set_clauses.append("diamond_status=%s")
            params.append(new_diamond_status)

        params.append(user_id)

        cur.execute(
            f"UPDATE vault_status SET {', '.join(set_clauses)} WHERE user_id=%s",
            params,
        )

        admin_user = request.client.host if request.client else "unknown"
        _log_admin_action(
            conn=conn,
            admin_user=admin_user,
            action="ADMIN_DIAMOND_MISSIONS_UPDATE",
            endpoint=endpoint,
            target_user_ids=[user_id],
            request_id=key,
            request_body=updates,
            response_status="SUCCESS",
            response_summary={
                "diamond_mission_1_done": new_m1,
                "diamond_mission_2_done": new_m2,
                "diamond_status": diamond_status,
            },
            idempotency_key=key,
        )

        response_body = {
            "updated": True,
            "diamond_mission_1_done": new_m1,
            "diamond_mission_2_done": new_m2,
            "diamond_status": new_diamond_status,
            "expires_at": expires_at.isoformat() if expires_at else None,
        }

        idempotency_finish(
            cur, key=key, scope=scope, endpoint=endpoint,
            response_status=200, response_body=response_body,
        )

        conn.commit()
        response.headers["Idempotency-Status"] = "recorded"
        return AdminDiamondMissionsUpdateResponse(**response_body)


@router.post("/{user_id}/vault/status", response_model=AdminStatusUpdateResponse)
async def admin_update_vault_status(
    user_id: int,
    body: AdminStatusUpdateRequest,
    request: Request,
    response: Response,
    _auth: str = Depends(verify_admin_password),
):
    """Update vault status directly."""
    now = now_utc()
    updates = {}
    if body.gold_status is not None:
        updates["gold_status"] = validate_status(body.gold_status, "gold_status")
    if body.platinum_status is not None:
        updates["platinum_status"] = validate_status(body.platinum_status, "platinum_status")
    if body.diamond_status is not None:
        updates["diamond_status"] = validate_status(body.diamond_status, "diamond_status")
    if not updates:
        raise HTTPException(status_code=400, detail="NO_FIELDS")

    key = validate_idempotency_key(request.headers.get("x-idempotency-key"))
    scope = idempotency_scope(request)
    endpoint = f"/api/vault/admin/users/{user_id}/vault/status"
    request_hash = hash_request_body({"user_id": user_id, **body.dict()})

    with db.get_conn() as conn:
        cur = conn.cursor()
        _apply_job_timeouts(cur)

        cur.execute("SELECT 1 FROM user_identity WHERE user_id=%s", (user_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="USER_NOT_FOUND")

        idem = idempotency_start(cur, key=key, scope=scope, endpoint=endpoint, request_hash=request_hash)
        if idem["status"] == "replayed":
            response.headers["Idempotency-Status"] = "replayed"
            return AdminStatusUpdateResponse(**idem["response_body"])
        if idem["status"] == "in_progress":
            raise HTTPException(status_code=409, detail="IDEMPOTENCY_IN_PROGRESS")

        row = get_or_create_vault_row(cur, user_id, now)
        if not row:
            raise HTTPException(status_code=404, detail="VAULT_NOT_FOUND")

        expires_at, gold_status, platinum_status, diamond_status, *_ = row
        current = {
            "gold_status": gold_status,
            "platinum_status": platinum_status,
            "diamond_status": diamond_status,
        }

        # Validate modifications
        for col, new_val in updates.items():
            validate_status_modification(current.get(col), new_val, col)

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
            f"UPDATE vault_status SET {', '.join(set_clauses)} WHERE user_id=%s",
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

        idempotency_finish(
            cur, key=key, scope=scope, endpoint=endpoint,
            response_status=200, response_body=response_body,
        )

        conn.commit()
        response.headers["Idempotency-Status"] = "recorded"
        return AdminStatusUpdateResponse(**response_body)


@router.post("/{user_id}/vault/attendance", response_model=AdminAttendanceAdjustResponse)
async def admin_adjust_attendance(
    user_id: int,
    body: AdminAttendanceAdjustRequest,
    request: Request,
    response: Response,
    _auth: str = Depends(verify_admin_password),
):
    """Adjust platinum attendance days."""
    if body.delta_days is None and body.set_days is None:
        raise HTTPException(status_code=400, detail="NO_FIELDS")

    key = validate_idempotency_key(request.headers.get("x-idempotency-key"))
    scope = idempotency_scope(request)
    endpoint = f"/api/vault/admin/users/{user_id}/vault/attendance"
    request_hash = hash_request_body({"user_id": user_id, **body.dict()})

    delta_days = int(body.delta_days or 0)
    with db.get_conn() as conn:
        cur = conn.cursor()
        _apply_job_timeouts(cur)

        cur.execute("SELECT review_ok FROM user_admin_snapshot WHERE user_id=%s", (user_id,))
        snap_row = cur.fetchone()
        review_ok = bool(snap_row[0]) if snap_row and snap_row[0] is not None else False

        idem = idempotency_start(cur, key=key, scope=scope, endpoint=endpoint, request_hash=request_hash)
        if idem["status"] == "replayed":
            response.headers["Idempotency-Status"] = "replayed"
            return AdminAttendanceAdjustResponse(**idem["response_body"])
        if idem["status"] == "in_progress":
            raise HTTPException(status_code=409, detail="IDEMPOTENCY_IN_PROGRESS")

        row = get_or_create_vault_row(cur, user_id, now_utc())
        if not row:
            raise HTTPException(status_code=404, detail="VAULT_NOT_FOUND")

        (
            expires_at, gold_status, platinum_status, diamond_status,
            attendance_days, platinum_deposit_total, platinum_deposit_count, _diamond_deposit_total, *_rest
        ) = row
        current_days = int(attendance_days or 0)

        if body.set_days is not None:
            target_days = clamp_attendance_days(int(body.set_days))
        else:
            target_days = clamp_attendance_days(current_days + delta_days)

        new_platinum_status = compute_platinum_status(
            deposit_total=int(platinum_deposit_total or 0),
            deposit_count=int(platinum_deposit_count or 0),
            attendance_days=target_days,
            review_ok=review_ok,
            m1=bool(row[12]), # plat_mission_1_done
            m2=bool(row[13]), # plat_mission_2_done
            gold_status=gold_status,
            current_status=platinum_status,
        )

        now = now_utc()
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

        idempotency_finish(
            cur, key=key, scope=scope, endpoint=endpoint,
            response_status=200, response_body=response_body,
        )

        conn.commit()
        response.headers["Idempotency-Status"] = "recorded"
        return AdminAttendanceAdjustResponse(**response_body)
