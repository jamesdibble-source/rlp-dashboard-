#!/bin/bash
# Print a concise scheduler operations cheat sheet for the OpenLot drip cadence.
# Non-destructive: documentation helper only.

set -euo pipefail

cat <<'EOF'
OpenLot scheduler operations

Check current scheduler state:
  npm run openlot:scheduler-status
  npm run openlot:check-drip-crons

Preview proposed cron install:
  npm run openlot:print-all-drip-crons
  npm run openlot:install-drip-crons

Apply proposed cron install:
  npm run openlot:install-drip-crons -- --apply

Preview removal:
  npm run openlot:remove-drip-crons

Restore from backup:
  bash engine/restore-crontab-backup.sh <backup-file>
  bash engine/restore-crontab-backup.sh <backup-file> --apply

Cycle entrypoints:
  bash engine/openlot-midday-drip.sh
  bash engine/openlot-afternoon-drip.sh
  bash engine/openlot-evening-drip.sh

Logs:
  tmp/logs/openlot-midday-drip-YYYY-MM-DD.log
  tmp/logs/openlot-afternoon-drip-YYYY-MM-DD.log
  tmp/logs/openlot-evening-drip-YYYY-MM-DD.log
EOF
