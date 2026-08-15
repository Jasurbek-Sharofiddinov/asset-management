# CLAUDE.md — AssetVault Project Context

## Project Overview
AssetVault is a full-stack Bank Office Asset Management platform. Backend is FastAPI + PostgreSQL, frontend is React + TypeScript + Vite + Tailwind v4.

## Commands

### Backend
```bash
# Start backend (from project root)
cd backend && ../venv/Scripts/uvicorn.exe app.main:app --reload --port 8000

# Apply migrations (Alembic is the only schema authority — no create_all)
cd backend && ../venv/Scripts/alembic.exe upgrade head

# Run seed script (requires SEED_PASSWORD and an already-migrated schema)
cd backend && ../venv/Scripts/python.exe seed.py

# Install dependencies
./venv/Scripts/pip.exe install -r backend/requirements.txt
```

### Frontend
```bash
cd frontend && npm run dev      # Dev server on :5173
cd frontend && npm run build    # Production build
cd frontend && npx tsc --noEmit # Type check
```

### Database
```bash
# PostgreSQL credentials: postgres / 12345
# Database name: assetvault
PGPASSWORD=12345 "C:/Program Files/PostgreSQL/17/bin/psql.exe" -U postgres -d assetvault
```

### Docker
```bash
docker-compose up --build
```

## Architecture

### Backend (backend/app/)
- **main.py** — FastAPI app factory, CORS, router registration, exception handlers (schema is NOT created here — Alembic only)
- **entrypoint.sh** — container startup: wait for DB → `alembic upgrade head` → `python seed.py` (skipped when `SKIP_SEED=1`) → exec the CMD
- **config.py** — pydantic-settings, reads from backend/.env
- **database.py** — async SQLAlchemy engine + session factory
- **dependencies.py** — get_db, get_current_user (JWT), require_role(*roles)
- **models/** — SQLAlchemy ORM: User, Asset, Assignment, Employee, Department, Branch, AuditLog
- **schemas/** — Pydantic v2: request/response validation
- **services/** — Business logic: asset state machine, assignment single-owner, audit append-only, QR generation
- **routers/** — REST endpoints: auth, assets, assignments, audit, analytics, reference

### Frontend (frontend/src/)
- **App.tsx** — React Router v6, protected routes, lazy loading, QueryClientProvider
- **lib/api.ts** — Axios instance with auth interceptors, all typed API functions
- **stores/authStore.ts** — Zustand: token + user persistence in localStorage
- **types/index.ts** — TypeScript interfaces matching backend schemas (UUIDs as strings)
- **components/ui/** — Button, Input, Select, Badge, Card, Modal, Table, Pagination, Toast, LoadingSpinner
- **components/layout/** — Sidebar (260px fixed), Header (breadcrumbs + search), Layout (Sidebar + Header + Outlet)
- **pages/** — LoginPage, DashboardPage, AssetsPage, AssetDetailPage, AnalyticsPage, AuditPage, ScannerPage, SettingsPage

## Key Design Decisions

### Asset Status State Machine
Enforced in `services/asset_service.py`. Invalid transitions return HTTP 409. WRITTEN_OFF is terminal. LOST can only transition to WRITTEN_OFF.

### API Response Shapes (important for frontend mapping)
- **GET /api/analytics/overview** returns `{ total_assets, by_status: {}, by_category: {}, total_value }`
- **GET /api/analytics/department-allocation** returns `[{ department, asset_count, total_value }]`
- **GET /api/analytics/status-over-time** returns `[{ date, statuses: { ASSIGNED: n, ... } }]`
- **GET /api/analytics/age-distribution** returns `[{ age_group, count }]`
- **GET /api/analytics/repair-frequency** returns `[{ name, serial_number, category, repair_count }]`
- **GET /api/audit** returns `{ items: [{ id, entity_type, entity_id, action, actor_name, old_value, new_value, reason, occurred_at }], total, page, pages }`
- All IDs are UUIDs (strings), audit log id is BigInteger

### Database
- PostgreSQL 17 on localhost:5432, user=postgres, password=12345
- Async driver: asyncpg (backend API)
- Sync driver: psycopg2-binary (seed script)
- Soft delete on assets (deleted_at column)
- Audit log is append-only (no UPDATE/DELETE)

### Authentication
- JWT access tokens (30 min) + refresh tokens (7 days)
- Roles: ADMIN, MANAGER, VIEWER, AUDITOR
- Password hashing: passlib + bcrypt 4.x (bcrypt 5.x is incompatible with passlib)

### Design System (Tailwind v4 @theme)
- Colors defined in frontend/src/index.css via @theme block
- Dark theme: vault-black (#0A0A0F), vault-surface (#12121A), vault-amber (#F59E0B)
- Fonts: Syne (display), IBM Plex Sans (body), JetBrains Mono (mono)
- Use inline `style={{ fontFamily: "'Syne', sans-serif" }}` for Syne — more reliable than Tailwind arbitrary font

## Common Pitfalls
- bcrypt must be pinned to 4.x (passlib incompatible with bcrypt 5.x)
- asyncpg needs pre-built wheels — use >=0.30.0 for Python 3.13
- Frontend types use `string` for all IDs (backend returns UUIDs)
- Backend audit field names are singular: `old_value`, `new_value`, `occurred_at` (not old_values, timestamp)
- Backend analytics field names don't match AnalyticsOverview type — use `(data as any).by_status` etc.
- Vite proxy forwards /api/* to backend on port 8000
- Redis is in config but not used in application code — optional dependency
