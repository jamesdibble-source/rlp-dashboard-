#!/bin/bash
# Non-destructive production cutover check for the RLP recurring pipeline.
# Combines the official production wrapper dry-run with current scheduler readiness
# into one concise go/no-go verdict.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DRY_RUN_OUTPUT="$(bash engine/production-buy-side-cycle.sh --dry-run 2>&1)"
STATUS_JSON="$(bash engine/openlot-scheduler-status.sh)"
PREFLIGHT_JSON="$(bash engine/openlot-scheduler-preflight.sh)"
STACK_SMOKE_JSON="$(bash engine/openlot-scheduler-stack-smoke.sh)"
GIT_STATUS="$(git status --porcelain 2>/dev/null || true)"

python3 - <<'PY' "$DRY_RUN_OUTPUT" "$STATUS_JSON" "$PREFLIGHT_JSON" "$STACK_SMOKE_JSON" "$GIT_STATUS"
import json, re, sys

dry_run_output, status_raw, preflight_raw, smoke_raw, git_status = sys.argv[1:6]
status = json.loads(status_raw)
preflight = json.loads(preflight_raw)
smoke = json.loads(smoke_raw)

apify = 'unknown'
cloudflare = 'unknown'
for line in dry_run_output.splitlines():
    m = re.match(r'-\s+apifyTokenPresent:\s+(\w+)', line)
    if m:
        apify = m.group(1)
    m = re.match(r'-\s+cloudflareTokenPresent:\s+(\w+)', line)
    if m:
        cloudflare = m.group(1)

blockers = []
if status.get('crontabState') == 'empty':
    blockers.append('No recurring cron entries are installed yet on this machine.')
missing_entries = [k for k, v in status.get('entries', {}).items() if v != 'installed']
if missing_entries:
    blockers.append('OpenLot drip schedule is not applied: ' + ', '.join(missing_entries) + ' missing.')
if not preflight.get('readyToApply'):
    blockers.append('Scheduler preflight is not green.')
if not smoke.get('allOk'):
    blockers.append('Scheduler helper stack smoke check is not green.')
if apify != 'yes':
    blockers.append('Apify token not detected for REA production runs.')
if cloudflare != 'yes':
    blockers.append('Cloudflare token not detected for deploy step.')
if git_status.strip():
    blockers.append('Working tree is dirty/uncommitted; production cutover is not pinned to a clean revision.')

result = {
    'go': len(blockers) == 0,
    'wrapperDryRunOk': 'dry-run only; no commands executed' in dry_run_output,
    'apifyTokenPresent': apify,
    'cloudflareTokenPresent': cloudflare,
    'schedulerReadyToApply': bool(preflight.get('readyToApply')),
    'schedulerInstalled': status.get('crontabState') != 'empty' and not missing_entries,
    'schedulerEntries': status.get('entries', {}),
    'recommendedApplyCommand': preflight.get('applyCommand'),
    'blockers': blockers,
    'gitDirty': bool(git_status.strip())
}
print(json.dumps(result, indent=2))
PY
