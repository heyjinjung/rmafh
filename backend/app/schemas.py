from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional


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


class AdminSegmentFilters(BaseModel):
    status: List[str] = []
    expiresAfter: Optional[str] = None
    expiresBefore: Optional[str] = None
    depositMin: Optional[int] = None
    depositMax: Optional[int] = None
    attendanceMin: Optional[int] = None
    attendanceMax: Optional[int] = None
    telegramOk: bool = False
    reviewOk: bool = False


class AdminSegmentCreateRequest(BaseModel):
    name: str
    filters: AdminSegmentFilters


class AdminSegmentItem(BaseModel):
    segment_id: str
    name: str
    filters: Dict[str, Any]
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class AdminSegmentsListResponse(BaseModel):
    items: List[AdminSegmentItem]


class AdminUsersFilter(BaseModel):
    query: Optional[str] = None
    status: Optional[str] = None


class AdminExtendExpiryTarget(BaseModel):
    mode: str  # user_ids | filter | segment
    user_ids: Optional[List[int]] = None
    filter: Optional[AdminUsersFilter] = None
    segment_id: Optional[str] = None


class AdminExtendExpiryRequest(BaseModel):
    request_id: str
    target: AdminExtendExpiryTarget
    extend_hours: int
    reason: str  # OPS | PROMO | ADMIN
    shadow: bool = False


class NotifyRequest(BaseModel):
    type: str
    user_ids: Optional[List[int]] = None
    external_user_ids: Optional[List[str]] = None
    variant_id: Optional[str] = None


class NotifyResponse(BaseModel):
    enqueued: int


class AdminNotificationItem(BaseModel):
    id: int
    user_id: int
    external_user_id: Optional[str] = None
    type: str
    variant_id: Optional[str] = None
    status: str
    scheduled_at: Optional[str] = None
    created_at: Optional[str] = None
    payload: Optional[dict] = None


class AdminNotificationsListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    has_more: bool
    items: List[AdminNotificationItem]


class AdminAuditLogItem(BaseModel):
    id: int
    admin_user: str
    action: str
    endpoint: Optional[str] = None
    target_count: Optional[int] = None
    request_id: Optional[str] = None
    response_status: Optional[str] = None
    error_message: Optional[str] = None
    job_id: Optional[str] = None
    idempotency_key: Optional[str] = None
    created_at: Optional[str] = None


class AdminAuditLogListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    has_more: bool
    items: List[AdminAuditLogItem]


class CompensationEnqueueRequest(BaseModel):
    user_id: Optional[int] = None
    external_user_id: Optional[str] = None
    vault_type: str
    request_id: str
    external_service: str
    payload: dict


class HealthResponse(BaseModel):
    status: str


class AdminStatusUpdateRequest(BaseModel):
    gold_status: Optional[str] = None
    platinum_status: Optional[str] = None
    diamond_status: Optional[str] = None


class AdminStatusUpdateResponse(BaseModel):
    updated: bool
    gold_status: str
    platinum_status: str
    diamond_status: str
    expires_at: Optional[str] = None


class AdminAttendanceAdjustRequest(BaseModel):
    delta_days: Optional[int] = Field(None, description="변경할 출석 증감값(+/-). set_days가 없을 때만 사용")
    set_days: Optional[int] = Field(None, description="출석일수를 특정 값으로 설정")


class AdminAttendanceAdjustResponse(BaseModel):
    platinum_attendance_days: int
    platinum_status: str
    last_attended_at: Optional[str]
    expires_at: Optional[str]


class AdminDepositUpdateRequest(BaseModel):
    platinum_deposit_done: Optional[bool] = None
    diamond_deposit_current: Optional[int] = None


class AdminDepositUpdateResponse(BaseModel):
    platinum_deposit_done: bool
    diamond_deposit_current: int
    platinum_status: str
    diamond_status: str
    expires_at: Optional[str]


class AdminUserCreateRequest(BaseModel):
    external_user_id: str
    nickname: Optional[str] = None
    joined_date: Optional[str] = Field(None, description="YYYY-MM-DD")
    deposit_total: Optional[int] = 0
    telegram_ok: Optional[bool] = False
    review_ok: Optional[bool] = False


class AdminUserUpdateRequest(BaseModel):
    nickname: Optional[str] = None
    joined_date: Optional[str] = Field(None, description="YYYY-MM-DD")
    deposit_total: Optional[int] = None
    telegram_ok: Optional[bool] = None
    review_ok: Optional[bool] = None


class AdminUserResponse(BaseModel):
    user_id: int
    external_user_id: str
    nickname: Optional[str]
    joined_date: Optional[str]
    created_at: Optional[str]


class UserIdentityBulkRequest(BaseModel):
    external_user_ids: List[str]


class UserIdentityBulkResponse(BaseModel):
    total: int
    created: int
    resolved: int
    mappings: dict[str, int]


class DailyUserImportRow(BaseModel):
    external_user_id: str = Field(..., alias="아이디")
    nickname: Optional[str] = Field(None, alias="닉네임")
    joined_at: Optional[str] = Field(None, alias="가입일")
    deposit_total: int = Field(0, alias="입금액")
    last_deposit_at: Optional[str] = Field(None, alias="입금일")
    telegram_ok: bool = Field(False, alias="텔레그램")
    review_ok: bool = Field(False, alias="리뷰")

    class Config:
        populate_by_name = True  # 한글/영문 둘 다 허용


class DailyUserImportRequest(BaseModel):
    rows: List[DailyUserImportRow]


class DailyUserImportResponse(BaseModel):
    total: int
    processed: int
    identity_created: int
    vault_rows_updated: int
    job_id: Optional[str] = None


class AdminImportError(BaseModel):
    row_index: int
    external_user_id: Optional[str] = None
    code: str
    detail: Optional[str] = None


class AdminImportRequest(BaseModel):
    mode: Optional[str] = Field("APPLY", description="APPLY | SHADOW")
    rows: List[DailyUserImportRow]


class AdminImportResponse(BaseModel):
    shadow: bool
    total: int
    processed: int
    identity_created: int
    vault_rows_updated: int
    dedup_removed: int
    errors: List[AdminImportError] = Field(default_factory=list)
    job_ids: Optional[List[str]] = None
    error_report_csv: Optional[str] = None


class UserLoginRequest(BaseModel):
    nickname: str = Field(..., min_length=1, max_length=50, description="사용자 닉네임")


class UserLoginResponse(BaseModel):
    external_user_id: str
    nickname: str
    user_id: int


class AdminJobTarget(BaseModel):
    user_ids: Optional[List[int]] = None
    external_user_ids: Optional[List[str]] = None
    segment_id: Optional[str] = None


class AdminJobCreateRequest(BaseModel):
    type: str
    target: Optional[AdminJobTarget] = None
    payload: Optional[Dict[str, Any]] = None
    dry_run: Optional[bool] = False


class AdminJobResponse(BaseModel):
    job_id: str
    type: Optional[str] = None
    status: str
    request_id: str
    target_count: int


class AdminJobItem(BaseModel):
    job_item_id: int
    job_id: str
    user_id: int
    status: str
    error_message: Optional[str] = None
    created_at: Optional[str] = None


class AdminJobsListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    has_more: bool
    items: List[AdminJobResponse]


class AdminJobDetailResponse(BaseModel):
    job_id: str
    type: str
    status: str
    request_id: str
    target_count: int
    processed: int
    failed: int
    payload: Optional[Dict[str, Any]] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class AdminJobItemsListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    has_more: bool
    items: List[AdminJobItem]
