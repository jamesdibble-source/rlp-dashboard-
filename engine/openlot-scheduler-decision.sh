#!/bin/bash
# Print a compact human-readable decision summary for whether the proposed OpenLot drip cron set should be applied now.
# Non-destructive: reads scheduler report + JSON preview only.

set -euo pipefail

ROOT="/Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard"
REPORT_JSON="$(bash "${ROOT}/engine/openlot-scheduler-report.sh")"
PREVIEW_JSON="$(bash "${ROOT}/engine/preview-drip-crons-json.sh")"

python3 - <<'PY' "$REPORT_JSON" "$PREVIEW_JSON"
import json, sys
report = json.loads(sys.argv[1])
preview = json.loads(sys.argv[2])
entries = report.get('entries', {})
all_missing = all(v == 'missing' for v in entries.values())
all_exec = bool(report.get('allHelpersExecutable'))
backup_count = int(report.get('backupCount') or 0)
result_lines = int(preview.get('resultLineCount') or 0)
ready = all_missing and all_exec and result_lines == 3
print('OpenLot scheduler decision summary')
print('')
print(f"crontabState: {report.get('crontabState')}")
print(f"entries: midday={entries.get('midday')} afternoon={entries.get('afternoon')} evening={entries.get('evening')}")
print(f"allHelpersExecutable: {str(all_exec).lower()}")
print(f"backupCount: {backup_count}")
print(f"previewResultLineCount: {result_lines}")
print('')
if ready:
    print('Recommendation: READY_TO_APPLY')
    print('Next command: npm run openlot:install-drip-crons -- --apply')
else:
    print('Recommendation: REVIEW_BEFORE_APPLY')
    print(f"Suggested check command: {report.get('recommendedNextAction')}")
PY
