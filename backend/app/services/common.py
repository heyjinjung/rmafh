"""Common service utilities and helpers.

Shared functions across services for DB operations, idempotency, parsing, etc.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict
import hashlib
import json
import uuid
import secrets
import logging

from fastapi import HTTPException
from psycopg2.extras import Json

from app import config, db
from app.utils.sql_builders import _apply_job_timeouts


logger = logging.getLogger("vault.service")


def now_utc() -> datetime:
    """Return current UTC datetime."""
    return datetime.now(timezone.utc)


def generate_job_id() -> str:
    """Generate a unique job ID."""
    return f"job_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{secrets.token_hex(4)}"


def hash_request_body(body: Dict[str, Any]) -> str:
    """Hash request body for idempotency comparison."""
    payload = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def validate_idempotency_key(value: str | None) -> str:
    """Return a usable idempotency key, generating one when missing."""
    raw = (value or "").strip()
    if not raw:
        raw = f"auto-{uuid.uuid4()}"
    if len(raw) > 128:
        raise HTTPException(status_code=400, detail="INVALID_IDEMPOTENCY_KEY")
    return raw


def validate_request_id(value: str | None) -> str:
    """Validate and return request_id."""
    request_id = (value or "").strip()
    if not request_id:
        raise HTTPException(status_code=400, detail="INVALID_REQUEST_ID")
    if len(request_id) > 128:
        raise HTTPException(status_code=400, detail="INVALID_REQUEST_ID")
    return request_id


def idempotency_scope(request) -> str:
    """Get idempotency scope from request."""
    return request.client.host if request.client else "unknown"


def idempotency_start(cur, *, key: str, scope: str, endpoint: str, request_hash: str) -> Dict[str, Any]:
    """Start idempotency check. Returns status dict."""
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
                endpoint, scope, key, status,
            )
            raise HTTPException(status_code=409, detail="IDEMPOTENCY_KEY_REUSE")
        if status == "DONE":
            logger.info(
                "idempotency_replayed endpoint=%s scope=%s key=%s status=%s",
                endpoint, scope, key, status,
            )
            return {
                "status": "replayed",
                "response_status": int(response_status or 200),
                "response_body": response_body,
            }
        logger.info(
            "idempotency_in_progress endpoint=%s scope=%s key=%s status=%s",
            endpoint, scope, key, status,
        )
        return {"status": "in_progress"}

    expires_at = now_utc() + timedelta(hours=config.IDEMPOTENCY_TTL_HOURS)
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
        endpoint, scope, key,
    )
    return {"status": "recorded"}


def idempotency_finish(cur, *, key: str, scope: str, endpoint: str, response_status: int, response_body: Dict[str, Any]):
    """Finish idempotency record with response."""
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
        endpoint, scope, key, response_status,
    )


def parse_bool(value) -> bool:
    """Parse boolean from various input formats."""
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    s = str(value).strip().lower()
    if not s:
        return False
    return s in {"1", "true", "t", "yes", "y", "ok", "o", "ㅇㅇ", "확인", "완료"}


def parse_int(value, default: int = 0) -> int:
    """Parse integer from various input formats."""
    if value is None:
        return default
    if isinstance(value, int):
        return value
    s = str(value).strip()
    if not s:
        return default
    s = s.replace(",", "")
    digits = "".join(ch for ch in s if ch.isdigit() or ch == "-")
    if not digits or digits == "-":
        return default
    try:
        return int(digits)
    except ValueError:
        return default


def validate_status(value: str | None, field: str) -> str:
    """Validate vault status value."""
    v = (value or "").strip().upper()
    if not v:
        raise HTTPException(status_code=400, detail=f"INVALID_{field.upper()}")
    if v not in {"LOCKED", "UNLOCKED", "CLAIMED", "EXPIRED"}:
        raise HTTPException(status_code=400, detail=f"INVALID_{field.upper()}")
    return v


def clamp_attendance_days(value: int) -> int:
    """Clamp attendance days to valid range."""
    return max(0, min(365, value))


def parse_iso_datetime(value: str | None) -> datetime | None:
    """Parse ISO datetime string."""
    s = str(value or "").strip()
    if not s:
        return None
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        if len(s) == 10 and s[4] == "-" and s[7] == "-":
            d = datetime.fromisoformat(s)
            return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        return None


def parse_joined_date(value: str | None):
    """Parse joined date from string."""
    dt = parse_iso_datetime(value)
    if dt is None:
        return None
    return dt.date()


def dedupe_int_list(values: list[int] | None, *, max_items: int) -> list[int]:
    """Deduplicate integer list."""
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


def dedupe_str_list(values: list[str] | None, *, max_items: int) -> list[str]:
    """Deduplicate string list."""
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


def normalize_external_user_id(value: str | None) -> str | None:
    """Normalize external user ID."""
    if value is None:
        return None
    v = str(value).strip()
    return v or None
