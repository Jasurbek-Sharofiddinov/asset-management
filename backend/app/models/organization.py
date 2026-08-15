import uuid
import enum
from datetime import datetime

from sqlalchemy import String, DateTime, Text, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class OrganizationStatus(str, enum.Enum):
    PENDING_REVIEW = "pending_review"
    REJECTED = "rejected"
    TRIALING = "trialing"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    SUSPENDED = "suspended"
    DELETED = "deleted"


class OrganizationPlan(str, enum.Enum):
    """Paid tiers only — trial is a status, not a permanent free plan.

    Aligns with Pricing.tsx sold tiers (Starter / Business / Enterprise).
    Trial is organization status=trialing (TRIAL_LENGTH_DAYS), not a plan value.
    """

    STARTER = "starter"
    BUSINESS = "business"
    ENTERPRISE = "enterprise"


# Deterministic default org for migration backfill / single-tenant bootstrap.
DEFAULT_ORGANIZATION_ID = uuid.UUID("a0000000-0000-4000-8000-000000000001")
DEFAULT_ORGANIZATION_SLUG = "default"


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=OrganizationStatus.TRIALING.value
    )
    plan: Mapped[str] = mapped_column(
        String(20), nullable=False, default=OrganizationPlan.STARTER.value
    )
    trial_ends_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    grace_ends_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Reviewer-facing signup / activation fields (all nullable)
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    institution_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    use_case: Mapped[str | None] = mapped_column(Text, nullable=True)
    signup_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    signup_user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("platform_admins.id", ondelete="SET NULL"),
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    reviewer = relationship("PlatformAdmin", foreign_keys=[reviewed_by], lazy="selectin")

    def __repr__(self) -> str:
        return f"<Organization {self.slug} status={self.status}>"
