#!/bin/bash
# Small recurring wrapper for the afternoon OpenLot live drip cycle.
# Intended as a scheduler-safe entrypoint.

set +e

cd "$(dirname "$0")/.." || exit 1

DATE=$(date '+%Y-%m-%d')
LOG_DIR="./tmp/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/openlot-afternoon-drip-${DATE}.log"

echo "==========================================" >> "$LOG_FILE"
echo "OPENLOT AFTERNOON DRIP START $(date '+%Y-%m-%d %H:%M:%S %Z')" >> "$LOG_FILE"
echo "==========================================" >> "$LOG_FILE"

npm run openlot:drip:afternoon -- --output ./tmp/openlot-live-drip-cycle-afternoon-script.json >> "$LOG_FILE" 2>&1
STATUS=$?

echo "OPENLOT AFTERNOON DRIP END $(date '+%Y-%m-%d %H:%M:%S %Z') status=$STATUS" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

exit 0
