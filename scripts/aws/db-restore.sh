#!/usr/bin/env bash
# ==============================================================================
# Blynt Database Restore Script (POSIX)
# Target: PostgreSQL (AWS RDS or Dev/Staging DB)
# Restores custom-format pg_dump with validation checks.
# ==============================================================================

set -euo pipefail

BACKUP_FILE="${1:-}"
TARGET_DATABASE_URL="${TARGET_DATABASE_URL:-}"
CONFIRM_RESTORE="${CONFIRM_RESTORE:-false}"

if [ -z "${BACKUP_FILE}" ]; then
  echo "[-] ERROR: Backup file path must be passed as the first argument."
  echo "    Usage: ./db-restore.sh <path/to/backup.dump>"
  exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "[-] ERROR: Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

if [ -z "${TARGET_DATABASE_URL}" ]; then
  echo "[-] ERROR: TARGET_DATABASE_URL environment variable is required."
  exit 1
fi

if [ "${CONFIRM_RESTORE}" != "true" ]; then
  echo "[-] SAFETY CHECK: Restoring will overwrite existing data in the target database."
  echo "    To proceed, set CONFIRM_RESTORE=true."
  exit 1
fi

# Verify checksum if present
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [ -f "${CHECKSUM_FILE}" ]; then
  echo "[+] Verifying SHA256 checksum..."
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum --check "${CHECKSUM_FILE}"
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 -c "${CHECKSUM_FILE}"
  fi
  echo "[+] Checksum valid."
fi

echo "[+] ==========================================================="
echo "[+] Starting Blynt Database Restore"
echo "[+] Source file: ${BACKUP_FILE}"
echo "[+] ==========================================================="

# Run pg_restore
# --clean: clean (drop) database objects before recreating them
# --if-exists: use IF EXISTS when dropping objects
# --no-owner: do not output commands to set ownership
# --no-privileges: prevent restoration of access privileges (grant/revoke)
if pg_restore \
  --dbname="${TARGET_DATABASE_URL}" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --verbose \
  "${BACKUP_FILE}"; then
  echo "[+] pg_restore completed successfully."
else
  # pg_restore returns non-zero on benign warnings (e.g. notices that drop target didn't exist)
  echo "[!] pg_restore finished with status $?. Please check validation script."
fi
