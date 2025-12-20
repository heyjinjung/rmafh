from pydantic import BaseModel, Field
from typing import List, Optional


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
    user_ids: List[int]
    variant_id: Optional[str] = None


class NotifyResponse(BaseModel):
    enqueued: int


class CompensationEnqueueRequest(BaseModel):
    user_id: int
    vault_type: str
    request_id: str
    external_service: str
    payload: dict


class HealthResponse(BaseModel):
    status: str
