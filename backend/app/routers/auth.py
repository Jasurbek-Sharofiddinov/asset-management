from datetime import datetime, timedelta, timezone
import logging
import uuid

from fastapi import APIRouter, Depends, Request
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.dependencies import (
    get_db,
    get_current_user,
    require_role,
    assert_organization_usable,
)
from app.models.user import User, UserRole
from app.models.organization import Organization, OrganizationStatus
from app.schemas.auth import (
    LoginRequest,
    CreateUserRequest,
    UpdateUserRequest,
    ResetPasswordRequest,
    ChangePasswordRequest,
    UserResponse,
    TokenResponse,
    RefreshRequest,
    LogoutRequest,
    OrganizationSignupRequest,
    OrganizationSignupResponse,
)
from app.exceptions import (
    UnauthorizedException,
    BadRequestException,
    TooManyRequestsException,
    ForbiddenException,
    NotFoundException,
)
from app.services import refresh_token_service, organization_service
from app.services.login_rate_limiter import login_rate_limiter, signup_rate_limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def _token_claims(extra: dict) -> dict:
    return {
        **extra,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
    }


def create_access_token(user_id: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = _token_claims({
        "sub": user_id,
        "role": role,
        "type": "access",
        "exp": expire,
    })
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload = _token_claims({
        "sub": user_id,
        "type": "refresh",
        "exp": expire,
        "jti": str(uuid.uuid4()),
    })
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _decode_refresh_token(token: str) -> str:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            issuer=settings.JWT_ISSUER,
            audience=settings.JWT_AUDIENCE,
        )
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        if not user_id or token_type != "refresh":
            raise UnauthorizedException("Invalid refresh token")
        return user_id
    except JWTError as e:
        logger.warning("Refresh token decode failed: %s", e)
        raise UnauthorizedException("Invalid or expired refresh token")


async def _resolve_login_user(
    db: AsyncSession, email: str, organization_slug: str | None
) -> User | None:
    """Resolve a login email under per-org uniqueness.

    Interim policy (trial signup / multi-tenant login UX is out of scope):
    - If organization_slug is provided, match (email, org.slug).
    - If omitted and exactly one active user has that email, use that user.
    - If omitted and multiple users share the email across orgs, refuse with
      400 rather than silently picking one (avoids authenticating the wrong tenant).
    """
    query = (
        select(User)
        .options(selectinload(User.organization))
        .join(Organization, User.organization_id == Organization.id)
        .where(User.email == email)
        .where(Organization.deleted_at.is_(None))
    )
    if organization_slug:
        slug = organization_slug.strip().lower()
        query = query.where(Organization.slug == slug)

    result = await db.execute(query)
    users = list(result.scalars().all())

    if not users:
        return None
    if len(users) == 1:
        return users[0]
    # Multiple matches without a disambiguating slug
    raise BadRequestException(
        "Multiple organizations found for this email. "
        "Provide organization_slug to continue."
    )


def _token_response(user: User, access_token: str, refresh_token: str) -> TokenResponse:
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        role=user.role,
        user_id=user.id,
        full_name=user.full_name,
        email=user.email,
        must_change_password=bool(user.must_change_password),
    )


async def _get_org_user_or_404(
    db: AsyncSession, org_id: uuid.UUID, user_id: uuid.UUID
) -> User:
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.organization_id == org_id,
        )
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise NotFoundException("User not found")
    return user


async def _active_admin_count(
    db: AsyncSession, org_id: uuid.UUID, exclude_id: uuid.UUID | None = None
) -> int:
    query = select(func.count()).select_from(User).where(
        User.organization_id == org_id,
        User.role == UserRole.ADMIN.value,
        User.is_active.is_(True),
    )
    if exclude_id is not None:
        query = query.where(User.id != exclude_id)
    return (await db.execute(query)).scalar() or 0


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN.value)),
):
    result = await db.execute(
        select(User)
        .where(User.organization_id == current_user.organization_id)
        .order_by(User.created_at.asc())
    )
    return result.scalars().all()


@router.post("/users", response_model=UserResponse, status_code=201)
async def create_user(
    body: CreateUserRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN.value)),
):
    # Always stamp caller's organization — ignore any client-supplied org field
    org_id = current_user.organization_id
    result = await db.execute(
        select(User).where(
            User.organization_id == org_id,
            User.email == body.email,
        )
    )
    if result.scalar_one_or_none():
        raise BadRequestException("Email already registered")

    hashed_password = pwd_context.hash(body.password)
    user = User(
        organization_id=org_id,
        full_name=body.full_name,
        email=body.email,
        hashed_password=hashed_password,
        role=body.role.value if isinstance(body.role, UserRole) else str(body.role),
        is_active=True,
        must_change_password=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    body: UpdateUserRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN.value)),
):
    target = await _get_org_user_or_404(db, current_user.organization_id, user_id)
    is_self = target.id == current_user.id
    new_role = body.role.value if isinstance(body.role, UserRole) else body.role

    if is_self:
        if body.is_active is False:
            raise ForbiddenException("You cannot deactivate your own account")
        if new_role is not None and new_role != UserRole.ADMIN.value:
            raise ForbiddenException("You cannot demote yourself")

    losing_admin = (
        target.role == UserRole.ADMIN.value
        and target.is_active
        and (
            (body.is_active is False)
            or (new_role is not None and new_role != UserRole.ADMIN.value)
        )
    )
    if losing_admin:
        remaining = await _active_admin_count(
            db, current_user.organization_id, exclude_id=target.id
        )
        if remaining < 1:
            raise ForbiddenException(
                "Cannot remove the last active administrator"
            )

    if body.full_name is not None:
        target.full_name = body.full_name
    if new_role is not None:
        target.role = new_role
    if body.is_active is not None:
        target.is_active = body.is_active

    await db.commit()
    await db.refresh(target)
    return target


@router.post("/users/{user_id}/reset-password", response_model=UserResponse)
async def reset_user_password(
    user_id: uuid.UUID,
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN.value)),
):
    if user_id == current_user.id:
        raise ForbiddenException("Use change-password for your own account")
    target = await _get_org_user_or_404(db, current_user.organization_id, user_id)
    target.hashed_password = pwd_context.hash(body.password)
    target.must_change_password = True
    await db.commit()
    await login_rate_limiter.clear_email(target.email)
    await db.refresh(target)
    return target


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(body.current_password, current_user.hashed_password):
        raise UnauthorizedException("Current password is incorrect")
    if body.current_password == body.new_password:
        raise BadRequestException("New password must be different from the current password")
    current_user.hashed_password = pwd_context.hash(body.new_password)
    current_user.must_change_password = False
    await db.commit()
    await login_rate_limiter.clear_email(current_user.email)
    return {"detail": "Password updated"}


@router.post("/signup", response_model=OrganizationSignupResponse, status_code=202)
async def signup(
    body: OrganizationSignupRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip = _client_ip(request)
    retry_after = await signup_rate_limiter.hit(ip)
    if retry_after:
        raise TooManyRequestsException(
            detail="Too many signup attempts. Please try again later.",
            retry_after=retry_after,
        )
    ua = (request.headers.get("User-Agent") or "")[:512] or None
    await organization_service.submit_organization_application(
        db,
        organization_name=body.organization_name,
        contact_email=body.contact_email,
        admin_full_name=body.admin_full_name,
        password=body.password,
        contact_phone=body.contact_phone,
        website=body.website,
        country=body.country,
        institution_type=body.institution_type,
        use_case=body.use_case,
        signup_ip=ip if ip != "unknown" else None,
        signup_user_agent=ua,
    )
    return OrganizationSignupResponse()


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip = _client_ip(request)
    email = body.email.strip().lower()
    retry_after = await login_rate_limiter.check_locked(ip, email)
    if retry_after:
        raise TooManyRequestsException(
            detail="Too many login attempts. Please try again later.",
            retry_after=retry_after,
        )

    try:
        user = await _resolve_login_user(db, email, body.organization_slug)
    except BadRequestException:
        # Ambiguous email is not a failed password attempt; surface immediately
        raise

    if not user or not verify_password(body.password, user.hashed_password):
        lockout = await login_rate_limiter.record_failure(ip, email)
        if lockout:
            raise TooManyRequestsException(
                detail="Too many login attempts. Please try again later.",
                retry_after=lockout,
            )
        raise UnauthorizedException("Incorrect email or password")

    if not user.is_active:
        raise UnauthorizedException("User account is deactivated")

    org = user.organization
    if org is not None:
        if org.status == OrganizationStatus.PENDING_REVIEW.value:
            raise ForbiddenException(
                "Your organization is awaiting activation"
            )
        if org.status == OrganizationStatus.REJECTED.value:
            raise ForbiddenException(
                "Your organization application was not approved"
            )

    # past_due may log in (read-only session); suspended/deleted are denied.
    assert_organization_usable(org, for_write=False)

    await login_rate_limiter.clear(ip, email)

    user.last_login = datetime.now(timezone.utc)
    access_token = create_access_token(str(user.id), user.role)
    refresh_token = create_refresh_token(str(user.id))
    await refresh_token_service.store_refresh_token(
        db, user_id=user.id, token=refresh_token
    )
    await db.commit()

    return _token_response(user, access_token, refresh_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    user_id = _decode_refresh_token(body.refresh_token)

    try:
        user_uuid = uuid.UUID(user_id)
    except (ValueError, TypeError):
        raise UnauthorizedException("Invalid or expired refresh token")

    result = await db.execute(
        select(User)
        .options(selectinload(User.organization))
        .where(User.id == user_uuid)
    )
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise UnauthorizedException("User not found or deactivated")

    # Re-check org status on every refresh so suspension takes effect immediately
    # (no bulk revoke-on-suspend endpoint yet). past_due may still refresh (reads).
    assert_organization_usable(user.organization, for_write=False)

    new_access_token = create_access_token(str(user.id), user.role)
    new_refresh_token = create_refresh_token(str(user.id))

    try:
        rotated = await refresh_token_service.rotate_refresh_token(
            db,
            presented_token=body.refresh_token,
            user_id=user.id,
            new_token=new_refresh_token,
        )
    except ValueError:
        await db.commit()
        raise UnauthorizedException("Invalid or expired refresh token")

    if rotated is None:
        raise UnauthorizedException("Invalid or expired refresh token")

    await db.commit()

    return _token_response(user, new_access_token, new_refresh_token)


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    org = current_user.organization
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "must_change_password": bool(current_user.must_change_password),
        "last_login": current_user.last_login.isoformat() if current_user.last_login else None,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
        "organization_id": str(current_user.organization_id),
        "organization": {
            "id": str(org.id),
            "name": org.name,
            "slug": org.slug,
            "status": org.status,
            "plan": org.plan,
            "trial_ends_at": org.trial_ends_at.isoformat() if org.trial_ends_at else None,
        }
        if org
        else None,
    }


@router.post("/logout")
async def logout(
    body: LogoutRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.refresh_token:
        await refresh_token_service.revoke_token(db, body.refresh_token)
        await db.commit()
    return {"message": "Successfully logged out"}
