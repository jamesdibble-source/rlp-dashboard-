#!/bin/bash
# Print a compact end-to-end scheduler report by combining readiness + audit findings.
# Non-destructive: reads state only.

set -euo pipefail

ROOT="/Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard"
STATUS_JSON="$(bash "${ROOT}/engine/openlot-scheduler-status.sh")"
AUDIT_JSON="$(bash "${ROOT}/engine/openlot-scheduler-audit.sh")"

python3 - <<'PY' "$STATUS_JSON" "$AUDIT_JSON"
import json, sys
status = json.loads(sys.argv[1])
audit = json.loads(sys.argv[2])
summary = {
    "crontabState": status.get("crontabState"),
    "entries": status.get("entries", {}),
    "backupCount": audit.get("backupCount"),
    "latestBackup": audit.get("latestBackup"),
    "helperCount": len(audit.get("helpers", [])),
    "allHelpersExecutable": all(h.get("exists") and h.get("executable") for h in audit.get("helpers", [])),
    "recommendedNextAction": (
        status.get("recommendedInstallCommand")
        if status.get("crontabState") == "empty"
        else status.get("recommendedCheckCommand")
    )
}
print(json.dumps(summary, indent=2))
PY
