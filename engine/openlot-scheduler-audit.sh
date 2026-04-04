#!/bin/bash
# Print a compact JSON audit of scheduler helper readiness.
# Non-destructive: inspects files, permissions, crontab state, and backup inventory only.

set -euo pipefail

ROOT="/Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard"
BACKUP_DIR="${ROOT}/tmp/cron-backups"
CURRENT="$(crontab -l 2>/dev/null || true)"

json_bool() {
  if [ "$1" = "true" ]; then
    printf 'true'
  else
    printf 'false'
  fi
}

file_status() {
  local path="$1"
  local exists=false
  local executable=false
  if [ -f "$path" ]; then
    exists=true
  fi
  if [ -x "$path" ]; then
    executable=true
  fi
  printf '{"path":"%s","exists":%s,"executable":%s}' "$path" "$(json_bool "$exists")" "$(json_bool "$executable")"
}

count_backups=0
latest_backup=null
if [ -d "$BACKUP_DIR" ]; then
  count_backups=$(find "$BACKUP_DIR" -type f | wc -l | tr -d ' ')
  latest=$(ls -1t "$BACKUP_DIR" 2>/dev/null | head -n 1 || true)
  if [ -n "$latest" ]; then
    latest_backup="\"${BACKUP_DIR}/${latest}\""
  fi
fi

if [ -z "$CURRENT" ]; then
  crontab_state="empty"
else
  crontab_state="present"
fi

cat <<EOF
{
  "crontabState": "${crontab_state}",
  "backupCount": ${count_backups},
  "latestBackup": ${latest_backup},
  "helpers": [
    $(file_status "${ROOT}/engine/openlot-midday-drip.sh"),
    $(file_status "${ROOT}/engine/openlot-afternoon-drip.sh"),
    $(file_status "${ROOT}/engine/openlot-evening-drip.sh"),
    $(file_status "${ROOT}/engine/print-all-drip-crons.sh"),
    $(file_status "${ROOT}/engine/check-drip-crons.sh"),
    $(file_status "${ROOT}/engine/install-drip-crons.sh"),
    $(file_status "${ROOT}/engine/remove-drip-crons.sh"),
    $(file_status "${ROOT}/engine/restore-crontab-backup.sh"),
    $(file_status "${ROOT}/engine/openlot-scheduler-status.sh"),
    $(file_status "${ROOT}/engine/openlot-scheduler-readme.sh")
  ]
}
EOF
