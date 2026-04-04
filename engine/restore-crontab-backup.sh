#!/bin/bash
# Restore crontab from a saved backup file.
# Safety: defaults to dry-run unless --apply is passed.

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: bash engine/restore-crontab-backup.sh <backup-file> [--apply]" >&2
  exit 1
fi

BACKUP_FILE="$1"
MODE="dry-run"
if [ "${2:-}" = "--apply" ]; then
  MODE="apply"
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

echo "Mode: $MODE"
echo "Backup file: $BACKUP_FILE"
echo ""
echo "Backup contents:"
cat "$BACKUP_FILE"

if [ "$MODE" = "apply" ]; then
  cat "$BACKUP_FILE" | crontab -
  echo ""
  echo "Crontab restored."
else
  echo ""
  echo "Dry-run only. Re-run with --apply to restore."
fi
