#!/bin/bash
# AssetVault Deployment Script (LEGACY PATH)
#
# Prefer docker-compose.prod.yml for production. This script deploys HTTP-only
# via systemd on port 8012 and is kept only for older hosts.
#
# Server: root@ubuntu-s-2vcpu-4gb-sfo3-01
# Domain: derived from BASE_DOMAIN (admin host asset.$BASE_DOMAIN) → port 8012
#
# Required secrets (export them or source a server-only untracked env file first):
#   DB_PASS, JWT_SECRET, GROQ_API_KEY, SEED_PASSWORD
# Optional:
#   APP_DIR, BASE_DOMAIN, DOMAIN, PORT, DB_NAME, DB_USER, GROQ_API_URL, GROQ_MODEL,
#   REDIS_PASSWORD, SERVICE_USER, LEGACY_BASE_DOMAIN

set -euo pipefail

APP_DIR="${APP_DIR:-/root/projects/jasur-asset}"
# Same env var as docker-compose.prod.yml; DOMAIN remains as an explicit override.
BASE_DOMAIN="${BASE_DOMAIN:-assetvault.uz}"
DOMAIN="${DOMAIN:-asset.${BASE_DOMAIN}}"
PORT="${PORT:-8012}"
DB_NAME="${DB_NAME:-assetvault}"
DB_USER="${DB_USER:-postgres}"
GROQ_API_URL="${GROQ_API_URL:-https://api.groq.com/openai/v1/chat/completions}"
GROQ_MODEL="${GROQ_MODEL:-llama-3.3-70b-versatile}"
SERVICE_USER="${SERVICE_USER:-assetvault}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"
LEGACY_BASE_DOMAIN="${LEGACY_BASE_DOMAIN:-}"

: "${DB_PASS:?DB_PASS must be set}"
: "${JWT_SECRET:?JWT_SECRET must be set}"
: "${GROQ_API_KEY:?GROQ_API_KEY must be set}"
: "${SEED_PASSWORD:?SEED_PASSWORD must be set}"

if [ "${#JWT_SECRET}" -lt 32 ]; then
  echo "ERROR: JWT_SECRET must be at least 32 bytes" >&2
  exit 1
fi

echo "=== AssetVault Deployment (legacy systemd path) ==="

# ── 0. Dedicated non-root service account ──
echo "[0/8] Ensuring service user '$SERVICE_USER'..."
if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
fi
# Ownership so the unit can read code, venv, and backend/.env
mkdir -p "$APP_DIR"
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"

# ── 1. Database ──
echo "[1/7] Setting up database..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
  sudo -u postgres createdb "$DB_NAME"
# Set password if needed (do not echo the password)
sudo -u postgres psql -c "ALTER USER $DB_USER PASSWORD '$DB_PASS';" >/dev/null 2>&1 || true

# ── 2. Python venv & backend deps ──
echo "[2/7] Setting up Python backend..."
cd "$APP_DIR"
if [ ! -d "venv" ]; then
  sudo -u "$SERVICE_USER" python3 -m venv venv
fi
# shellcheck disable=SC1091
source venv/bin/activate
pip install -r backend/requirements.txt --quiet
pip install "bcrypt==4.2.1" --quiet  # passlib compatibility
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR/venv"

# ── 3. Backend .env (written from env vars; file is gitignored) ──
echo "[3/7] Configuring backend..."
umask 077
if [ -n "$REDIS_PASSWORD" ]; then
  REDIS_URL_VALUE="redis://:${REDIS_PASSWORD}@localhost:6379/0"
else
  REDIS_URL_VALUE="redis://localhost:6379/0"
fi
cat > backend/.env << ENVEOF
ENVIRONMENT=production
DATABASE_URL=postgresql+asyncpg://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
SYNC_DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
REDIS_URL=${REDIS_URL_VALUE}
JWT_SECRET=${JWT_SECRET}
SEED_PASSWORD=${SEED_PASSWORD}
GROQ_API_KEY=${GROQ_API_KEY}
GROQ_API_URL=${GROQ_API_URL}
GROQ_MODEL=${GROQ_MODEL}
BASE_DOMAIN=${BASE_DOMAIN}
LEGACY_BASE_DOMAIN=${LEGACY_BASE_DOMAIN}
CORS_ORIGINS=[]
ENVEOF
chown "$SERVICE_USER:$SERVICE_USER" backend/.env
chmod 600 backend/.env

# ── 4. Schema migrations (Alembic is the only schema authority) ──
echo "[4/8] Running database migrations..."
cd "$APP_DIR/backend"
if ! sudo -u "$SERVICE_USER" -E "$APP_DIR/venv/bin/alembic" upgrade head; then
  echo "ERROR: alembic upgrade head failed — aborting before seeding/restart" >&2
  exit 1
fi

# ── 5. Seed database (requires the schema from step 4) ──
echo "[5/8] Seeding database..."
sudo -u "$SERVICE_USER" -E env SEED_PASSWORD="$SEED_PASSWORD" \
  "$APP_DIR/venv/bin/python" seed.py || echo "  (already seeded or seeding skipped)"

# ── 6. Build frontend ──
# Prod serves static dist via nginx; Vite's /api proxy is only for local/Docker
# `npm run dev` and must not be overwritten here.
echo "[6/8] Building frontend..."
cd "$APP_DIR/frontend"
npm install --quiet
VITE_BASE_DOMAIN="$BASE_DOMAIN" npm run build
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR/frontend/dist"

# ── 7. Systemd service for backend ──
echo "[7/8] Setting up systemd service..."
cat > /etc/systemd/system/assetvault.service << SVCEOF
[Unit]
Description=AssetVault Backend API
After=network.target postgresql.service redis-server.service redis.service

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$APP_DIR/backend
Environment=PATH=$APP_DIR/venv/bin:/usr/bin:/bin
ExecStart=$APP_DIR/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable assetvault
systemctl restart assetvault

# ── 8. Nginx config ──
echo "[8/8] Configuring nginx..."
cat > /etc/nginx/sites-available/assetvault << NGXEOF
server {
    listen 80;
    server_name $DOMAIN;

    # Frontend static files
    root $APP_DIR/frontend/dist;
    index index.html;

    # Security headers (no HSTS on plain HTTP — enable after certbot TLS)
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; media-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" always;

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }

    # Do not expose Swagger / OpenAPI publicly
    location = /docs { return 404; }
    location = /openapi.json { return 404; }
    location = /redoc { return 404; }
    location /redoc { return 404; }

    # SPA fallback — all other routes serve index.html
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Cache static assets (expires only — avoid add_header dropping security headers)
    location /assets/ {
        expires 30d;
    }
}
NGXEOF

ln -sf /etc/nginx/sites-available/assetvault /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

echo ""
echo "=== Deployment complete! ==="
echo "  Backend: http://127.0.0.1:8000 (systemd: assetvault, user: $SERVICE_USER)"
echo "  Frontend: http://$DOMAIN"
echo "  API docs: blocked at nginx (not publicly exposed)"
echo ""
echo "Next steps:"
echo "  1. Install SSL: certbot --nginx -d $DOMAIN"
echo "     Then add HSTS to the HTTPS server block in the nginx site config."
echo "  2. Check status: systemctl status assetvault"
echo "  3. View logs: journalctl -u assetvault -f"
echo "  Note: prefer docker-compose.prod.yml for current production deploys."
