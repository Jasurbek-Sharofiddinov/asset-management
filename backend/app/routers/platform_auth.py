"""Platform authentication routes — isolated from tenant /api/auth."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Request
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_db
from app.exceptions import (
    TooManyRequestsException,
    UnauthorizedException,
)
from app.models.platform_admin import PlatformAdmin
from app.platform_dependencies import (
    PLATFORM_SCOPE,
    get_current_platform_admin,
)
from app.schemas.platform import (
    PlatformAdminResponse,
    PlatformLoginRequest,
    PlatformLogoutRequest,
    PlatformRefreshRequest,
    PlatformTokenResponse,
)
from app.services import platform_refresh_token_service
from app.services.login_rate_limiter import platform_login_rate_limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/platform/auth", tags=["platform-auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def _platform_token_claims(extra: dict) -> dict:
    return {
        **extra,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_PLATFORM_AUDIENCE,
        "scope": PLATFORM_SCOPE,
    }


def create_platform_access_token(admin_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = _platform_token_claims(
        {
            "sub": admin_id,
            "type": "access",
            "exp": expire,
        }
    )
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_platform_refresh_token(admin_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload = _platform_token_claims(
        {
            "sub": admin_id,
            "type": "refresh",
            "exp": expire,
            "jti": str(uuid.uuid4()),
        }
    )
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _decode_platform_refresh_token(token: str) -> str:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            issuer=settings.JWT_ISSUER,
            audience=settings.JWT_PLATFORM_AUDIENCE,
        )
        admin_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        scope: str = payload.get("scope")
        if not admin_id or token_type != "refresh" or scope != PLATFORM_SCOPE:
            raise UnauthorizedException("Invalid refresh token")
        return admin_id
    except JWTError as e:
        logger.warning("Platform refresh token decode failed: %s", e)
        raise UnauthorizedException("Invalid or expired refresh token")


@router.post("/login", response_model=PlatformTokenResponse)
async def platform_login(
    body: PlatformLoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip = _client_ip(request)
    email = body.email.strip().lower()

    retry_after = await platform_login_rate_limiter.check_locked(ip, email)
    if retry_after is not None:
        raise TooManyRequestsException(
            "Too many failed login attempts. Try again later.",
            retry_after=retry_after,
        )

    result = await db.execute(
        select(PlatformAdmin).where(PlatformAdmin.email == email)
    )
    admin = result.scalar_one_or_none()

    if (
        admin is None
        or not admin.is_active
        or not verify_password(body.password, admin.hashed_password)
    ):
        lockout = await platform_login_rate_limiter.record_failure(ip, email)
        if lockout is not None:
            raise TooManyRequestsException(
                "Too many failed login attempts. Try again later.",
                retry_after=lockout,
            )
        raise UnauthorizedException("Invalid email or password")

    await platform_login_rate_limiter.clear(ip, email)

    access = create_platform_access_token(str(admin.id))
    refresh = create_platform_refresh_token(str(admin.id))
    await platform_refresh_token_service.store_refresh_token(
        db, admin_id=admin.id, token=refresh
    )

    admin.last_login = datetime.now(timezone.utc)
    await db.commit()

    return PlatformTokenResponse(
        access_token=access,
        refresh_token=refresh,
        admin_id=admin.id,
        full_name=admin.full_name,
        email=admin.email,
    )


@router.post("/refresh", response_model=PlatformTokenResponse)
async def platform_refresh(
    body: PlatformRefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    admin_id = _decode_platform_refresh_token(body.refresh_token)

    try:
        admin_uuid = uuid.UUID(admin_id)
    except (ValueError, TypeError):
        raise UnauthorizedException("Invalid refresh token")

    result = await db.execute(
        select(PlatformAdmin).where(PlatformAdmin.id == admin_uuid)
    )
    admin = result.scalar_one_or_none()
    if admin is None or not admin.is_active:
        raise UnauthorizedException("Invalid or inactive platform admin")

    new_refresh = create_platform_refresh_token(str(admin.id))
    try:
        rotated = await platform_refresh_token_service.rotate_refresh_token(
            db,
            presented_token=body.refresh_token,
            admin_id=admin.id,
            new_token=new_refresh,
        )
    except ValueError:
        await db.commit()
        raise UnauthorizedException("Refresh token reuse detected")

    if rotated is None:
        await db.commit()
        raise UnauthorizedException("Invalid or expired refresh token")

    access = create_platform_access_token(str(admin.id))
    await db.commit()

    return PlatformTokenResponse(
        access_token=access,
        refresh_token=new_refresh,
        admin_id=admin.id,
        full_name=admin.full_name,
        email=admin.email,
    )


@router.post("/logout")
async def platform_logout(
    body: PlatformLogoutRequest,
    db: AsyncSession = Depends(get_db),
    _admin: PlatformAdmin = Depends(get_current_platform_admin),
):
    if body.refresh_token:
        await platform_refresh_token_service.revoke_token(db, body.refresh_token)
        await db.commit()
    return {"detail": "Logged out"}


@router.get("/me", response_model=PlatformAdminResponse)
async def platform_me(
    admin: PlatformAdmin = Depends(get_current_platform_admin),
):
    return PlatformAdminResponse.model_validate(admin)
