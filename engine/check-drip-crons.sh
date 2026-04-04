#!/bin/bash
# Check whether the proposed OpenLot drip cron entries are already installed.
# Non-destructive: reads current crontab and reports match status only.

set -euo pipefail

ROOT="/Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard"
MIDDAY="15 13 * * * bash ${ROOT}/engine/openlot-midday-drip.sh"
AFTERNOON="30 15 * * * bash ${ROOT}/engine/openlot-afternoon-drip.sh"
EVENING="45 18 * * * bash ${ROOT}/engine/openlot-evening-drip.sh"
CURRENT="$(crontab -l 2>/dev/null || true)"

check_line() {
  local label="$1"
  local line="$2"
  if printf '%s\n' "$CURRENT" | grep -Fx -- "$line" >/dev/null; then
    echo "$label: installed"
  else
    echo "$label: missing"
  fi
}

if [ -z "$CURRENT" ]; then
  echo "Current crontab: empty"
else
  echo "Current crontab: present"
fi
check_line "midday" "$MIDDAY"
check_line "afternoon" "$AFTERNOON"
check_line "evening" "$EVENING"
