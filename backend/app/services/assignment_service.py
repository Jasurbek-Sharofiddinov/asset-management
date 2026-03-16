import uuid
from datetime import datetime, timezone
from typing import List

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset import Asset, AssetStatus
from app.models.assignment import Assignment, Employee, Department, Branch
from app.schemas.assignment import AssignRequest, AssignmentResponse
from app.services.asset_service import validate_transition, get_asset_raw
from app.exceptions import (
    NotFoundException,
    ConflictException,
    BadRequestException,
)


async def assign_asset(
    db: AsyncSession,
    asset_id: uuid.UUID,
    data: AssignRequest,
    assigned_by: uuid.UUID,
) -> Assignment:
    asset = await get_asset_raw(db, asset_id)

    # Check no active assignment exists
    existing = await db.execute(
        select(Assignment).where(
            Assignment.asset_id == asset_id,
            Assignment.is_active == True,
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictException(
            f"Asset '{asset.name}' already has an active assignment. Return it first."
        )

    # Validate at least one assignee
    if not data.employee_id and not data.department_id:
        raise BadRequestException("Either employee_id or department_id must be provided")

    # Validate references exist
    if data.employee_id:
        emp_result = await db.execute(
            select(Employee).where(Employee.id == data.employee_id)
        )
        if not emp_result.scalar_one_or_none():
            raise NotFoundException(f"Employee with id '{data.employee_id}' not found")

    if data.department_id:
        dept_result = await db.execute(
            select(Department).where(Department.id == data.department_id)
        )
        if not dept_result.scalar_one_or_none():
            raise NotFoundException(f"Department with id '{data.department_id}' not found")

    branch_result = await db.execute(
        select(Branch).where(Branch.id == data.branch_id)
    )
    if not branch_result.scalar_one_or_none():
        raise NotFoundException(f"Branch with id '{data.branch_id}' not found")

    # Validate status transition to ASSIGNED
    validate_transition(asset.status, AssetStatus.ASSIGNED.value)

    assignment = Assignment(
        asset_id=asset_id,
        employee_id=data.employee_id,
        department_id=data.department_id,
        branch_id=data.branch_id,
        assigned_by=assigned_by,
        notes=data.notes,
        is_active=True,
    )
    db.add(assignment)

    asset.status = AssetStatus.ASSIGNED.value
    await db.commit()
    await db.refresh(assignment)
    return assignment


async def return_asset(
    db: AsyncSession,
    asset_id: uuid.UUID,
    return_reason: str | None = None,
) -> Assignment:
    asset = await get_asset_raw(db, asset_id)

    result = await db.execute(
        select(Assignment).where(
            Assignment.asset_id == asset_id,
            Assignment.is_active == True,
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise NotFoundException(f"No active assignment found for asset '{asset.name}'")

    assignment.returned_at = datetime.now(timezone.utc)
    assignment.is_active = False
    assignment.return_reason = return_reason

    validate_transition(asset.status, AssetStatus.REGISTERED.value)
    asset.status = AssetStatus.REGISTERED.value

    await db.commit()
    await db.refresh(assignment)
    return assignment


async def get_asset_assignments(
    db: AsyncSession,
    asset_id: uuid.UUID,
) -> List[AssignmentResponse]:
    # Ensure asset exists
    await get_asset_raw(db, asset_id)

    result = await db.execute(
        select(Assignment)
        .where(Assignment.asset_id == asset_id)
        .order_by(Assignment.assigned_at.desc())
    )
    assignments = result.scalars().all()

    responses = []
    for a in assignments:
        emp_name = a.employee.full_name if a.employee else None
        dept_name = a.department.name if a.department else None
        branch_name = a.branch.name if a.branch else None
        assigner_name = a.assigner.full_name if a.assigner else None

        responses.append(
            AssignmentResponse(
                id=a.id,
                asset_id=a.asset_id,
                employee_id=a.employee_id,
                department_id=a.department_id,
                branch_id=a.branch_id,
                assigned_by=a.assigned_by,
                assigned_at=a.assigned_at,
                returned_at=a.returned_at,
                return_reason=a.return_reason,
                is_active=a.is_active,
                notes=a.notes,
                employee_name=emp_name,
                department_name=dept_name,
                branch_name=branch_name,
                assigner_name=assigner_name,
            )
        )
    return responses
