from datetime import date, timedelta, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, case, and_, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.asset import Asset, AssetStatus, AssetCategory
from app.models.assignment import Assignment, Department, Branch
from app.models.audit import AuditLog

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/overview")
async def get_overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base_filter = Asset.deleted_at.is_(None)

    # Total count
    total_result = await db.execute(
        select(func.count(Asset.id)).where(base_filter)
    )
    total = total_result.scalar() or 0

    # By status
    status_result = await db.execute(
        select(Asset.status, func.count(Asset.id))
        .where(base_filter)
        .group_by(Asset.status)
    )
    by_status = {row[0]: row[1] for row in status_result.all()}

    # By category
    category_result = await db.execute(
        select(Asset.category, func.count(Asset.id))
        .where(base_filter)
        .group_by(Asset.category)
    )
    by_category = {row[0]: row[1] for row in category_result.all()}

    # Total value
    value_result = await db.execute(
        select(func.sum(Asset.purchase_price)).where(base_filter)
    )
    total_value = float(value_result.scalar() or 0)

    return {
        "total_assets": total,
        "by_status": by_status,
        "by_category": by_category,
        "total_value": total_value,
    }


@router.get("/value-over-time")
async def get_value_over_time(
    months: int = Query(12, ge=1, le=60),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    data = []

    for i in range(months - 1, -1, -1):
        target_date = now - timedelta(days=i * 30)
        result = await db.execute(
            select(func.sum(Asset.purchase_price)).where(
                and_(
                    Asset.deleted_at.is_(None),
                    Asset.created_at <= target_date,
                )
            )
        )
        value = float(result.scalar() or 0)
        data.append({
            "date": target_date.strftime("%Y-%m"),
            "value": value,
        })

    return data


@router.get("/status-over-time")
async def get_status_over_time(
    months: int = Query(12, ge=1, le=60),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns status distribution snapshots approximated from audit logs."""
    # Current snapshot approach
    base_filter = Asset.deleted_at.is_(None)
    result = await db.execute(
        select(
            func.date_trunc("month", Asset.created_at).label("month"),
            Asset.status,
            func.count(Asset.id),
        )
        .where(base_filter)
        .group_by("month", Asset.status)
        .order_by("month")
    )
    rows = result.all()

    data = {}
    for row in rows:
        month_str = row[0].strftime("%Y-%m") if row[0] else "unknown"
        if month_str not in data:
            data[month_str] = {}
        data[month_str][row[1]] = row[2]

    return [{"date": k, "statuses": v} for k, v in sorted(data.items())]


@router.get("/department-allocation")
async def get_department_allocation(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(
            Department.name,
            func.count(Assignment.id),
            func.sum(Asset.purchase_price),
        )
        .join(Assignment, Assignment.department_id == Department.id)
        .join(Asset, Asset.id == Assignment.asset_id)
        .where(
            and_(
                Assignment.is_active == True,
                Asset.deleted_at.is_(None),
            )
        )
        .group_by(Department.name)
    )
    rows = result.all()

    return [
        {
            "department": row[0],
            "asset_count": row[1],
            "total_value": float(row[2] or 0),
        }
        for row in rows
    ]


@router.get("/age-distribution")
async def get_age_distribution(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = date.today()
    result = await db.execute(
        select(
            case(
                (Asset.purchase_date.is_(None), "Unknown"),
                (Asset.purchase_date >= now - timedelta(days=365), "< 1 year"),
                (Asset.purchase_date >= now - timedelta(days=730), "1-2 years"),
                (Asset.purchase_date >= now - timedelta(days=1095), "2-3 years"),
                (Asset.purchase_date >= now - timedelta(days=1825), "3-5 years"),
                else_="5+ years",
            ).label("age_group"),
            func.count(Asset.id),
        )
        .where(Asset.deleted_at.is_(None))
        .group_by("age_group")
    )
    rows = result.all()

    return [{"age_group": row[0], "count": row[1]} for row in rows]


@router.get("/repair-frequency")
async def get_repair_frequency(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(
            Asset.name,
            Asset.serial_number,
            Asset.category,
            func.count(AuditLog.id).label("repair_count"),
        )
        .join(
            AuditLog,
            and_(
                AuditLog.entity_id == Asset.id,
                AuditLog.entity_type == "asset",
                AuditLog.action == "STATUS_CHANGE",
            ),
        )
        .where(
            and_(
                Asset.deleted_at.is_(None),
                AuditLog.new_value.isnot(None),
            )
        )
        .group_by(Asset.id, Asset.name, Asset.serial_number, Asset.category)
        .order_by(func.count(AuditLog.id).desc())
        .limit(20)
    )
    rows = result.all()

    return [
        {
            "name": row[0],
            "serial_number": row[1],
            "category": row[2],
            "repair_count": row[3],
        }
        for row in rows
    ]


@router.get("/warranty-expiring")
async def get_warranty_expiring(
    days: int = Query(90, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    cutoff = today + timedelta(days=days)

    result = await db.execute(
        select(Asset)
        .where(
            and_(
                Asset.deleted_at.is_(None),
                Asset.warranty_expiry.isnot(None),
                Asset.warranty_expiry >= today,
                Asset.warranty_expiry <= cutoff,
            )
        )
        .order_by(Asset.warranty_expiry)
    )
    assets = result.scalars().all()

    return [
        {
            "id": str(a.id),
            "name": a.name,
            "serial_number": a.serial_number,
            "category": a.category,
            "warranty_expiry": a.warranty_expiry.isoformat() if a.warranty_expiry else None,
            "days_remaining": (a.warranty_expiry - today).days if a.warranty_expiry else None,
            "status": a.status,
        }
        for a in assets
    ]
