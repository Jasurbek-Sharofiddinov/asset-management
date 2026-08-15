"""Platform authentication dependencies — isolated from tenant auth.

Decodes JWTs with JWT_PLATFORM_AUDIENCE and loads only from platform_admins.
Tenant tokens (JWT_AUDIENCE) fail audience validation before any DB lookup.
"""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_db
from app.exceptions import UnauthorizedException
from app.models.platform_admin import PlatformAdmin

logger = logging.getLogger(__name__)

# Separate security scheme instance — same Bearer mechanics, distinct module.
security = HTTPBearer()

PLATFORM_SCOPE = "platform"


def decode_platform_access_token(token: str) -> str:
    """Decode a platform access token; return admin id (sub).

    Audience is validated first — a tenant token is rejected here with no DB hit.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            issuer=settings.JWT_ISSUER,
            audience=settings.JWT_PLATFORM_AUDIENCE,
        )
    except JWTError as e:
        logger.warning("Platform JWT validation failed: %s", e)
        raise UnauthorizedException("Invalid or expired token")

    token_type = payload.get("type", "access")
    scope = payload.get("scope")
    admin_id = payload.get("sub")

    if token_type != "access":
        raise UnauthorizedException("Invalid token")
    if scope != PLATFORM_SCOPE:
        raise UnauthorizedException("Invalid token")
    if not admin_id:
        raise UnauthorizedException("Invalid token")

    return str(admin_id)


async def get_current_platform_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> PlatformAdmin:
    admin_id_str = decode_platform_access_token(credentials.credentials)

    try:
        admin_uuid = UUID(admin_id_str)
    except (ValueError, TypeError):
        raise UnauthorizedException("Invalid token")

    result = await db.execute(
        select(PlatformAdmin).where(PlatformAdmin.id == admin_uuid)
    )
    admin = result.scalar_one_or_none()
    if admin is None or not admin.is_active:
        raise UnauthorizedException("Invalid or inactive platform admin")
    return admin
