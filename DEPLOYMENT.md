# 🚀 Production Deployment Guide: Vercel + Render/Railway + Neon/Supabase

This guide outlines how to host **Ledgerline** using the modern cloud stack:
- **Frontend**: [Vercel](https://vercel.com) (Next.js 15 App Router with Turbopack)
- **Backend API**: [Render](https://render.com) or [Railway](https://railway.app) (NestJS + Prisma Engine)
- **Database**: [Neon](https://neon.tech) or [Supabase](https://supabase.com) (Serverless PostgreSQL)

---

## 📋 Architecture Overview

```
 ┌─────────────────────────────────────────────────────────────┐
 │                     User Browser                            │
 └──────────────────────────────┬──────────────────────────────┘
                                │ HTTPS
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │            Vercel (apps/web - Next.js 15)                   │
 │   - URL: https://ledgerline.vercel.app                      │
 │   - Same-origin reverse proxy /api/v1/* ──┐                 │
 └───────────────────────────────────────────┼─────────────────┘
                                             │ Internal Proxy
                                             ▼
 ┌─────────────────────────────────────────────────────────────┐
 │       Render / Railway (apps/api - NestJS REST API)         │
 │   - URL: https://ledgerline-api.onrender.com                │
 │   - Double-entry accounting engine & JWT auth               │
 └──────────────────────────────┬──────────────────────────────┘
                                │ SSL Connection
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │           Neon / Supabase (PostgreSQL 16)                   │
 │   - Connection pooling & automated backups                  │
 └─────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Step 1: Set Up PostgreSQL (Neon or Supabase)

### Option A: Neon (Recommended for Serverless)
1. Sign up / Log in to [Neon Console](https://console.neon.tech).
2. Create a new project (e.g. `ledgerline-prod`).
3. Copy the **Connection String** from the dashboard:
   ```env
   DATABASE_URL="postgresql://neondb_owner:YOUR_PASSWORD@ep-xyz-123456.us-east-2.aws.neon.tech/neondb?sslmode=require"
   ```

### Option B: Supabase
1. Sign up / Log in to [Supabase](https://supabase.com).
2. Create a new project.
3. Under **Project Settings > Database**, copy the **URI connection string** (Transaction pooler or direct):
   ```env
   DATABASE_URL="postgresql://postgres.YOUR_PROJECT:YOUR_PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres?sslmode=require"
   ```

### Run Migrations & Seed Demo Data
From your local terminal, deploy the schema and seed default chart of accounts:
```bash
# Windows PowerShell
$env:DATABASE_URL="your-connection-string"
npm run db:deploy
npm run db:seed

# Linux / macOS
DATABASE_URL="your-connection-string" npm run db:deploy
DATABASE_URL="your-connection-string" npm run db:seed
```

---

## ⚙️ Step 2: Deploy Backend API (Render or Railway)

### Option A: Render (Using Blueprint or Web Service)

#### Method 1: Using `render.yaml` Blueprint (Automated)
1. Push your repository to GitHub / GitLab.
2. In [Render Dashboard](https://dashboard.render.com), click **New + > Blueprint**.
3. Connect your repository. Render automatically reads `render.yaml`.
4. Fill in the requested secret values:
   - `DATABASE_URL`: Your Neon or Supabase connection string.
   - `FRONTEND_URL`: `https://YOUR_VERCEL_APP.vercel.app` (or leave placeholder until Step 3).
5. Click **Apply**. Render will build and deploy the API with health checks.

#### Method 2: Manual Web Service on Render
If setting up manually:
- **Build Command**: `npm install && npm run prisma:generate --workspace apps/api && npm run build --workspace apps/api`
- **Start Command**: `npm run prisma:deploy --workspace apps/api && node apps/api/dist/main.js`
- **Health Check Path**: `/api/v1/health`
- **Environment Variables**:
  ```env
  NODE_ENV=production
  APP_ENV=production
  PORT=10000
  DATABASE_URL=postgresql://...
  JWT_SECRET=super_secret_minimum_32_characters_random_string_123
  SESSION_SECRET=another_secret_minimum_32_characters_different_456
  FRONTEND_URL=https://YOUR_VERCEL_APP.vercel.app
  ```

> [!IMPORTANT]
> **Live Secret Rotation Procedure (Operational Deployment Action)**:
> - Generate new distinct cryptographic secrets (min 64 chars):
>   `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
> - Set distinct `JWT_SECRET` and `SESSION_SECRET` in your host's environment settings (Render / Railway / Docker).
> - Rotating secrets immediately invalidates all active sessions, requiring users to log in with fresh credentials.
> - Never use default or development secrets in production; the API enforces startup failure if weak or identical secrets are detected.

---

### Option B: Railway

1. In [Railway Dashboard](https://railway.app), click **New Project > Deploy from GitHub repo**.
2. Select your repository. Railway automatically reads `railway.json`.
3. In **Variables**, add:
   ```env
   NODE_ENV=production
   APP_ENV=production
   DATABASE_URL=postgresql://...
   JWT_SECRET=super_secret_minimum_32_characters_random_string_123
   SESSION_SECRET=another_secret_minimum_32_characters_different_456
   FRONTEND_URL=https://YOUR_VERCEL_APP.vercel.app
   ```
4. In **Settings > Networking**, generate a public domain (e.g. `ledgerline-api.up.railway.app`).

---

## 🌐 Step 3: Deploy Frontend (Vercel)

1. Sign up / Log in to [Vercel](https://vercel.com).
2. Click **Add New... > Project** and import your Git repository.
3. Configure Project Settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: Click edit and set to `apps/web`
4. Add **Environment Variables**:
   ```env
   API_URL=https://YOUR_RENDER_OR_RAILWAY_URL.onrender.com
   ```
   *(Optional)* If you want the browser to connect directly to the API rather than through Vercel's rewrite proxy:
   ```env
   NEXT_PUBLIC_API_URL=https://YOUR_RENDER_OR_RAILWAY_URL.onrender.com/api/v1
   ```
5. Click **Deploy**.

> **Note on Rewrites**: Ledgerline's `next.config.js` automatically proxies `/api/v1/*` to your `API_URL`. This means your web application runs seamlessly under a single origin (`https://YOUR_VERCEL_APP.vercel.app`), avoiding cross-origin cookie restrictions and CORS preflight latency.

---

## 🔒 Step 4: Finalize CORS on the Backend

Once your Vercel deployment completes and you have your live Vercel URL (e.g., `https://ledgerline-app.vercel.app`):
1. In Render / Railway dashboard, update the `FRONTEND_URL` environment variable:
   ```env
   FRONTEND_URL=https://ledgerline-app.vercel.app
   ```
2. *(Built-in protection)* Ledgerline's CORS policy dynamically recognizes all `*.vercel.app` domains, allowing seamless preview deployments without breaking authentication!

---

## ✅ Step 5: Verification & Demo Access

1. Open your live Vercel URL in your browser: `https://YOUR_VERCEL_APP.vercel.app`
2. Log in with the pre-seeded demo accounts:

| Role | Email | Password |
|---|---|---|
| **Owner / Admin** | `owner@democonsulting.com` | `Password1234!` |
| **Accountant** | `accountant@democonsulting.com` | `Password1234!` |
| **Read-Only Auditor** | `viewer@democonsulting.com` | `Password1234!` |

3. Test core operations:
   - Navigate to **Sales > Invoices > New Invoice**.
   - Create and post an invoice to verify double-entry posting to the General Ledger.
   - Navigate to **Reports > Trial Balance** to verify live real-time ledger reporting.
