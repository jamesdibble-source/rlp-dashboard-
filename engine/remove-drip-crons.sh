#!/bin/bash
# Remove the proposed OpenLot drip cron entries with backup + idempotent rewrite.
# Safety: defaults to dry-run unless --apply is passed.

set -euo pipefail

ROOT="/Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard"
MODE="dry-run"

if [ "${1:-}" = "--apply" ]; then
  MODE="apply"
fi

CURRENT="$(crontab -l 2>/dev/null || true)"
BACKUP_DIR="${ROOT}/tmp/cron-backups"
mkdir -p "$BACKUP_DIR"
STAMP="$(date '+%Y-%m-%d_%H-%M-%S')"
BACKUP_FILE="${BACKUP_DIR}/crontab-remove-${STAMP}.txt"
printf '%s\n' "$CURRENT" > "$BACKUP_FILE"

FILTERED="$(printf '%s\n' "$CURRENT" | grep -Fv -- "${ROOT}/engine/openlot-midday-drip.sh" | grep -Fv -- "${ROOT}/engine/openlot-afternoon-drip.sh" | grep -Fv -- "${ROOT}/engine/openlot-evening-drip.sh" || true)"
NORMALIZED="$(printf '%s\n' "$FILTERED" | sed '/^$/N;/^\n$/D')"

echo "Mode: $MODE"
echo "Backup file: $BACKUP_FILE"
echo ""
echo "Resulting crontab after removal:"
printf '%s\n' "$NORMALIZED"

if [ "$MODE" = "apply" ]; then
  printf '%s\n' "$NORMALIZED" | crontab -
  echo ""
  echo "Crontab updated."
else
  echo ""
  echo "Dry-run only. Re-run with --apply to remove."
fi
