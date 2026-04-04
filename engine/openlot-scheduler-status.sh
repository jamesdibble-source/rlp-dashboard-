#!/bin/bash
# Summarise current OpenLot drip scheduler readiness in one non-destructive report.

set -euo pipefail

ROOT="/Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard"
MIDDAY="15 13 * * * bash ${ROOT}/engine/openlot-midday-drip.sh"
AFTERNOON="30 15 * * * bash ${ROOT}/engine/openlot-afternoon-drip.sh"
EVENING="45 18 * * * bash ${ROOT}/engine/openlot-evening-drip.sh"
CURRENT="$(crontab -l 2>/dev/null || true)"
BACKUP_DIR="${ROOT}/tmp/cron-backups"

check_line() {
  local line="$1"
  if printf '%s\n' "$CURRENT" | grep -Fx -- "$line" >/dev/null; then
    echo installed
  else
    echo missing
  fi
}

LATEST_BACKUP=""
if [ -d "$BACKUP_DIR" ]; then
  LATEST_BACKUP="$(ls -1t "$BACKUP_DIR" 2>/dev/null | head -n 1 || true)"
fi

if [ -z "$CURRENT" ]; then
  CRON_STATE="empty"
else
  CRON_STATE="present"
fi

cat <<EOF
{
  "crontabState": "${CRON_STATE}",
  "entries": {
    "midday": "$(check_line "$MIDDAY")",
    "afternoon": "$(check_line "$AFTERNOON")",
    "evening": "$(check_line "$EVENING")"
  },
  "latestBackup": $(if [ -n "$LATEST_BACKUP" ]; then printf '"%s/%s"' "$BACKUP_DIR" "$LATEST_BACKUP"; else printf 'null'; fi),
  "recommendedInstallCommand": "npm run openlot:install-drip-crons -- --apply",
  "recommendedCheckCommand": "npm run openlot:check-drip-crons"
}
EOF
