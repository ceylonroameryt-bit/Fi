# Blynt — Secrets Management & Rotation Policy

## 1. Secrets Overview
Blynt mandates strict zero-hardcoded-secrets and least-privilege policies. All runtime secrets are provisioned in **AWS Secrets Manager** (`blynt-dev-secrets` in DEV, `blynt-prod-secrets` in Production) and injected as environment variables into AWS App Runner via IAM role permissions.

---

## 2. Secrets Inventory

| Secret Key | Description | Length / Format | Rotation Frequency |
|---|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Full URI with SSL mode | 90 Days |
| `JWT_SECRET` | Secret key used for signing HS256 auth tokens | 64 characters (base64url) | 90 Days |
| `SESSION_SECRET` | Secret key used for session cookie integrity | 64 characters (base64url) | 90 Days |
| `AWS_S3_BUCKET_NAME` | Document storage bucket name | Plain text identifier | Static |
| `FRONTEND_URL` | CORS origin and email callback domain | URL (e.g. `https://app.blynt.io`) | Static |

---

## 3. Secret Generation Standard
Never use weak, predictable, or repeated secrets. Generate cryptographically strong secrets using Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

In Terraform, secrets are generated automatically using the `hashicorp/random` provider with `length = 64` and `special = false`.

---

## 4. Emergency Secret Rotation Procedure

If a secret (such as `JWT_SECRET` or `DATABASE_URL`) is compromised or leaked:

1. **Generate New Secret**:
   Create a new 64-character secret token.
2. **Update Secrets Manager**:
   ```bash
   aws secretsmanager update-secret \
     --secret-id blynt-dev-secrets \
     --secret-string '{"JWT_SECRET":"<NEW_KEY>",...}' \
     --region eu-west-2
   ```
3. **Restart App Runner Service**:
   Trigger a new deployment so App Runner re-reads the updated Secrets Manager values:
   ```bash
   aws apprunner start-deployment --service-arn <SERVICE_ARN> --region eu-west-2
   ```
4. **Invalidate Active Sessions**:
   Rotating `JWT_SECRET` immediately invalidates all active user access tokens, requiring all users to re-authenticate with their credentials and MFA tokens.
