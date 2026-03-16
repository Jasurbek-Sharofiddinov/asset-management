import uuid
from datetime import datetime
from typing import Optional, List, Any

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: int
    entity_type: str
    entity_id: uuid.UUID
    action: str
    actor_id: Optional[uuid.UUID] = None
    actor_name: Optional[str] = None
    old_value: Optional[dict] = None
    new_value: Optional[dict] = None
    reason: Optional[str] = None
    ip_address: Optional[str] = None
    occurred_at: datetime

    model_config = {"from_attributes": True}


class AuditListResponse(BaseModel):
    items: List[AuditLogResponse]
    total: int
    page: int
    pages: int
