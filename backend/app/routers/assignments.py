import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_role
from app.models.user import User, UserRole
from app.schemas.assignment import AssignRequest, ReturnRequest, AssignmentResponse
from app.services import assignment_service, audit_service, asset_service

router = APIRouter(prefix="/api/assets", tags=["assignments"])


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/{asset_id}/assign", response_model=AssignmentResponse, status_code=201)
async def assign_asset(
    asset_id: uuid.UUID,
    body: AssignRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.ADMIN.value, UserRole.MANAGER.value)
    ),
):
    assignment = await assignment_service.assign_asset(
        db, asset_id, body, current_user.id
    )

    emp_name = assignment.employee.full_name if assignment.employee else None
    dept_name = assignment.department.name if assignment.department else None
    branch_name = assignment.branch.name if assignment.branch else None

    await audit_service.log_action(
        db,
        entity_type="asset",
        entity_id=asset_id,
        action="ASSIGN",
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        new_value={
            "employee": emp_name,
            "department": dept_name,
            "branch": branch_name,
        },
        ip_address=_get_client_ip(request),
    )

    return AssignmentResponse(
        id=assignment.id,
        asset_id=assignment.asset_id,
        employee_id=assignment.employee_id,
        department_id=assignment.department_id,
        branch_id=assignment.branch_id,
        assigned_by=assignment.assigned_by,
        assigned_at=assignment.assigned_at,
        returned_at=assignment.returned_at,
        return_reason=assignment.return_reason,
        is_active=assignment.is_active,
        notes=assignment.notes,
        employee_name=emp_name,
        department_name=dept_name,
        branch_name=branch_name,
        assigner_name=current_user.full_name,
    )


@router.post("/{asset_id}/return", response_model=AssignmentResponse)
async def return_asset(
    asset_id: uuid.UUID,
    body: ReturnRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.ADMIN.value, UserRole.MANAGER.value)
    ),
):
    assignment = await assignment_service.return_asset(
        db, asset_id, body.return_reason
    )

    emp_name = assignment.employee.full_name if assignment.employee else None
    dept_name = assignment.department.name if assignment.department else None
    branch_name = assignment.branch.name if assignment.branch else None

    await audit_service.log_action(
        db,
        entity_type="asset",
        entity_id=asset_id,
        action="RETURN",
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        old_value={
            "employee": emp_name,
            "department": dept_name,
            "branch": branch_name,
        },
        reason=body.return_reason,
        ip_address=_get_client_ip(request),
    )

    return AssignmentResponse(
        id=assignment.id,
        asset_id=assignment.asset_id,
        employee_id=assignment.employee_id,
        department_id=assignment.department_id,
        branch_id=assignment.branch_id,
        assigned_by=assignment.assigned_by,
        assigned_at=assignment.assigned_at,
        returned_at=assignment.returned_at,
        return_reason=assignment.return_reason,
        is_active=assignment.is_active,
        notes=assignment.notes,
        employee_name=emp_name,
        department_name=dept_name,
        branch_name=branch_name,
        assigner_name=current_user.full_name,
    )
