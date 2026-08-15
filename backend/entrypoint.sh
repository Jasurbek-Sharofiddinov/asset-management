#!/bin/sh
# Container startup: wait for the DB, migrate schema, optionally seed, then run
# the API. Schema authority is Alembic only — do not use create_all.
# Set SKIP_SEED=1 to skip seeding (production).
set -e

# alembic.ini and the app package live next to this script.
cd "$(dirname "$0")"

echo "[entrypoint] Waiting for database..."
python - <<'PY' || exit 1
import os
import sys
import time

import psycopg2

url = os.environ.get("SYNC_DATABASE_URL") or os.environ.get("DATABASE_URL", "")
# psycopg2 does not understand SQLAlchemy driver suffixes.
url = url.replace("+asyncpg", "").replace("+psycopg2", "")
if not url:
    sys.exit("[entrypoint] FATAL: neither SYNC_DATABASE_URL nor DATABASE_URL is set")

deadline = time.monotonic() + 60
last_error = None
while time.monotonic() < deadline:
    try:
        psycopg2.connect(url).close()
    except Exception as exc:
        last_error = exc
        time.sleep(1)
    else:
        print("[entrypoint] Database is reachable.")
        sys.exit(0)

sys.exit(f"[entrypoint] FATAL: database not reachable after 60s: {last_error}")
PY

echo "[entrypoint] Running database migrations (alembic upgrade head)..."
if ! alembic upgrade head; then
  echo "[entrypoint] FATAL: migrations failed — refusing to start the API against an unmigrated schema." >&2
  exit 1
fi

if [ "${SKIP_SEED:-0}" = "1" ]; then
  echo "[entrypoint] SKIP_SEED=1 — skipping seed."
else
  echo "[entrypoint] Running seed (idempotent)..."
  if ! python seed.py; then
    echo "[entrypoint] FATAL: seed.py failed — refusing to start the API." >&2
    exit 1
  fi
fi

echo "[entrypoint] Starting application: $*"
exec "$@"
