import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List

from pydantic import BaseModel, Field


class AssetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    asset_type: str = Field(..., min_length=1, max_length=100)
    category: str = Field(default="OTHER")
    serial_number: str = Field(..., min_length=1, max_length=255)
    brand: Optional[str] = None
    model: Optional[str] = None
    purchase_date: Optional[date] = None
    purchase_price: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    warranty_expiry: Optional[date] = None
    description: Optional[str] = None
    image_url: Optional[str] = None


class AssetUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    asset_type: Optional[str] = Field(None, min_length=1, max_length=100)
    category: Optional[str] = None
    serial_number: Optional[str] = Field(None, min_length=1, max_length=255)
    brand: Optional[str] = None
    model: Optional[str] = None
    purchase_date: Optional[date] = None
    purchase_price: Optional[Decimal] = Field(None, ge=0)
    warranty_expiry: Optional[date] = None
    description: Optional[str] = None
    image_url: Optional[str] = None


class AssetResponse(BaseModel):
    id: uuid.UUID
    name: str
    asset_type: str
    category: str
    serial_number: str
    brand: Optional[str] = None
    model: Optional[str] = None
    purchase_date: Optional[date] = None
    purchase_price: Optional[Decimal] = None
    warranty_expiry: Optional[date] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    status: str
    qr_code_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    created_by: Optional[uuid.UUID] = None
    deleted_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AssignmentBrief(BaseModel):
    id: uuid.UUID
    employee_name: Optional[str] = None
    department_name: Optional[str] = None
    branch_name: Optional[str] = None
    assigned_at: datetime
    is_active: bool

    model_config = {"from_attributes": True}


class AssetDetail(BaseModel):
    id: uuid.UUID
    name: str
    asset_type: str
    category: str
    serial_number: str
    brand: Optional[str] = None
    model: Optional[str] = None
    purchase_date: Optional[date] = None
    purchase_price: Optional[Decimal] = None
    warranty_expiry: Optional[date] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    status: str
    qr_code_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    created_by: Optional[uuid.UUID] = None
    deleted_at: Optional[datetime] = None
    current_assignment: Optional[AssignmentBrief] = None

    model_config = {"from_attributes": True}


class AssetStatusUpdate(BaseModel):
    new_status: str
    reason: Optional[str] = None


class AssetListResponse(BaseModel):
    items: List[AssetResponse]
    total: int
    page: int
    pages: int
