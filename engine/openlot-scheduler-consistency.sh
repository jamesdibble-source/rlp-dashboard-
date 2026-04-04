#!/bin/bash
# Verify internal consistency across the OpenLot scheduler helpers.
# Non-destructive: reads command outputs only.

set -euo pipefail

ROOT="/Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard"
REPORT_JSON="$(bash "${ROOT}/engine/openlot-scheduler-report.sh")"
MAP_JSON="$(bash "${ROOT}/engine/openlot-scheduler-command-map.sh")"
DECISION_TEXT="$(bash "${ROOT}/engine/openlot-scheduler-decision.sh")"

python3 - <<'PY' "$REPORT_JSON" "$MAP_JSON" "$DECISION_TEXT"
import json, sys
report = json.loads(sys.argv[1])
cmdmap = json.loads(sys.argv[2])
decision_text = sys.argv[3]
install_apply = cmdmap.get('installApply')
report_next = report.get('recommendedNextAction')
decision_next = None
for line in decision_text.splitlines():
    if line.startswith('Next command: '):
        decision_next = line.split(': ', 1)[1].strip()
        break
summary = {
    'installApply': install_apply,
    'reportRecommendedNextAction': report_next,
    'decisionNextCommand': decision_next,
    'allMatch': bool(install_apply and install_apply == report_next == decision_next)
}
print(json.dumps(summary, indent=2))
PY
