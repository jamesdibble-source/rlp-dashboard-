#!/bin/bash
# Emit a compact shell-ready command sheet for the scheduler rollout.
# Non-destructive: wraps existing apply-now helper only.

set -euo pipefail

ROOT="/Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard"
APPLY_NOW_JSON="$(bash "${ROOT}/engine/openlot-scheduler-apply-now-card.sh")"

python3 - <<'PY' "$APPLY_NOW_JSON"
import json, sys
card = json.loads(sys.argv[1])
print('OpenLot Scheduler Command Sheet')
print('')
print('Apply:')
print(card.get('applyCommand', ''))
print('')
print('Rollback:')
print(card.get('removeCommand', ''))
print('')
print('Restore template:')
print(card.get('restoreCommandTemplate', ''))
print('')
print('Proposed cron entries:')
for line in card.get('entries', []):
    print(line)
PY
