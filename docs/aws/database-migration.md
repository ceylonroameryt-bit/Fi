# Blynt — Database Migration Protocol

This protocol provides the definitive standard operating procedure (SOP) for dumping, transferring, restoring, and validating the PostgreSQL database from existing hosting (Render / Supabase / Neon) to Amazon RDS PostgreSQL in `eu-west-2`.

---

## 1. Principles & Safety Rules
1. **Zero Data Loss**: Double-entry financial ledgers must not lose transactions or have state diverge.
2. **Read-Only Lock During Cutover**: Application writes must be halted before the final snapshot is taken.
3. **Checksum Verification**: Every dump file must be verified with SHA-256 before restoration.
4. **Mandatory Invariant Verification**: A migration is only considered successful when `db-validate` confirms that:
   - Sum(Debits) == Sum(Credits) across all posted journal entries.
   - Discrepancy is exactly £0.0000.
   - Zero orphaned journal lines.
   - Zero duplicate journal numbers per organisation.

---

## 2. Step-by-Step Migration Execution

### Step 2.1: Export Source Database
Run the backup script pointing at the source database:

**Linux / macOS:**
```bash
export DATABASE_URL="postgresql://user:password@source-db-host:5432/dbname?sslmode=require"
chmod +x scripts/aws/db-backup.sh
./scripts/aws/db-backup.sh
```

**Windows (PowerShell):**
```powershell
$env:DATABASE_URL = "postgresql://user:password@source-db-host:5432/dbname?sslmode=require"
.\scripts\aws\db-backup.ps1
```

This generates:
- `backups/blynt_backup_<TIMESTAMP>.dump` (pg_dump custom format with blobs)
- `backups/blynt_backup_<TIMESTAMP>.dump.sha256` (cryptographic checksum)

---

### Step 2.2: Restore to Target Amazon RDS Instance
Ensure connectivity to the target RDS database (either from within the VPC, via a bastion host, or via private network tunnel).

**Linux / macOS:**
```bash
export TARGET_DATABASE_URL="postgresql://blynt_admin:<PASSWORD>@<RDS_ENDPOINT>:5432/blynt?sslmode=require"
export CONFIRM_RESTORE="true"
chmod +x scripts/aws/db-restore.sh
./scripts/aws/db-restore.sh backups/blynt_backup_<TIMESTAMP>.dump
```

**Windows (PowerShell):**
```powershell
$env:TARGET_DATABASE_URL = "postgresql://blynt_admin:<PASSWORD>@<RDS_ENDPOINT>:5432/blynt?sslmode=require"
$env:CONFIRM_RESTORE = "true"
.\scripts\aws\db-restore.ps1 -BackupFile "backups/blynt_backup_<TIMESTAMP>.dump" -Force
```

---

### Step 2.3: Execute Migration Validation Runner
Run the automated integrity validator to verify row counts and financial invariants across both databases:

**Linux / macOS:**
```bash
export SOURCE_DATABASE_URL="postgresql://user:password@source-db-host:5432/dbname?sslmode=require"
export TARGET_DATABASE_URL="postgresql://blynt_admin:<PASSWORD>@<RDS_ENDPOINT>:5432/blynt?sslmode=require"
chmod +x scripts/aws/db-validate.sh
./scripts/aws/db-validate.sh
```

**Windows (PowerShell):**
```powershell
$env:SOURCE_DATABASE_URL = "postgresql://user:password@source-db-host:5432/dbname?sslmode=require"
$env:TARGET_DATABASE_URL = "postgresql://blynt_admin:<PASSWORD>@<RDS_ENDPOINT>:5432/blynt?sslmode=require"
.\scripts\aws\db-validate.ps1
```

### Expected Output Criteria
```text
=============================================================
       BLYNT DATABASE MIGRATION VALIDATION RUNNER
=============================================================
[+] Validating target database: postgresql://blynt_admin:***@...

--- FINANCIAL INTEGRITY CONTROLS ---
  - Total Debits (posted) : £1000090201.8366
  - Total Credits (posted): £1000090201.8366
  - Difference            : £0.0000
  - Status Balanced       : PASS [MATCH]
  - Orphan Journal Lines  : PASS [0]
  - Duplicate Journal Nos : PASS [0]
=============================================================
[+] VALIDATION PASSED: All accounting integrity and row checks verified successfully.
=============================================================
```

If any table row count fails to match or any accounting invariant shows a non-zero discrepancy, the script exits with code 1 and cutover must NOT proceed.
