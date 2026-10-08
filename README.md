# Blynt — Business Finance, Simplified

Blynt is a UK-focused cloud accounting and finance SaaS built with **NestJS**, **Prisma**, **PostgreSQL**, and **Next.js 15 (Turbopack)**.

This repository implements the double-entry accounting core, engineered to institutional standards of ledger immutability, mathematical precision, tenant isolation, and financial period integrity. Clarity in Every Number.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology | Key Capabilities |
| :--- | :--- | :--- |
| **Database** | PostgreSQL 16+ | `btree_gist` temporal exclusion, check constraints, composite tenant foreign keys, append-only triggers |
| **ORM / Migration**| Prisma ORM | Strict schema definitions, transactional atomicity, decimal-safe models |
| **Backend API** | NestJS 11 + TypeScript | Modular architecture, custom decorators, domain exception filter, structured logging, scrypt security |
| **Accounting Engine**| Decimal.js / Prisma Decimal | 4-decimal-place fixed-point arithmetic (`NUMERIC(19,4)`), zero floating-point drift |
| **Frontend Web** | Next.js 15 + React 19 | App Router, Turbopack, responsive accounting design system, real-time balance calculations |

---

## 📦 Implemented Scope (Phases 1–8)

### Phase 1: Project & Database Foundation
- Multi-workspace monorepo (`apps/api`, `apps/web`).
- PostgreSQL schema featuring UUID primary keys, composite uniqueness constraints (`organization_id`, `code`), and composite tenant foreign keys preventing cross-tenant leakage.
- Database-level integrity:
  - `btree_gist` exclusion constraint preventing overlapping date ranges for financial years within any organisation.
  - Check constraints ensuring debits and credits are non-negative and lines are not simultaneously zero.
  - Append-only `audit_logs` table protected against `UPDATE` and `DELETE` via database triggers.
- Structured JSON logger with correlation IDs (`x-request-id`), execution duration metrics, and centralized domain error catalog.

### Phase 2: Authentication
- Registration and session-based authentication with Bearer tokens.
- Cryptographically secure password hashing using Node.js native `crypto.scrypt` with random salt and constant-time timing-safe comparison.
- Multi-session tracking with device metadata, user agent, IP tracking, and revocation.
- Reset and verification token management.

### Phase 3: Multi-Organisation System
- Strict tenant isolation enforced at the database level and route guard level.
- Multi-organisation switcher allowing users to belong to multiple organisations with distinct roles.
- Organisation settings, legal entity naming, registration numbers, tax numbers, and jurisdiction controls.

### Phase 4: Roles & Permissions (RBAC)
- Five system roles seeded per organisation:
  - `OWNER`: Full administrative and ledger privileges, organisation archiving.
  - `ADMINISTRATOR`: Full operational control, user management, unlocking hard-locked periods.
  - `ACCOUNTANT`: Full ledger operations, journal creation, validation, and period soft-locking.
  - `BOOKKEEPER`: Journal creation and drafting, view accounts and periods.
  - `VIEWER`: Read-only access to accounts, journals, and reports.
- Fine-grained permission codes (e.g. `account.create`, `journal.validate`, `period.lock`).

### Phase 5: Chart of Accounts
- Unified nominal ledger covering classes 1000–8999:
  - `1000–1999`: Assets (Normal Balance: **DEBIT**)
  - `2000–2999`: Liabilities (Normal Balance: **CREDIT**)
  - `3000–3999`: Equity (Normal Balance: **CREDIT**)
  - `4000–4999`: Revenue (Normal Balance: **CREDIT**)
  - `5000–8999`: Expenses (Normal Balance: **DEBIT**)
- Standard 46-account template automatically seeded or loaded on demand.
- System Control Accounts flag (`isControlAccount`) preventing direct manual journal entries to protected accounts (e.g. Debtors Control, Creditors Control).
- Account archiving and restoration workflow ensuring inactive accounts cannot receive new journal postings while preserving audit history.

### Phase 6: Financial Years & Accounting Periods
- Financial years with strict date boundary constraints and calendar overlap rejection.
- Automated 12-month accounting period generator calculating exact start and end dates without calendar gaps.
- Three-tier period locking state machine:
  1. `OPEN`: Standard posting permitted.
  2. `SOFT_LOCKED`: Closed to regular bookkeepers; allows review.
  3. `HARD_LOCKED`: Immutable audit lockdown; rejects any journal creation or validation within this date range.

### Phase 7: Manual Journal Entry
- Sequential number generation format: `JE-YYYY-XXXXXX` (e.g. `JE-2026-000001`) via atomic sequence counter.
- Multi-row journal creation with support for line-level descriptions, references, and `NUMERIC(19,4)` debit and credit values.
- Real-time balance difference calculation in both web UI and API.

### Phase 8: Journal Validation Engine
The `JournalValidationService` enforces 15 authoritative accounting rules before any journal can be marked as `VALIDATED`:
1. Total debits must exactly equal total credits (difference == 0).
2. Journal must have at least 2 lines.
3. Every line must have an account belonging to the same organisation.
4. Accounts referenced must be `ACTIVE` (not archived).
5. Accounts with `allow_manual_posting = false` or `isControlAccount = true` are rejected from manual journals.
6. Lines cannot have both debit and credit greater than zero.
7. Lines cannot have both debit and credit equal to zero.
8. Negative amounts are prohibited.
9. Journal entry date must resolve to an existing accounting period.
10. The resolved accounting period must not be `HARD_LOCKED`.
11. Organization must be `ACTIVE`.
12. Status transition: If a `VALIDATED` journal is edited, its status is automatically reset to `DRAFT` requiring re-validation.
13. Audit log entry recorded on creation, modification, deletion, and validation.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+ (LTS)
- npm 10+
- Windows, macOS, or Linux

### 1. Database Setup
Ledgerline includes a local embedded PostgreSQL server script for zero-dependency local development:

```bash
# Start embedded PostgreSQL cluster (port 5433)
npm run db:start

# Run Prisma database migrations
npm run db:migrate --workspace apps/api

# Seed Demo Organisation, Chart of Accounts, and Demo Users
npm run db:seed --workspace apps/api
```

### 2. Start the Backend API (Port 4000)
```bash
npm run start:dev --workspace apps/api
```
The API server starts at `http://localhost:4000/api/v1` (Health check: `http://localhost:4000/api/v1/health`).

### 3. Start the Web Frontend (Port 3000)
```bash
npm run dev --workspace apps/web
```
Open `http://localhost:3000` in your browser.

---

## 🔑 Demo Credentials

The database seed initializes `Demo Consulting Ltd` with the following test credentials:

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Owner** | `owner@democonsulting.com` | `Password1234!` | Full system & ledger privileges |
| **Accountant** | `accountant@democonsulting.com` | `Password1234!` | Full accounting & validation |
| **Viewer** | `viewer@democonsulting.com` | `Password1234!` | Read-only ledger inspection |

---

## 🧪 Test Suite Execution

### 1. Unit Tests
Verifies fixed-point money arithmetic, chart of accounts constraints, date math, and journal validation engine logic:
```bash
npm run test --workspace apps/api
```
*Result: 4 suites passed, 19 unit tests passing.*

### 2. End-to-End (E2E) Integration Tests
Executes 20 real integration tests against the live database covering the full lifecycle:
```bash
npm run test:e2e --workspace apps/api
```
*Result: 20 passed, 20 total.*

Test suite coverage includes:
- User registration and multi-tenant organisation creation.
- Duplicate account code rejection (`409 Conflict`).
- Financial year creation and period overlap prevention (`409 Conflict`).
- Balanced manual journal creation (£25,000 DR Bank / CR Share Capital).
- Journal validation engine state transition to `VALIDATED`.
- Immutability check: editing a `VALIDATED` journal resets status to `DRAFT`.
- Mathematical imbalance rejection (difference detection).
- Archived account and control account rejection.
- Cross-tenant isolation verification (tenant boundary breach rejected).
- Hard-locked accounting period validation rejection.
- Role-based access control (Viewer 403 Forbidden on write actions).
- Append-only audit log verification.

### 3. Frontend Typecheck & Build
```bash
# Typecheck Next.js client
npm run typecheck --workspace apps/web

# Production build with Turbopack
npm run build --workspace apps/web
```
*Result: 15 routes compiled and prerendered with 0 errors.*

---

## 📋 API Reference Summary

All tenant-scoped endpoints require `Authorization: Bearer <token>` and `x-organization-id: <orgId>`:

### Authentication
- `POST /api/v1/auth/register` — Register user
- `POST /api/v1/auth/login` — Sign in and issue token
- `GET  /api/v1/auth/me` — Get current authenticated user
- `POST /api/v1/auth/logout` — Revoke active session

### Organizations
- `GET  /api/v1/organizations` — List user organisations & roles
- `POST /api/v1/organizations` — Create new organisation
- `GET  /api/v1/organizations/:id` — Get organisation details
- `PATCH /api/v1/organizations/:id` — Update organisation metadata
- `POST /api/v1/organizations/:id/switch` — Switch active organisation

### Chart of Accounts
- `GET  /api/v1/organizations/:orgId/accounts` — List nominal accounts
- `POST /api/v1/organizations/:orgId/accounts` — Create nominal account
- `POST /api/v1/organizations/:orgId/accounts/template` — Load 1000–8999 template
- `POST /api/v1/organizations/:orgId/accounts/:id/archive` — Archive account
- `POST /api/v1/organizations/:orgId/accounts/:id/restore` — Restore account

### Financial Years & Periods
- `GET  /api/v1/organizations/:orgId/financial-years` — List financial years
- `POST /api/v1/organizations/:orgId/financial-years` — Create financial year (with auto-periods)
- `GET  /api/v1/organizations/:orgId/periods` — List accounting periods
- `POST /api/v1/organizations/:orgId/periods/:id/soft-lock` — Soft-lock period
- `POST /api/v1/organizations/:orgId/periods/:id/hard-lock` — Hard-lock period
- `POST /api/v1/organizations/:orgId/periods/:id/unlock` — Unlock period

### Manual Journals
- `GET  /api/v1/organizations/:orgId/journals` — List manual journals (paginated, filtered)
- `POST /api/v1/organizations/:orgId/journals` — Create draft manual journal
- `GET  /api/v1/organizations/:orgId/journals/:id` — Get journal details with lines
- `PATCH /api/v1/organizations/:orgId/journals/:id` — Update journal (resets to DRAFT)
- `DELETE /api/v1/organizations/:orgId/journals/:id` — Delete draft journal
- `POST /api/v1/organizations/:orgId/journals/:id/validate` — Run validation engine (transitions to VALIDATED)
- `POST /api/v1/organizations/:orgId/journals/:id/post` — Post validated journal to General Ledger
- `POST /api/v1/organizations/:orgId/journals/:id/reverse` — Reverse posted journal

### Contacts & Directory
- `GET  /api/v1/organizations/:orgId/contacts` — List customers and suppliers
- `POST /api/v1/organizations/:orgId/contacts` — Create customer or supplier contact
- `GET  /api/v1/organizations/:orgId/contacts/:id` — Get contact details
- `PATCH /api/v1/organizations/:orgId/contacts/:id` — Update contact
- `POST /api/v1/organizations/:orgId/contacts/:id/archive` — Archive contact
- `POST /api/v1/organizations/:orgId/contacts/:id/restore` — Restore contact

### Sales Invoicing
- `GET  /api/v1/organizations/:orgId/invoices` — List sales invoices (filtered, paginated)
- `POST /api/v1/organizations/:orgId/invoices` — Create draft sales invoice
- `GET  /api/v1/organizations/:orgId/invoices/:id` — Get invoice details
- `PATCH /api/v1/organizations/:orgId/invoices/:id` — Update draft invoice
- `DELETE /api/v1/organizations/:orgId/invoices/:id` — Delete draft invoice
- `POST /api/v1/organizations/:orgId/invoices/:id/post` — Post invoice to General Ledger via Journal Posting Engine
- `POST /api/v1/organizations/:orgId/invoices/:id/void` — Void invoice and create symmetrical reversal journal

---

## 🐳 Hosting & Deployment

### 1. Production Docker Hosting (Turnkey)
Blynt includes multi-stage container definitions and a Compose stack:

```bash
# Build and launch all services (PostgreSQL, NestJS API, Next.js Web)
docker compose up -d

# Check running containers
docker compose ps

# View unified container logs
docker compose logs -f
```

The stack exposes:
- **Web Application**: `http://localhost:3000`
- **Backend API**: `http://localhost:4000/api/v1`
- **Health Endpoint**: `http://localhost:4000/api/v1/health`

### 2. Native Host Runner (Without Docker)
To host the application locally or on a VPS directly with Node.js:

```bash
# Run production build and host API + Web concurrently
npm run host
```

Or for development hosting:
```bash
npm run dev
```

### 3. Cloud Deployment (Vercel + Render/Railway + Neon/Supabase)
For production cloud hosting, turnkey configurations are included:
- **Frontend**: [apps/web/vercel.json](file:///d:/Project/F!/apps/web/vercel.json) & [vercel.json](file:///d:/Project/F!/vercel.json)
- **Backend API**: [render.yaml](file:///d:/Project/F!/render.yaml) & [railway.json](file:///d:/Project/F!/railway.json)
- **Step-by-Step Guide**: See the complete [DEPLOYMENT.md](file:///d:/Project/F!/DEPLOYMENT.md) guide.

