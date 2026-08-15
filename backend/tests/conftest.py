"""Isolated pytest fixtures against Postgres database ``assetvault_test``.

Environment overrides MUST happen before ``app`` is imported so Settings and
the SQLAlchemy engine bind to the test database, not live ``assetvault``.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import psycopg2
import pytest
from httpx import ASGITransport, AsyncClient
from passlib.context import CryptContext
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

BACKEND_DIR = Path(__file__).resolve().parents[1]
TEST_DB = "assetvault_test"
PG_USER = "postgres"
PG_PASSWORD = os.environ.get("POSTGRES_PASSWORD", "postgres")
PG_HOST = "localhost"
PG_PORT = "5432"

os.environ["JWT_SECRET"] = "test-jwt-secret-assetvault-not-for-production-use"
os.environ["DATABASE_URL"] = (
    f"postgresql+asyncpg://{PG_USER}:{PG_PASSWORD}@{PG_HOST}:{PG_PORT}/{TEST_DB}"
)
os.environ["SYNC_DATABASE_URL"] = (
    f"postgresql://{PG_USER}:{PG_PASSWORD}@{PG_HOST}:{PG_PORT}/{TEST_DB}"
)
os.environ["REDIS_URL"] = "redis://127.0.0.1:1/0"
os.environ["ENVIRONMENT"] = "development"
os.environ["SEED_PASSWORD"] = "SeedPass1"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

TRUNCATE_TABLES = (
    "assignments",
    "assets",
    "employees",
    "departments",
    "branches",
    "audit_logs",
    "refresh_tokens",
    "users",
    "platform_refresh_tokens",
    "platform_audit_logs",
    "platform_admins",
    "organizations",
)


def _admin_pg_connect(dbname: str = "postgres"):
    return psycopg2.connect(
        dbname=dbname,
        user=PG_USER,
        password=PG_PASSWORD,
        host=PG_HOST,
        port=PG_PORT,
    )


def _ensure_test_database() -> None:
    conn = _admin_pg_connect()
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (TEST_DB,))
    if cur.fetchone() is None:
        cur.execute(f'CREATE DATABASE "{TEST_DB}"')
    cur.close()
    conn.close()


def _run_alembic() -> None:
    subprocess.check_call(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=str(BACKEND_DIR),
        env={**os.environ},
    )


@pytest.fixture(scope="session", autouse=True)
def _test_schema():
    _ensure_test_database()
    _run_alembic()
    yield


@pytest.fixture(autouse=True)
async def _truncate_and_reset_limiter():
    from sqlalchemy import text

    from app.database import engine
    from app.services.login_rate_limiter import login_rate_limiter, signup_rate_limiter

    login_rate_limiter._redis_failed = True
    login_rate_limiter._memory.clear()
    signup_rate_limiter._redis_failed = True
    signup_rate_limiter._memory.clear()

    async with engine.begin() as conn:
        await conn.execute(
            text(
                "TRUNCATE TABLE "
                + ", ".join(TRUNCATE_TABLES)
                + " RESTART IDENTITY CASCADE"
            )
        )
    yield


@pytest.fixture
async def client():
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def db_session():
    from app.database import async_session_factory

    async with async_session_factory() as session:
        yield session


async def _commit(session, obj):
    session.add(obj)
    await session.commit()
    await session.refresh(obj)
    return obj


@pytest.fixture
async def org(db_session):
    from app.models.organization import Organization, OrganizationStatus, OrganizationPlan

    return await _commit(
        db_session,
        Organization(
            name="Test Bank",
            slug="test-bank",
            status=OrganizationStatus.ACTIVE.value,
            plan=OrganizationPlan.BUSINESS.value,
        ),
    )


@pytest.fixture
async def admin(db_session, org):
    from app.models.user import User, UserRole

    return await _commit(
        db_session,
        User(
            organization_id=org.id,
            full_name="Admin User",
            email="admin@test.uz",
            hashed_password=pwd_context.hash("AdminPass1"),
            role=UserRole.ADMIN.value,
            is_active=True,
            must_change_password=False,
        ),
    )


@pytest.fixture
async def manager(db_session, org):
    from app.models.user import User, UserRole

    return await _commit(
        db_session,
        User(
            organization_id=org.id,
            full_name="Manager User",
            email="manager@test.uz",
            hashed_password=pwd_context.hash("ManagerPass1"),
            role=UserRole.MANAGER.value,
            is_active=True,
            must_change_password=False,
        ),
    )


@pytest.fixture
async def auditor(db_session, org):
    from app.models.user import User, UserRole

    return await _commit(
        db_session,
        User(
            organization_id=org.id,
            full_name="Auditor User",
            email="auditor@test.uz",
            hashed_password=pwd_context.hash("AuditorPass1"),
            role=UserRole.AUDITOR.value,
            is_active=True,
            must_change_password=False,
        ),
    )


@pytest.fixture
async def branch(db_session, org):
    from app.models.assignment import Branch

    return await _commit(
        db_session,
        Branch(organization_id=org.id, name="Head Office", location="Tashkent"),
    )


@pytest.fixture
async def department(db_session, org):
    from app.models.assignment import Department

    return await _commit(
        db_session,
        Department(organization_id=org.id, name="IT"),
    )


@pytest.fixture
async def employee(db_session, org, branch, department):
    from app.models.assignment import Employee

    return await _commit(
        db_session,
        Employee(
            organization_id=org.id,
            full_name="Dilshod Karimov",
            email="dilshod@test.uz",
            branch_id=branch.id,
            department_id=department.id,
            position="Analyst",
        ),
    )


@pytest.fixture
async def asset(db_session, org, admin):
    from app.models.asset import Asset, AssetStatus, AssetCategory

    return await _commit(
        db_session,
        Asset(
            organization_id=org.id,
            name="Dell Monitor",
            asset_type="Monitor",
            category=AssetCategory.IT.value,
            serial_number="SN-TEST-001",
            status=AssetStatus.REGISTERED.value,
            created_by=admin.id,
        ),
    )


@pytest.fixture
async def platform_admin(db_session):
    from app.models.platform_admin import PlatformAdmin

    return await _commit(
        db_session,
        PlatformAdmin(
            email="ops@test.uz",
            full_name="Platform Ops",
            hashed_password=pwd_context.hash("OpsPass1"),
            is_active=True,
        ),
    )


async def login(client: AsyncClient, email: str, password: str, slug: str | None = None) -> str:
    body = {"email": email, "password": password}
    if slug:
        body["organization_slug"] = slug
    resp = await client.post("/api/auth/login", json=body)
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
