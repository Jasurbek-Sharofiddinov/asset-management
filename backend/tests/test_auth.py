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
