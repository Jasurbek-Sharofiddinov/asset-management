import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AssignRequest(BaseModel):
    employee_id: Optional[uuid.UUID] = None
    department_id: Optional[uuid.UUID] = None
    branch_id: uuid.UUID
    notes: Optional[str] = None


class ReturnRequest(BaseModel):
    return_reason: Optional[str] = None


class AssignmentResponse(BaseModel):
    id: uuid.UUID
    asset_id: uuid.UUID
    employee_id: Optional[uuid.UUID] = None
    department_id: Optional[uuid.UUID] = None
    branch_id: uuid.UUID
    assigned_by: uuid.UUID
    assigned_at: datetime
    returned_at: Optional[datetime] = None
    return_reason: Optional[str] = None
    is_active: bool
    notes: Optional[str] = None
    employee_name: Optional[str] = None
    department_name: Optional[str] = None
    branch_name: Optional[str] = None
    assigner_name: Optional[str] = None

    model_config = {"from_attributes": True}
