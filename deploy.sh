#!/bin/bash
# AssetVault Deployment Script
# Server: root@ubuntu-s-2vcpu-4gb-sfo3-01
# Domain: asset.datamou.uz → port 8012

set -e

APP_DIR="/root/projects/jasur-asset"
DOMAIN="asset.datamou.uz"
PORT=8012
DB_NAME="assetvault"
DB_USER="postgres"
DB_PASS="12345"

echo "=== AssetVault Deployment ==="

# ── 1. Database ──
echo "[1/7] Setting up database..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
  sudo -u postgres createdb $DB_NAME
# Set password if needed
sudo -u postgres psql -c "ALTER USER postgres PASSWORD '$DB_PASS';" 2>/dev/null || true

# ── 2. Python venv & backend deps ──
echo "[2/7] Setting up Python backend..."
cd $APP_DIR
if [ ! -d "venv" ]; then
  python3 -m venv venv
fi
source venv/bin/activate
pip install -r backend/requirements.txt --quiet
pip install "bcrypt==4.2.1" --quiet  # passlib compatibility

# ── 3. Backend .env ──
echo "[3/7] Configuring backend..."
cat > backend/.env << 'ENVEOF'
DATABASE_URL=postgresql+asyncpg://postgres:12345@localhost:5432/assetvault
SYNC_DATABASE_URL=postgresql://postgres:12345@localhost:5432/assetvault
REDIS_URL=redis://localhost:6379/0
JWT_SECRET=assetvault-production-secret-key-2024-change-me
GROQ_API_KEY=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
GROQ_API_URL=https://api.groq.com/openai/v1/chat/completions
GROQ_MODEL=llama-3.3-70b-versatile
CORS_ORIGINS=["https://asset.datamou.uz","http://asset.datamou.uz","http://localhost:8012"]
ENVEOF

# ── 4. Seed database ──
echo "[4/7] Seeding database..."
cd $APP_DIR/backend
python seed.py 2>/dev/null || echo "  (already seeded or seeding skipped)"

# ── 5. Build frontend ──
echo "[5/7] Building frontend..."
cd $APP_DIR/frontend
npm install --quiet
# Update vite config for production build with API proxy base
cat > vite.config.ts << 'VITEEOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
VITEEOF
npm run build

# ── 6. Systemd service for backend ──
echo "[6/7] Setting up systemd service..."
cat > /etc/systemd/system/assetvault.service << SVCEOF
[Unit]
Description=AssetVault Backend API
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=$APP_DIR/backend
Environment=PATH=$APP_DIR/venv/bin:/usr/bin:/bin
ExecStart=$APP_DIR/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable assetvault
systemctl restart assetvault

# ── 7. Nginx config ──
echo "[7/7] Configuring nginx..."
cat > /etc/nginx/sites-available/assetvault << NGXEOF
server {
    listen 80;
    server_name $DOMAIN;

    # Frontend static files
    root $APP_DIR/frontend/dist;
    index index.html;

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }

    # Swagger docs
    location /docs {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
    }
    location /openapi.json {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
    }

    # SPA fallback — all other routes serve index.html
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Cache static assets
    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
NGXEOF

ln -sf /etc/nginx/sites-available/assetvault /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

echo ""
echo "=== Deployment complete! ==="
echo "  Backend: http://127.0.0.1:8000 (systemd: assetvault)"
echo "  Frontend: http://$DOMAIN"
echo "  API Docs: http://$DOMAIN/docs"
echo ""
echo "Next steps:"
echo "  1. Install SSL: certbot --nginx -d $DOMAIN"
echo "  2. Check status: systemctl status assetvault"
echo "  3. View logs: journalctl -u assetvault -f"
