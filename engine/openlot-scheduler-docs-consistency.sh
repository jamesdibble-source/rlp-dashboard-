#!/bin/bash
# Verify that the compact scheduler matrix references npm commands that exist in package.json.
# Non-destructive: documentation consistency check only.

set -euo pipefail

ROOT="/Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard"
python3 - <<'PY' "${ROOT}/package.json" "${ROOT}/engine/OPENLOT_SCHEDULER_MATRIX.md"
import json, re, sys
pkg_path, matrix_path = sys.argv[1:3]
with open(pkg_path, 'r', encoding='utf-8') as f:
    pkg = json.load(f)
with open(matrix_path, 'r', encoding='utf-8') as f:
    matrix = f.read()
scripts = pkg.get('scripts', {})
cmds = re.findall(r'`npm run ([^`]+?)`', matrix)
missing = []
for cmd in cmds:
    base = cmd.split(' -- ')[0].strip()
    if base not in scripts:
      missing.append(cmd)
print(json.dumps({
    'matrixCommandCount': len(cmds),
    'missingCommands': missing,
    'allPresent': len(missing) == 0
}, indent=2))
PY
