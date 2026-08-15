import logging
from typing import Callable
from uuid import UUID

from fastapi import Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import async_session_factory
from app.models.organization import Organization, OrganizationStatus
from app.models.user import User
from app.exceptions import UnauthorizedException, ForbiddenException
from app.services.host_tenant import bound_organization_slug, tenant_host_enforced

logger = logging.getLogger(__name__)
security = HTTPBearer()

_ORG_FULL_ACCESS = frozenset(
    {
        OrganizationStatus.TRIALING.value,
        OrganizationStatus.ACTIVE.value,
    }
)
_ORG_READ_ONLY = frozenset({OrganizationStatus.PAST_DUE.value})
_SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
_PASSWORD_CHANGE_ALLOWED = frozenset(
    {
        ("GET", "/api/auth/me"),
        ("POST", "/api/auth/change-password"),
        ("POST", "/api/auth/logout"),
    }
)


def assert_organization_usable(
    organization: Organization | None,
    *,
    for_write: bool = False,
) -> None:
    """Enforce deleted_at + organization.status (additional to soft-delete).

    - trialing / active → full access
    - past_due → reads allowed; writes denied
    - suspended / deleted (and any other non-allowed status) → no access
    Unknown statuses fail closed.
    """
    if organization is None or organization.deleted_at is not None:
        raise UnauthorizedException("Organization is unavailable")

    status = organization.status
    if status in _ORG_FULL_ACCESS:
        return
    if status == OrganizationStatus.SUSPENDED.value:
        raise ForbiddenException("Organization account is suspended")
    if status == OrganizationStatus.DELETED.value:
        raise ForbiddenException("Organization account is unavailable")
    if status in _ORG_READ_ONLY:
        if for_write:
            raise ForbiddenException(
                "Organization account is past due; write access is disabled"
            )
        return
    # Fail closed for pending_review, rejected, or any future unknown value.
    raise ForbiddenException("Organization account is unavailable")


def _request_is_write(request: Request) -> bool:
    """True when the request mutates state (past_due orgs are blocked)."""
    if request.method in _SAFE_METHODS:
        return False
    # Allow session cleanup even when the org is past_due.
    path = request.url.path.rstrip("/")
    if request.method == "POST" and path.endswith("/api/auth/logout"):
        return False
    return True


async def get_db():
    async with async_session_factory() as session:
        try:
            yield session
        finally:
            await session.close()


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            issuer=settings.JWT_ISSUER,
            audience=settings.JWT_AUDIENCE,
        )
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type", "access")
        if user_id is None:
            raise UnauthorizedException("Invalid token")
        if token_type != "access":
            raise UnauthorizedException("Invalid token")
    except JWTError as e:
        logger.warning("JWT validation failed: %s", e)
        raise UnauthorizedException("Invalid or expired token")

    try:
        user_uuid = UUID(user_id)
    except (ValueError, TypeError):
        raise UnauthorizedException("Invalid token")

    result = await db.execute(
        select(User)
        .options(selectinload(User.organization))
        .where(User.id == user_uuid)
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise UnauthorizedException("User not found")
    if not user.is_active:
        raise UnauthorizedException("User account is deactivated")

    assert_organization_usable(
        user.organization,
        for_write=_request_is_write(request),
    )

    bound = bound_organization_slug(request)
    if bound:
        org_slug = user.organization.slug if user.organization is not None else None
        if org_slug != bound:
            raise ForbiddenException(
                "This request does not match the workspace host."
            )
    elif tenant_host_enforced():
        raise ForbiddenException("Sign in at your workspace URL.")

    if user.must_change_password:
        path = request.url.path.rstrip("/")
        if (request.method, path) not in _PASSWORD_CHANGE_ALLOWED:
            raise ForbiddenException(
                "Password change required before continuing"
            )

    return user


def require_role(*roles: str) -> Callable:
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise ForbiddenException(
                f"Role '{current_user.role}' is not authorized. Required: {', '.join(roles)}"
            )
        return current_user
    return role_checker
