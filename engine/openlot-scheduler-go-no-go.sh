#!/bin/bash
# Print a compact human-readable go/no-go card for the scheduler rollout.
# Non-destructive: wraps the preflight helper only.

set -euo pipefail

ROOT="/Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard"
PREFLIGHT_JSON="$(bash "${ROOT}/engine/openlot-scheduler-preflight.sh")"

python3 - <<'PY' "$PREFLIGHT_JSON"
import json, sys
p = json.loads(sys.argv[1])
checks = p.get('checks', {})
print('OpenLot scheduler go/no-go')
print('')
for key in ['crontabEmpty','entriesMissing','helpersExecutable','consistencyMatch','previewHasThreeLines']:
    print(f"{key}: {str(bool(checks.get(key))).lower()}")
print('')
if p.get('readyToApply'):
    print('GO')
    print(f"Apply command: {p.get('applyCommand')}")
else:
    print('NO_GO')
    print('Review preflight before applying.')
PY
