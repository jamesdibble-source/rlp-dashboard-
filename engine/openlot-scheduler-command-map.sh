#!/bin/bash
# Emit a machine-readable map of the key OpenLot scheduler commands.
# Non-destructive documentation helper.

set -euo pipefail

cat <<'EOF'
{
  "readiness": "npm run openlot:scheduler-status",
  "help": "npm run openlot:scheduler-help",
  "audit": "npm run openlot:scheduler-audit",
  "report": "npm run openlot:scheduler-report",
  "decision": "npm run openlot:scheduler-decision",
  "printCronText": "npm run openlot:print-all-drip-crons",
  "previewInstallJson": "npm run openlot:preview-drip-crons-json",
  "previewRemoveJson": "npm run openlot:preview-drip-crons-remove-json",
  "installDryRun": "npm run openlot:install-drip-crons",
  "installApply": "npm run openlot:install-drip-crons -- --apply",
  "removeDryRun": "npm run openlot:remove-drip-crons",
  "removeApply": "npm run openlot:remove-drip-crons -- --apply",
  "restoreDryRun": "npm run openlot:restore-crontab -- <backup-file>",
  "restoreApply": "npm run openlot:restore-crontab -- <backup-file> --apply"
}
EOF
