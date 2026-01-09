from typing import Any

from fastapi import HTTPException

from app import config
from app.utils.parsers import _parse_date_optional, _parse_int_optional


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
