from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.refresh_token import RefreshToken


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def cleanup_expired_tokens(db: AsyncSession) -> None:
    now = datetime.now(timezone.utc)
    await db.execute(delete(RefreshToken).where(RefreshToken.expires_at < now))


async def store_refresh_token(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    token: str,
    family_id: uuid.UUID | None = None,
) -> RefreshToken:
    await cleanup_expired_tokens(db)
    expires_at = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    record = RefreshToken(
        user_id=user_id,
        token_hash=hash_token(token),
        family_id=family_id or uuid.uuid4(),
        expires_at=expires_at,
    )
    db.add(record)
    await db.flush()
    return record


async def revoke_token(db: AsyncSession, token: str) -> bool:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == hash_token(token))
    )
    record = result.scalar_one_or_none()
    if record is None:
        return False
    if record.revoked_at is None:
        record.revoked_at = now
        await db.flush()
    return True


async def revoke_family(db: AsyncSession, family_id: uuid.UUID) -> None:
    now = datetime.now(timezone.utc)
    await db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.family_id == family_id,
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=now)
    )


async def rotate_refresh_token(
    db: AsyncSession,
    *,
    presented_token: str,
    user_id: uuid.UUID,
    new_token: str,
) -> RefreshToken | None:
    """Validate and rotate a refresh token.

    Returns the new RefreshToken row on success.
    Returns None if the token is unknown/expired.
    Raises ValueError on reuse of an already-rotated token (family revoked).
    """
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == hash_token(presented_token)
        )
    )
    record = result.scalar_one_or_none()
    if record is None:
        return None

    if record.user_id != user_id:
        return None

    if record.expires_at < now:
        record.revoked_at = now
        await db.flush()
        return None

    if record.revoked_at is not None:
        await revoke_family(db, record.family_id)
        await db.flush()
        raise ValueError("refresh token reuse detected")

    record.revoked_at = now
    new_record = await store_refresh_token(
        db,
        user_id=user_id,
        token=new_token,
        family_id=record.family_id,
    )
    return new_record
