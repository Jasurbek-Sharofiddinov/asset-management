import re
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.models.user import UserRole

MIN_PASSWORD_LENGTH = 8
MIN_TEMP_PASSWORD_LENGTH = 4
MAX_PASSWORD_BYTES = 72
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _validate_password(password: str) -> str:
    password_bytes = password.encode("utf-8")
    if len(password_bytes) > MAX_PASSWORD_BYTES:
        raise ValueError(
            f"Password cannot exceed {MAX_PASSWORD_BYTES} bytes "
            "(bcrypt limit). Use a shorter password."
        )
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(
            f"Password must be at least {MIN_PASSWORD_LENGTH} characters."
        )
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must contain at least one lowercase letter.")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain at least one uppercase letter.")
    if not re.search(r"\d", password):
        raise ValueError("Password must contain at least one digit.")
    return password


def _validate_temporary_password(password: str) -> str:
    """Admin-set temp passwords: short and simple is allowed.

    The user is forced onto the strong policy at first login / after reset.
    """
    value = (password or "").strip()
    if len(value.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValueError(
            f"Password cannot exceed {MAX_PASSWORD_BYTES} bytes "
            "(bcrypt limit). Use a shorter password."
        )
    if len(value) < MIN_TEMP_PASSWORD_LENGTH:
        raise ValueError(
            f"Temporary password must be at least {MIN_TEMP_PASSWORD_LENGTH} characters."
        )
    return value


class LoginRequest(BaseModel):
    email: str
    password: str
    # Optional org slug — required when the same email exists in multiple orgs
    organization_slug: Optional[str] = None


class OrganizationSignupRequest(BaseModel):
    organization_name: str = Field(..., min_length=1, max_length=255)
    contact_email: str = Field(..., min_length=3, max_length=255)
    admin_full_name: str = Field(..., min_length=1, max_length=255)
    password: str
    contact_phone: Optional[str] = Field(None, max_length=50)
    website: Optional[str] = Field(None, max_length=255)
    country: Optional[str] = Field(None, max_length=100)
    institution_type: Optional[str] = Field(None, max_length=100)
    use_case: Optional[str] = Field(None, max_length=5000)

    @field_validator("organization_name", "admin_full_name")
    @classmethod
    def strip_required(cls, v: str) -> str:
        value = v.strip()
        if not value:
            raise ValueError("This field cannot be empty.")
        return value

    @field_validator("contact_email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        email = v.strip().lower()
        if not _EMAIL_RE.match(email):
            raise ValueError("Invalid email address.")
        return email

    @field_validator("password")
    @classmethod
    def password_policy(cls, v: str) -> str:
        return _validate_password(v)

    @field_validator(
        "contact_phone", "website", "country", "institution_type", "use_case"
    )
    @classmethod
    def strip_optional(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        stripped = v.strip()
        return stripped or None


class OrganizationSignupResponse(BaseModel):
    detail: str = (
        "Your application has been received and is awaiting review."
    )


class CreateUserRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)
    email: str = Field(..., min_length=3, max_length=255)
    password: str
    role: UserRole = UserRole.VIEWER

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        email = v.strip().lower()
        if not _EMAIL_RE.match(email):
            raise ValueError("Invalid email address.")
        return email

    @field_validator("password")
    @classmethod
    def password_policy(cls, v: str) -> str:
        return _validate_temporary_password(v)

    @field_validator("role", mode="before")
    @classmethod
    def normalize_role(cls, v):
        if isinstance(v, str):
            return v.upper()
        return v


# Backwards-compatible alias for any remaining imports
RegisterRequest = CreateUserRequest


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    must_change_password: bool = False
    last_login: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str
    user_id: uuid.UUID
    full_name: str
    email: str
    must_change_password: bool = False


class UpdateUserRequest(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None

    @field_validator("full_name")
    @classmethod
    def strip_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        name = v.strip()
        if not name:
            raise ValueError("Name cannot be empty.")
        return name

    @field_validator("role", mode="before")
    @classmethod
    def normalize_role(cls, v):
        if isinstance(v, str):
            return v.upper()
        return v


class ResetPasswordRequest(BaseModel):
    password: str

    @field_validator("password")
    @classmethod
    def password_policy(cls, v: str) -> str:
        return _validate_temporary_password(v)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_policy(cls, v: str) -> str:
        return _validate_password(v)


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = None


class TenantInfoResponse(BaseModel):
    slug: str
    name: str


class WorkspaceLookupRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        email = v.strip().lower()
        if not _EMAIL_RE.match(email):
            raise ValueError("Invalid email address.")
        return email


class WorkspaceItem(BaseModel):
    slug: str
    name: str


class WorkspaceLookupResponse(BaseModel):
    items: list[WorkspaceItem] = []
