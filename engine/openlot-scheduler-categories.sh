#!/bin/bash
# Emit a machine-readable categorized view of the scheduler command surface.
# Non-destructive: inspects package.json scripts only.

set -euo pipefail

ROOT="/Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard"
python3 - <<'PY' "${ROOT}/package.json"
import json, sys
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    pkg = json.load(f)
scripts = pkg.get('scripts', {})
category_sets = {
    'cycles': ['openlot:drip:midday', 'openlot:drip:afternoon', 'openlot:drip:evening'],
    'inventory_and_maps': ['openlot:scheduler-command-map', 'openlot:scheduler-ops-index', 'openlot:scheduler-categories', 'openlot:scheduler-install-diff', 'openlot:scheduler-backup-inventory', 'openlot:scheduler-runbook-json', 'openlot:scheduler-docs-consistency', 'openlot:scheduler-surface-summary', 'openlot:scheduler-coverage-check', 'openlot:scheduler-release-card', 'openlot:scheduler-apply-now-card', 'openlot:scheduler-operator-checklist', 'openlot:scheduler-install-preview', 'openlot:scheduler-command-sheet'],
    'print_and_check': ['openlot:print-midday-cron', 'openlot:print-all-drip-crons', 'openlot:check-drip-crons', 'openlot:scheduler-status', 'openlot:scheduler-help', 'openlot:scheduler-audit', 'openlot:scheduler-report', 'openlot:scheduler-decision', 'openlot:scheduler-go-no-go', 'openlot:scheduler-stack-smoke', 'openlot:scheduler-consistency'],
    'preview': ['openlot:preview-drip-crons-json', 'openlot:preview-drip-crons-remove-json', 'openlot:scheduler-preflight', 'openlot:scheduler-apply-packet'],
    'mutation_and_rollback': ['openlot:install-drip-crons', 'openlot:remove-drip-crons', 'openlot:restore-crontab'],
}
out = {}
for category, keys in category_sets.items():
    out[category] = {k: scripts[k] for k in keys if k in scripts}
print(json.dumps({
    'categories': out,
    'categoryCounts': {k: len(v) for k, v in out.items()},
    'totalCount': sum(len(v) for v in out.values())
}, indent=2, sort_keys=True))
PY
