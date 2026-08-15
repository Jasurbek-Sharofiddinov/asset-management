from app.models.asset import Asset, AssetStatus, AssetCategory
from tests.conftest import auth_header, login, _commit


async def test_get_asset_assignments_returns_200(client, admin, asset):
    token = await login(client, admin.email, "AdminPass1")
    resp = await client.get(
        f"/api/assets/{asset.id}/assignments",
        headers=auth_header(token),
    )
    assert resp.status_code == 200
    assert resp.json() == []


async def test_get_asset_assignments_after_assign(
    client, admin, asset, employee, branch
):
    token = await login(client, admin.email, "AdminPass1")
    assign = await client.post(
        f"/api/assets/{asset.id}/assign",
        headers=auth_header(token),
        json={
            "employee_id": str(employee.id),
            "branch_id": str(branch.id),
        },
    )
    assert assign.status_code == 201, assign.text

    resp = await client.get(
        f"/api/assets/{asset.id}/assignments",
        headers=auth_header(token),
    )
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["employee_id"] == str(employee.id)
    assert items[0]["branch_id"] == str(branch.id)


async def test_list_assets_sort_by_name_asc(client, admin, org, db_session):
    for name in ("Zebra Desk", "Apple Monitor", "Mango Laptop"):
        await _commit(
            db_session,
            Asset(
                organization_id=org.id,
                name=name,
                asset_type="Equipment",
                category=AssetCategory.IT.value,
                serial_number=f"SN-{name.split()[0].upper()}",
                status=AssetStatus.REGISTERED.value,
                created_by=admin.id,
            ),
        )

    token = await login(client, admin.email, "AdminPass1")
    resp = await client.get(
        "/api/assets",
        params={"sort_by": "name", "sort_order": "asc", "size": 50},
        headers=auth_header(token),
    )
    assert resp.status_code == 200
    names = [item["name"] for item in resp.json()["items"]]
    assert names == sorted(names)
    assert names[0] == "Apple Monitor"
    assert names[-1] == "Zebra Desk"


async def test_list_assets_multi_status_filter(client, admin, org, db_session):
    specs = [
        ("Assigned One", AssetStatus.ASSIGNED),
        ("Lost One", AssetStatus.LOST),
        ("Registered One", AssetStatus.REGISTERED),
    ]
    for name, status in specs:
        await _commit(
            db_session,
            Asset(
                organization_id=org.id,
                name=name,
                asset_type="Equipment",
                category=AssetCategory.IT.value,
                serial_number=f"SN-{status.value}",
                status=status.value,
                created_by=admin.id,
            ),
        )

    token = await login(client, admin.email, "AdminPass1")
    resp = await client.get(
        "/api/assets",
        params=[("status", "ASSIGNED"), ("status", "LOST"), ("size", "50")],
        headers=auth_header(token),
    )
    assert resp.status_code == 200
    statuses = {item["status"] for item in resp.json()["items"]}
    assert statuses == {"ASSIGNED", "LOST"}


async def test_assign_without_branch_id_returns_422(
    client, admin, asset, employee
):
    token = await login(client, admin.email, "AdminPass1")
    resp = await client.post(
        f"/api/assets/{asset.id}/assign",
        headers=auth_header(token),
        json={"employee_id": str(employee.id)},
    )
    assert resp.status_code == 422


async def test_assign_with_branch_returns_201_and_assigned(
    client, admin, asset, employee, branch
):
    token = await login(client, admin.email, "AdminPass1")
    resp = await client.post(
        f"/api/assets/{asset.id}/assign",
        headers=auth_header(token),
        json={
            "employee_id": str(employee.id),
            "branch_id": str(branch.id),
        },
    )
    assert resp.status_code == 201, resp.text

    detail = await client.get(
        f"/api/assets/{asset.id}",
        headers=auth_header(token),
    )
    assert detail.status_code == 200
    assert detail.json()["status"] == "ASSIGNED"


async def test_registered_to_lost_returns_409(client, admin, asset):
    token = await login(client, admin.email, "AdminPass1")
    resp = await client.patch(
        f"/api/assets/{asset.id}/status",
        headers=auth_header(token),
        json={"new_status": "LOST", "reason": "missing"},
    )
    assert resp.status_code == 409
