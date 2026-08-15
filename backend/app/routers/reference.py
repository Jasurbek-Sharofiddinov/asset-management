import uuid
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user, require_role
from app.models.user import User, UserRole
from app.models.assignment import Employee, Department, Branch
from app.schemas.reference import (
    EmployeeCreate,
    EmployeeUpdate,
    EmployeeResponse,
    DepartmentCreate,
    DepartmentResponse,
    BranchCreate,
    BranchResponse,
)
from app.exceptions import NotFoundException, ConflictException

router = APIRouter(prefix="/api", tags=["reference"])


# ── Departments ──────────────────────────────────────────────────────────────

@router.get("/departments", response_model=List[DepartmentResponse])
async def list_departments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Department)
        .where(Department.organization_id == current_user.organization_id)
        .order_by(Department.name)
    )
    return result.scalars().all()


@router.post("/departments", response_model=DepartmentResponse, status_code=201)
async def create_department(
    body: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.ADMIN.value, UserRole.MANAGER.value)
    ),
):
    existing = await db.execute(
        select(Department).where(
            Department.organization_id == current_user.organization_id,
            Department.name == body.name,
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictException(f"Department '{body.name}' already exists")

    dept = Department(
        organization_id=current_user.organization_id,
        name=body.name,
    )
    db.add(dept)
    await db.commit()
    await db.refresh(dept)
    return dept


@router.get("/departments/{dept_id}", response_model=DepartmentResponse)
async def get_department(
    dept_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Department).where(
            Department.id == dept_id,
            Department.organization_id == current_user.organization_id,
        )
    )
    dept = result.scalar_one_or_none()
    if not dept:
        raise NotFoundException(f"Department with id '{dept_id}' not found")
    return dept


@router.put("/departments/{dept_id}", response_model=DepartmentResponse)
async def update_department(
    dept_id: uuid.UUID,
    body: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.ADMIN.value, UserRole.MANAGER.value)
    ),
):
    result = await db.execute(
        select(Department).where(
            Department.id == dept_id,
            Department.organization_id == current_user.organization_id,
        )
    )
    dept = result.scalar_one_or_none()
    if not dept:
        raise NotFoundException(f"Department with id '{dept_id}' not found")

    existing = await db.execute(
        select(Department).where(
            Department.organization_id == current_user.organization_id,
            Department.name == body.name,
            Department.id != dept_id,
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictException(f"Department '{body.name}' already exists")

    dept.name = body.name
    await db.commit()
    await db.refresh(dept)
    return dept


@router.delete("/departments/{dept_id}")
async def delete_department(
    dept_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN.value)),
):
    result = await db.execute(
        select(Department).where(
            Department.id == dept_id,
            Department.organization_id == current_user.organization_id,
        )
    )
    dept = result.scalar_one_or_none()
    if not dept:
        raise NotFoundException(f"Department with id '{dept_id}' not found")

    await db.delete(dept)
    await db.commit()
    return {"message": f"Department '{dept.name}' deleted"}


# ── Branches ─────────────────────────────────────────────────────────────────

@router.get("/branches", response_model=List[BranchResponse])
async def list_branches(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Branch)
        .where(Branch.organization_id == current_user.organization_id)
        .order_by(Branch.name)
    )
    return result.scalars().all()


@router.post("/branches", response_model=BranchResponse, status_code=201)
async def create_branch(
    body: BranchCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.ADMIN.value, UserRole.MANAGER.value)
    ),
):
    existing = await db.execute(
        select(Branch).where(
            Branch.organization_id == current_user.organization_id,
            Branch.name == body.name,
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictException(f"Branch '{body.name}' already exists")

    branch = Branch(
        organization_id=current_user.organization_id,
        name=body.name,
        location=body.location,
    )
    db.add(branch)
    await db.commit()
    await db.refresh(branch)
    return branch


@router.get("/branches/{branch_id}", response_model=BranchResponse)
async def get_branch(
    branch_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Branch).where(
            Branch.id == branch_id,
            Branch.organization_id == current_user.organization_id,
        )
    )
    branch = result.scalar_one_or_none()
    if not branch:
        raise NotFoundException(f"Branch with id '{branch_id}' not found")
    return branch


@router.put("/branches/{branch_id}", response_model=BranchResponse)
async def update_branch(
    branch_id: uuid.UUID,
    body: BranchCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.ADMIN.value, UserRole.MANAGER.value)
    ),
):
    result = await db.execute(
        select(Branch).where(
            Branch.id == branch_id,
            Branch.organization_id == current_user.organization_id,
        )
    )
    branch = result.scalar_one_or_none()
    if not branch:
        raise NotFoundException(f"Branch with id '{branch_id}' not found")

    existing = await db.execute(
        select(Branch).where(
            Branch.organization_id == current_user.organization_id,
            Branch.name == body.name,
            Branch.id != branch_id,
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictException(f"Branch '{body.name}' already exists")

    branch.name = body.name
    branch.location = body.location
    await db.commit()
    await db.refresh(branch)
    return branch


@router.delete("/branches/{branch_id}")
async def delete_branch(
    branch_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN.value)),
):
    result = await db.execute(
        select(Branch).where(
            Branch.id == branch_id,
            Branch.organization_id == current_user.organization_id,
        )
    )
    branch = result.scalar_one_or_none()
    if not branch:
        raise NotFoundException(f"Branch with id '{branch_id}' not found")

    await db.delete(branch)
    await db.commit()
    return {"message": f"Branch '{branch.name}' deleted"}


# ── Employees ────────────────────────────────────────────────────────────────

@router.get("/employees", response_model=List[EmployeeResponse])
async def list_employees(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Employee)
        .where(Employee.organization_id == current_user.organization_id)
        .order_by(Employee.full_name)
    )
    employees = result.scalars().all()

    responses = []
    for emp in employees:
        responses.append(
            EmployeeResponse(
                id=emp.id,
                full_name=emp.full_name,
                email=emp.email,
                department_id=emp.department_id,
                branch_id=emp.branch_id,
                position=emp.position,
                department_name=emp.department.name if emp.department else None,
                branch_name=emp.branch.name if emp.branch else None,
            )
        )
    return responses


@router.post("/employees", response_model=EmployeeResponse, status_code=201)
async def create_employee(
    body: EmployeeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.ADMIN.value, UserRole.MANAGER.value)
    ),
):
    org_id = current_user.organization_id
    existing = await db.execute(
        select(Employee).where(
            Employee.organization_id == org_id,
            Employee.email == body.email,
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictException(f"Employee with email '{body.email}' already exists")

    # Ensure referenced dept/branch belong to the same org
    if body.department_id:
        dept = await db.execute(
            select(Department).where(
                Department.id == body.department_id,
                Department.organization_id == org_id,
            )
        )
        if not dept.scalar_one_or_none():
            raise NotFoundException(f"Department with id '{body.department_id}' not found")
    if body.branch_id:
        br = await db.execute(
            select(Branch).where(
                Branch.id == body.branch_id,
                Branch.organization_id == org_id,
            )
        )
        if not br.scalar_one_or_none():
            raise NotFoundException(f"Branch with id '{body.branch_id}' not found")

    emp = Employee(
        organization_id=org_id,
        full_name=body.full_name,
        email=body.email,
        department_id=body.department_id,
        branch_id=body.branch_id,
        position=body.position,
    )
    db.add(emp)
    await db.commit()
    await db.refresh(emp)

    # Reload relationships
    result = await db.execute(select(Employee).where(Employee.id == emp.id))
    emp = result.scalar_one()

    return EmployeeResponse(
        id=emp.id,
        full_name=emp.full_name,
        email=emp.email,
        department_id=emp.department_id,
        branch_id=emp.branch_id,
        position=emp.position,
        department_name=emp.department.name if emp.department else None,
        branch_name=emp.branch.name if emp.branch else None,
    )


@router.get("/employees/{emp_id}", response_model=EmployeeResponse)
async def get_employee(
    emp_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Employee).where(
            Employee.id == emp_id,
            Employee.organization_id == current_user.organization_id,
        )
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise NotFoundException(f"Employee with id '{emp_id}' not found")

    return EmployeeResponse(
        id=emp.id,
        full_name=emp.full_name,
        email=emp.email,
        department_id=emp.department_id,
        branch_id=emp.branch_id,
        position=emp.position,
        department_name=emp.department.name if emp.department else None,
        branch_name=emp.branch.name if emp.branch else None,
    )


@router.put("/employees/{emp_id}", response_model=EmployeeResponse)
async def update_employee(
    emp_id: uuid.UUID,
    body: EmployeeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.ADMIN.value, UserRole.MANAGER.value)
    ),
):
    org_id = current_user.organization_id
    result = await db.execute(
        select(Employee).where(
            Employee.id == emp_id,
            Employee.organization_id == org_id,
        )
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise NotFoundException(f"Employee with id '{emp_id}' not found")

    update_data = body.model_dump(exclude_unset=True)

    if "email" in update_data and update_data["email"] != emp.email:
        existing = await db.execute(
            select(Employee).where(
                Employee.organization_id == org_id,
                Employee.email == update_data["email"],
                Employee.id != emp_id,
            )
        )
        if existing.scalar_one_or_none():
            raise ConflictException(
                f"Employee with email '{update_data['email']}' already exists"
            )

    if "department_id" in update_data and update_data["department_id"] is not None:
        dept = await db.execute(
            select(Department).where(
                Department.id == update_data["department_id"],
                Department.organization_id == org_id,
            )
        )
        if not dept.scalar_one_or_none():
            raise NotFoundException(
                f"Department with id '{update_data['department_id']}' not found"
            )

    if "branch_id" in update_data and update_data["branch_id"] is not None:
        br = await db.execute(
            select(Branch).where(
                Branch.id == update_data["branch_id"],
                Branch.organization_id == org_id,
            )
        )
        if not br.scalar_one_or_none():
            raise NotFoundException(
                f"Branch with id '{update_data['branch_id']}' not found"
            )

    for field, value in update_data.items():
        setattr(emp, field, value)

    await db.commit()
    await db.refresh(emp)

    # Reload relationships
    result = await db.execute(select(Employee).where(Employee.id == emp.id))
    emp = result.scalar_one()

    return EmployeeResponse(
        id=emp.id,
        full_name=emp.full_name,
        email=emp.email,
        department_id=emp.department_id,
        branch_id=emp.branch_id,
        position=emp.position,
        department_name=emp.department.name if emp.department else None,
        branch_name=emp.branch.name if emp.branch else None,
    )


@router.delete("/employees/{emp_id}")
async def delete_employee(
    emp_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN.value)),
):
    result = await db.execute(
        select(Employee).where(
            Employee.id == emp_id,
            Employee.organization_id == current_user.organization_id,
        )
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise NotFoundException(f"Employee with id '{emp_id}' not found")

    await db.delete(emp)
    await db.commit()
    return {"message": f"Employee '{emp.full_name}' deleted"}
