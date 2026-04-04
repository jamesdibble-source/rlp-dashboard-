#!/bin/bash
# Emit a compact machine-readable operator checklist for applying the scheduler rollout.
# Non-destructive: combines existing helpers only.

set -euo pipefail

ROOT="/Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard"
RELEASE_JSON="$(bash "${ROOT}/engine/openlot-scheduler-release-card.sh")"
APPLY_NOW_JSON="$(bash "${ROOT}/engine/openlot-scheduler-apply-now-card.sh")"

python3 - <<'PY' "$RELEASE_JSON" "$APPLY_NOW_JSON"
import json, sys
release = json.loads(sys.argv[1])
apply_now = json.loads(sys.argv[2])
checklist = [
    {"step": 1, "label": "Confirm releaseReady", "done": bool(release.get('releaseReady'))},
    {"step": 2, "label": "Confirm current crontab is empty", "done": release.get('crontabState') == 'empty'},
    {"step": 3, "label": "Run exact apply command", "command": apply_now.get('applyCommand')},
    {"step": 4, "label": "If needed, rollback with exact remove command", "command": apply_now.get('removeCommand')},
    {"step": 5, "label": "If needed, restore from backup with template", "command": apply_now.get('restoreCommandTemplate')},
]
print(json.dumps({
    'readyToExecuteChecklist': bool(release.get('releaseReady')) and release.get('crontabState') == 'empty',
    'checklist': checklist,
    'proposedEntries': apply_now.get('entries', []),
}, indent=2))
PY
