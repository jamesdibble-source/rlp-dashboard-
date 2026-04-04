#!/bin/bash
# Emit a compact machine-readable manifest of scheduler handoff commands and artifacts.
# Non-destructive: combines existing helper outputs only.

set -euo pipefail

ROOT="/Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard"
INDEX_JSON="$(bash "${ROOT}/engine/openlot-scheduler-handoff-index.sh")"
APPLY_NOW_JSON="$(bash "${ROOT}/engine/openlot-scheduler-apply-now-card.sh")"

python3 - <<'PY' "$INDEX_JSON" "$APPLY_NOW_JSON"
import json, sys
index = json.loads(sys.argv[1])
apply_now = json.loads(sys.argv[2])
print(json.dumps({
    'artifacts': index.get('artifacts', {}),
    'allArtifactsPresent': index.get('allPresent'),
    'commands': {
        'releaseCard': 'npm run openlot:scheduler-release-card',
        'applyNowCard': 'npm run openlot:scheduler-apply-now-card',
        'operatorChecklist': 'npm run openlot:scheduler-operator-checklist',
        'installPreview': 'npm run openlot:scheduler-install-preview',
        'commandSheet': 'npm run openlot:scheduler-command-sheet',
        'handoffIndex': 'npm run openlot:scheduler-handoff-index',
        'apply': apply_now.get('applyCommand'),
        'rollback': apply_now.get('removeCommand'),
        'restoreTemplate': apply_now.get('restoreCommandTemplate'),
    },
    'proposedEntries': apply_now.get('entries', []),
}, indent=2))
PY
