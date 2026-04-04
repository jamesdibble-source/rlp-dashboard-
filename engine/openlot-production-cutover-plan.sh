#!/bin/bash
# Emit a compact production cutover plan for the current wrapper + scheduler state.
# Non-destructive: runs dry-run/read-only helpers only.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

WRAPPER_DRY_RUN="$(bash "$ROOT/engine/production-buy-side-cycle.sh" --dry-run)"
APPLY_NOW_JSON="$(bash "$ROOT/engine/openlot-scheduler-apply-now-card.sh")"
STACK_SMOKE_JSON="$(bash "$ROOT/engine/openlot-scheduler-stack-smoke.sh")"
RELEASE_JSON="$(bash "$ROOT/engine/openlot-scheduler-release-card.sh")"
COVERAGE_JSON="$(bash "$ROOT/engine/openlot-scheduler-coverage-check.sh")"

python3 - <<'PY' "$WRAPPER_DRY_RUN" "$APPLY_NOW_JSON" "$STACK_SMOKE_JSON" "$RELEASE_JSON" "$COVERAGE_JSON"
import json, re, sys

wrapper_text, apply_now_json, stack_smoke_json, release_json, coverage_json = sys.argv[1:6]
apply_now = json.loads(apply_now_json)
stack_smoke = json.loads(stack_smoke_json)
release = json.loads(release_json)
coverage = json.loads(coverage_json)

plan = {
    'wrapper': {
        'ready': 'dry-run only; no commands executed' in wrapper_text.lower(),
        'officialCommand': 'npm run ops:prod:buy-side',
        'dryRunCommand': 'npm run ops:prod:buy-side:dry-run',
        'observedPlan': {}
    },
    'scheduler': {
        'stackSmokeAllOk': bool(stack_smoke.get('allOk')),
        'preflightReady': bool(release.get('preflightReady')),
        'coverageComplete': bool(release.get('coverageComplete')),
        'coverageChecks': coverage.get('checks', {}),
        'currentCrontabState': apply_now.get('crontabState'),
        'entryStates': apply_now.get('entryStates', {}),
        'applyCommand': apply_now.get('applyCommand'),
        'rollbackCommand': apply_now.get('removeCommand'),
        'restoreCommandTemplate': apply_now.get('restoreCommandTemplate'),
        'proposedEntries': apply_now.get('entries', []),
    },
    'cutover': {
        'installRecurringProductionCommand': apply_now.get('applyCommand'),
        'finalValidation': [
            'npm run openlot:check-drip-crons',
            'npm run openlot:scheduler-status',
            'crontab -l'
        ]
    }
}

patterns = {
    'states': r'- states: (.+)',
    'sources': r'- sources: (.+)',
    'mode': r'- mode: (.+)',
    'queue': r'- queue: (.+)',
    'maxJobsPerPass': r'- maxJobsPerPass: (.+)',
    'maxPasses': r'- maxPasses: (.+)',
    'discovery': r'- discovery: (.+)',
    'apifyTokenPresent': r'- apifyTokenPresent: (.+)',
    'cloudflareTokenPresent': r'- cloudflareTokenPresent: (.+)',
}
for key, pattern in patterns.items():
    match = re.search(pattern, wrapper_text)
    if match:
        plan['wrapper']['observedPlan'][key] = match.group(1).strip()

print(json.dumps(plan, indent=2))
PY
