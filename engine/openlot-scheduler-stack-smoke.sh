#!/bin/bash
# Run the core scheduler helper stack and emit a compact JSON smoke summary.
# Non-destructive: calls inspection helpers only.

set -euo pipefail

ROOT="/Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard"
STATUS_JSON="$(bash "${ROOT}/engine/openlot-scheduler-status.sh")"
AUDIT_JSON="$(bash "${ROOT}/engine/openlot-scheduler-audit.sh")"
REPORT_JSON="$(bash "${ROOT}/engine/openlot-scheduler-report.sh")"
CONSISTENCY_JSON="$(bash "${ROOT}/engine/openlot-scheduler-consistency.sh")"
PREFLIGHT_JSON="$(bash "${ROOT}/engine/openlot-scheduler-preflight.sh")"

python3 - <<'PY' "$STATUS_JSON" "$AUDIT_JSON" "$REPORT_JSON" "$CONSISTENCY_JSON" "$PREFLIGHT_JSON"
import json, sys
status, audit, report, consistency, preflight = [json.loads(x) for x in sys.argv[1:6]]
summary = {
    'statusOk': status.get('crontabState') in ('empty', 'present'),
    'auditOk': audit.get('helperCount', 0) >= 1 if 'helperCount' in audit else len(audit.get('helpers', [])) >= 1,
    'reportOk': bool(report.get('recommendedNextAction')),
    'consistencyOk': bool(consistency.get('allMatch')),
    'preflightOk': bool(preflight.get('readyToApply')),
    'applyCommand': report.get('recommendedNextAction'),
}
summary['allOk'] = all(summary[k] for k in ['statusOk','auditOk','reportOk','consistencyOk','preflightOk'])
print(json.dumps(summary, indent=2))
PY
