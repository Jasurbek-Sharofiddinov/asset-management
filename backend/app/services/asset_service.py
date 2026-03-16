import uuid
import math
from datetime import datetime, date, timezone
from typing import Optional, Tuple, List

from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset import Asset, AssetStatus
from app.models.assignment import Assignment
from app.exceptions import (
    NotFoundException,
    ConflictException,
    InvalidTransitionException,
    BadRequestException,
)
from app.schemas.asset import (
    AssetCreate,
    AssetUpdate,
    AssetResponse,
    AssetDetail,
    AssetListResponse,
    AssignmentBrief,
)

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


async def create_asset(
    db: AsyncSession,
    data: AssetCreate,
    created_by: uuid.UUID,
) -> Asset:
    existing = await db.execute(
        select(Asset).where(Asset.serial_number == data.serial_number)
    )
    if existing.scalar_one_or_none():
        raise ConflictException(f"Asset with serial number '{data.serial_number}' already exists")

    asset = Asset(
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
    page: int = 1,
    size: int = 20,
    status: Optional[str] = None,
    category: Optional[str] = None,
    department_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> AssetListResponse:
    base_query = select(Asset).where(Asset.deleted_at.is_(None))
    count_query = select(func.count(Asset.id)).where(Asset.deleted_at.is_(None))

    filters = []
    if status:
        filters.append(Asset.status == status)
    if category:
        filters.append(Asset.category == category)
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
                    Assignment.department_id == department_id,
                    Assignment.is_active == True,
                )
            )
            .scalar_subquery()
        )
        filters.append(Asset.id.in_(subquery))

    if filters:
        combined = and_(*filters)
        base_query = base_query.where(combined)
        count_query = count_query.where(combined)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    pages = max(1, math.ceil(total / size))
    offset = (page - 1) * size

    result = await db.execute(
        base_query.order_by(Asset.created_at.desc()).offset(offset).limit(size)
    )
    assets = result.scalars().all()

    items = [AssetResponse.model_validate(a) for a in assets]
    return AssetListResponse(items=items, total=total, page=page, pages=pages)


async def get_asset(db: AsyncSession, asset_id: uuid.UUID) -> AssetDetail:
    result = await db.execute(
        select(Asset).where(Asset.id == asset_id, Asset.deleted_at.is_(None))
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise NotFoundException(f"Asset with id '{asset_id}' not found")

    current_assignment = None
    assignment_result = await db.execute(
        select(Assignment).where(
            Assignment.asset_id == asset_id,
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


async def get_asset_raw(db: AsyncSession, asset_id: uuid.UUID) -> Asset:
    result = await db.execute(
        select(Asset).where(Asset.id == asset_id, Asset.deleted_at.is_(None))
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise NotFoundException(f"Asset with id '{asset_id}' not found")
    return asset


async def update_asset(
    db: AsyncSession,
    asset_id: uuid.UUID,
    data: AssetUpdate,
) -> Asset:
    asset = await get_asset_raw(db, asset_id)
    update_data = data.model_dump(exclude_unset=True)

    if "serial_number" in update_data and update_data["serial_number"] != asset.serial_number:
        existing = await db.execute(
            select(Asset).where(
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


async def delete_asset(db: AsyncSession, asset_id: uuid.UUID) -> Asset:
    asset = await get_asset_raw(db, asset_id)
    asset.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(asset)
    return asset


async def change_status(
    db: AsyncSession,
    asset_id: uuid.UUID,
    new_status: str,
) -> Asset:
    asset = await get_asset_raw(db, asset_id)
    validate_transition(asset.status, new_status)
    asset.status = new_status
    await db.commit()
    await db.refresh(asset)
    return asset
