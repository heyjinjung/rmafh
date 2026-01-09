"""Dependencies for router injection.

This module provides common dependencies (auth verification, idempotency helpers, etc.)
that are shared across routers.
"""

from fastapi import Depends, Header, Request
from app.utils.auth import verify_admin_password

# Re-export verify_admin_password for router usage
__all__ = ["verify_admin_password", "get_admin_user", "get_idempotency_key"]


def get_admin_user(request: Request) -> str:
    """Extract admin user identifier from request."""
    return request.client.host if request.client else "unknown"


def get_idempotency_key(x_idempotency_key: str | None = Header(default=None)) -> str | None:
    """Extract idempotency key from request headers."""
    return x_idempotency_key
