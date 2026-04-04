#!/bin/bash
# Emit a compact machine-readable index of the scheduler rollout handoff artifacts.
# Non-destructive: reports file/script presence only.

set -euo pipefail

ROOT="/Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard"
python3 - <<'PY' "$ROOT"
import json, os, sys
root = sys.argv[1]
items = {
    'readyMarkdown': 'engine/OPENLOT_SCHEDULER_READY_TO_APPLY.md',
    'releaseCard': 'engine/openlot-scheduler-release-card.sh',
    'applyNowCard': 'engine/openlot-scheduler-apply-now-card.sh',
    'operatorChecklist': 'engine/openlot-scheduler-operator-checklist.sh',
    'installPreview': 'engine/openlot-scheduler-install-preview.sh',
    'commandSheet': 'engine/openlot-scheduler-command-sheet.sh',
}
out = {}
for key, rel in items.items():
    path = os.path.join(root, rel)
    out[key] = {'path': path, 'exists': os.path.exists(path)}
print(json.dumps({'artifacts': out, 'allPresent': all(v['exists'] for v in out.values())}, indent=2))
PY
