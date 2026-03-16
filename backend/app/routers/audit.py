import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user, require_role
from app.models.user import User, UserRole
from app.schemas.audit import AuditListResponse
from app.services import audit_service

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("", response_model=AuditListResponse)
async def list_audit_logs(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[uuid.UUID] = Query(None),
    action: Optional[str] = Query(None),
    actor_id: Optional[uuid.UUID] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await audit_service.get_audit_logs(
        db,
        page=page,
        size=size,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        actor_id=actor_id,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/export")
async def export_audit_logs(
    entity_type: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.AUDITOR.value, UserRole.ADMIN.value)
    ),
):
    csv_content = await audit_service.export_audit_csv(
        db,
        entity_type=entity_type,
        action=action,
        date_from=date_from,
        date_to=date_to,
    )

    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit_logs.csv"},
    )
