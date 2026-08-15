from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date, timedelta

from app.dependencies import get_db, require_role
from app.models.user import User, UserRole
from app.models.asset import Asset
from app.models.assignment import Assignment, Department
from app.models.audit import AuditLog
from app.services import ai_service

router = APIRouter(prefix="/api/ai", tags=["ai"])


_ai_roles = require_role(UserRole.ADMIN.value, UserRole.MANAGER.value)


@router.post("/recommend-category")
async def recommend_category(
    name: str = Query(...),
    brand: str = Query(""),
    model: str = Query(""),
    asset_type: str = Query(""),
    description: str = Query(""),
    current_user: User = Depends(_ai_roles),
):
    """AI-powered category recommendation for new assets."""
    result = await ai_service.recommend_category(
        name=name, brand=brand, model=model,
        asset_type=asset_type, description=description
    )
    return result


@router.get("/insights")
async def get_insights(
    locale: str = Query("en"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_ai_roles),
):
    """Generate AI insights from current asset data (scoped to caller's org)."""
    org_id = current_user.organization_id
    base_filter = and_(Asset.deleted_at.is_(None), Asset.organization_id == org_id)

    total_result = await db.execute(select(func.count(Asset.id)).where(base_filter))
    total = total_result.scalar() or 0

    status_result = await db.execute(
        select(Asset.status, func.count(Asset.id)).where(base_filter).group_by(Asset.status)
    )
    by_status = {row[0]: row[1] for row in status_result.all()}

    category_result = await db.execute(
        select(Asset.category, func.count(Asset.id)).where(base_filter).group_by(Asset.category)
    )
    by_category = {row[0]: row[1] for row in category_result.all()}

    value_result = await db.execute(select(func.sum(Asset.purchase_price)).where(base_filter))
    total_value = float(value_result.scalar() or 0)

    dept_result = await db.execute(
        select(Department.name, func.count(Assignment.id))
        .join(Assignment, Assignment.department_id == Department.id)
        .where(
            and_(
                Assignment.is_active == True,
                Assignment.organization_id == org_id,
                Department.organization_id == org_id,
            )
        )
        .group_by(Department.name)
    )
    dept_allocation = {row[0]: row[1] for row in dept_result.all()}

    today = date.today()
    expiring_result = await db.execute(
        select(func.count(Asset.id)).where(
            and_(
                base_filter,
                Asset.warranty_expiry.isnot(None),
                Asset.warranty_expiry <= today + timedelta(days=90),
                Asset.warranty_expiry >= today,
            )
        )
    )
    expiring_count = expiring_result.scalar() or 0

    repair_result = await db.execute(
        select(func.count(AuditLog.id)).where(
            and_(
                AuditLog.organization_id == org_id,
                AuditLog.action == "STATUS_CHANGE",
                AuditLog.entity_type == "asset",
            )
        )
    )
    total_status_changes = repair_result.scalar() or 0

    analytics_data = {
        "total_assets": total,
        "total_value": total_value,
        "by_status": by_status,
        "by_category": by_category,
        "department_allocation": dept_allocation,
        "warranties_expiring_90d": expiring_count,
        "total_status_changes": total_status_changes,
    }

    insights = await ai_service.generate_insights(analytics_data, locale=locale)
    insights["data_snapshot"] = analytics_data
    return insights


@router.get("/predictions")
async def get_predictions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_ai_roles),
):
    """Predict future asset needs based on current org-scoped data."""
    org_id = current_user.organization_id
    base_filter = and_(Asset.deleted_at.is_(None), Asset.organization_id == org_id)

    total_result = await db.execute(select(func.count(Asset.id)).where(base_filter))
    total = total_result.scalar() or 0

    status_result = await db.execute(
        select(Asset.status, func.count(Asset.id)).where(base_filter).group_by(Asset.status)
    )
    by_status = {row[0]: row[1] for row in status_result.all()}

    category_result = await db.execute(
        select(Asset.category, func.count(Asset.id), func.sum(Asset.purchase_price))
        .where(base_filter).group_by(Asset.category)
    )
    category_data = [
        {"category": row[0], "count": row[1], "value": float(row[2] or 0)}
        for row in category_result.all()
    ]

    today = date.today()
    age_result = await db.execute(
        select(Asset.category, func.avg(func.current_date() - Asset.purchase_date))
        .where(and_(base_filter, Asset.purchase_date.isnot(None)))
        .group_by(Asset.category)
    )
    avg_age = {}
    for row in age_result.all():
        days = row[1]
        if days is not None:
            if hasattr(days, "days"):
                avg_age[row[0]] = round(days.days / 365, 1)
            else:
                avg_age[row[0]] = round(float(days) / 365, 1)

    repair_result = await db.execute(
        select(func.count(AuditLog.id)).where(
            and_(
                AuditLog.organization_id == org_id,
                AuditLog.action == "STATUS_CHANGE",
                AuditLog.entity_type == "asset",
            )
        )
    )
    total_repairs = repair_result.scalar() or 0
    repairs_by_cat = {"total_status_changes": total_repairs}

    expiring_result = await db.execute(
        select(Asset.category, func.count(Asset.id))
        .where(
            and_(
                base_filter,
                Asset.warranty_expiry.isnot(None),
                Asset.warranty_expiry <= today + timedelta(days=180),
                Asset.warranty_expiry >= today,
            )
        )
        .group_by(Asset.category)
    )
    expiring_by_cat = {row[0]: row[1] for row in expiring_result.all()}

    analytics_data = {
        "total_assets": total,
        "by_status": by_status,
        "categories": category_data,
        "average_age_years_by_category": avg_age,
        "status_changes_by_category": repairs_by_cat,
        "warranties_expiring_180d_by_category": expiring_by_cat,
    }

    predictions = await ai_service.predict_needs(analytics_data)
    predictions["based_on"] = analytics_data
    return predictions
