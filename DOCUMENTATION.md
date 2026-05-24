# Mechatroniqs Portal — Technical Documentation

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Database Schema](#3-database-schema)
4. [Backend](#4-backend)
5. [API Reference](#5-api-reference)
6. [Frontend](#6-frontend)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [Data Flow](#8-data-flow)
9. [Environment Configuration](#9-environment-configuration)
10. [Setup & Running](#10-setup--running)
11. [Demo Accounts](#11-demo-accounts)

---

## 1. System Overview

The Mechatroniqs Portal is an internal web application for managing industrial service and retrofit projects. It tracks the full lifecycle of a job: from quoting and approving, through active execution with field technician reports, to completion.

**Core business entities:**
- **Customers** — industrial companies that commission work
- **Machines** — specific equipment belonging to customers
- **Projects** — individual service jobs (maintenance, electrical upgrade, retrofit, reconstruction)
- **Inventory** — spare parts and components, with stock levels
- **Service Reports** — field reports logged by technicians per project visit
- **Users** — internal staff with role-based access

---

## 2. Architecture

```
┌─────────────────────────────────────────────────┐
│  Browser  (React 18 + Vite, port 5173)          │
│  ┌──────────────────────────────────────────┐   │
│  │  TanStack Query  ←→  Axios HTTP Client   │   │
│  │  React Router v6  ·  shadcn/ui + Tailwind│   │
│  └──────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────┘
                     │ HTTP/JSON  (proxied via Vite in dev)
                     │ Bearer JWT in Authorization header
┌────────────────────▼────────────────────────────┐
│  Express API  (Node.js + TypeScript, port 3001) │
│  ┌──────────────────────────────────────────┐   │
│  │  JWT middleware · Role guard middleware   │   │
│  │  express-validator · morgan logger       │   │
│  └──────────────┬───────────────────────────┘   │
│                 │  Prisma ORM                    │
└─────────────────┼───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│  PostgreSQL 18  (port 5432)                     │
│  Database: mechatroniqs_portal                  │
└─────────────────────────────────────────────────┘
```

### Technology Decisions

| Concern | Choice | Reason |
|---------|--------|--------|
| API framework | Express.js | Minimal, well-understood, easy to extend |
| ORM | Prisma 5 | Type-safe queries, auto-migration, great DX |
| Auth | JWT (HS256) | Stateless, works well for SPA + API pattern |
| Password hashing | bcryptjs (cost 12) | Industry standard, configurable cost factor |
| Frontend build | Vite | Fast HMR, native ESM, zero-config TypeScript |
| Server state | TanStack Query v5 | Automatic caching, background refetch, invalidation |
| UI primitives | Radix UI | Accessible, unstyled, composable headless components |
| Styling | Tailwind CSS v3 | Utility-first, consistent design tokens via CSS vars |
| Charts | Recharts | React-native chart library built on D3 |

---

## 3. Database Schema

### Entity-Relationship Overview

```
customers (1) ──── (N) machines
customers (1) ──── (N) projects
machines  (1) ──── (N) projects
users     (1) ──── (N) projects        (created_by)
users     (1) ──── (N) service_reports (technician_id)
projects  (1) ──── (N) project_materials
projects  (1) ──── (N) service_reports
inventory (1) ──── (N) project_materials
```

### Enums

```sql
user_role:   admin | project_manager | technician
job_type:    maintenance | electrical_upgrade | retrofit | reconstruction
status_type: draft | pending_approval | approved | in_progress | completed | cancelled
```

### Tables

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | gen_random_uuid() |
| name | VARCHAR(255) | |
| email | VARCHAR(255) UNIQUE | login identifier |
| password_hash | VARCHAR(255) | bcrypt cost 12 |
| role | user_role | default: technician |
| created_at | TIMESTAMP | default: now() |

#### `customers`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| company_name | VARCHAR(255) | |
| vat_number | VARCHAR(50) UNIQUE | required |
| contact_person | VARCHAR(255) | nullable |
| email | VARCHAR(255) | nullable |
| phone | VARCHAR(50) | nullable |
| address | TEXT | required |
| created_at | TIMESTAMP | |

#### `machines`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| customer_id | UUID FK → customers | ON DELETE CASCADE, nullable |
| name | VARCHAR(255) | |
| model | VARCHAR(255) | nullable |
| serial_number | VARCHAR(255) UNIQUE | nullable |
| manufacturer | VARCHAR(255) | nullable |
| technical_specs | JSONB | free-form key/value specs |
| created_at | TIMESTAMP | |

#### `inventory`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| part_number | VARCHAR(100) UNIQUE | human-readable identifier |
| name | VARCHAR(255) | |
| description | TEXT | nullable |
| stock_quantity | INT | default 0 |
| safety_stock_level | INT | default 5, low-stock threshold |
| unit_cost | DECIMAL(10,2) | purchase cost |
| unit_price | DECIMAL(10,2) | sell/charge price |
| ce_certified | BOOLEAN | default true |

#### `projects`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| customer_id | UUID FK → customers | nullable |
| machine_id | UUID FK → machines | nullable |
| title | VARCHAR(255) | |
| type | job_type | |
| status | status_type | default: draft |
| estimated_labor_hours | DECIMAL(6,2) | default 0.00 |
| actual_labor_hours | DECIMAL(6,2) | auto-updated on report submit |
| quoted_total_price | DECIMAL(10,2) | |
| terms_and_conditions | TEXT | nullable |
| created_by | UUID FK → users | nullable |
| created_at | TIMESTAMP | |

#### `project_materials`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| project_id | UUID FK → projects | ON DELETE CASCADE |
| inventory_id | UUID FK → inventory | nullable |
| quantity_required | INT | |
| unit_cost_at_quote | DECIMAL(10,2) | snapshot at time of quoting |
| unit_price_at_quote | DECIMAL(10,2) | snapshot at time of quoting |

> **Price snapshot pattern**: costs are copied from inventory at quote time so future inventory price changes do not affect existing quotes.

#### `service_reports`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| project_id | UUID FK → projects | ON DELETE CASCADE |
| technician_id | UUID FK → users | nullable |
| work_performed | TEXT | required |
| hours_logged | DECIMAL(4,2) | |
| digital_signature | TEXT | free text e.g. "NAME_DATE" |
| submitted_at | TIMESTAMP | default: now() |

### Cascade Rules
- Deleting a **customer** cascades to their **machines**
- Deleting a **project** cascades to its **project_materials** and **service_reports**
- Machines have `ON DELETE CASCADE` from customers; projects/service_reports have explicit cascade

---

## 4. Backend

### Directory Structure

```
backend/
├── prisma/
│   └── schema.prisma            # Prisma schema (source of truth)
└── src/
    ├── app.ts                   # Express app setup, middleware, route mounting
    ├── server.ts                # HTTP server entry point
    ├── lib/
    │   └── prisma.ts            # Singleton Prisma client
    ├── middleware/
    │   ├── auth.ts              # JWT verify + role guard
    │   └── errorHandler.ts      # Global error handler
    ├── prisma/
    │   └── seed.ts              # Demo data seeder
    ├── routes/
    │   ├── auth.ts              # POST /login, GET /me
    │   ├── users.ts             # CRUD users (admin only for write)
    │   ├── customers.ts         # CRUD customers
    │   ├── machines.ts          # CRUD machines
    │   ├── inventory.ts         # CRUD inventory + stock adjustment
    │   ├── projects.ts          # CRUD projects + materials + status + stats
    │   └── serviceReports.ts    # CRUD service reports
    └── types/
        └── index.ts             # JwtPayload, AuthenticatedRequest interfaces
```

### Middleware Pipeline

Every request passes through:
1. `cors` — allows requests from `FRONTEND_URL` (default `http://localhost:5173`)
2. `express.json()` — parse JSON body
3. `morgan` — HTTP request logger
4. Route-level: `authenticate` — verifies Bearer JWT, attaches `req.user`
5. Route-level: `requireRole(...roles)` — checks `req.user.role` against allowed roles
6. `errorHandler` — catches unhandled errors, returns 500

### Prisma Client

The client is a module-level singleton in `src/lib/prisma.ts`. In development, it is attached to `globalThis` to survive hot-reload restarts without spawning multiple connections.

Query logging is enabled in development mode (`NODE_ENV=development`) to print every SQL query to stdout.

### Token Expiry

JWT tokens expire after `JWT_EXPIRES_IN` (default `7d`). There is no refresh token mechanism — expired tokens redirect to `/login` via the Axios response interceptor.

---

## 5. API Reference

All endpoints except `/api/auth/login` and `/api/health` require:
```
Authorization: Bearer <jwt_token>
```

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | None | Login with email + password. Returns `{ token, user }` |
| GET | `/api/auth/me` | Any | Returns current user profile |

**Login request:**
```json
{ "email": "admin@mechatroniqs.com", "password": "admin123" }
```
**Login response:**
```json
{
  "token": "eyJ...",
  "user": { "id": "...", "name": "System Admin", "email": "...", "role": "admin" }
}
```

---

### Users `/api/users`

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/users` | admin, pm | List all users |
| POST | `/api/users` | admin | Create user |
| PATCH | `/api/users/:id` | admin | Update name/email/role |
| DELETE | `/api/users/:id` | admin | Delete user (cannot delete self) |

---

### Customers `/api/customers`

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/customers` | Any | List all customers with machine/project counts |
| GET | `/api/customers/:id` | Any | Single customer with machines and projects |
| POST | `/api/customers` | admin, pm | Create customer |
| PUT | `/api/customers/:id` | admin, pm | Update customer |
| DELETE | `/api/customers/:id` | admin | Delete customer (cascades to machines) |

**Create/Update body:**
```json
{
  "companyName": "Hellenic Steel Works S.A.",
  "vatNumber": "EL123456789",
  "contactPerson": "Dimitris Kostas",
  "email": "info@hellenicsteel.gr",
  "phone": "+30 210 555 0100",
  "address": "Piraeus Industrial Zone, Block 4, Piraeus 18545"
}
```

---

### Machines `/api/machines`

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/machines?customerId=` | Any | List machines, optional filter by customer |
| GET | `/api/machines/:id` | Any | Single machine with projects |
| POST | `/api/machines` | admin, pm | Create machine |
| PUT | `/api/machines/:id` | admin, pm | Update machine |
| DELETE | `/api/machines/:id` | admin | Delete machine |

**Create body:**
```json
{
  "customerId": "uuid",
  "name": "CNC Plasma Cutter",
  "model": "Hypertherm XPR300",
  "serialNumber": "CNC-2019-001",
  "manufacturer": "Hypertherm",
  "technicalSpecs": { "voltage": "3-phase 400V", "power_kw": 22 }
}
```

---

### Inventory `/api/inventory`

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/inventory?lowStock=true` | Any | List all parts; `lowStock=true` filters to stock ≤ safety level |
| GET | `/api/inventory/:id` | Any | Single part |
| POST | `/api/inventory` | admin, pm | Create part |
| PUT | `/api/inventory/:id` | admin, pm | Update part |
| PATCH | `/api/inventory/:id/stock` | admin, pm, tech | Adjust stock quantity |
| DELETE | `/api/inventory/:id` | admin | Delete part |

**Stock adjustment body:**
```json
{ "adjustment": 10 }   // positive = add, negative = subtract
```

**Response includes computed field:**
```json
{ "isLowStock": true }  // true when stockQuantity <= safetyStockLevel
```

---

### Projects `/api/projects`

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/projects` | Any | List projects with optional filters |
| GET | `/api/projects/dashboard-stats` | Any | Aggregated KPIs for dashboard |
| GET | `/api/projects/:id` | Any | Full project detail with materials and reports |
| POST | `/api/projects` | admin, pm | Create project (optionally with materials) |
| PUT | `/api/projects/:id` | admin, pm | Update project fields |
| PATCH | `/api/projects/:id/status` | admin, pm | Update status only |
| POST | `/api/projects/:id/materials` | admin, pm | Add material line |
| DELETE | `/api/projects/:id/materials/:materialId` | admin, pm | Remove material line |
| DELETE | `/api/projects/:id` | admin | Delete project (cascades) |

**List query params:** `?status=in_progress&type=retrofit&customerId=uuid`

**Dashboard stats response:**
```json
{
  "total": 3,
  "byStatus": [{ "status": "in_progress", "_count": 1 }, ...],
  "byType":   [{ "type": "retrofit", "_count": 1 }, ...],
  "recentProjects": [...],
  "lowStockCount": 2,
  "totalValue": "47500.00"
}
```

**Create project body:**
```json
{
  "title": "CNC Retrofit Phase 1",
  "type": "retrofit",
  "status": "draft",
  "customerId": "uuid",
  "machineId": "uuid",
  "quotedTotalPrice": 15800.00,
  "estimatedLaborHours": 80,
  "termsAndConditions": "Net 30 days.",
  "materials": [
    {
      "inventoryId": "uuid",
      "quantityRequired": 2,
      "unitCostAtQuote": 380.00,
      "unitPriceAtQuote": 520.00
    }
  ]
}
```

---

### Service Reports `/api/service-reports`

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/service-reports` | Any | List reports with optional filters |
| GET | `/api/service-reports/:id` | Any | Full report detail |
| POST | `/api/service-reports` | Any (logged-in) | Submit report — auto-increments `actual_labor_hours` on the project |
| PATCH | `/api/service-reports/:id` | admin | Edit report |
| DELETE | `/api/service-reports/:id` | admin | Delete report |

**List query params:** `?projectId=uuid&technicianId=uuid`

**Submit report body:**
```json
{
  "projectId": "uuid",
  "workPerformed": "Replaced PLC CPU and rewired I/O panel. All axes tested.",
  "hoursLogged": 8.5,
  "digitalSignature": "NIKOS_GEORGIOU_2026-05-22"
}
```

> On submit, the backend automatically does:
> `UPDATE projects SET actual_labor_hours = actual_labor_hours + hoursLogged WHERE id = projectId`

---

## 6. Frontend

### Directory Structure

```
frontend/src/
├── main.tsx                     # React 18 root mount
├── App.tsx                      # QueryClient, BrowserRouter, route tree
├── index.css                    # Tailwind directives + CSS custom properties
├── types/
│   └── index.ts                 # Shared TypeScript interfaces (User, Project, etc.)
├── lib/
│   ├── api.ts                   # Axios instance + per-entity API functions
│   └── utils.ts                 # cn(), formatCurrency(), formatDate(), label maps
├── contexts/
│   └── AuthProvider.tsx         # Auth state (user, token, login, logout)
├── hooks/
│   ├── useAuth.ts               # AuthContext definition + useAuth hook
│   ├── useQueries.ts            # All TanStack Query hooks + mutation hooks
│   └── useToast.ts              # Toast notification state machine
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx        # Sidebar + top bar shell
│   │   └── ProtectedRoute.tsx   # Redirects to /login if unauthenticated
│   └── ui/                      # shadcn/ui component library (local copies)
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── select.tsx
│       ├── table.tsx
│       ├── textarea.tsx
│       ├── toast.tsx
│       ├── toaster.tsx
│       └── badge.tsx
└── pages/
    ├── LoginPage.tsx            # /login
    ├── DashboardPage.tsx        # /
    ├── CustomersPage.tsx        # /customers
    ├── MachinesPage.tsx         # /machines
    ├── InventoryPage.tsx        # /inventory
    ├── ProjectsPage.tsx         # /projects
    ├── ProjectDetailPage.tsx    # /projects/:id
    ├── ServiceReportsPage.tsx   # /service-reports
    └── UsersPage.tsx            # /users  (admin only)
```

### Route Map

```
/login              LoginPage          — public
/                   DashboardPage      — protected
/customers          CustomersPage      — protected
/machines           MachinesPage       — protected
/inventory          InventoryPage      — protected
/projects           ProjectsPage       — protected
/projects/:id       ProjectDetailPage  — protected
/service-reports    ServiceReportsPage — protected
/users              UsersPage          — admin only (redirects otherwise)
*                   → redirect to /
```

### Pages

#### LoginPage
- Email + password form with show/hide toggle
- Calls `authApi.login()`, stores JWT in `localStorage`, sets auth context
- Displays demo credentials for quick access
- Redirects to `/` on success

#### DashboardPage
- KPI cards: total projects, in-progress count, pending approval, completed
- Total quoted value card
- Low-stock alert card (links to `/inventory?lowStock=true`)
- Bar chart: projects by status
- Pie chart: projects by type
- Recent projects list (last 5)

#### CustomersPage
- Card grid layout (responsive 1/2/3 columns)
- Search by company name, VAT, contact person
- Create/Edit customer via Dialog form
- Delete with confirmation prompt (warns about cascade)
- Shows machine and project counts per customer

#### MachinesPage
- Card grid layout
- Search by name, model, serial number, manufacturer, customer
- Technical specs displayed as key/value grid (first 4 fields)
- Customer filter drives machine dropdown in create form
- Technical specs stored and edited as raw JSON text

#### InventoryPage
- Full-width sortable table
- Low-stock rows highlighted amber
- Low-stock filter toggle button
- CE certification shown as shield icon
- Stock adjustment dialog (positive/negative integer)
- Create/Edit dialog with all fields

#### ProjectsPage
- Full-width table with sortable columns
- Filters: text search, status dropdown, type dropdown
- Inline status change via Select dropdown (admin/pm only)
- "New Project" dialog with:
  - Customer + Machine selectors (machine list filters by selected customer)
  - Bill of Materials builder (add parts from inventory with quantity)
  - Terms & Conditions textarea
- Clicking a project title navigates to ProjectDetailPage

#### ProjectDetailPage
- Breadcrumb navigation back to projects list
- Header: title, status badge, type, created date
- Info grid: customer/machine card, financials card, labor progress bar
- Status quick-change rail (click to transition, all roles with edit permission)
- Terms & Conditions text block
- Bill of Materials section: list with total, add/remove buttons
- Service Reports section: chronological log of all reports, "Log Work" button
- Edit dialog for all project fields
- Delete button (admin only)

#### ServiceReportsPage
- Feed-style layout (cards, newest first)
- Filter by project dropdown
- Search across work_performed, technician name, project title
- Shows: project title, customer, technician, hours, timestamp, signature
- Aggregate hours counter in header (filtered)
- Delete report (admin only)

#### UsersPage (admin only)
- Table of all users with avatar initials, role icons
- "You" badge on current user's row
- Invite user dialog (name, email, temp password, role)
- Delete user (cannot delete self)

### TanStack Query Cache Keys

```typescript
KEYS.customers              = ['customers']
KEYS.customer(id)           = ['customers', id]
KEYS.machines(customerId?)  = ['machines', customerId ?? 'all']
KEYS.machine(id)            = ['machines', 'detail', id]
KEYS.inventory              = ['inventory']
KEYS.projects(params?)      = ['projects', params ?? {}]
KEYS.project(id)            = ['projects', 'detail', id]
KEYS.dashboardStats         = ['dashboard-stats']
KEYS.serviceReports(params?)= ['service-reports', params ?? {}]
KEYS.serviceReport(id)      = ['service-reports', 'detail', id]
KEYS.users                  = ['users']
```

Mutations invalidate related keys on success. For example, creating a service report invalidates `['service-reports', *]` and `['projects', *]` (because `actual_labor_hours` changes).

### Axios Client

`src/lib/api.ts` exports a configured Axios instance (`api`) and per-entity API objects (`customersApi`, `projectsApi`, etc.).

**Request interceptor:** injects `Authorization: Bearer <token>` from `localStorage`.

**Response interceptor:** on HTTP 401, clears `localStorage` and redirects to `/login`.

In development, all `/api/*` requests are proxied by Vite to `http://localhost:3001` (configured in `vite.config.ts`) — so the frontend never makes cross-origin requests and no CORS issues arise during development.

### Styling System

Tailwind CSS uses CSS custom properties defined in `index.css` for all design tokens:

```css
--primary:     221.2 83.2% 53.3%   /* blue-600 */
--destructive: 0 84.2% 60.2%       /* red-500 */
--muted:       210 40% 96.1%       /* gray-100 */
--border:      214.3 31.8% 91.4%   /* gray-200 */
--radius:      0.5rem
```

All `shadcn/ui` components are vendored locally under `src/components/ui/` — they are not imported from an npm package, so they can be freely modified.

---

## 7. Authentication & Authorization

### Flow

```
1. User POSTs { email, password } to /api/auth/login
2. Server verifies password with bcrypt.compare()
3. Server signs JWT: { userId, email, role } with HS256
4. Client stores token in localStorage
5. Axios interceptor adds Bearer header to every request
6. Server's authenticate() middleware verifies token on each request
7. requireRole() middleware checks req.user.role against allowed roles
8. On 401 response → Axios interceptor clears token, redirects to /login
```

### Role Matrix

| Resource / Action | admin | project_manager | technician |
|-------------------|:-----:|:---------------:|:----------:|
| View all data | ✅ | ✅ | ✅ |
| Create customers, machines, inventory | ✅ | ✅ | ❌ |
| Edit customers, machines, inventory | ✅ | ✅ | ❌ |
| Create projects | ✅ | ✅ | ❌ |
| Edit project fields | ✅ | ✅ | ❌ |
| Change project status | ✅ | ✅ | ❌ |
| Add/remove project materials | ✅ | ✅ | ❌ |
| Submit service reports | ✅ | ✅ | ✅ |
| Adjust inventory stock | ✅ | ✅ | ✅ |
| Delete anything | ✅ | ❌ | ❌ |
| Manage users | ✅ | ❌ | ❌ |

---

## 8. Data Flow

### Creating a Project with Materials

```
User fills form → handleCreate()
  → projectsApi.create({ title, type, ..., materials: [...] })
    → POST /api/projects
      → validate body (express-validator)
      → prisma.project.create({ data: { ..., projectMaterials: { create: [...] } } })
        (single DB transaction — project + all materials atomically)
      → return full project with includes
  → navigate to /projects/:newId
  → invalidate ['projects', *] and ['dashboard-stats']
```

### Submitting a Service Report

```
Technician fills Log Work dialog → handleAddReport()
  → serviceReportsApi.create({ projectId, workPerformed, hoursLogged, digitalSignature })
    → POST /api/service-reports
      → prisma.serviceReport.create(...)
      → prisma.project.update({ actual_labor_hours: { increment: hoursLogged } })
        (two separate queries, not a transaction — acceptable for this use case)
      → return report with technician + project names
  → invalidate ['service-reports', *] and ['projects', *]
  → ProjectDetailPage refetches — labor bar updates automatically
```

### Status Transition

```
Admin/PM clicks status badge in table or detail page
  → projectsApi.updateStatus(id, newStatus)
    → PATCH /api/projects/:id/status
      → prisma.project.update({ status })
      → return updated project
  → invalidate ['projects', *], ['projects', 'detail', id], ['dashboard-stats']
  → All views showing this project update simultaneously
```

---

## 9. Environment Configuration

### Backend (`backend/.env`)

```env
DATABASE_URL="postgresql://postgres:Mechatroniqs2024!@localhost:5432/mechatroniqs_portal"
JWT_SECRET="your-secret-key"        # min 32 random chars in production
JWT_EXPIRES_IN="7d"                 # any zeit/ms format: 1h, 7d, 30d
PORT=3001
NODE_ENV=development                # or production
FRONTEND_URL="http://localhost:5173" # CORS allowed origin
```

### Frontend

The frontend has no `.env` file in development — the Vite proxy in `vite.config.ts` forwards `/api/*` to `http://localhost:3001`. For a production build pointing at a real server:

```env
# frontend/.env.production
VITE_API_URL=https://api.yourdomain.com
```
And update `src/lib/api.ts`:
```typescript
baseURL: import.meta.env.VITE_API_URL ?? '/api'
```

---

## 10. Setup & Running

### Prerequisites

- Node.js 20+
- PostgreSQL 14+ running and accessible
- npm

### First-Time Setup

```bash
# 1. Clone / navigate to project
cd "I:\Web Applications\Mechatroniqs-Automation\Portal"

# 2. Backend dependencies
cd backend
npm install

# 3. Configure database connection
# Edit backend/.env → set DATABASE_URL

# 4. Push schema to DB + generate Prisma client
npx prisma db push
npx prisma generate

# 5. Seed demo data
npx ts-node src/prisma/seed.ts

# 6. Frontend dependencies
cd ../frontend
npm install
```

### Development

Open two terminals:

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
# → Server running on http://localhost:3001
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
# → Local: http://localhost:5173
```

### Production Build

```bash
# Backend
cd backend
npm run build          # compiles TypeScript to dist/
node dist/server.js    # run compiled output

# Frontend
cd frontend
npm run build          # outputs to dist/
# Serve dist/ with nginx, Apache, or any static file server
# Proxy /api/* to backend
```

### Prisma Commands

```bash
npx prisma studio          # GUI database browser at localhost:5555
npx prisma db push         # sync schema to DB (no migration history)
npx prisma migrate dev     # create named migration file
npx prisma generate        # regenerate Prisma client after schema change
```

---

## 11. Demo Accounts

Seeded by `src/prisma/seed.ts`:

| Role | Email | Password |
|------|-------|----------|
| Administrator | admin@mechatroniqs.com | admin123 |
| Project Manager | pm@mechatroniqs.com | manager123 |
| Technician | tech@mechatroniqs.com | tech123 |

### Seeded Data Summary

| Entity | Records | Details |
|--------|---------|---------|
| Users | 3 | One per role |
| Customers | 2 | Hellenic Steel Works, Aegean Manufacturing |
| Machines | 3 | CNC Plasma Cutter, Press Brake, Welding Robot |
| Inventory | 5 | Siemens PLC, HMI, ABB VFD, Panasonic Servo, LAPP cable |
| Projects | 3 | In Progress, Approved, Draft |
| Project Materials | 5 | Attached to projects 1 and 3 |
| Service Reports | 2 | Both on the in-progress project |
