from typing import List, Set
import re

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings

FORBIDDEN_JWT_SECRETS = frozenset({
    "assetvault-production-secret-key-2024",
    "assetvault-production-secret-key-2024-change-me",
    "assetvault-secret-key-change-in-production",
})

# Default reserved host labels for {slug}.BASE_DOMAIN — configuration-driven, not a code literal.
_DEFAULT_RESERVED_SLUGS = (
    "www,api,admin,app,mail,static,assets,cdn,staging,dev,status,support,"
    "help,docs,default,demo,console,platform,auth,login,signup,billing,webhook,webhooks,asset"
)


class Settings(BaseSettings):
    # "development" | "production" — controls FastAPI docs exposure, etc.
    ENVIRONMENT: str = "development"

    DATABASE_URL: str = "postgresql+asyncpg://postgres:12345@localhost:5432/assetvault"
    SYNC_DATABASE_URL: str = "postgresql://postgres:12345@localhost:5432/assetvault"

    JWT_SECRET: str = Field(..., min_length=1)
    JWT_ALGORITHM: str = "HS256"
    JWT_ISSUER: str = "assetvault"
    # Tenant API audience — platform tokens use JWT_PLATFORM_AUDIENCE instead.
    JWT_AUDIENCE: str = "assetvault-api"
    JWT_PLATFORM_AUDIENCE: str = "assetvault-platform"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    REDIS_URL: str = "redis://localhost:6379/0"

    # Trial length in days (no permanent free tier — enforcement is a later phase)
    TRIAL_LENGTH_DAYS: int = 14

    GROK_API_KEY: str = ""
    GROK_API_URL: str = "https://api.x.ai/v1/chat/completions"
    GROK_MODEL: str = "grok-3-mini"

    GROQ_API_KEY: str = ""
    GROQ_API_URL: str = "https://api.groq.com/openai/v1/chat/completions"
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # Production apex domain (e.g. "assetvault.uz"). Empty in local/dev so
    # CORS stays on localhost origins only.
    # Tenant app host: {APP_SUBDOMAIN}.{BASE_DOMAIN}  (was ADMIN_SUBDOMAIN — renamed)
    # Platform console: {PLATFORM_SUBDOMAIN}.{BASE_DOMAIN}
    BASE_DOMAIN: str = ""
    # Optional second apex during domain migration (e.g. "datamou.uz"). Empty = unused.
    LEGACY_BASE_DOMAIN: str = ""
    APP_SUBDOMAIN: str = "asset"
    PLATFORM_SUBDOMAIN: str = "admin"

    # Comma-separated reserved org slugs (hostname labels). Overridable via env.
    RESERVED_SLUGS: str = _DEFAULT_RESERVED_SLUGS

    # Explicit origins (localhost defaults for native/dev). Production compose
    # typically leaves this as [] and relies on BASE_DOMAIN / LEGACY_BASE_DOMAIN.
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
    ]

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.strip().lower() == "production"

    def get_reserved_slugs(self) -> Set[str]:
        return {
            s.strip().lower()
            for s in (self.RESERVED_SLUGS or "").split(",")
            if s.strip()
        }

    def get_cors_origins(self) -> List[str]:
        """Explicit origins (localhost + listed CORS_ORIGINS).

        Production tenant/platform hosts are allowed via get_cors_origin_regex()
        so arbitrary {slug}.{BASE_DOMAIN} origins work with credentials.
        """
        origins: List[str] = list(self.CORS_ORIGINS)
        seen: set[str] = set()
        deduped: List[str] = []
        for origin in origins:
            if origin and origin not in seen:
                seen.add(origin)
                deduped.append(origin)
        return deduped

    def get_cors_origin_regex(self) -> str | None:
        """Anchored https origins for apex and one-label subdomains of configured domains."""
        parts: list[str] = []
        for domain in (self.BASE_DOMAIN, self.LEGACY_BASE_DOMAIN):
            d = (domain or "").strip().lstrip(".")
            if d:
                parts.append(re.escape(d))
        if not parts:
            return None
        joined = "|".join(parts)
        return rf"^https://([a-z0-9-]+\.)?({joined})$"

    @field_validator("JWT_SECRET")
    @classmethod
    def validate_jwt_secret(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError(
                "JWT_SECRET is required. Set it in backend/.env (or the process "
                "environment) to a unique random string of at least 32 bytes. "
                "Example: openssl rand -hex 32"
            )
        if len(v.encode("utf-8")) < 32:
            raise ValueError(
                "JWT_SECRET must be at least 32 bytes. "
                "Generate one with: openssl rand -hex 32"
            )
        if v.strip() in FORBIDDEN_JWT_SECRETS:
            raise ValueError(
                "JWT_SECRET matches a known insecure placeholder value. "
                "Set a unique secret of at least 32 bytes "
                "(e.g. openssl rand -hex 32)."
            )
        return v


settings = Settings()
