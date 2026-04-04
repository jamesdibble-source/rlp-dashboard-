#!/bin/bash
# Emit a compact machine-readable runbook summary for the OpenLot scheduler rollout.
# Non-destructive: static guidance + command references only.

set -euo pipefail

cat <<'EOF'
{
  "recommendedOrder": [
    "npm run openlot:scheduler-go-no-go",
    "npm run openlot:scheduler-apply-packet",
    "npm run openlot:install-drip-crons -- --apply",
    "npm run openlot:check-drip-crons",
    "npm run openlot:remove-drip-crons -- --apply"
  ],
  "cycles": {
    "midday": "npm run openlot:drip:midday",
    "afternoon": "npm run openlot:drip:afternoon",
    "evening": "npm run openlot:drip:evening"
  },
  "logs": [
    "tmp/logs/openlot-midday-drip-YYYY-MM-DD.log",
    "tmp/logs/openlot-afternoon-drip-YYYY-MM-DD.log",
    "tmp/logs/openlot-evening-drip-YYYY-MM-DD.log"
  ],
  "coreHelpers": {
    "status": "npm run openlot:scheduler-status",
    "report": "npm run openlot:scheduler-report",
    "decision": "npm run openlot:scheduler-decision",
    "preflight": "npm run openlot:scheduler-preflight",
    "applyPacket": "npm run openlot:scheduler-apply-packet",
    "stackSmoke": "npm run openlot:scheduler-stack-smoke"
  }
}
EOF
