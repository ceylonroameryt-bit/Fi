#!/usr/bin/env bash
# ==============================================================================
# Blynt Database Validation Script (POSIX)
# Runs TypeScript validator to verify table row counts & financial invariants.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

export TARGET_DATABASE_URL="${TARGET_DATABASE_URL:-${DATABASE_URL:-}}"
export SOURCE_DATABASE_URL="${SOURCE_DATABASE_URL:-}"

if [ -z "${TARGET_DATABASE_URL}" ]; then
  echo "[-] ERROR: TARGET_DATABASE_URL or DATABASE_URL must be specified."
  exit 1
fi

echo "[+] Executing database validation checks..."
cd "${ROOT_DIR}"
npx tsx "${SCRIPT_DIR}/db-validate.ts"
