import csv
import io
import math
import uuid
from datetime import datetime, date
from typing import Optional, List

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.schemas.audit import AuditLogResponse, AuditListResponse


async def log_action(
    db: AsyncSession,
    entity_type: str,
    entity_id: uuid.UUID,
    action: str,
    actor_id: Optional[uuid.UUID] = None,
    actor_name: Optional[str] = None,
    old_value: Optional[dict] = None,
    new_value: Optional[dict] = None,
    reason: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> AuditLog:
    log_entry = AuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        actor_id=actor_id,
        actor_name=actor_name,
        old_value=old_value,
        new_value=new_value,
        reason=reason,
        ip_address=ip_address,
    )
    db.add(log_entry)
    await db.commit()
    await db.refresh(log_entry)
    return log_entry


async def get_audit_logs(
    db: AsyncSession,
    page: int = 1,
    size: int = 20,
    entity_type: Optional[str] = None,
    entity_id: Optional[uuid.UUID] = None,
    action: Optional[str] = None,
    actor_id: Optional[uuid.UUID] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> AuditListResponse:
    base_query = select(AuditLog)
    count_query = select(func.count(AuditLog.id))

    filters = []
    if entity_type:
        filters.append(AuditLog.entity_type == entity_type)
    if entity_id:
        filters.append(AuditLog.entity_id == entity_id)
    if action:
        filters.append(AuditLog.action == action)
    if actor_id:
        filters.append(AuditLog.actor_id == actor_id)
    if date_from:
        filters.append(func.date(AuditLog.occurred_at) >= date_from)
    if date_to:
        filters.append(func.date(AuditLog.occurred_at) <= date_to)

    if filters:
        combined = and_(*filters)
        base_query = base_query.where(combined)
        count_query = count_query.where(combined)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    pages = max(1, math.ceil(total / size))
    offset = (page - 1) * size

    result = await db.execute(
        base_query.order_by(AuditLog.occurred_at.desc()).offset(offset).limit(size)
    )
    logs = result.scalars().all()

    items = [AuditLogResponse.model_validate(log) for log in logs]
    return AuditListResponse(items=items, total=total, page=page, pages=pages)


async def get_entity_history(
    db: AsyncSession,
    entity_type: str,
    entity_id: uuid.UUID,
) -> List[AuditLogResponse]:
    result = await db.execute(
        select(AuditLog)
        .where(
            AuditLog.entity_type == entity_type,
            AuditLog.entity_id == entity_id,
        )
        .order_by(AuditLog.occurred_at.desc())
    )
    logs = result.scalars().all()
    return [AuditLogResponse.model_validate(log) for log in logs]


async def export_audit_csv(
    db: AsyncSession,
    entity_type: Optional[str] = None,
    action: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> str:
    query = select(AuditLog)
    filters = []

    if entity_type:
        filters.append(AuditLog.entity_type == entity_type)
    if action:
        filters.append(AuditLog.action == action)
    if date_from:
        filters.append(func.date(AuditLog.occurred_at) >= date_from)
    if date_to:
        filters.append(func.date(AuditLog.occurred_at) <= date_to)

    if filters:
        query = query.where(and_(*filters))

    result = await db.execute(query.order_by(AuditLog.occurred_at.desc()))
    logs = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Entity Type", "Entity ID", "Action", "Actor ID",
        "Actor Name", "Old Value", "New Value", "Reason",
        "IP Address", "Occurred At",
    ])

    for log in logs:
        writer.writerow([
            log.id,
            log.entity_type,
            str(log.entity_id),
            log.action,
            str(log.actor_id) if log.actor_id else "",
            log.actor_name or "",
            str(log.old_value) if log.old_value else "",
            str(log.new_value) if log.new_value else "",
            log.reason or "",
            log.ip_address or "",
            log.occurred_at.isoformat() if log.occurred_at else "",
        ])

    return output.getvalue()
