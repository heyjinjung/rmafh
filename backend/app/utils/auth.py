from fastapi import Header, HTTPException

from app import config


def verify_admin_password(x_admin_password: str | None = Header(None)):
    if x_admin_password is None:
        if config.ALLOW_INSECURE_ADMIN_BYPASS:
            return "bypass"
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")
    if x_admin_password != config.ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")
    return x_admin_password
