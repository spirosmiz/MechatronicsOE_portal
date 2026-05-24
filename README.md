# Mechatroniqs Portal — Industrial Service & Retrofit Management

A production-ready full-stack web application for managing industrial service projects, customers, machines, inventory, and technician field reports.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express.js (TypeScript) |
| Database | PostgreSQL + Prisma ORM |
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS + shadcn/ui components |
| Data Fetching | TanStack Query (React Query v5) |
| Auth | JWT (RS256 stored in localStorage) |

## Quick Start

### Prerequisites
- Node.js 20+
- Docker Desktop (for PostgreSQL)
- npm or pnpm

### 1. Start PostgreSQL

```bash
docker-compose up -d
```

### 2. Backend Setup

```bash
cd backend
npm install
# Copy and adjust the .env if needed
cp .env.example .env

# Push schema to DB and generate Prisma client
npx prisma db push
npx prisma generate

# Seed with demo data
npm run prisma:seed

# Start dev server on :3001
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend
npm install

# Start Vite dev server on :5173
npm run dev
```

Open `http://localhost:5173`

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@mechatroniqs.com | admin123 |
| Project Manager | pm@mechatroniqs.com | manager123 |
| Technician | tech@mechatroniqs.com | tech123 |

## Features

### Modules
- **Dashboard** — KPI cards, project status charts (Recharts), low-stock alerts, recent projects
- **Customers** — CRUD with VAT number, contact info, machine/project counts
- **Machines** — Technical specs (JSONB), customer assignment, serial number tracking
- **Inventory** — Parts catalogue, CE certification tracking, safety stock alerts, stock adjustment
- **Projects** — Full lifecycle management (draft → approved → in_progress → completed), BOM, labor hours
- **Service Reports** — Technician field reports with digital signature, hours logged auto-accumulation
- **Users** — Admin-only user management with role-based access control

### Role Permissions
| Action | Admin | Project Manager | Technician |
|--------|-------|-----------------|------------|
| View all data | ✅ | ✅ | ✅ |
| Create/Edit customers, machines, inventory | ✅ | ✅ | ❌ |
| Create/Edit projects | ✅ | ✅ | ❌ |
| Update project status | ✅ | ✅ | ❌ |
| Submit service reports | ✅ | ✅ | ✅ |
| Adjust stock | ✅ | ✅ | ✅ |
| Delete anything | ✅ | ❌ | ❌ |
| Manage users | ✅ | ❌ | ❌ |

## API Endpoints

```
POST   /api/auth/login
GET    /api/auth/me

GET    /api/users
POST   /api/users
PATCH  /api/users/:id
DELETE /api/users/:id

GET    /api/customers
GET    /api/customers/:id
POST   /api/customers
PUT    /api/customers/:id
DELETE /api/customers/:id

GET    /api/machines?customerId=
GET    /api/machines/:id
POST   /api/machines
PUT    /api/machines/:id
DELETE /api/machines/:id

GET    /api/inventory?lowStock=true
GET    /api/inventory/:id
POST   /api/inventory
PUT    /api/inventory/:id
PATCH  /api/inventory/:id/stock
DELETE /api/inventory/:id

GET    /api/projects?status=&type=&customerId=
GET    /api/projects/dashboard-stats
GET    /api/projects/:id
POST   /api/projects
PUT    /api/projects/:id
PATCH  /api/projects/:id/status
POST   /api/projects/:id/materials
DELETE /api/projects/:id/materials/:materialId
DELETE /api/projects/:id

GET    /api/service-reports?projectId=&technicianId=
GET    /api/service-reports/:id
POST   /api/service-reports
PATCH  /api/service-reports/:id
DELETE /api/service-reports/:id
```

## Project Structure

```
Portal/
├── docker-compose.yml
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   └── src/
│       ├── lib/prisma.ts
│       ├── middleware/auth.ts, errorHandler.ts
│       ├── routes/auth.ts, users.ts, customers.ts,
│       │         machines.ts, inventory.ts, projects.ts,
│       │         serviceReports.ts
│       ├── types/index.ts
│       ├── app.ts
│       └── server.ts
└── frontend/
    └── src/
        ├── components/
        │   ├── layout/ (AppLayout, ProtectedRoute)
        │   └── ui/ (button, card, dialog, select, table, toast…)
        ├── contexts/ (AuthProvider)
        ├── hooks/ (useAuth, useQueries, useToast)
        ├── lib/ (api.ts, utils.ts)
        ├── pages/ (Dashboard, Customers, Machines,
        │            Inventory, Projects, ProjectDetail,
        │            ServiceReports, Users, Login)
        ├── types/index.ts
        ├── App.tsx
        └── main.tsx
```
