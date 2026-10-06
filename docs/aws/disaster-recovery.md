# Blynt — Disaster Recovery & Backup Policy

## 1. Objectives & Metrics
As a cloud accounting and financial SaaS platform, Blynt adheres to the following recovery objectives:

- **Recovery Point Objective (RPO)**:
  - **Production**: < 15 minutes (continuous WAL archiving and point-in-time recovery).
  - **DEV / Staging**: < 24 hours.
- **Recovery Time Objective (RTO)**:
  - **Production**: < 1 hour.
  - **DEV / Staging**: < 2 hours.

---

## 2. Backup Strategy

### 2.1 Amazon RDS Automated Snapshots
- **Automated Backups**: Enabled with a 7-day retention period in DEV, 35-day in Production.
- **Point-in-Time Recovery (PITR)**: Amazon RDS continuously captures transaction logs to Amazon S3, allowing rollback to any second within the retention window.
- **Backup Window**: Scheduled during low-traffic UK hours (02:00 - 03:00 UTC).

### 2.2 Cold S3 Database Backups
- Encrypted custom-format database dumps (`pg_dump -Fc -b`) are generated daily and stored in an isolated backup S3 bucket with Object Lock (WORM - Write Once, Read Many) to prevent ransomware tampering.
- Backups older than 90 days are transitioned to Amazon S3 Glacier Flexible Retrieval.

### 2.3 S3 Document Versioning
- S3 documents bucket has versioning enabled (`versioning_configuration { status = "Enabled" }`).
- Prevents accidental overwrites or malicious deletions of accounting attachments, bills, and VAT certificates.

---

## 3. Disaster Scenarios & Recovery Procedures

### Scenario A: Accidental Database Table Corruption / Truncation
1. Identify the exact UTC timestamp of the corruption event.
2. In AWS Console or via AWS CLI, execute a Point-in-Time Recovery (PITR) to a temporary RDS instance named `blynt-restored-pitr`.
3. Extract the corrupted table or data using `pg_dump` and restore into the active database, or swap endpoints.
4. Run `db-validate.sh` to confirm ledger balance and financial integrity.

### Scenario B: Complete AZ Outage in London (`eu-west-2a`)
- In Production (Multi-AZ), Amazon RDS performs an automatic failover to the synchronous standby in `eu-west-2b` within 60–120 seconds with zero data loss.
- AWS App Runner maintains multi-AZ availability across the region automatically.

### Scenario C: Regional AWS London Outage
1. Provision target infrastructure in the secondary UK/European standby region (`eu-west-1` Ireland) using Terraform.
2. Restore latest cross-region replicated snapshot to the new RDS instance.
3. Deploy API container via ECR cross-region replica.
4. Update Route 53 DNS records with automatic health-check failover.
