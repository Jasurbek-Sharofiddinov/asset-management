"""add_organizations_and_tenant_stamping

Revision ID: 002_organizations
Revises: 001_baseline
Create Date: 2026-08-11 00:00:00.000000

Adds the organizations table and stamps organization_id onto every business
table. Designed to run against a database that already contains production
data: columns are added nullable, backfilled to a deterministic default org,
then set NOT NULL. Global unique indexes/constraints are replaced with
per-organization composites.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "002_organizations"
down_revision: Union[str, None] = "001_baseline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Must match app.models.organization.DEFAULT_ORGANIZATION_ID / SLUG
DEFAULT_ORG_ID = "a0000000-0000-4000-8000-000000000001"
DEFAULT_ORG_SLUG = "default"

TENANTED_TABLES = (
    "users",
    "branches",
    "departments",
    "employees",
    "assets",
    "assignments",
    "audit_logs",
)


def upgrade() -> None:
    # 1. Create organizations table
    op.create_table(
        "organizations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("plan", sa.String(length=20), nullable=False),
        sa.Column("trial_ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("grace_ends_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_organizations_slug", "organizations", ["slug"], unique=True)

    # 2. Insert deterministic default organization (idempotent by fixed id/slug)
    op.execute(
        sa.text(
            """
            INSERT INTO organizations (id, name, slug, status, plan, trial_ends_at, created_at, updated_at)
            VALUES (
                CAST(:org_id AS uuid),
                'Default Organization',
                :slug,
                'active',
                'business',
                NULL,
                now(),
                now()
            )
            ON CONFLICT (id) DO NOTHING
            """
        ).bindparams(org_id=DEFAULT_ORG_ID, slug=DEFAULT_ORG_SLUG)
    )
    # Also handle the case where slug exists under a different id (should not happen)
    op.execute(
        sa.text(
            """
            INSERT INTO organizations (id, name, slug, status, plan, created_at, updated_at)
            SELECT CAST(:org_id AS uuid), 'Default Organization', :slug, 'active', 'business', now(), now()
            WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE slug = :slug)
            """
        ).bindparams(org_id=DEFAULT_ORG_ID, slug=DEFAULT_ORG_SLUG)
    )

    # Resolve the org id we will backfill to (by slug, so it's reproducible even if
    # the fixed UUID insert was skipped due to an earlier manual seed).
    # 3. Add nullable organization_id columns
    for table in TENANTED_TABLES:
        op.add_column(
            table,
            sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=True),
        )

    # 4. Backfill every row to the default organization (lookup by slug)
    for table in TENANTED_TABLES:
        op.execute(
            sa.text(
                f"""
                UPDATE {table}
                SET organization_id = (
                    SELECT id FROM organizations WHERE slug = :slug LIMIT 1
                )
                WHERE organization_id IS NULL
                """
            ).bindparams(slug=DEFAULT_ORG_SLUG)
        )

    # 5. Alter to NOT NULL + FK + index
    for table in TENANTED_TABLES:
        op.alter_column(
            table,
            "organization_id",
            existing_type=postgresql.UUID(as_uuid=True),
            nullable=False,
        )
        op.create_foreign_key(
            f"fk_{table}_organization_id",
            table,
            "organizations",
            ["organization_id"],
            ["id"],
        )
        op.create_index(
            f"ix_{table}_organization_id",
            table,
            ["organization_id"],
            unique=False,
        )

    # 6. Swap unique constraints / indexes to per-organization composites
    # Actual live names from \di / pg_constraint inspection:
    #   ix_users_email (UNIQUE INDEX)
    #   ix_assets_serial_number (UNIQUE INDEX)
    #   departments_name_key (UNIQUE CONSTRAINT)
    #   ix_employees_email (UNIQUE INDEX)
    op.drop_index("ix_users_email", table_name="users")
    op.create_index("ix_users_email", "users", ["email"], unique=False)
    op.create_unique_constraint(
        "uq_users_organization_id_email", "users", ["organization_id", "email"]
    )

    op.drop_index("ix_assets_serial_number", table_name="assets")
    op.create_index("ix_assets_serial_number", "assets", ["serial_number"], unique=False)
    op.create_unique_constraint(
        "uq_assets_organization_id_serial_number",
        "assets",
        ["organization_id", "serial_number"],
    )

    op.drop_constraint("departments_name_key", "departments", type_="unique")
    op.create_unique_constraint(
        "uq_departments_organization_id_name",
        "departments",
        ["organization_id", "name"],
    )

    op.drop_index("ix_employees_email", table_name="employees")
    op.create_index("ix_employees_email", "employees", ["email"], unique=False)
    op.create_unique_constraint(
        "uq_employees_organization_id_email",
        "employees",
        ["organization_id", "email"],
    )


def downgrade() -> None:
    # Reverse unique swaps first
    op.drop_constraint("uq_employees_organization_id_email", "employees", type_="unique")
    op.drop_index("ix_employees_email", table_name="employees")
    op.create_index("ix_employees_email", "employees", ["email"], unique=True)

    op.drop_constraint("uq_departments_organization_id_name", "departments", type_="unique")
    op.create_unique_constraint("departments_name_key", "departments", ["name"])

    op.drop_constraint(
        "uq_assets_organization_id_serial_number", "assets", type_="unique"
    )
    op.drop_index("ix_assets_serial_number", table_name="assets")
    op.create_index("ix_assets_serial_number", "assets", ["serial_number"], unique=True)

    op.drop_constraint("uq_users_organization_id_email", "users", type_="unique")
    op.drop_index("ix_users_email", table_name="users")
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # Drop FKs, indexes, and columns
    for table in reversed(TENANTED_TABLES):
        op.drop_constraint(f"fk_{table}_organization_id", table, type_="foreignkey")
        op.drop_index(f"ix_{table}_organization_id", table_name=table)
        op.drop_column(table, "organization_id")

    op.drop_index("ix_organizations_slug", table_name="organizations")
    op.drop_table("organizations")
