import uuid
import enum
from datetime import datetime, date
from decimal import Decimal

from sqlalchemy import String, Date, DateTime, Numeric, Text, ForeignKey, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AssetCategory(str, enum.Enum):
    IT = "IT"
    OFFICE = "OFFICE"
    SECURITY = "SECURITY"
    NETWORKING = "NETWORKING"
    PRINTING = "PRINTING"
    SERVER = "SERVER"
    MOBILE = "MOBILE"
    FURNITURE = "FURNITURE"
    OTHER = "OTHER"


class AssetStatus(str, enum.Enum):
    REGISTERED = "REGISTERED"
    ASSIGNED = "ASSIGNED"
    IN_REPAIR = "IN_REPAIR"
    LOST = "LOST"
    WRITTEN_OFF = "WRITTEN_OFF"


class Asset(Base):
    __tablename__ = "assets"
    __table_args__ = (
        UniqueConstraint(
            "organization_id", "serial_number", name="uq_assets_organization_id_serial_number"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(
        String(20), nullable=False, default=AssetCategory.OTHER.value, index=True
    )
    serial_number: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    brand: Mapped[str | None] = mapped_column(String(100), nullable=True)
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    purchase_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    purchase_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    warranty_expiry: Mapped[date | None] = mapped_column(Date, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=AssetStatus.REGISTERED.value, index=True
    )
    qr_code_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    organization = relationship("Organization", lazy="selectin")
    creator = relationship("User", foreign_keys=[created_by], lazy="selectin")
    assignments = relationship(
        "Assignment", back_populates="asset", lazy="selectin",
        order_by="Assignment.assigned_at.desc()"
    )

    def __repr__(self) -> str:
        return f"<Asset {self.name} serial={self.serial_number} status={self.status}>"
