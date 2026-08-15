import uuid
import math
from datetime import datetime, date, timezone
from typing import Optional, Sequence

from sqlalchemy import select, func, and_, or_, asc, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset import Asset, AssetStatus
from app.models.assignment import Assignment
from app.exceptions import (
    NotFoundException,
    ConflictException,
    InvalidTransitionException,
)
from app.schemas.asset import (
    AssetCreate,
    AssetUpdate,
    AssetResponse,
    AssetDetail,
    AssetListResponse,
    AssignmentBrief,
)

SORTABLE_COLUMNS = {
    "name": Asset.name,
    "serial_number": Asset.serial_number,
    "status": Asset.status,
    "category": Asset.category,
    "purchase_date": Asset.purchase_date,
    "purchase_price": Asset.purchase_price,
    "created_at": Asset.created_at,
}

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    AssetStatus.REGISTERED.value: {
        AssetStatus.ASSIGNED.value,
        AssetStatus.IN_REPAIR.value,
        AssetStatus.WRITTEN_OFF.value,
    },
    AssetStatus.ASSIGNED.value: {
        AssetStatus.REGISTERED.value,
        AssetStatus.IN_REPAIR.value,
        AssetStatus.LOST.value,
    },
    AssetStatus.IN_REPAIR.value: {
        AssetStatus.ASSIGNED.value,
        AssetStatus.REGISTERED.value,
        AssetStatus.WRITTEN_OFF.value,
    },
    AssetStatus.LOST.value: {
        AssetStatus.WRITTEN_OFF.value,
    },
    AssetStatus.WRITTEN_OFF.value: set(),
}


def validate_transition(current_status: str, target_status: str) -> None:
    allowed = ALLOWED_TRANSITIONS.get(current_status, set())
    if target_status not in allowed:
        raise InvalidTransitionException(current_status, target_status)


def _normalize_list(value: str | Sequence[str] | None) -> list[str] | None:
    if value is None:
        return None
    if isinstance(value, str):
        items = [value] if value else []
    else:
        items = [v for v in value if v]
    return items or None


def _sort_clause(sort_by: str | None, sort_order: str | None):
    column = SORTABLE_COLUMNS.get((sort_by or "").strip(), Asset.created_at)
    descending = (sort_order or "desc").strip().lower() != "asc"
    return desc(column) if descending else asc(column)


async def create_asset(
    db: AsyncSession,
    data: AssetCreate,
    created_by: uuid.UUID,
    organization_id: uuid.UUID,
) -> Asset:
    existing = await db.execute(
        select(Asset).where(
            Asset.organization_id == organization_id,
            Asset.serial_number == data.serial_number,
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictException(f"Asset with serial number '{data.serial_number}' already exists")

    asset = Asset(
        organization_id=organization_id,
        name=data.name,
        asset_type=data.asset_type,
        category=data.category,
        serial_number=data.serial_number,
        brand=data.brand,
        model=data.model,
        purchase_date=data.purchase_date,
        purchase_price=data.purchase_price,
        warranty_expiry=data.warranty_expiry,
        description=data.description,
        image_url=data.image_url,
        status=AssetStatus.REGISTERED.value,
        created_by=created_by,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset


async def get_assets(
    db: AsyncSession,
    organization_id: uuid.UUID,
    page: int = 1,
    size: int = 20,
    status: str | Sequence[str] | None = None,
    category: str | Sequence[str] | None = None,
    department_id: Optional[uuid.UUID] = None,
    branch_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
) -> AssetListResponse:
    base_query = select(Asset).where(
        Asset.deleted_at.is_(None),
        Asset.organization_id == organization_id,
    )
    count_query = select(func.count(Asset.id)).where(
        Asset.deleted_at.is_(None),
        Asset.organization_id == organization_id,
    )

    filters = []
    statuses = _normalize_list(status)
    if statuses:
        filters.append(Asset.status.in_(statuses))
    categories = _normalize_list(category)
    if categories:
        filters.append(Asset.category.in_(categories))
    if search:
        search_pattern = f"%{search}%"
        filters.append(
            or_(
                Asset.name.ilike(search_pattern),
                Asset.serial_number.ilike(search_pattern),
                Asset.brand.ilike(search_pattern),
                Asset.model.ilike(search_pattern),
                Asset.description.ilike(search_pattern),
            )
        )
    if date_from:
        filters.append(Asset.purchase_date >= date_from)
    if date_to:
        filters.append(Asset.purchase_date <= date_to)

    if department_id:
        subquery = (
            select(Assignment.asset_id)
            .where(
                and_(
                    Assignment.organization_id == organization_id,
                    Assignment.department_id == department_id,
                    Assignment.is_active == True,
                )
            )
            .scalar_subquery()
        )
        filters.append(Asset.id.in_(subquery))

    if branch_id:
        branch_subquery = (
            select(Assignment.asset_id)
            .where(
                and_(
                    Assignment.organization_id == organization_id,
                    Assignment.branch_id == branch_id,
                    Assignment.is_active == True,
                )
            )
            .scalar_subquery()
        )
        filters.append(Asset.id.in_(branch_subquery))

    if filters:
        combined = and_(*filters)
        base_query = base_query.where(combined)
        count_query = count_query.where(combined)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    pages = max(1, math.ceil(total / size))
    offset = (page - 1) * size

    result = await db.execute(
        base_query.order_by(_sort_clause(sort_by, sort_order)).offset(offset).limit(size)
    )
    assets = result.scalars().all()

    # Fetch active assignments for these assets to populate assigned_to
    asset_ids = [a.id for a in assets]
    assigned_map = {}
    if asset_ids:
        from app.models.assignment import Assignment as Asgn, Employee, Department, Branch
        assign_result = await db.execute(
            select(
                Asgn.asset_id,
                Employee.full_name.label("employee_name"),
                Department.name.label("department_name"),
                Branch.name.label("branch_name"),
            )
            .outerjoin(Employee, Asgn.employee_id == Employee.id)
            .outerjoin(Department, Asgn.department_id == Department.id)
            .outerjoin(Branch, Asgn.branch_id == Branch.id)
            .where(
                and_(
                    Asgn.organization_id == organization_id,
                    Asgn.asset_id.in_(asset_ids),
                    Asgn.is_active == True,
                )
            )
        )
        for row in assign_result.all():
            name = row.employee_name or row.department_name or ""
            if row.branch_name:
                name += f" ({row.branch_name})" if name else row.branch_name
            assigned_map[row.asset_id] = name

    items = []
    for a in assets:
        d = AssetResponse.model_validate(a).model_dump()
        d["assigned_to"] = assigned_map.get(a.id, None)
        items.append(d)

    return {"items": items, "total": total, "page": page, "pages": pages}


async def get_asset(
    db: AsyncSession, asset_id: uuid.UUID, organization_id: uuid.UUID
) -> AssetDetail:
    result = await db.execute(
        select(Asset).where(
            Asset.id == asset_id,
            Asset.organization_id == organization_id,
            Asset.deleted_at.is_(None),
        )
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise NotFoundException(f"Asset with id '{asset_id}' not found")

    current_assignment = None
    assignment_result = await db.execute(
        select(Assignment).where(
            Assignment.asset_id == asset_id,
            Assignment.organization_id == organization_id,
            Assignment.is_active == True,
        )
    )
    active_assignment = assignment_result.scalar_one_or_none()
    if active_assignment:
        emp_name = active_assignment.employee.full_name if active_assignment.employee else None
        dept_name = active_assignment.department.name if active_assignment.department else None
        branch_name = active_assignment.branch.name if active_assignment.branch else None
        current_assignment = AssignmentBrief(
            id=active_assignment.id,
            employee_name=emp_name,
            department_name=dept_name,
            branch_name=branch_name,
            assigned_at=active_assignment.assigned_at,
            is_active=active_assignment.is_active,
        )

    detail = AssetDetail(
        id=asset.id,
        name=asset.name,
        asset_type=asset.asset_type,
        category=asset.category,
        serial_number=asset.serial_number,
        brand=asset.brand,
        model=asset.model,
        purchase_date=asset.purchase_date,
        purchase_price=asset.purchase_price,
        warranty_expiry=asset.warranty_expiry,
        description=asset.description,
        image_url=asset.image_url,
        status=asset.status,
        qr_code_url=asset.qr_code_url,
        created_at=asset.created_at,
        updated_at=asset.updated_at,
        created_by=asset.created_by,
        deleted_at=asset.deleted_at,
        current_assignment=current_assignment,
    )
    return detail


async def get_asset_raw(
    db: AsyncSession, asset_id: uuid.UUID, organization_id: uuid.UUID
) -> Asset:
    result = await db.execute(
        select(Asset).where(
            Asset.id == asset_id,
            Asset.organization_id == organization_id,
            Asset.deleted_at.is_(None),
        )
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise NotFoundException(f"Asset with id '{asset_id}' not found")
    return asset


async def update_asset(
    db: AsyncSession,
    asset_id: uuid.UUID,
    data: AssetUpdate,
    organization_id: uuid.UUID,
) -> Asset:
    asset = await get_asset_raw(db, asset_id, organization_id)
    update_data = data.model_dump(exclude_unset=True)

    if "serial_number" in update_data and update_data["serial_number"] != asset.serial_number:
        existing = await db.execute(
            select(Asset).where(
                Asset.organization_id == organization_id,
                Asset.serial_number == update_data["serial_number"],
                Asset.id != asset_id,
            )
        )
        if existing.scalar_one_or_none():
            raise ConflictException(
                f"Asset with serial number '{update_data['serial_number']}' already exists"
            )

    for field, value in update_data.items():
        setattr(asset, field, value)

    await db.commit()
    await db.refresh(asset)
    return asset


async def delete_asset(
    db: AsyncSession, asset_id: uuid.UUID, organization_id: uuid.UUID
) -> Asset:
    asset = await get_asset_raw(db, asset_id, organization_id)
    asset.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(asset)
    return asset


async def change_status(
    db: AsyncSession,
    asset_id: uuid.UUID,
    new_status: str,
    organization_id: uuid.UUID,
) -> Asset:
    asset = await get_asset_raw(db, asset_id, organization_id)
    validate_transition(asset.status, new_status)
    asset.status = new_status
    await db.commit()
    await db.refresh(asset)
    return asset
