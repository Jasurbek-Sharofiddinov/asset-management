from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import engine
from app.exceptions import (
    NotFoundException,
    ConflictException,
    ForbiddenException,
    UnauthorizedException,
    BadRequestException,
    TooManyRequestsException,
    InvalidTransitionException,
)
from app.routers import (
    auth,
    assets,
    assignments,
    audit,
    analytics,
    reference,
    ai,
    platform_auth,
    platform_organizations,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Schema is managed solely by Alembic migrations (see backend/entrypoint.sh).
    # Do not call Base.metadata.create_all here — it drifts from migration history.
    yield
    await engine.dispose()


_docs_enabled = not settings.is_production

app = FastAPI(
    title="AssetVault API",
    description="Bank Office Asset Management Platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if _docs_enabled else None,
    redoc_url="/redoc" if _docs_enabled else None,
    openapi_url="/openapi.json" if _docs_enabled else None,
)

# CORS — origins from CORS_ORIGINS plus https://{app,platform,apex} for BASE_DOMAIN / LEGACY_BASE_DOMAIN
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(assets.router)
app.include_router(assignments.router)
app.include_router(audit.router)
app.include_router(analytics.router)
app.include_router(reference.router)
app.include_router(ai.router)
app.include_router(platform_auth.router)
app.include_router(platform_organizations.router)
app.include_router(platform_organizations.ops_router)


# ── Exception Handlers ───────────────────────────────────────────────────────

@app.exception_handler(NotFoundException)
async def not_found_handler(request: Request, exc: NotFoundException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(ConflictException)
async def conflict_handler(request: Request, exc: ConflictException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(ForbiddenException)
async def forbidden_handler(request: Request, exc: ForbiddenException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(UnauthorizedException)
async def unauthorized_handler(request: Request, exc: UnauthorizedException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers or {},
    )


@app.exception_handler(TooManyRequestsException)
async def too_many_requests_handler(request: Request, exc: TooManyRequestsException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers or {},
    )


@app.exception_handler(BadRequestException)
async def bad_request_handler(request: Request, exc: BadRequestException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(InvalidTransitionException)
async def invalid_transition_handler(request: Request, exc: InvalidTransitionException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# ── Health Check ─────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "AssetVault API"}
