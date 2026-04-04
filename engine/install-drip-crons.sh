#!/bin/bash
# Install the proposed OpenLot drip cron entries with backup + idempotent rewrite.
# Safety: defaults to dry-run unless --apply is passed.

set -euo pipefail

ROOT="/Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard"
MIDDAY="15 13 * * * bash ${ROOT}/engine/openlot-midday-drip.sh"
AFTERNOON="30 15 * * * bash ${ROOT}/engine/openlot-afternoon-drip.sh"
EVENING="45 18 * * * bash ${ROOT}/engine/openlot-evening-drip.sh"
MODE="dry-run"

if [ "${1:-}" = "--apply" ]; then
  MODE="apply"
fi

CURRENT="$(crontab -l 2>/dev/null || true)"
BACKUP_DIR="${ROOT}/tmp/cron-backups"
mkdir -p "$BACKUP_DIR"
STAMP="$(date '+%Y-%m-%d_%H-%M-%S')"
BACKUP_FILE="${BACKUP_DIR}/crontab-${STAMP}.txt"
printf '%s\n' "$CURRENT" > "$BACKUP_FILE"

FILTERED="$(printf '%s\n' "$CURRENT" | grep -Fv -- "${ROOT}/engine/openlot-midday-drip.sh" | grep -Fv -- "${ROOT}/engine/openlot-afternoon-drip.sh" | grep -Fv -- "${ROOT}/engine/openlot-evening-drip.sh" || true)"
NEW_CONTENT="${FILTERED}"
for LINE in "$MIDDAY" "$AFTERNOON" "$EVENING"; do
  if [ -n "$NEW_CONTENT" ]; then
    NEW_CONTENT="${NEW_CONTENT}\n${LINE}"
  else
    NEW_CONTENT="$LINE"
  fi
done

NORMALIZED="$(printf '%b\n' "$NEW_CONTENT" | sed '/^$/N;/^\n$/D')"

echo "Mode: $MODE"
echo "Backup file: $BACKUP_FILE"
echo ""
echo "Proposed crontab:"
printf '%s\n' "$NORMALIZED"

if [ "$MODE" = "apply" ]; then
  printf '%s\n' "$NORMALIZED" | crontab -
  echo ""
  echo "Crontab updated."
else
  echo ""
  echo "Dry-run only. Re-run with --apply to install."
fi
