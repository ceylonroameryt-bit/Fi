#!/usr/bin/env bash
# ==============================================================================
# Blynt Database Backup Script (POSIX)
# Target: PostgreSQL (Render, Local, or AWS RDS)
# Generates custom-format pg_dump with blobs and SHA256 checksum.
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/blynt_backup_${TIMESTAMP}.dump"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"

mkdir -p "${BACKUP_DIR}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[-] ERROR: DATABASE_URL environment variable is required."
  echo "    Format: postgresql://user:password@host:port/dbname?sslmode=require"
  exit 1
fi

echo "[+] ==========================================================="
echo "[+] Starting Blynt Database Backup"
echo "[+] Timestamp : ${TIMESTAMP}"
echo "[+] Destination : ${BACKUP_FILE}"
echo "[+] ==========================================================="

# Run pg_dump in custom format (-Fc) with blobs (-b)
if pg_dump --dbname="${DATABASE_URL}" --format=c --blobs --verbose --file="${BACKUP_FILE}"; then
  echo "[+] pg_dump completed successfully."
else
  echo "[-] ERROR: pg_dump failed!"
  exit 1
fi

# Generate SHA256 checksum
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "${BACKUP_FILE}" > "${CHECKSUM_FILE}"
  echo "[+] Checksum generated: $(cat "${CHECKSUM_FILE}")"
elif command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "${BACKUP_FILE}" > "${CHECKSUM_FILE}"
  echo "[+] Checksum generated: $(cat "${CHECKSUM_FILE}")"
fi

FILE_SIZE=$(ls -lh "${BACKUP_FILE}" | awk '{print $5}')
echo "[+] Backup successfully created (${FILE_SIZE}): ${BACKUP_FILE}"
