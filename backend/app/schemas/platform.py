import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.models.organization import OrganizationPlan
from app.schemas.auth import _EMAIL_RE


class PlatformLoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class PlatformAdminResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    is_active: bool
    last_login: Optional[datetime] = None

    model_config = {"from_attributes": True}


class PlatformTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    admin_id: uuid.UUID
    full_name: str
    email: str


class PlatformRefreshRequest(BaseModel):
    refresh_token: str


class PlatformLogoutRequest(BaseModel):
    refresh_token: Optional[str] = None


class OrganizationPlatformSummary(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    status: str
    plan: str
    contact_email: Optional[str] = None
    country: Optional[str] = None
    institution_type: Optional[str] = None
    created_at: datetime
    trial_ends_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class OrganizationPlatformDetail(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    status: str
    plan: str
    trial_ends_at: Optional[datetime] = None
    grace_ends_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    website: Optional[str] = None
    country: Optional[str] = None
    institution_type: Optional[str] = None
    use_case: Optional[str] = None
    signup_ip: Optional[str] = None
    signup_user_agent: Optional[str] = None
    rejection_reason: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[uuid.UUID] = None
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


class OrganizationListResponse(BaseModel):
    items: list[OrganizationPlatformSummary]
    total: int
    page: int
    pages: int


class ActivateOrganizationRequest(BaseModel):
    slug: str = Field(..., min_length=3, max_length=63)
    plan: OrganizationPlan = OrganizationPlan.STARTER
    admin_email: Optional[str] = None
    admin_full_name: Optional[str] = None

    @field_validator("admin_email")
    @classmethod
    def validate_admin_email(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        email = v.strip().lower()
        if not _EMAIL_RE.match(email):
            raise ValueError("Invalid email address.")
        return email


class ActivateOrganizationResponse(BaseModel):
    organization: OrganizationPlatformDetail
    invite_token: Optional[str] = None
    admin_email: str
    admin_user_id: uuid.UUID


class RejectOrganizationRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=2000)


class SuspendOrganizationRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=2000)


class OrganizationPatchRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    plan: Optional[OrganizationPlan] = None
    notes: Optional[str] = Field(None, max_length=5000)
    trial_ends_at: Optional[datetime] = None


class CreateOrganizationRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: Optional[str] = Field(None, min_length=3, max_length=63)
    contact_email: Optional[str] = None
    plan: OrganizationPlan = OrganizationPlan.STARTER
    notes: Optional[str] = Field(None, max_length=5000)

    @field_validator("contact_email")
    @classmethod
    def validate_contact_email(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        email = v.strip().lower()
        if not email:
            return None
        if not _EMAIL_RE.match(email):
            raise ValueError("Invalid email address.")
        return email

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        name = v.strip()
        if not name:
            raise ValueError("Name cannot be empty.")
        return name


class OrganizationStatsResponse(BaseModel):
    total: int
    by_status: dict[str, int]
    pending_review: int
    trials_expiring_soon: list[OrganizationPlatformSummary]


class PlatformAuditEntry(BaseModel):
    id: int
    actor_email: str
    action: str
    target_organization_id: Optional[uuid.UUID] = None
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    old_value: Optional[dict] = None
    new_value: Optional[dict] = None
    reason: Optional[str] = None
    ip_address: Optional[str] = None
    occurred_at: datetime

    model_config = {"from_attributes": True}


class PlatformAuditListResponse(BaseModel):
    items: list[PlatformAuditEntry]
    total: int
    page: int
    pages: int
