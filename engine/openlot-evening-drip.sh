#!/bin/bash
# Small recurring wrapper for the evening OpenLot live drip cycle.
# Intended as a scheduler-safe entrypoint.

set +e

cd "$(dirname "$0")/.." || exit 1

DATE=$(date '+%Y-%m-%d')
LOG_DIR="./tmp/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/openlot-evening-drip-${DATE}.log"

echo "========================================" >> "$LOG_FILE"
echo "OPENLOT EVENING DRIP START $(date '+%Y-%m-%d %H:%M:%S %Z')" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"

npm run openlot:drip:evening -- --output ./tmp/openlot-live-drip-cycle-evening-script.json >> "$LOG_FILE" 2>&1
STATUS=$?

echo "OPENLOT EVENING DRIP END $(date '+%Y-%m-%d %H:%M:%S %Z') status=$STATUS" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

exit 0
