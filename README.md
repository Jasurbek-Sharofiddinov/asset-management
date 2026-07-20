# AssetVault — Bank Office Asset Management Platform

**Every asset. Every moment. Under control.**

AssetVault is a production-grade asset management platform built for banking and enterprise environments. It covers the full lifecycle of IT, office, and infrastructure assets — registration, assignment, status tracking, QR code generation, audit logging, and analytics dashboards.

---

## Tech Stack

### Backend
- **Python 3.12** + **FastAPI** (async REST API)
- **SQLAlchemy 2.0** (async ORM) + **PostgreSQL 17**
- **Alembic** (database migrations)
- **JWT** authentication (python-jose + passlib/bcrypt)
- **QR code generation** (qrcode + Pillow)
- **Pydantic v2** (request/response validation)

### Frontend
- **React 19** + **TypeScript**
- **Vite 8** (build tool)
- **Tailwind CSS v4** (custom design system)
- **Recharts** (analytics charts)
- **TanStack Query v5** (server state)
- **Zustand** (client state)
- **React Router v6** (routing)
- **React Hook Form** + **Zod** (form validation)
- **Framer Motion** (animations)
- **html5-qrcode** (camera-based QR scanner)

### Infrastructure
- **Docker Compose** (PostgreSQL, Redis, backend, frontend, Nginx)
- **Nginx** (reverse proxy)

---

## Run Locally

You have two options: **Docker** (one command, nothing else to install) or a **native** setup (run the backend and frontend directly).

### Option A — Docker (easiest)

Requires only Docker Desktop. Brings up PostgreSQL, Redis, the backend, and the frontend together:

```bash
git clone <repo-url>
cd asset-management
docker compose up --build
```

- **App**: http://localhost
- **Frontend dev server**: http://localhost:5173
- **API docs**: http://localhost:8000/docs

Seed the database once the stack is up:

```bash
docker compose exec backend python seed.py
```

### Option B — Native setup

#### Prerequisites
- **Python 3.10–3.13** (3.13 recommended)
- **Node.js 20.19+** (or 22+ — required by Vite 8)
- **PostgreSQL 15+** running locally (or just run `docker compose up -d db` to use the containerized DB)

> **macOS note:** the system Python is 3.9, which is **too old** (the backend uses `X | None` syntax that needs 3.10+). The most reliable way to get a clean interpreter is [`uv`](https://github.com/astral-sh/uv): `brew install uv`.

#### 1. Backend

```bash
git clone <repo-url>
cd asset-management

# --- create the virtual environment ---
# Recommended (uv, pins a standalone Python 3.13):
uv venv --python 3.13 --seed venv
source venv/bin/activate
uv pip install -r backend/requirements.txt

# --- or, standard venv (needs Python 3.10+ on PATH) ---
# python3 -m venv venv
# source venv/bin/activate
# pip install -r backend/requirements.txt
```

Create `backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://postgres:<password>@localhost:5432/assetvault
SYNC_DATABASE_URL=postgresql://postgres:<password>@localhost:5432/assetvault
JWT_SECRET=dev-secret-change-me
```

Create and seed the database, then start the API:

```bash
createdb assetvault           # or: psql -U postgres -c "CREATE DATABASE assetvault;"

cd backend
python seed.py                # loads sample data
../venv/bin/uvicorn app.main:app --reload --port 8000
```

#### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

#### 3. Open in browser

- **Frontend**: http://localhost:5173
- **API docs**: http://localhost:8000/docs

> The Vite dev server proxies `/api` to the backend on port 8000 (see `frontend/vite.config.ts`), so no extra CORS config is needed for local development.

### Troubleshooting

- **`seed.py` fails with "password cannot be longer than 72 bytes"** — a bcrypt/passlib mismatch. `bcrypt` is pinned `<5` in `requirements.txt`; reinstall deps if you see this. The harmless `error reading bcrypt version` warning can be ignored.
- **`TypeError: unsupported operand type(s) for |` on startup** — your Python is older than 3.10. Recreate the venv with `uv venv --python 3.13 --seed venv`.
- **Frontend `npm install` peer-dependency conflict** — the build tooling is aligned on Vite 8 + `@tailwindcss/vite` 4.3+. Make sure `package.json` isn't pinning an older Vite.

---

## Deployment (Production)

Live at **https://asset.datamou.uz** (Let's Encrypt HTTPS).

Deployed with Docker Compose on a Linux host using `docker-compose.prod.yml`, which differs from the local compose file:

- **web** — multi-stage build (`frontend/Dockerfile.prod`): Vite builds static assets, served by Nginx, which also reverse-proxies `/api`, `/docs`, and `/openapi.json` to the backend and terminates TLS on 443 (HTTP → HTTPS redirect).
- **backend / db / redis** — same images as local, but the DB and Redis ports are **not** published to the host.
- **Secrets** (`POSTGRES_PASSWORD`, `JWT_SECRET`, `GROQ_API_KEY`) live in a server-only `.env` next to the compose file — never committed.

```bash
# on the server
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec -T backend python seed.py   # first run only
```

TLS certificates are issued via a `certbot` container (webroot challenge) and auto-renewed by a twice-daily cron that reloads Nginx.

---

## Login Credentials

| Role    | Email                  | Password   |
|---------|------------------------|------------|
| Admin   | admin@assetvault.uz    | Vault@2024 |
| Manager | manager@assetvault.uz  | Vault@2024 |
| Auditor | auditor@assetvault.uz  | Vault@2024 |

---

## Features

### Authentication & Roles
- JWT-based auth with access/refresh tokens
- Four roles: **Admin**, **Manager**, **Viewer**, **Auditor**
- Role-based access control on all endpoints and UI routes

### Asset Management
- Full CRUD with soft delete
- 9 asset categories: IT, Office, Security, Networking, Printing, Server, Mobile, Furniture, Other
- Enforced status state machine:
  ```
  REGISTERED → ASSIGNED, IN_REPAIR, WRITTEN_OFF
  ASSIGNED   → REGISTERED, IN_REPAIR, LOST
  IN_REPAIR  → ASSIGNED, REGISTERED, WRITTEN_OFF
  LOST       → WRITTEN_OFF (only)
  WRITTEN_OFF → (terminal)
  ```
- Invalid transitions return HTTP 409

### Assignment & Ownership
- Assign assets to employees or departments
- Single active assignment enforced per asset
- Auto status transitions on assign/return
- Full assignment history per asset

### QR Codes
- Auto-generated QR code PNG for each asset
- Contains JSON payload: id, name, serial, category, status, assignee
- Camera-based QR scanner page (mobile-friendly)

### Audit Log
- Immutable, append-only audit trail
- Tracks: asset CRUD, status changes, assignments, returns, logins
- Expandable JSON diff view (old/new values)
- CSV export for auditors

### Analytics Dashboard
- Asset value over time (line chart)
- Status breakdown over time (stacked area chart)
- Department allocation (horizontal bar chart)
- Age distribution histogram
- Repair frequency table (top 10)
- Warranty expiry calendar (90-day lookahead)

### Dashboard
- KPI cards with animated counters: Total, Assigned, In Repair, Lost, Written Off
- Status distribution donut chart
- Category breakdown bar chart
- Recent activity feed (auto-refreshes every 30s)
- Department utilization with progress bars

---

## Project Structure

```
asset-management/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, routers, exception handlers
│   │   ├── config.py            # Settings (pydantic-settings, reads .env)
│   │   ├── database.py          # Async SQLAlchemy engine + session
│   │   ├── dependencies.py      # get_db, get_current_user, require_role
│   │   ├── exceptions.py        # Custom HTTP exceptions
│   │   ├── models/              # SQLAlchemy ORM models
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   ├── routers/             # API route handlers
│   │   └── services/            # Business logic layer
│   ├── alembic/                 # Database migrations
│   ├── seed.py                  # Faker-based data seeder
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/          # UI components + layout
│   │   ├── pages/               # Route pages
│   │   ├── lib/                 # API client, utilities
│   │   ├── stores/              # Zustand auth store
│   │   ├── types/               # TypeScript interfaces
│   │   ├── App.tsx              # Router + providers
│   │   └── index.css            # Tailwind + design tokens
│   ├── vite.config.ts
│   └── Dockerfile
├── nginx/nginx.conf
├── docker-compose.yml
└── README.md
```

---

## API Endpoints

### Auth
| Method | Endpoint             | Description        |
|--------|----------------------|--------------------|
| POST   | /api/auth/login      | Login, get tokens  |
| POST   | /api/auth/refresh    | Refresh token      |
| GET    | /api/auth/me         | Current user       |
| POST   | /api/auth/logout     | Logout             |

### Assets
| Method | Endpoint                   | Description              |
|--------|----------------------------|--------------------------|
| GET    | /api/assets                | List (paginated, filter) |
| POST   | /api/assets                | Create asset             |
| GET    | /api/assets/{id}           | Get detail               |
| PUT    | /api/assets/{id}           | Update asset             |
| DELETE | /api/assets/{id}           | Soft delete              |
| PATCH  | /api/assets/{id}/status    | Change status            |
| GET    | /api/assets/{id}/qr        | Get QR code PNG          |
| GET    | /api/assets/{id}/history   | Asset audit trail        |

### Assignments
| Method | Endpoint                    | Description    |
|--------|-----------------------------|----------------|
| POST   | /api/assets/{id}/assign     | Assign asset   |
| POST   | /api/assets/{id}/return     | Return asset   |

### Audit
| Method | Endpoint           | Description          |
|--------|--------------------|----------------------|
| GET    | /api/audit         | List logs (filtered) |
| GET    | /api/audit/export  | Export CSV            |

### Analytics
| Method | Endpoint                             | Description              |
|--------|--------------------------------------|--------------------------|
| GET    | /api/analytics/overview              | KPI summary              |
| GET    | /api/analytics/value-over-time       | Cumulative value chart   |
| GET    | /api/analytics/status-over-time      | Status trends            |
| GET    | /api/analytics/department-allocation | Assets per department    |
| GET    | /api/analytics/age-distribution      | Asset age histogram      |
| GET    | /api/analytics/repair-frequency      | Most repaired assets     |
| GET    | /api/analytics/warranty-expiring     | Expiring warranties      |

### Reference Data
| Method | Endpoint          | Description    |
|--------|-------------------|----------------|
| GET    | /api/employees    | List employees |
| GET    | /api/departments  | List depts     |
| GET    | /api/branches     | List branches  |

---

## Seed Data

The `seed.py` script generates:
- **5 branches**: HQ Tashkent, Samarkand, Namangan, Bukhara, Fergana
- **8 departments**: IT, HR, Finance, Security, Operations, Legal, Customer Service, Management
- **30 employees** across departments and branches
- **300 assets** with realistic status distribution (~60% assigned, ~15% registered, ~10% in repair, ~8% lost, ~7% written off)
- **~220 assignments** with history
- **~900 audit log entries**
- **3 users** (admin, manager, auditor)

---

## Design System

Dark vault aesthetic with amber/gold accents:

- **Background**: `#0A0A0F` (vault black)
- **Surface**: `#12121A` (cards/panels)
- **Accent**: `#F59E0B` (amber/gold)
- **Fonts**: Syne (headings), IBM Plex Sans (body), JetBrains Mono (codes/IDs)
- **Status colors**: Green (assigned), Yellow (in repair), Red (lost), Gray (registered/written off)

---

## License

Internal use. Not for redistribution.
