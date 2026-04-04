#!/bin/bash
# Emit a compact machine-readable release/readiness card for the scheduler rollout.
# Non-destructive: combines existing helpers only.

set -euo pipefail

ROOT="/Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard"
PREFLIGHT_JSON="$(bash "${ROOT}/engine/openlot-scheduler-preflight.sh")"
COVERAGE_JSON="$(bash "${ROOT}/engine/openlot-scheduler-coverage-check.sh")"
REPORT_JSON="$(bash "${ROOT}/engine/openlot-scheduler-report.sh")"

python3 - <<'PY' "$PREFLIGHT_JSON" "$COVERAGE_JSON" "$REPORT_JSON"
import json, sys
preflight = json.loads(sys.argv[1])
coverage = json.loads(sys.argv[2])
report = json.loads(sys.argv[3])
release_ready = bool(preflight.get('readyToApply')) and bool(coverage.get('coverageComplete'))
print(json.dumps({
    'releaseReady': release_ready,
    'preflightReady': preflight.get('readyToApply'),
    'coverageComplete': coverage.get('coverageComplete'),
    'recommendedNextAction': report.get('recommendedNextAction'),
    'crontabState': report.get('crontabState'),
    'entryStates': report.get('entries', {}),
    'backupCount': report.get('backupCount'),
    'opsIndexCount': coverage.get('opsIndexCount'),
    'categorizedCount': coverage.get('categorizedCount'),
    'matrixCommandCount': coverage.get('matrixCommandCount'),
}, indent=2))
PY
