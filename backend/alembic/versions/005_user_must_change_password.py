"""add users.must_change_password

Revision ID: 005_user_must_change_password
Revises: 004_platform_org_review
Create Date: 2026-08-15 00:00:00.000000

Forces a password change after admin-created accounts and admin resets.
Existing users default to false (they already chose a password).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "005_user_must_change_password"
down_revision: Union[str, None] = "004_platform_org_review"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "must_change_password",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "must_change_password")
