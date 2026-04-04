#!/bin/bash
# Emit a compact machine-readable apply-now card combining readiness and exact next commands.
# Non-destructive: combines existing helpers only.

set -euo pipefail

ROOT="/Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard"
RELEASE_JSON="$(bash "${ROOT}/engine/openlot-scheduler-release-card.sh")"
APPLY_PACKET_JSON="$(bash "${ROOT}/engine/openlot-scheduler-apply-packet.sh")"
COMMAND_MAP_JSON="$(bash "${ROOT}/engine/openlot-scheduler-command-map.sh")"

python3 - <<'PY' "$RELEASE_JSON" "$APPLY_PACKET_JSON" "$COMMAND_MAP_JSON"
import json, sys
release = json.loads(sys.argv[1])
packet = json.loads(sys.argv[2])
cmdmap = json.loads(sys.argv[3])
print(json.dumps({
    'applyNow': bool(release.get('releaseReady')),
    'releaseReady': release.get('releaseReady'),
    'recommendedNextAction': release.get('recommendedNextAction'),
    'applyCommand': packet.get('applyCommand') or cmdmap.get('installApply'),
    'removeCommand': packet.get('removeCommand') or cmdmap.get('removeApply'),
    'restoreCommandTemplate': packet.get('restoreCommandTemplate') or cmdmap.get('restoreApply'),
    'entryStates': release.get('entryStates', {}),
    'crontabState': release.get('crontabState'),
    'entries': packet.get('entries', []),
}, indent=2))
PY
