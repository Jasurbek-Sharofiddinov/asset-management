"""Login brute-force protection keyed on client IP + email.

Uses Redis when available (correct under multiple uvicorn workers). Falls back
to an in-process counter if Redis is unreachable so the API still protects
itself without locking all users out.

Key prefixes are parameterized so tenant and platform login attempts never
share the same rate-limit buckets.
"""

from __future__ import annotations

import logging
import time
from typing import Optional

import redis.asyncio as redis

from app.config import settings

logger = logging.getLogger(__name__)

MAX_FAILURES = 5
BASE_LOCKOUT_SECONDS = 30
MAX_LOCKOUT_SECONDS = 900  # 15 minutes

TENANT_LOGIN_PREFIX = "login_fail"
PLATFORM_LOGIN_PREFIX = "platform_login_fail"


class LoginRateLimiter:
    def __init__(self, key_prefix: str = TENANT_LOGIN_PREFIX) -> None:
        self._key_prefix = key_prefix
        self._redis: Optional[redis.Redis] = None
        self._redis_failed = False
        self._memory: dict[str, dict] = {}

    def _key(self, ip: str, email: str) -> str:
        return f"{self._key_prefix}:{ip}:{email.strip().lower()}"

    async def _client(self) -> Optional[redis.Redis]:
        if self._redis_failed:
            return None
        try:
            if self._redis is None:
                self._redis = redis.from_url(
                    settings.REDIS_URL,
                    decode_responses=True,
                    socket_connect_timeout=0.5,
                    socket_timeout=0.5,
                )
            await self._redis.ping()
            return self._redis
        except Exception as exc:
            logger.warning(
                "Redis unavailable for login rate limiting; using in-process fallback (%s)",
                type(exc).__name__,
            )
            self._redis_failed = True
            if self._redis is not None:
                try:
                    await self._redis.aclose()
                except Exception:
                    pass
                self._redis = None
            return None

    @staticmethod
    def _lockout_seconds(failures: int) -> int:
        if failures < MAX_FAILURES:
            return 0
        exponent = failures - MAX_FAILURES
        return min(BASE_LOCKOUT_SECONDS * (2 ** exponent), MAX_LOCKOUT_SECONDS)

    async def check_locked(self, ip: str, email: str) -> Optional[int]:
        """Return Retry-After seconds if locked, otherwise None."""
        key = self._key(ip, email)
        client = await self._client()
        if client is not None:
            try:
                data = await client.hgetall(key)
                if not data:
                    return None
                locked_until = float(data.get("locked_until", 0))
                now = time.time()
                if locked_until > now:
                    return max(1, int(locked_until - now))
                return None
            except Exception as exc:
                logger.warning("Redis rate-limit check failed: %s", type(exc).__name__)
                self._redis_failed = True

        entry = self._memory.get(key)
        if not entry:
            return None
        now = time.time()
        if entry.get("locked_until", 0) > now:
            return max(1, int(entry["locked_until"] - now))
        return None

    async def record_failure(self, ip: str, email: str) -> Optional[int]:
        """Record a failed attempt. Return Retry-After if now locked."""
        key = self._key(ip, email)
        client = await self._client()
        if client is not None:
            try:
                pipe = client.pipeline()
                pipe.hincrby(key, "failures", 1)
                pipe.hget(key, "failures")
                results = await pipe.execute()
                failures = int(results[1] or 1)
                lockout = self._lockout_seconds(failures)
                if lockout:
                    locked_until = time.time() + lockout
                    await client.hset(key, "locked_until", str(locked_until))
                    await client.expire(key, MAX_LOCKOUT_SECONDS)
                    return lockout
                await client.expire(key, MAX_LOCKOUT_SECONDS)
                return None
            except Exception as exc:
                logger.warning("Redis rate-limit record failed: %s", type(exc).__name__)
                self._redis_failed = True

        entry = self._memory.setdefault(key, {"failures": 0, "locked_until": 0.0})
        entry["failures"] = int(entry.get("failures", 0)) + 1
        lockout = self._lockout_seconds(entry["failures"])
        if lockout:
            entry["locked_until"] = time.time() + lockout
            return lockout
        return None

    async def clear(self, ip: str, email: str) -> None:
        key = self._key(ip, email)
        self._memory.pop(key, None)
        client = await self._client()
        if client is not None:
            try:
                await client.delete(key)
            except Exception as exc:
                logger.warning("Redis rate-limit clear failed: %s", type(exc).__name__)

    async def clear_email(self, email: str) -> None:
        """Drop lockout for this email across every IP (password reset / change)."""
        normalized = (email or "").strip().lower()
        if not normalized:
            return
        suffix = f":{normalized}"
        for key in [k for k in self._memory if k.endswith(suffix)]:
            self._memory.pop(key, None)
        client = await self._client()
        if client is not None:
            try:
                pattern = f"{self._key_prefix}:*:{normalized}"
                async for key in client.scan_iter(match=pattern):
                    await client.delete(key)
            except Exception as exc:
                logger.warning(
                    "Redis rate-limit clear_email failed: %s", type(exc).__name__
                )


login_rate_limiter = LoginRateLimiter(key_prefix=TENANT_LOGIN_PREFIX)
platform_login_rate_limiter = LoginRateLimiter(key_prefix=PLATFORM_LOGIN_PREFIX)


SIGNUP_PREFIX = "signup"
SIGNUP_MAX_HITS = 3
SIGNUP_WINDOW_SECONDS = 3600


class FixedWindowRateLimiter:
    """Per-identity fixed window (e.g. 3 signups per IP per hour)."""

    def __init__(
        self,
        key_prefix: str,
        max_hits: int,
        window_seconds: int,
    ) -> None:
        self._key_prefix = key_prefix
        self._max_hits = max_hits
        self._window = window_seconds
        self._redis: Optional[redis.Redis] = None
        self._redis_failed = False
        self._memory: dict[str, dict] = {}

    def _key(self, identity: str) -> str:
        return f"{self._key_prefix}:{identity}"

    async def _client(self) -> Optional[redis.Redis]:
        if self._redis_failed:
            return None
        try:
            if self._redis is None:
                self._redis = redis.from_url(
                    settings.REDIS_URL,
                    decode_responses=True,
                    socket_connect_timeout=0.5,
                    socket_timeout=0.5,
                )
            await self._redis.ping()
            return self._redis
        except Exception as exc:
            logger.warning(
                "Redis unavailable for signup rate limiting; using in-process fallback (%s)",
                type(exc).__name__,
            )
            self._redis_failed = True
            if self._redis is not None:
                try:
                    await self._redis.aclose()
                except Exception:
                    pass
                self._redis = None
            return None

    async def hit(self, identity: str) -> Optional[int]:
        """Increment the window. Return Retry-After seconds if over the limit."""
        key = self._key(identity)
        client = await self._client()
        if client is not None:
            try:
                count = int(await client.incr(key))
                if count == 1:
                    await client.expire(key, self._window)
                if count > self._max_hits:
                    ttl = int(await client.ttl(key))
                    return max(1, ttl if ttl > 0 else self._window)
                return None
            except Exception as exc:
                logger.warning(
                    "Redis signup rate-limit failed: %s", type(exc).__name__
                )
                self._redis_failed = True

        now = time.time()
        entry = self._memory.get(key)
        if not entry or now - entry["window_start"] >= self._window:
            self._memory[key] = {"count": 1, "window_start": now}
            return None
        entry["count"] = int(entry["count"]) + 1
        if entry["count"] > self._max_hits:
            remaining = self._window - (now - entry["window_start"])
            return max(1, int(remaining))
        return None


signup_rate_limiter = FixedWindowRateLimiter(
    key_prefix=SIGNUP_PREFIX,
    max_hits=SIGNUP_MAX_HITS,
    window_seconds=SIGNUP_WINDOW_SECONDS,
)

tenant_lookup_rate_limiter = FixedWindowRateLimiter(
    key_prefix="tenant_lookup",
    max_hits=30,
    window_seconds=60,
)
workspace_lookup_rate_limiter = FixedWindowRateLimiter(
    key_prefix="workspace_lookup",
    max_hits=5,
    window_seconds=300,
)
