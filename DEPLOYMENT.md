# 🚀 AWS Production Deployment & Operations Guide: Blynt

Blynt is deployed exclusively on **Amazon Web Services (AWS)** in the **`eu-west-2` (London, UK)** region to satisfy UK GDPR and HMRC Making Tax Digital (MTD) regulatory standards.

- **Frontend Web**: AWS App Runner (Next.js 15 App Router with Turbopack container on port 3000)
- **Backend API**: AWS App Runner (NestJS + Prisma Engine container on port 4000)
- **Database**: Amazon RDS PostgreSQL 16.10 (Single-AZ `db.t4g.micro` in private VPC subnets)
- **Document Storage**: Amazon S3 (Server-side AES-256 encryption, versioned, private)
- **Secrets Management**: AWS Secrets Manager
- **Container Registry**: Amazon ECR (`blynt-dev-api` and `blynt-dev-web`)
- **Infrastructure as Code**: Terraform (`infrastructure/environments/dev`)

---

## 📋 Architecture & Security Model

```
 ┌─────────────────────────────────────────────────────────────┐
 │                     User Web Browser                        │
 └──────────────────────────────┬──────────────────────────────┘
                                │ HTTPS
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │        AWS App Runner: Web (apps/web - Next.js 15)          │
 │   - URL: https://<web-id>.eu-west-2.awsapprunner.com        │
 │   - Reverse proxies: /api/v1/* ────────────────────────────┐│
 └────────────────────────────────────────────────────────────┼┘
                                                              │ HTTPS Proxy
                                                              ▼
 ┌─────────────────────────────────────────────────────────────┐
 │        AWS App Runner: API (apps/api - NestJS)              │
 │   - URL: https://arpi2ujw2t.eu-west-2.awsapprunner.com      │
 │   - Double-entry accounting engine & JWT auth               │
 │   - Non-root user 'node' in container                       │
 │   - Health check: /api/v1/health                            │
 └──────────────────────────────┬──────────────────────────────┘
                                │ VPC Egress Connector (Private Subnets)
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │         Amazon RDS PostgreSQL 16.10 (Multi-AZ Ready)        │
 │   - Host: blynt-dev-db.czkggs0wokh2.eu-west-2.rds.amazonaws │
 │   - Database: blynt, User: blynt_admin                      │
 │   - Automated 7-day backups, storage encryption at rest     │
 └─────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Step 1: PostgreSQL Setup (Amazon RDS)

### Connection Strings
AWS App Runner accesses Amazon RDS through an App Runner VPC Egress Connector mapped to private VPC subnets:

1. **`DATABASE_URL`**:
   ```env
   DATABASE_URL="postgresql://blynt_admin:<password>@blynt-dev-db.czkggs0wokh2.eu-west-2.rds.amazonaws.com:5432/blynt?schema=public&sslmode=require"
   ```
2. **`DIRECT_URL`**:
   ```env
   DIRECT_URL="postgresql://blynt_admin:<password>@blynt-dev-db.czkggs0wokh2.eu-west-2.rds.amazonaws.com:5432/blynt?schema=public&sslmode=require"
   ```

### Applying Migrations
Schema migrations are automatically applied on container startup via `Dockerfile.api`:
```bash
npx prisma migrate deploy --schema=./apps/api/prisma/schema.prisma && node apps/api/dist/main.js
```

---

## ⚙️ Step 2: Backend API Deployment (AWS App Runner)

### Secrets Management
Secrets are securely stored in **AWS Secrets Manager** (`blynt-dev-secrets`) and injected directly into container environment variables at runtime:
- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET` (256-bit cryptographic hex)
- `SESSION_SECRET` (256-bit cryptographic hex)

### Health Check Endpoint
- Path: `/api/v1/health`
- Interval: 10s
- Threshold: 1 healthy check
- Response:
  ```json
  {
    "status": "healthy",
    "version": "0.1.0",
    "services": {
      "database": "up"
    }
  }
  ```

---

## 🌐 Step 3: Frontend Deployment (AWS App Runner)

1. Next.js 15 is packaged into a minimal multi-stage Docker container (`Dockerfile.web`).
2. Image is pushed to Amazon ECR (`896138901883.dkr.ecr.eu-west-2.amazonaws.com/blynt-dev-web`).
3. AWS App Runner runs the container on port `3000` with health check on `/login`.
4. Requests to `/api/v1/*` are automatically proxied to the live API App Runner service (`https://arpi2ujw2t.eu-west-2.awsapprunner.com`).

---

## 🔒 Operational Procedures

### Live Secret Rotation
If `JWT_SECRET` or `SESSION_SECRET` must be rotated:
1. Generate two new distinct 256-bit keys using `openssl rand -hex 32`.
2. Update the secret in AWS Secrets Manager:
   ```bash
   aws secretsmanager update-secret --secret-id blynt-dev-secrets --secret-string '{"JWT_SECRET":"...","SESSION_SECRET":"..."}' --region eu-west-2
   ```
3. Trigger a deployment in App Runner to pick up the updated secrets:
   ```bash
   aws apprunner start-deployment --service-arn <API_SERVICE_ARN> --region eu-west-2
   ```

### Database Backups (Amazon RDS Snapshots & `pg_dump`)
Automated snapshots occur daily with a 7-day retention period. For manual on-demand dumps:
```bash
pg_dump "$DATABASE_URL" -Fc -f "blynt_backup_$(date +%Y%m%d_%H%M%S).dump"
```

### GitHub CI/CD Pipeline
Continuous integration and automated AWS deployment are defined in `.github/workflows/deploy-aws-dev.yml`:
1. Executes on every push to `main`.
2. Runs quality gates (linting, typechecks, Jest and Vitest suites).
3. Builds and pushes container images to Amazon ECR.
4. Applies Terraform in `infrastructure/environments/dev`.
5. Verifies and deploys both App Runner services.
