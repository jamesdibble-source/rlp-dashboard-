#!/bin/bash
# Emit a machine-readable diff between the current crontab and the proposed OpenLot drip install state.
# Non-destructive: reads current crontab and preview output only.

set -euo pipefail

source "$(dirname "$0")/scheduler-lib.sh"

ROOT="$(scheduler_root)"
PREVIEW_JSON="$(bash "${ROOT}/engine/preview-drip-crons-json.sh")"
CURRENT="$(scheduler_current_crontab)"

python3 - <<'PY' "$CURRENT" "$PREVIEW_JSON" "$ROOT"
import json, sys
current, preview_json, root = sys.argv[1:4]
preview = json.loads(preview_json)
current_lines = [line for line in current.splitlines() if line.strip()]
proposed_lines = [line for line in preview.get('resultingCrontab', []) if line.strip()]
managed_paths = [
    f"{root}/engine/openlot-midday-drip.sh",
    f"{root}/engine/openlot-afternoon-drip.sh",
    f"{root}/engine/openlot-evening-drip.sh",
]
managed_current = [line for line in current_lines if any(path in line for path in managed_paths)]
unmanaged_current = [line for line in current_lines if not any(path in line for path in managed_paths)]
missing = [line for line in proposed_lines if line not in current_lines]
extra_managed = [line for line in managed_current if line not in proposed_lines]
already_matching = [line for line in proposed_lines if line in current_lines]
print(json.dumps({
    'currentLineCount': len(current_lines),
    'proposedLineCount': len(proposed_lines),
    'managedCurrentLineCount': len(managed_current),
    'unmanagedCurrentLineCount': len(unmanaged_current),
    'missingManagedEntries': missing,
    'extraManagedEntries': extra_managed,
    'alreadyMatchingEntries': already_matching,
    'unmanagedCurrentEntries': unmanaged_current,
    'readyForCleanInstall': len(current_lines) == 0,
    'proposedManagedEntryCount': 3,
}, indent=2))
PY
