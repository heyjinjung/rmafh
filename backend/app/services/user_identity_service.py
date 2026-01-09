"""User identity service layer.

Handles user identity resolution, creation, and bulk operations.
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List

from fastapi import HTTPException

from app import db
from app.services.common import now_utc, normalize_external_user_id


def get_user_id_by_external_user_id(cur, external_user_id: str) -> int | None:
    """Get user_id by external_user_id."""
    cur.execute(
        "SELECT user_id FROM user_identity WHERE external_user_id=%s",
        (external_user_id,),
    )
    row = cur.fetchone()
    return int(row[0]) if row else None


def get_or_create_user_id_by_external_user_id(cur, external_user_id: str) -> int:
    """Get or create user_id by external_user_id."""
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
    user_id = get_user_id_by_external_user_id(cur, external_user_id)
    if user_id is None:
        raise RuntimeError("failed to resolve user_id for external_user_id")
    return user_id


def resolve_user_id(
    cur,
    *,
    user_id: int | None,
    external_user_id: str | None,
    default_user_id: int | None,
    create_if_missing: bool,
) -> int:
    """Resolve user_id from various inputs."""
    ext = normalize_external_user_id(external_user_id)
    if ext:
        if create_if_missing:
            return get_or_create_user_id_by_external_user_id(cur, ext)
        resolved = get_user_id_by_external_user_id(cur, ext)
        if resolved is None:
            raise HTTPException(status_code=404, detail="EXTERNAL_USER_NOT_FOUND")
        return resolved

    if user_id is not None:
        return int(user_id)
    if default_user_id is None:
        raise HTTPException(status_code=400, detail="USER_REQUIRED")
    return int(default_user_id)


def resolve_user_ids_by_external_user_ids(cur, external_user_ids: list[str]) -> list[int]:
    """Resolve multiple external_user_ids to user_ids."""
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


def bulk_get_or_create_user_ids_by_external_user_ids(cur, external_user_ids: list[str]) -> dict[str, int]:
    """Bulk get or create user_ids by external_user_ids."""
    cleaned = [str(v).strip() for v in (external_user_ids or []) if str(v).strip()]
    if not cleaned:
        return {}

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
