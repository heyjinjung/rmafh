from datetime import date, datetime
from typing import Any


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
