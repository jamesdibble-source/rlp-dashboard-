#!/bin/bash
# Run a compact preflight before applying the proposed OpenLot drip cron entries.
# Non-destructive: reads helper outputs only.

set -euo pipefail

ROOT="/Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard"
REPORT_JSON="$(bash "${ROOT}/engine/openlot-scheduler-report.sh")"
CONSISTENCY_JSON="$(bash "${ROOT}/engine/openlot-scheduler-consistency.sh")"
PREVIEW_JSON="$(bash "${ROOT}/engine/preview-drip-crons-json.sh")"

python3 - <<'PY' "$REPORT_JSON" "$CONSISTENCY_JSON" "$PREVIEW_JSON"
import json, sys
report = json.loads(sys.argv[1])
consistency = json.loads(sys.argv[2])
preview = json.loads(sys.argv[3])
entries = report.get('entries', {})
checks = {
    'crontabEmpty': report.get('crontabState') == 'empty',
    'entriesMissing': all(v == 'missing' for v in entries.values()),
    'helpersExecutable': bool(report.get('allHelpersExecutable')),
    'consistencyMatch': bool(consistency.get('allMatch')),
    'previewHasThreeLines': int(preview.get('resultLineCount') or 0) == 3,
}
ready = all(checks.values())
print(json.dumps({
    'checks': checks,
    'readyToApply': ready,
    'applyCommand': consistency.get('installApply'),
    'previewEntries': preview.get('resultingCrontab', [])
}, indent=2))
PY
