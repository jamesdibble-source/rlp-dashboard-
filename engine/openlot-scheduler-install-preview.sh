#!/bin/bash
# Emit a compact human-readable preview of exactly what would be installed for the scheduler rollout.
# Non-destructive: wraps existing preview/apply helpers only.

set -euo pipefail

ROOT="/Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard"
APPLY_NOW_JSON="$(bash "${ROOT}/engine/openlot-scheduler-apply-now-card.sh")"
PREVIEW_JSON="$(bash "${ROOT}/engine/preview-drip-crons-json.sh")"

python3 - <<'PY' "$APPLY_NOW_JSON" "$PREVIEW_JSON"
import json, sys
apply_now = json.loads(sys.argv[1])
preview = json.loads(sys.argv[2])
print("OpenLot Scheduler Install Preview")
print("")
print(f"Apply now: {'yes' if apply_now.get('applyNow') else 'no'}")
print(f"Crontab state: {apply_now.get('crontabState')}")
print(f"Apply command: {apply_now.get('applyCommand')}")
print(f"Remove command: {apply_now.get('removeCommand')}")
print(f"Restore template: {apply_now.get('restoreCommandTemplate')}")
print("")
print("Proposed entries:")
for line in apply_now.get('entries', []):
    print(f"- {line}")
print("")
print("Resulting crontab preview:")
for line in preview.get('resultingCrontab', []):
    print(f"- {line}")
PY
