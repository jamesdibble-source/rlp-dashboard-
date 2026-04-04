#!/bin/bash
# Print the exact cron entry and install command for the first OpenLot midday drip cycle.
# This is non-destructive: it prints guidance only and does not modify crontab.

set -euo pipefail

ROOT="/Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard"
ENTRY="15 13 * * * bash ${ROOT}/engine/openlot-midday-drip.sh"

echo "Suggested cron entry:"
echo "$ENTRY"
echo ""
echo "To install manually, run:"
echo "(crontab -l 2>/dev/null; echo \"$ENTRY\") | crontab -"
