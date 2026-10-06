# 🚀 Production Deployment & Operations Guide: Blynt

This guide provides operational instructions for deploying and running **Blynt** in production using modern cloud platforms:
- **Frontend**: [Vercel](https://vercel.com) (Next.js 15 App Router with Turbopack) or Docker container.
- **Backend API**: [Render](https://render.com), [Railway](https://railway.app), or containerized orchestrators (NestJS + Prisma Engine).
- **Database**: [Neon](https://neon.tech), [Supabase](https://supabase.com), or self-hosted PostgreSQL 16+.

---

## 📋 Architecture & Security Model

```
 ┌─────────────────────────────────────────────────────────────┐
 │                     User Web Browser                        │
 └──────────────────────────────┬──────────────────────────────┘
                                │ HTTPS
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │            Vercel (apps/web - Next.js 15)                   │
 │   - URL: https://app.warpledger.com                         │
 │   - Same-origin reverse proxy: /api/v1/* ──────────────────┐│
 └────────────────────────────────────────────────────────────┼┘
                                                              │ Internal Server Proxy
                                                              ▼
 ┌─────────────────────────────────────────────────────────────┐
 │       Render / Railway / Container (apps/api - NestJS)      │
 │   - URL: https://api.warpledger.com                         │
 │   - Double-entry accounting engine & JWT auth               │
 │   - Runs as unprivileged 'node' user (non-root)             │
 │   - Health check: /api/v1/health                            │
 └──────────────────────────────┬──────────────────────────────┘
                                │ TLS 1.3 / SSL Connection
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │           Neon / Supabase / Dedicated PostgreSQL 16         │
 │   - Transaction pooling (DATABASE_URL)                      │
 │   - Direct connection for schema migrations (DIRECT_URL)    │
 └─────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Step 1: PostgreSQL Setup (Neon, Supabase, or Dedicated)

### Connection Strings
Managed serverless databases (like Neon or Supabase) utilize pgBouncer or connection poolers for high-concurrency HTTP transactions, but require direct TCP connections for running schema migrations and DDL locks:

1. **`DATABASE_URL`** (Transaction Pooling):
   ```env
   DATABASE_URL="postgresql://user:password@ep-pooler.us-east-2.aws.neon.tech/warpledger?sslmode=require"
   ```
2. **`DIRECT_URL`** (Direct Connection for Migrations):
   ```env
   DIRECT_URL="postgresql://user:password@ep-direct.us-east-2.aws.neon.tech/warpledger?sslmode=require"
   ```

### Applying Migrations (Explicit Release Step)
In production, schema migrations must be executed explicitly as part of a pre-deployment release step, **never** embedded in background runtime processes or dev modes:

```bash
# Production schema migration
npm run prisma:deploy --workspace apps/api
```

> [!WARNING]
> **Production Seeding Notice**: Never run `npm run db:seed` or `npm run prisma:seed` against production databases. The seed command is strictly intended for local development and synthetic test sandboxes. Production tenants and charts of accounts are bootstrapped cleanly via user registration and organization onboarding.

---

## ⚙️ Step 2: Backend API Deployment (Render / Railway / Docker)

### Strong Secrets Generation
The backend API strictly rejects startup if `JWT_SECRET` or `SESSION_SECRET` are missing, shorter than 32 characters, identical to each other, or match known example/development values.

Generate high-entropy 256-bit secrets using OpenSSL or Node.js crypto:
```bash
# Generate JWT_SECRET
openssl rand -hex 32

# Generate distinct SESSION_SECRET
openssl rand -hex 32
```

### Environment Variables
Configure the following environment variables in your deployment environment:

| Variable | Description | Example / Allowed Values |
|---|---|---|
| `NODE_ENV` | Runtime environment | `production` |
| `APP_ENV` | Application environment | `production` |
| `PORT` | Listening HTTP port | `4000` (or `10000` on Render) |
| `DATABASE_URL` | PostgreSQL connection URL | `postgresql://...` |
| `DIRECT_URL` | Direct migration connection URL | `postgresql://...` |
| `JWT_SECRET` | 256-bit secret for access token JWTs | *(Generated 64-char hex)* |
| `SESSION_SECRET` | 256-bit secret for session cookies | *(Generated 64-char hex)* |
| `ACCESS_TOKEN_TTL_SECONDS` | JWT expiry duration | `900` (15 minutes) |
| `REFRESH_TOKEN_TTL_DAYS` | Refresh token lifespan | `14` |
| `FRONTEND_URL` | Canonical frontend web URL | `https://app.warpledger.com` |
| `CORS_ALLOWED_ORIGINS` | Comma-delimited CORS origins | `https://app.warpledger.com` |
| `COOKIE_SECURE` | Enforce HTTPS cookies | `true` |
| `RATE_LIMIT_PER_MINUTE` | General API rate limit | `300` |
| `AUTH_RATE_LIMIT_PER_MINUTE` | Auth route brute-force protection | `10` |
| `MAIL_PROVIDER` | Transactional email provider | `smtp` (or `test` for CI) |
| `SMTP_HOST` | Outgoing SMTP server hostname | `smtp.sendgrid.net` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | `apikey` |
| `SMTP_PASS` | SMTP password / API token | `SG.xxxxxxxx` |
| `SMTP_SECURE` | Enable TLS wrapper | `false` (for STARTTLS 587) |
| `MAIL_FROM` | Sender address | `noreply@warpledger.com` |

### Render Blueprint Deployment
When using Render:
1. Connect repository with `render.yaml`.
2. Configure secrets (`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `SESSION_SECRET`).
3. Set the **Pre-Deploy Command** to: `npm run prisma:deploy --workspace apps/api`.
4. Health check path is automatically monitored at `/api/v1/health`.

### Docker Container Hardening
The API and Web Dockerfiles run under the unprivileged `node` user (UID 1000) to ensure container isolation. Multi-stage builds produce minimal production containers excluding devDependencies and build tools.

---

## 🌐 Step 3: Frontend Deployment (Vercel)

1. Import the Git repository in Vercel.
2. Set **Root Directory** to `apps/web`.
3. Set **Framework Preset** to Next.js.
4. Set **Environment Variables**:
   - `API_URL`: `https://api.warpledger.com` (internal server-to-server proxy target).
5. **Do Not Expose Container-Only Hostnames to Browsers**:
   - In containerized deployments (such as Docker Compose), set `API_URL=http://api:4000` so Next.js server proxies requests internally.
   - Leave `NEXT_PUBLIC_API_URL` empty to ensure client browsers use same-origin `/api/v1` routes rather than attempting to resolve non-routable container names.

---

## 🔒 Operational Procedures

### Live Secret Rotation
If `JWT_SECRET` or `SESSION_SECRET` must be rotated:
1. Generate two new distinct 256-bit keys using `openssl rand -hex 32`.
2. Update the environment variables in your deployment dashboard (e.g. Render / Railway / Docker).
3. Trigger a rolling restart of the API services.
4. Active client access tokens will fail validation and refresh tokens will be re-authenticated against the database session store, gracefully rotating active sessions.

### Database Backups (`pg_dump`)
Perform automated point-in-time recovery (PITR) and daily logical backups:
```bash
# Create logical backup
pg_dump "$DATABASE_URL" -Fc -f "warpledger_backup_$(date +%Y%m%d_%H%M%S).dump"

# Restore from backup
pg_restore -d "$DATABASE_URL" --clean --no-owner "warpledger_backup_YYYYMMDD_HHMMSS.dump"
```

### Rollback Procedure
If a release must be rolled back:
1. **Frontend / API**: Re-deploy the previous Git release tag or container SHA in your cloud hosting provider.
2. **Database Migrations**:
   - Warp Ledger migrations are forward-compatible.
   - If an applied migration failed during a pre-deploy release:
     ```bash
     npx prisma migrate resolve --rolled-back <migration_name> --schema=apps/api/prisma/schema.prisma
     ```
   - Always verify database health at `/api/v1/health` following rollbacks.

### GitHub Branch Protection & Required Status Checks
To ensure continuous integrity, configure the following branch protection rules on `main`:
1. Require a pull request before merging.
2. Require linear history.
3. Require status checks to pass before merging:
   - `validate`: CI pipeline (Lint, Typecheck, Unit Tests, PostgreSQL Migration/Integration Tests, Production Builds).
   - `docker-smoke`: API and Web Docker image build verification.
