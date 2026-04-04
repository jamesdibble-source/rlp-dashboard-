#!/bin/bash
# Print the exact cron entries and install command for the initial OpenLot drip cadence.
# Non-destructive: prints guidance only and does not modify crontab.

set -euo pipefail

ROOT="/Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard"
MIDDAY="15 13 * * * bash ${ROOT}/engine/openlot-midday-drip.sh"
AFTERNOON="30 15 * * * bash ${ROOT}/engine/openlot-afternoon-drip.sh"
EVENING="45 18 * * * bash ${ROOT}/engine/openlot-evening-drip.sh"

echo "Suggested cron entries:"
echo "$MIDDAY"
echo "$AFTERNOON"
echo "$EVENING"
echo ""
echo "To install manually, run:"
echo "(crontab -l 2>/dev/null; echo \"$MIDDAY\"; echo \"$AFTERNOON\"; echo \"$EVENING\") | crontab -"
