"""Admin users router.

Endpoints for admin user management (CRUD operations).
"""

from datetime import timedelta
from typing import Any

from fastapi import APIRouter, HTTPException, Depends, Request, Response
from psycopg2.extras import Json

from app import db
from app.schemas import (
    AdminUserCreateRequest,
    AdminUserUpdateRequest,
    AdminUserResponse,
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
    normalize_external_user_id,
    parse_joined_date,
)
from app.services.vault_service import get_or_create_vault_row

router = APIRouter(prefix="/api/vault/admin/users", tags=["admin-users"])


@router.get("")
async def get_all_users(
    query: str | None = None,
    status: str | None = None,
    sort_by: str | None = None,
    sort_dir: str | None = None,
    page: int = 1,
    page_size: int = 50,
    _auth: str = Depends(verify_admin_password),
):
    """회원 리스트 조회 (서버 페이징/정렬/필터)."""
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
                vs.gold_mission_1_done,
                vs.gold_mission_2_done,
                vs.gold_mission_3_done,
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
            joined_date = row[17]
            max_attendance_days = 0
            if joined_date:
                days_since_join = (today - joined_date).days
                max_attendance_days = max(0, days_since_join)

            actual_attendance = row[10] or 0
            capped_attendance = min(actual_attendance, max_attendance_days) if joined_date else actual_attendance

            deposit_total = int(row[14] or 0)
            platinum_deposit_done = bool(row[11])
            diamond_deposit_current = int(row[12] or 0) or deposit_total

            users.append({
                "user_id": row[0],
                "external_user_id": row[1],
                "created_at": row[2].isoformat() if row[2] else None,
                "expires_at": row[3].isoformat() if row[3] else None,
                "gold_status": row[4] or "LOCKED",
                "gold_mission_1_done": bool(row[5]),
                "gold_mission_2_done": bool(row[6]),
                "gold_mission_3_done": bool(row[7]),
                "platinum_status": row[8] or "LOCKED",
                "diamond_status": row[9] or "LOCKED",
                "platinum_attendance_days": capped_attendance,
                "max_attendance_days": max_attendance_days,
                "joined_date": joined_date.isoformat() if joined_date else None,
                "platinum_deposit_done": platinum_deposit_done,
                "diamond_deposit_current": diamond_deposit_current,
                "review_ok": row[13] or False,
                "deposit_total": deposit_total,
                "nickname": row[15] or "",
                "telegram_ok": row[16] or False,
            })

        return {"users": users, "total": total, "page": page, "page_size": page_size}


@router.post("", response_model=AdminUserResponse)
async def admin_create_user(
    body: AdminUserCreateRequest,
    request: Request,
    response: Response,
    _auth: str = Depends(verify_admin_password),
):
    """Create a new user."""
    ext = normalize_external_user_id(body.external_user_id)
    if not ext:
        raise HTTPException(status_code=400, detail="EXTERNAL_USER_ID_REQUIRED")

    joined_date = parse_joined_date(body.joined_date)
    nickname = (body.nickname or "").strip() or None
    deposit_total = int(body.deposit_total or 0)
    telegram_ok = bool(body.telegram_ok)
    review_ok = bool(body.review_ok)

    key = validate_idempotency_key(request.headers.get("x-idempotency-key"))
    scope = idempotency_scope(request)
    endpoint = "/api/vault/admin/users"
    request_hash = hash_request_body(body.dict())

    now = now_utc()
    with db.get_conn() as conn:
        cur = conn.cursor()
        idem = idempotency_start(cur, key=key, scope=scope, endpoint=endpoint, request_hash=request_hash)
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

            idempotency_finish(
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


@router.patch("/{user_id}", response_model=AdminUserResponse)
async def admin_update_user(
    user_id: int,
    body: AdminUserUpdateRequest,
    request: Request,
    response: Response,
    _auth: str = Depends(verify_admin_password),
):
    """Update a user's admin snapshot."""
    if all(
        getattr(body, field) is None
        for field in ("nickname", "joined_date", "deposit_total", "telegram_ok", "review_ok")
    ):
        raise HTTPException(status_code=400, detail="NO_FIELDS")

    nickname = None if body.nickname is None else (body.nickname or "").strip() or None
    joined_date = parse_joined_date(body.joined_date) if body.joined_date is not None else None
    deposit_total = None if body.deposit_total is None else int(body.deposit_total)
    telegram_ok = None if body.telegram_ok is None else bool(body.telegram_ok)
    review_ok = None if body.review_ok is None else bool(body.review_ok)

    now = now_utc()
    key = validate_idempotency_key(request.headers.get("x-idempotency-key"))
    scope = idempotency_scope(request)
    endpoint = f"/api/vault/admin/users/{user_id}"
    request_hash = hash_request_body({"user_id": user_id, **body.dict()})

    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT external_user_id, created_at FROM user_identity WHERE user_id=%s", (user_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="USER_NOT_FOUND")
        external_user_id, created_at = row[0], row[1]

        idem = idempotency_start(cur, key=key, scope=scope, endpoint=endpoint, request_hash=request_hash)
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
            f"UPDATE user_admin_snapshot SET {', '.join(set_parts)} WHERE user_id=%s",
            params,
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="SNAPSHOT_NOT_FOUND")

        if telegram_ok is not None:
            vault_row = get_or_create_vault_row(cur, user_id, now)
            if vault_row:
                _expires_at, gold_status, *_rest = vault_row
                if gold_status != "CLAIMED":
                    new_gold_status = "UNLOCKED" if telegram_ok else "LOCKED"
                    cur.execute(
                        "UPDATE vault_status SET gold_status=%s, updated_at=%s WHERE user_id=%s",
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
            "SELECT nickname, joined_date, deposit_total, telegram_ok, review_ok FROM user_admin_snapshot WHERE user_id=%s",
            (user_id,),
        )
        snap = cur.fetchone()

        cur.execute("SELECT expires_at FROM vault_status WHERE user_id=%s", (user_id,))
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

        idempotency_finish(
            cur, key=key, scope=scope, endpoint=endpoint,
            response_status=200, response_body=response_body,
        )

        conn.commit()
        response.headers["Idempotency-Status"] = "recorded"
        return AdminUserResponse(**response_body)


@router.delete("/{user_id}")
async def admin_delete_user(
    user_id: int,
    request: Request,
    response: Response,
    _auth: str = Depends(verify_admin_password),
):
    """Delete a user."""
    key = validate_idempotency_key(request.headers.get("x-idempotency-key"))
    scope = idempotency_scope(request)
    endpoint = f"/api/vault/admin/users/{user_id}"
    request_hash = hash_request_body({"user_id": user_id})

    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT external_user_id FROM user_identity WHERE user_id=%s", (user_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="USER_NOT_FOUND")
        external_user_id = row[0]

        idem = idempotency_start(cur, key=key, scope=scope, endpoint=endpoint, request_hash=request_hash)
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
        idempotency_finish(
            cur, key=key, scope=scope, endpoint=endpoint,
            response_status=200, response_body=response_body,
        )

        conn.commit()
        response.headers["Idempotency-Status"] = "recorded"
        return response_body
