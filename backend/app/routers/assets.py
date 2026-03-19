import uuid
from datetime import date
from typing import Optional, List

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user, require_role
from app.models.user import User, UserRole
from app.schemas.asset import (
    AssetCreate,
    AssetUpdate,
    AssetResponse,
    AssetDetail,
    AssetStatusUpdate,
    AssetListResponse,
)
from app.schemas.assignment import AssignmentResponse
from app.services import asset_service, assignment_service, audit_service
from app.services.qr_service import generate_qr_code

router = APIRouter(prefix="/api/assets", tags=["assets"])


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.get("")
async def list_assets(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    department_id: Optional[uuid.UUID] = Query(None),
    branch_id: Optional[uuid.UUID] = Query(None),
    search: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await asset_service.get_assets(
        db, page=page, size=size, status=status, category=category,
        department_id=department_id, branch_id=branch_id, search=search,
        date_from=date_from, date_to=date_to,
    )


@router.post("", response_model=AssetResponse, status_code=201)
async def create_asset(
    body: AssetCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.ADMIN.value, UserRole.MANAGER.value)
    ),
):
    asset = await asset_service.create_asset(db, body, current_user.id)

    await audit_service.log_action(
        db,
        entity_type="asset",
        entity_id=asset.id,
        action="CREATE",
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        new_value={"name": asset.name, "serial_number": asset.serial_number, "category": asset.category},
        ip_address=_get_client_ip(request),
    )

    return asset


@router.get("/{asset_id}", response_model=AssetDetail)
async def get_asset(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await asset_service.get_asset(db, asset_id)


@router.put("/{asset_id}", response_model=AssetResponse)
async def update_asset(
    asset_id: uuid.UUID,
    body: AssetUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.ADMIN.value, UserRole.MANAGER.value)
    ),
):
    old_asset = await asset_service.get_asset_raw(db, asset_id)
    old_data = {
        "name": old_asset.name,
        "serial_number": old_asset.serial_number,
        "category": old_asset.category,
        "status": old_asset.status,
    }

    asset = await asset_service.update_asset(db, asset_id, body)

    new_data = {
        "name": asset.name,
        "serial_number": asset.serial_number,
        "category": asset.category,
        "status": asset.status,
    }

    await audit_service.log_action(
        db,
        entity_type="asset",
        entity_id=asset.id,
        action="UPDATE",
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        old_value=old_data,
        new_value=new_data,
        ip_address=_get_client_ip(request),
    )

    return asset


@router.delete("/{asset_id}", response_model=AssetResponse)
async def delete_asset(
    asset_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN.value)),
):
    asset = await asset_service.delete_asset(db, asset_id)

    await audit_service.log_action(
        db,
        entity_type="asset",
        entity_id=asset.id,
        action="DELETE",
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        old_value={"name": asset.name, "serial_number": asset.serial_number},
        ip_address=_get_client_ip(request),
    )

    return asset


@router.patch("/{asset_id}/status", response_model=AssetResponse)
async def change_asset_status(
    asset_id: uuid.UUID,
    body: AssetStatusUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.ADMIN.value, UserRole.MANAGER.value)
    ),
):
    old_asset = await asset_service.get_asset_raw(db, asset_id)
    old_status = old_asset.status

    asset = await asset_service.change_status(db, asset_id, body.new_status)

    await audit_service.log_action(
        db,
        entity_type="asset",
        entity_id=asset.id,
        action="STATUS_CHANGE",
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        old_value={"status": old_status},
        new_value={"status": asset.status},
        reason=body.reason,
        ip_address=_get_client_ip(request),
    )

    return asset


@router.get("/{asset_id}/qr")
async def get_asset_qr(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    asset_detail = await asset_service.get_asset(db, asset_id)

    assigned_to = None
    branch = None
    if asset_detail.current_assignment:
        assigned_to = asset_detail.current_assignment.employee_name
        branch = asset_detail.current_assignment.branch_name

    qr_data = {
        "id": str(asset_detail.id),
        "name": asset_detail.name,
        "serial": asset_detail.serial_number,
        "category": asset_detail.category,
        "status": asset_detail.status,
        "assignedTo": assigned_to,
        "branch": branch,
        "scanUrl": f"/api/assets/{asset_detail.id}",
    }

    png_bytes = generate_qr_code(qr_data)
    return Response(content=png_bytes, media_type="image/png")


@router.get("/{asset_id}/history", response_model=List[AssignmentResponse])
async def get_asset_history(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await assignment_service.get_asset_assignments(db, asset_id)
