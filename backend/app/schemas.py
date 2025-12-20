from pydantic import BaseModel, Field
from typing import List, Optional


class ClaimRequest(BaseModel):
    vault_type: str = Field(..., description="GOLD | PLATINUM | DIAMOND")


class ClaimResponse(BaseModel):
    claimed: bool
    vault_type: str
    now: str
    expires_at: str


class AttendanceResponse(BaseModel):
    platinum_attendance_days: int
    now: str
    expires_at: str


class ReferralReviveRequest(BaseModel):
    request_id: str = Field(..., description="멱등키")
    channel: str
    invite_code: str


class ReferralReviveResponse(BaseModel):
    revived: bool
    expires_at: str


class ExtendExpiryRequest(BaseModel):
    request_id: str
    scope: str  # ALL_ACTIVE | USER_IDS
    user_ids: Optional[List[int]] = None
    external_user_ids: Optional[List[str]] = None
    extend_hours: int
    reason: str  # OPS | PROMO | ADMIN
    shadow: bool = False


class ExtendExpiryResponse(BaseModel):
    shadow: bool
    updated: int | None = None
    candidates: int | None = None
    sample_user_ids: Optional[List[int]] = None
    new_expires_at: Optional[str] = None


class NotifyRequest(BaseModel):
    type: str
    user_ids: Optional[List[int]] = None
    external_user_ids: Optional[List[str]] = None
    variant_id: Optional[str] = None


class NotifyResponse(BaseModel):
    enqueued: int


class CompensationEnqueueRequest(BaseModel):
    user_id: Optional[int] = None
    external_user_id: Optional[str] = None
    vault_type: str
    request_id: str
    external_service: str
    payload: dict


class HealthResponse(BaseModel):
    status: str
