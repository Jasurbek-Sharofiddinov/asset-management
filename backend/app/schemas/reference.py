import uuid
from typing import Optional, List

from pydantic import BaseModel, Field


class DepartmentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class DepartmentResponse(BaseModel):
    id: uuid.UUID
    name: str

    model_config = {"from_attributes": True}


class BranchCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    location: Optional[str] = None


class BranchResponse(BaseModel):
    id: uuid.UUID
    name: str
    location: Optional[str] = None

    model_config = {"from_attributes": True}


class EmployeeCreate(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)
    email: str = Field(..., min_length=1, max_length=255)
    department_id: Optional[uuid.UUID] = None
    branch_id: Optional[uuid.UUID] = None
    position: Optional[str] = None


class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[str] = Field(None, min_length=1, max_length=255)
    department_id: Optional[uuid.UUID] = None
    branch_id: Optional[uuid.UUID] = None
    position: Optional[str] = None


class EmployeeResponse(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    department_id: Optional[uuid.UUID] = None
    branch_id: Optional[uuid.UUID] = None
    position: Optional[str] = None
    department_name: Optional[str] = None
    branch_name: Optional[str] = None

    model_config = {"from_attributes": True}
