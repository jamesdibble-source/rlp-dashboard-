#!/bin/bash
# Shared helpers for OpenLot scheduler scripts.

scheduler_root() {
  printf '%s' "/Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard"
}

scheduler_midday_entry() {
  printf '%s' "15 13 * * * bash $(scheduler_root)/engine/openlot-midday-drip.sh"
}

scheduler_afternoon_entry() {
  printf '%s' "30 15 * * * bash $(scheduler_root)/engine/openlot-afternoon-drip.sh"
}

scheduler_evening_entry() {
  printf '%s' "45 18 * * * bash $(scheduler_root)/engine/openlot-evening-drip.sh"
}

scheduler_current_crontab() {
  crontab -l 2>/dev/null || true
}

scheduler_backup_dir() {
  printf '%s' "$(scheduler_root)/tmp/cron-backups"
}

scheduler_normalize_crontab() {
  printf '%s\n' "$1" | sed '/^$/N;/^\n$/D'
}
