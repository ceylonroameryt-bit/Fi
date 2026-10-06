# Blynt — Rollback Runbook

This document defines the emergency rollback procedure in the event that the AWS cutover encounters critical failures, data verification discrepancies, or unrecoverable system errors during the maintenance window.

---

## 1. Rollback Criteria (Abort Gates)
The Lead Engineer and Incident Commander must trigger an immediate rollback if ANY of the following occur:
1. `db-validate.sh` reports a row mismatch or financial invariant discrepancy (`diff != 0.0000`).
2. AWS App Runner service fails to pass health checks within 10 minutes of cutover.
3. Database restoration fails or takes longer than the designated 15-minute budget.
4. Core accounting transactions (e.g., journal posting, invoice approval) fail during smoke testing.

---

## 2. Emergency Rollback Procedure

```
   [CRITICAL ABORT] 
          │
          ▼
   1. REVERT DNS RECORDS (Cloudflare / Route 53)
          │   Point CNAMEs back to Render / legacy origin immediately.
          │   (Low TTL ensures rapid propagation within 300 seconds).
          ▼
   2. RE-ENABLE LEGACY READ-WRITE MODE
          │   Lift read-only maintenance flag on legacy infrastructure.
          ▼
   3. FLUSH APPLICATION SESSIONS
          │   Invalidate active sessions if uncommitted writes took place.
          ▼
   4. ISOLATE AWS TARGET RESOURCES
          │   Pause or stop AWS App Runner to prevent split-brain writes.
          ▼
   5. POST-MORTEM & INCIDENT REVIEW
              Gather CloudWatch logs, pg_restore logs, and validation errors.
```

---

## 3. Detailed Step Actions

### Step 1: Revert DNS
In DNS control plane (Cloudflare / Route 53):
- Revert `api.blynt.io` to Render backend URL (e.g. `blynt-api.onrender.com`).
- Revert `app.blynt.io` to Vercel/Render frontend URL.

### Step 2: Restore Legacy Service
- Ensure Render services are active and healthy.
- Remove the maintenance banner and re-enable API write access.

### Step 3: Prevent Split-Brain Traffic
To guarantee no traffic continues hitting AWS:
```bash
aws apprunner pause-service --service-arn <APP_RUNNER_SERVICE_ARN> --region eu-west-2
```

### Step 4: Data Re-Verification
Verify that the legacy database remains in its pre-cutover state and no partial transactions occurred:
```bash
export DATABASE_URL="postgresql://...legacy-db..."
./scripts/aws/db-validate.sh
```

### Step 5: Communication
Notify users that scheduled maintenance has concluded and services have resumed normally. Schedule an internal incident post-mortem to diagnose the root cause before attempting subsequent cutovers.
