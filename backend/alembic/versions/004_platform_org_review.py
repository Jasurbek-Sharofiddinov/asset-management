"""add_platform_identity_and_org_review

Revision ID: 004_platform_org_review
Revises: 003_uq_branches_org_name
Create Date: 2026-08-11 00:00:00.000000

Creates platform_admins, platform_refresh_tokens, and platform_audit_logs.
Adds nullable reviewer / signup columns on organizations for the activation
lifecycle. Existing rows are left untouched (all new columns nullable).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "004_platform_org_review"
down_revision: Union[str, None] = "003_uq_branches_org_name"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "platform_admins",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=512), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("mfa_secret", sa.String(length=255), nullable=True),
        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email", name="uq_platform_admins_email"),
    )
    op.create_index("ix_platform_admins_email", "platform_admins", ["email"], unique=False)

    op.create_table(
        "platform_refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("admin_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("family_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["admin_id"],
            ["platform_admins.id"],
            name="fk_platform_refresh_tokens_admin_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_platform_refresh_tokens_admin_id",
        "platform_refresh_tokens",
        ["admin_id"],
        unique=False,
    )
    op.create_index(
        "ix_platform_refresh_tokens_token_hash",
        "platform_refresh_tokens",
        ["token_hash"],
        unique=True,
    )
    op.create_index(
        "ix_platform_refresh_tokens_family_id",
        "platform_refresh_tokens",
        ["family_id"],
        unique=False,
    )
    op.create_index(
        "ix_platform_refresh_tokens_expires_at",
        "platform_refresh_tokens",
        ["expires_at"],
        unique=False,
    )

    op.create_table(
        "platform_audit_logs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actor_email", sa.String(length=255), nullable=False),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("target_organization_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("target_type", sa.String(length=50), nullable=True),
        sa.Column("target_id", sa.String(length=64), nullable=True),
        sa.Column("old_value", sa.JSON(), nullable=True),
        sa.Column("new_value", sa.JSON(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["actor_id"],
            ["platform_admins.id"],
            name="fk_platform_audit_logs_actor_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["target_organization_id"],
            ["organizations.id"],
            name="fk_platform_audit_logs_target_organization_id",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_platform_audit_logs_actor_id",
        "platform_audit_logs",
        ["actor_id"],
        unique=False,
    )
    op.create_index(
        "ix_platform_audit_logs_action",
        "platform_audit_logs",
        ["action"],
        unique=False,
    )
    op.create_index(
        "ix_platform_audit_logs_target_organization_id",
        "platform_audit_logs",
        ["target_organization_id"],
        unique=False,
    )
    op.create_index(
        "ix_platform_audit_logs_occurred_at",
        "platform_audit_logs",
        ["occurred_at"],
        unique=False,
    )

    # Organization reviewer / signup columns (nullable — existing orgs untouched)
    op.add_column(
        "organizations",
        sa.Column("contact_email", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "organizations",
        sa.Column("contact_phone", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "organizations",
        sa.Column("website", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "organizations",
        sa.Column("country", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "organizations",
        sa.Column("institution_type", sa.String(length=100), nullable=True),
    )
    op.add_column("organizations", sa.Column("use_case", sa.Text(), nullable=True))
    op.add_column(
        "organizations",
        sa.Column("signup_ip", sa.String(length=45), nullable=True),
    )
    op.add_column(
        "organizations",
        sa.Column("signup_user_agent", sa.String(length=512), nullable=True),
    )
    op.add_column(
        "organizations", sa.Column("rejection_reason", sa.Text(), nullable=True)
    )
    op.add_column(
        "organizations",
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "organizations",
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column("organizations", sa.Column("notes", sa.Text(), nullable=True))
    op.create_foreign_key(
        "fk_organizations_reviewed_by",
        "organizations",
        "platform_admins",
        ["reviewed_by"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_organizations_reviewed_by", "organizations", type_="foreignkey"
    )
    op.drop_column("organizations", "notes")
    op.drop_column("organizations", "reviewed_by")
    op.drop_column("organizations", "reviewed_at")
    op.drop_column("organizations", "rejection_reason")
    op.drop_column("organizations", "signup_user_agent")
    op.drop_column("organizations", "signup_ip")
    op.drop_column("organizations", "use_case")
    op.drop_column("organizations", "institution_type")
    op.drop_column("organizations", "country")
    op.drop_column("organizations", "website")
    op.drop_column("organizations", "contact_phone")
    op.drop_column("organizations", "contact_email")

    op.drop_index("ix_platform_audit_logs_occurred_at", table_name="platform_audit_logs")
    op.drop_index(
        "ix_platform_audit_logs_target_organization_id",
        table_name="platform_audit_logs",
    )
    op.drop_index("ix_platform_audit_logs_action", table_name="platform_audit_logs")
    op.drop_index("ix_platform_audit_logs_actor_id", table_name="platform_audit_logs")
    op.drop_table("platform_audit_logs")

    op.drop_index(
        "ix_platform_refresh_tokens_expires_at",
        table_name="platform_refresh_tokens",
    )
    op.drop_index(
        "ix_platform_refresh_tokens_family_id",
        table_name="platform_refresh_tokens",
    )
    op.drop_index(
        "ix_platform_refresh_tokens_token_hash",
        table_name="platform_refresh_tokens",
    )
    op.drop_index(
        "ix_platform_refresh_tokens_admin_id",
        table_name="platform_refresh_tokens",
    )
    op.drop_table("platform_refresh_tokens")

    op.drop_index("ix_platform_admins_email", table_name="platform_admins")
    op.drop_table("platform_admins")
