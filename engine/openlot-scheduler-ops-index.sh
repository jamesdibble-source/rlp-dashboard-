#!/bin/bash
# Emit a compact machine-readable index of the current scheduler helper inventory.
# Non-destructive: inspects package.json scripts only.

set -euo pipefail

ROOT="/Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard"
python3 - <<'PY' "${ROOT}/package.json"
import json, sys
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    pkg = json.load(f)
scripts = pkg.get('scripts', {})
index = {k: v for k, v in scripts.items() if k.startswith('openlot:') and 'scheduler' in k or k in {
    'openlot:print-midday-cron',
    'openlot:print-all-drip-crons',
    'openlot:check-drip-crons',
    'openlot:install-drip-crons',
    'openlot:preview-drip-crons-json',
    'openlot:preview-drip-crons-remove-json',
    'openlot:remove-drip-crons',
    'openlot:restore-crontab',
    'openlot:drip:midday',
    'openlot:drip:afternoon',
    'openlot:drip:evening'
}}
print(json.dumps({
    'count': len(index),
    'scripts': index
}, indent=2, sort_keys=True))
PY
