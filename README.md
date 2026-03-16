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
- **React 18** + **TypeScript**
- **Vite** (build tool)
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

## Quick Start

### Prerequisites
- Python 3.12+
- Node.js 20+
- PostgreSQL 15+ running locally

### 1. Clone and setup

```bash
git clone <repo-url>
cd asset-management
```

### 2. Backend setup

```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # Linux/Mac
# or: venv\Scripts\activate     # Windows

# Install dependencies
pip install -r backend/requirements.txt

# Configure database (edit backend/.env)
# DATABASE_URL=postgresql+asyncpg://postgres:<password>@localhost:5432/assetvault
# SYNC_DATABASE_URL=postgresql://postgres:<password>@localhost:5432/assetvault

# Create database
createdb assetvault
# or: psql -U postgres -c "CREATE DATABASE assetvault;"

# Seed with sample data
cd backend
python seed.py

# Start the API server
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

### 4. Open in browser

- **Frontend**: http://localhost:5173
- **API Docs**: http://localhost:8000/docs

### Docker (alternative)

```bash
docker-compose up --build
# App available at http://localhost
```

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
- **150 assets** with realistic status distribution (~60% assigned, ~15% registered, ~10% in repair, ~8% lost, ~7% written off)
- **118 assignments** with history
- **473 audit log entries**
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
