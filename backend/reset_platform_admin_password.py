"""Reset (or create) the platform operator password from environment.

Reads credentials only from:
  PLATFORM_ADMIN_EMAIL
  PLATFORM_ADMIN_PASSWORD
  PLATFORM_ADMIN_FULL_NAME  (optional; updates name when set)

Uses a properly committed transaction. Never prints the password.
Never uses a hardcoded or default credential.

Usage (Docker Compose, from repo root after updating root .env):
  docker compose run --rm --no-deps backend python reset_platform_admin_password.py

Native (with SYNC_DATABASE_URL and the PLATFORM_ADMIN_* vars set):
  cd backend && ../venv/Scripts/python.exe reset_platform_admin_password.py
"""

from __future__ import annotations

import os
import sys
import uuid
from datetime import datetime, timezone

from passlib.context import CryptContext
from sqlalchemy import create_engine, text

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def main() -> int:
    email = (os.environ.get("PLATFORM_ADMIN_EMAIL") or "").strip().lower()
    password = os.environ.get("PLATFORM_ADMIN_PASSWORD")
    full_name = (os.environ.get("PLATFORM_ADMIN_FULL_NAME") or "").strip()

    if not email or not password:
        print(
            "FATAL: PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD must both be set.",
            file=sys.stderr,
        )
        return 1

    if len(password) < 12:
        print(
            "FATAL: PLATFORM_ADMIN_PASSWORD must be at least 12 characters.",
            file=sys.stderr,
        )
        return 1

    database_url = os.environ.get("SYNC_DATABASE_URL")
    if not database_url:
        print("FATAL: SYNC_DATABASE_URL is not set.", file=sys.stderr)
        return 1

    hashed = pwd_context.hash(password)
    now = datetime.now(timezone.utc)

    engine = create_engine(database_url)
    try:
        # SQLAlchemy 2.0: engine.begin() is a context manager — the transaction
        # commits only on clean exit from the `with` block.
        with engine.begin() as conn:
            row = conn.execute(
                text(
                    "SELECT id FROM platform_admins WHERE email = :email"
                ),
                {"email": email},
            ).fetchone()

            if row is None:
                name = full_name or "Platform Admin"
                conn.execute(
                    text(
                        """
                        INSERT INTO platform_admins (
                            id, email, full_name, hashed_password,
                            is_active, created_at, updated_at
                        ) VALUES (
                            :id, :email, :full_name, :hashed_password,
                            true, :now, :now
                        )
                        """
                    ),
                    {
                        "id": str(uuid.uuid4()),
                        "email": email,
                        "full_name": name,
                        "hashed_password": hashed,
                        "now": now,
                    },
                )
                print(f"Created platform admin {email} (password not printed).")
            else:
                if full_name:
                    conn.execute(
                        text(
                            """
                            UPDATE platform_admins
                            SET hashed_password = :hashed_password,
                                full_name = :full_name,
                                updated_at = :now
                            WHERE email = :email
                            """
                        ),
                        {
                            "hashed_password": hashed,
                            "full_name": full_name,
                            "now": now,
                            "email": email,
                        },
                    )
                else:
                    conn.execute(
                        text(
                            """
                            UPDATE platform_admins
                            SET hashed_password = :hashed_password,
                                updated_at = :now
                            WHERE email = :email
                            """
                        ),
                        {
                            "hashed_password": hashed,
                            "now": now,
                            "email": email,
                        },
                    )
                print(f"Updated platform admin password for {email} (password not printed).")
    finally:
        engine.dispose()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
