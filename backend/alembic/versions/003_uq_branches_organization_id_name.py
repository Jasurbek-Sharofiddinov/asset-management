"""add_uq_branches_organization_id_name

Revision ID: 003_uq_branches_org_name
Revises: 002_organizations
Create Date: 2026-08-11 00:00:00.000000

Adds per-organization uniqueness on branch names, matching the composite
unique pattern introduced in 002_organizations
(e.g. uq_departments_organization_id_name).
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "003_uq_branches_org_name"
down_revision: Union[str, None] = "002_organizations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_branches_organization_id_name",
        "branches",
        ["organization_id", "name"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_branches_organization_id_name", "branches", type_="unique"
    )
