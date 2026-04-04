#!/bin/bash
# Emit a compact machine-readable apply packet for the proposed OpenLot drip scheduler rollout.
# Non-destructive: combines existing helpers only.

set -euo pipefail

ROOT="/Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard"
REPORT_JSON="$(bash "${ROOT}/engine/openlot-scheduler-report.sh")"
PREVIEW_JSON="$(bash "${ROOT}/engine/preview-drip-crons-json.sh")"
MAP_JSON="$(bash "${ROOT}/engine/openlot-scheduler-command-map.sh")"

python3 - <<'PY' "$REPORT_JSON" "$PREVIEW_JSON" "$MAP_JSON"
import json, sys
report = json.loads(sys.argv[1])
preview = json.loads(sys.argv[2])
cmdmap = json.loads(sys.argv[3])
packet = {
    'readyToApply': report.get('crontabState') == 'empty' and all(v == 'missing' for v in report.get('entries', {}).values()),
    'applyCommand': cmdmap.get('installApply'),
    'removeCommand': cmdmap.get('removeApply'),
    'restoreCommandTemplate': cmdmap.get('restoreApply'),
    'entries': preview.get('resultingCrontab', []),
    'latestBackup': report.get('latestBackup'),
}
print(json.dumps(packet, indent=2))
PY
