#!/bin/bash
# Emit a compact machine-readable summary of the scheduler command/documentation surface.
# Non-destructive: combines existing helper outputs only.

set -euo pipefail

ROOT="/Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard"
OPS_INDEX_JSON="$(bash "${ROOT}/engine/openlot-scheduler-ops-index.sh")"
CATEGORIES_JSON="$(bash "${ROOT}/engine/openlot-scheduler-categories.sh")"
DOCS_JSON="$(bash "${ROOT}/engine/openlot-scheduler-docs-consistency.sh")"

python3 - <<'PY' "$OPS_INDEX_JSON" "$CATEGORIES_JSON" "$DOCS_JSON"
import json, sys
ops = json.loads(sys.argv[1])
cats = json.loads(sys.argv[2])
docs = json.loads(sys.argv[3])
summary = {
    'opsIndexCount': ops.get('count'),
    'categorizedCount': cats.get('totalCount'),
    'matrixCommandCount': docs.get('matrixCommandCount'),
    'matrixCommandsAllPresent': docs.get('allPresent'),
    'uncategorizedScriptCount': (ops.get('count') or 0) - (cats.get('totalCount') or 0),
    'categoryCounts': cats.get('categoryCounts', {}),
}
print(json.dumps(summary, indent=2))
PY
