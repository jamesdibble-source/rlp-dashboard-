#!/bin/bash
# Emit a machine-readable preview of the proposed OpenLot drip cron install/remove state.
# Non-destructive.

set -euo pipefail

source "$(dirname "$0")/scheduler-lib.sh"
MODE="install"
if [ "${1:-}" = "--remove" ]; then
  MODE="remove"
fi

CURRENT="$(scheduler_current_crontab)"
ROOT="$(scheduler_root)"
MIDDAY="$(scheduler_midday_entry)"
AFTERNOON="$(scheduler_afternoon_entry)"
EVENING="$(scheduler_evening_entry)"

FILTERED="$(printf '%s\n' "$CURRENT" | grep -Fv -- "${ROOT}/engine/openlot-midday-drip.sh" | grep -Fv -- "${ROOT}/engine/openlot-afternoon-drip.sh" | grep -Fv -- "${ROOT}/engine/openlot-evening-drip.sh" || true)"
if [ "$MODE" = "install" ]; then
  NEW_CONTENT="$FILTERED"
  for LINE in "$MIDDAY" "$AFTERNOON" "$EVENING"; do
    if [ -n "$NEW_CONTENT" ]; then
      NEW_CONTENT="$(printf '%s\n%s' "$NEW_CONTENT" "$LINE")"
    else
      NEW_CONTENT="$LINE"
    fi
  done
else
  NEW_CONTENT="$FILTERED"
fi
NORMALIZED="$(scheduler_normalize_crontab "$NEW_CONTENT")"

python3 - <<'PY' "$MODE" "$CURRENT" "$NORMALIZED" "$MIDDAY" "$AFTERNOON" "$EVENING"
import json, sys
mode, current, normalized, midday, afternoon, evening = sys.argv[1:7]
print(json.dumps({
    "mode": mode,
    "currentLineCount": 0 if current == '' else len(current.splitlines()),
    "resultLineCount": 0 if normalized == '' else len(normalized.splitlines()),
    "entries": {
        "midday": midday,
        "afternoon": afternoon,
        "evening": evening,
    },
    "resultingCrontab": normalized.splitlines() if normalized else []
}, indent=2))
PY
