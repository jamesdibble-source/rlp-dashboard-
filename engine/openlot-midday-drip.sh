#!/bin/bash
# Small recurring wrapper for the initial midday OpenLot live drip cycle.
# Intended as a scheduler-safe entrypoint.

set +e

cd "$(dirname "$0")/.." || exit 1

DATE=$(date '+%Y-%m-%d')
LOG_DIR="./tmp/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/openlot-midday-drip-${DATE}.log"

echo "==========================================" >> "$LOG_FILE"
echo "OPENLOT MIDDAY DRIP START $(date '+%Y-%m-%d %H:%M:%S %Z')" >> "$LOG_FILE"
echo "==========================================" >> "$LOG_FILE"

npm run openlot:drip:midday -- --output ./tmp/openlot-live-drip-cycle-midday-script.json >> "$LOG_FILE" 2>&1
STATUS=$?

echo "OPENLOT MIDDAY DRIP END $(date '+%Y-%m-%d %H:%M:%S %Z') status=$STATUS" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

exit 0
