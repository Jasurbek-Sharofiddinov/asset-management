from tests.conftest import auth_header, login


async def test_lockout_cleared_after_admin_password_reset(client, admin, manager):
    for _ in range(5):
        resp = await client.post(
            "/api/auth/login",
            json={"email": manager.email, "password": "wrong-password"},
        )
        assert resp.status_code in (401, 429)

    locked = await client.post(
        "/api/auth/login",
        json={"email": manager.email, "password": "ManagerPass1"},
    )
    assert locked.status_code == 429

    admin_token = await login(client, admin.email, "AdminPass1")
    reset = await client.post(
        f"/api/auth/users/{manager.id}/reset-password",
        headers=auth_header(admin_token),
        json={"password": "NewTemp1"},
    )
    assert reset.status_code == 200, reset.text

    unlocked = await client.post(
        "/api/auth/login",
        json={"email": manager.email, "password": "NewTemp1"},
    )
    assert unlocked.status_code == 200, unlocked.text
    assert unlocked.json()["must_change_password"] is True


async def test_easy_temp_password_create_and_change_policy(client, admin):
    admin_token = await login(client, admin.email, "AdminPass1")
    created = await client.post(
        "/api/auth/users",
        headers=auth_header(admin_token),
        json={
            "full_name": "Temp User",
            "email": "temp.user@test.uz",
            "password": "temp",
            "role": "VIEWER",
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["must_change_password"] is True

    too_short = await client.post(
        "/api/auth/users",
        headers=auth_header(admin_token),
        json={
            "full_name": "Bad Temp",
            "email": "bad.temp@test.uz",
            "password": "abc",
            "role": "VIEWER",
        },
    )
    assert too_short.status_code == 422

    login_resp = await client.post(
        "/api/auth/login",
        json={"email": "temp.user@test.uz", "password": "temp"},
    )
    assert login_resp.status_code == 200, login_resp.text
    token = login_resp.json()["access_token"]

    weak = await client.post(
        "/api/auth/change-password",
        headers=auth_header(token),
        json={"current_password": "temp", "new_password": "weak"},
    )
    assert weak.status_code == 422

    strong = await client.post(
        "/api/auth/change-password",
        headers=auth_header(token),
        json={"current_password": "temp", "new_password": "StrongPass9"},
    )
    assert strong.status_code == 200, strong.text


async def test_signup_pending_login_forbidden_then_activate(
    client, platform_admin
):
    signup = await client.post(
        "/api/auth/signup",
        json={
            "organization_name": "Pending Bank",
            "contact_email": "founder@pending.uz",
            "admin_full_name": "Founder User",
            "password": "FounderPass1",
        },
    )
    assert signup.status_code == 202, signup.text

    pending_login = await client.post(
        "/api/auth/login",
        json={"email": "founder@pending.uz", "password": "FounderPass1"},
    )
    assert pending_login.status_code == 403

    plat = await client.post(
        "/api/platform/auth/login",
        json={"email": platform_admin.email, "password": "OpsPass1"},
    )
    assert plat.status_code == 200, plat.text
    plat_token = plat.json()["access_token"]

    orgs = await client.get(
        "/api/platform/organizations",
        headers=auth_header(plat_token),
        params={"q": "Pending Bank"},
    )
    assert orgs.status_code == 200, orgs.text
    items = orgs.json()["items"]
    assert len(items) >= 1
    org = next(o for o in items if o["name"] == "Pending Bank")

    activate = await client.post(
        f"/api/platform/organizations/{org['id']}/activate",
        headers=auth_header(plat_token),
        json={
            "slug": org["slug"],
            "plan": "starter",
            "admin_email": "founder@pending.uz",
        },
    )
    assert activate.status_code == 200, activate.text

    after = await client.post(
        "/api/auth/login",
        json={"email": "founder@pending.uz", "password": "FounderPass1"},
    )
    assert after.status_code == 200, after.text


async def test_demo_host_login_forces_demo_org_and_rejects_other_slug(
    client, db_session, monkeypatch
):
    from app.config import settings
    from app.models.organization import Organization, OrganizationStatus, OrganizationPlan
    from app.models.user import User, UserRole
    from tests.conftest import pwd_context, _commit

    monkeypatch.setattr(settings, "BASE_DOMAIN", "assetvault.uz")
    monkeypatch.setattr(settings, "LEGACY_BASE_DOMAIN", "")
    demo = await _commit(
        db_session,
        Organization(
            name="Demo Organization",
            slug="demo",
            status=OrganizationStatus.ACTIVE.value,
            plan=OrganizationPlan.BUSINESS.value,
        ),
    )
    await _commit(
        db_session,
        User(
            organization_id=demo.id,
            full_name="Demo Admin",
            email="demo.admin@test.uz",
            hashed_password=pwd_context.hash("DemoPass1"),
            role=UserRole.ADMIN.value,
            is_active=True,
            must_change_password=False,
        ),
    )

    ok = await client.post(
        "/api/auth/login",
        json={"email": "demo.admin@test.uz", "password": "DemoPass1"},
        headers={"Host": "demo.assetvault.uz"},
    )
    assert ok.status_code == 200, ok.text

    conflict = await client.post(
        "/api/auth/login",
        json={
            "email": "demo.admin@test.uz",
            "password": "DemoPass1",
            "organization_slug": "test-bank",
        },
        headers={"Host": "demo.assetvault.uz"},
    )
    assert conflict.status_code == 403


async def test_demo_host_rejects_foreign_org_token(client, admin, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "BASE_DOMAIN", "assetvault.uz")
    monkeypatch.setattr(settings, "LEGACY_BASE_DOMAIN", "")
    token = await login(
        client, admin.email, "AdminPass1", host="test-bank.assetvault.uz"
    )
    me = await client.get(
        "/api/auth/me",
        headers={**auth_header(token), "Host": "demo.assetvault.uz"},
    )
    assert me.status_code == 403


async def test_demo_host_blocks_signup(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "BASE_DOMAIN", "assetvault.uz")
    monkeypatch.setattr(settings, "LEGACY_BASE_DOMAIN", "")
    resp = await client.post(
        "/api/auth/signup",
        json={
            "organization_name": "Should Fail",
            "contact_email": "nope@example.com",
            "admin_full_name": "Nope",
            "password": "FounderPass1",
        },
        headers={"Host": "demo.assetvault.uz"},
    )
    assert resp.status_code == 403


async def test_shared_host_login_refuses_tokens(client, admin, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "BASE_DOMAIN", "assetvault.uz")
    monkeypatch.setattr(settings, "LEGACY_BASE_DOMAIN", "")
    monkeypatch.setattr(settings, "APP_SUBDOMAIN", "app")
    resp = await client.post(
        "/api/auth/login",
        json={"email": admin.email, "password": "AdminPass1"},
        headers={"Host": "app.assetvault.uz"},
    )
    assert resp.status_code == 403
    assert "access_token" not in resp.json()


async def test_tenant_lookup_and_workspace_list(client, admin, org, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "BASE_DOMAIN", "assetvault.uz")
    monkeypatch.setattr(settings, "LEGACY_BASE_DOMAIN", "")
    monkeypatch.setattr(settings, "APP_SUBDOMAIN", "app")
    found = await client.get(
        "/api/auth/tenant",
        headers={"Host": "test-bank.assetvault.uz"},
    )
    assert found.status_code == 200, found.text
    assert found.json()["slug"] == "test-bank"

    missing = await client.get(
        "/api/auth/tenant",
        headers={"Host": "nope.assetvault.uz"},
    )
    assert missing.status_code == 404

    listed = await client.post(
        "/api/auth/workspaces",
        json={"email": admin.email},
        headers={"Host": "app.assetvault.uz"},
    )
    assert listed.status_code == 200, listed.text
    slugs = {item["slug"] for item in listed.json()["items"]}
    assert "test-bank" in slugs

    empty = await client.post(
        "/api/auth/workspaces",
        json={"email": "nobody@example.com"},
        headers={"Host": "app.assetvault.uz"},
    )
    assert empty.status_code == 200
    assert empty.json()["items"] == []


async def test_app_host_rejects_tenant_session(client, admin, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "BASE_DOMAIN", "assetvault.uz")
    monkeypatch.setattr(settings, "LEGACY_BASE_DOMAIN", "")
    monkeypatch.setattr(settings, "APP_SUBDOMAIN", "app")
    token = await login(
        client, admin.email, "AdminPass1", host="test-bank.assetvault.uz"
    )
    me = await client.get(
        "/api/auth/me",
        headers={**auth_header(token), "Host": "app.assetvault.uz"},
    )
    assert me.status_code == 403


async def test_tenant_lookup_hides_pending_and_shared_hosts(
    client, db_session, monkeypatch
):
    from app.config import settings
    from app.models.organization import Organization, OrganizationStatus, OrganizationPlan
    from tests.conftest import _commit

    monkeypatch.setattr(settings, "BASE_DOMAIN", "assetvault.uz")
    monkeypatch.setattr(settings, "LEGACY_BASE_DOMAIN", "")
    monkeypatch.setattr(settings, "APP_SUBDOMAIN", "app")
    await _commit(
        db_session,
        Organization(
            name="Pending Co",
            slug="pending-co",
            status=OrganizationStatus.PENDING_REVIEW.value,
            plan=OrganizationPlan.STARTER.value,
        ),
    )
    pending = await client.get(
        "/api/auth/tenant",
        headers={"Host": "pending-co.assetvault.uz"},
    )
    assert pending.status_code == 404

    shared = await client.get(
        "/api/auth/tenant",
        headers={"Host": "app.assetvault.uz"},
    )
    assert shared.status_code == 404


async def test_signup_blocked_on_any_tenant_host(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "BASE_DOMAIN", "assetvault.uz")
    monkeypatch.setattr(settings, "APP_SUBDOMAIN", "app")
    resp = await client.post(
        "/api/auth/signup",
        json={
            "organization_name": "Should Fail",
            "contact_email": "nope@example.com",
            "admin_full_name": "Nope",
            "password": "FounderPass1",
        },
        headers={"Host": "acme.assetvault.uz"},
    )
    assert resp.status_code == 403


async def test_workspace_lookup_skips_inactive_users(
    client, db_session, org, monkeypatch
):
    from app.config import settings
    from app.models.user import User, UserRole
    from tests.conftest import pwd_context, _commit

    monkeypatch.setattr(settings, "BASE_DOMAIN", "assetvault.uz")
    monkeypatch.setattr(settings, "APP_SUBDOMAIN", "app")
    await _commit(
        db_session,
        User(
            organization_id=org.id,
            full_name="Inactive",
            email="inactive@test.uz",
            hashed_password=pwd_context.hash("Inactive1"),
            role=UserRole.VIEWER.value,
            is_active=False,
            must_change_password=False,
        ),
    )
    listed = await client.post(
        "/api/auth/workspaces",
        json={"email": "inactive@test.uz"},
        headers={"Host": "app.assetvault.uz"},
    )
    assert listed.status_code == 200
    assert listed.json()["items"] == []


async def test_dev_login_without_base_domain_still_issues_tokens(client, admin):
    resp = await client.post(
        "/api/auth/login",
        json={"email": admin.email, "password": "AdminPass1"},
    )
    assert resp.status_code == 200, resp.text
    assert "access_token" in resp.json()
