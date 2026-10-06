# Blynt — Production Cutover Runbook

This runbook outlines the exact sequence for executing a scheduled zero-data-loss production cutover to AWS with a maintenance window of under 30 minutes.

---

## 1. Timeline Overview (T-Minus Schedule)

| Phase | Time | Action | Responsible |
|---|---|---|---|
| Preparation | T-48 Hours | Reduce DNS TTL on domains to 300s (5 minutes) | Lead SRE |
| Preparation | T-24 Hours | Run trial dry-run migration to AWS DEV RDS | DBA |
| Maintenance Window | T-00:00 | Announce maintenance window; enable read-only banner | Lead Engineer |
| Freezing | T+00:05 | Stop writes to Render/legacy API instance | Lead SRE |
| Data Transfer | T+00:10 | Execute final differential `pg_dump` and `pg_restore` | DBA |
| Verification | T+00:18 | Run `db-validate` and accounting integrity checks | QA / Accounting Eng |
| DNS Shift | T+00:22 | Point API and Web CNAMEs to AWS endpoints | Lead SRE |
| Smoke Tests | T+00:25 | Execute live test transactions and verify ledgers | QA / Product |
| Completion | T+00:30 | Remove maintenance banner; restore normal TTL | Incident Lead |

---

## 2. Step-by-Step Execution Protocol

### Step 1: Pre-Cutover Checks (T-24h)
- Verify AWS App Runner service is reporting `OPERATION_STATUS: OPERATION_SUCCEEDED`.
- Ensure `/api/v1/health` responds with HTTP 200.
- Verify S3 bucket permissions and presigned URL generation.

### Step 2: Maintenance Window Initiation (T-00:00)
- Post notification to users.
- In legacy frontend / API, activate read-only mode to prevent new transactions or journal postings from entering the system.

### Step 3: Source Snapshot & Export (T+00:05)
```bash
./scripts/aws/db-backup.sh
```
Verify the generated `.sha256` checksum matches.

### Step 4: Target Restoration (T+00:10)
```bash
export TARGET_DATABASE_URL="postgresql://...aws-rds..."
export CONFIRM_RESTORE=true
./scripts/aws/db-restore.sh backups/blynt_backup_<FINAL_TIMESTAMP>.dump
```

### Step 5: Data Invariant Verification (T+00:18)
```bash
export SOURCE_DATABASE_URL="postgresql://...legacy-db..."
export TARGET_DATABASE_URL="postgresql://...aws-rds..."
./scripts/aws/db-validate.sh
```
**Gate Check**: Do NOT proceed to DNS change unless:
1. All table row counts match exactly between source and target.
2. Status Balanced is `PASS [MATCH]`.
3. Orphan Journal Lines is `0`.
4. Difference is `£0.0000`.

### Step 6: DNS Cutover (T+00:22)
Update DNS records in Cloudflare / Route 53:
- `api.blynt.io` CNAME → `<AWS_APPRUNNER_DOMAIN>`
- `app.blynt.io` CNAME → `<AWS_AMPLIFY_OR_VERCEL_DOMAIN>`

### Step 7: Live Smoke Testing (T+00:25)
1. Log in with test administrator credentials.
2. Create and approve a draft sales invoice.
3. Post the invoice to create double-entry journal entries.
4. Verify trial balance report remains balanced.
5. Verify audit logs record the actions.

### Step 8: Completion (T+00:30)
- Remove maintenance mode.
- Restore DNS TTL to 3600s.
- Archive legacy database snapshot securely.
