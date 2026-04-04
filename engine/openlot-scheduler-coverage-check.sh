#!/bin/bash
# Emit a compact machine-readable coverage verdict for the scheduler command surface.
# Non-destructive: wraps the existing scheduler surface summary only.

set -euo pipefail

ROOT="/Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard"
SUMMARY_JSON="$(bash "${ROOT}/engine/openlot-scheduler-surface-summary.sh")"

python3 - <<'PY' "$SUMMARY_JSON"
import json, sys
summary = json.loads(sys.argv[1])
checks = {
    'categorizedMatchesOpsIndex': (summary.get('categorizedCount') == summary.get('opsIndexCount')),
    'noUncategorizedScripts': int(summary.get('uncategorizedScriptCount') or 0) == 0,
    'matrixCommandsAllPresent': bool(summary.get('matrixCommandsAllPresent')),
}
print(json.dumps({
    'checks': checks,
    'coverageComplete': all(checks.values()),
    'opsIndexCount': summary.get('opsIndexCount'),
    'categorizedCount': summary.get('categorizedCount'),
    'uncategorizedScriptCount': summary.get('uncategorizedScriptCount'),
    'matrixCommandCount': summary.get('matrixCommandCount'),
}, indent=2))
PY
