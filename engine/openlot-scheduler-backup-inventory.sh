#!/bin/bash
# Emit a machine-readable inventory of scheduler crontab backups with ready-to-run restore commands.
# Non-destructive: reads backup files only.

set -euo pipefail

source "$(dirname "$0")/scheduler-lib.sh"

BACKUP_DIR="$(scheduler_backup_dir)"

python3 - <<'PY' "$BACKUP_DIR"
import json, os, sys
backup_dir = sys.argv[1]
entries = []
if os.path.isdir(backup_dir):
    for name in sorted(os.listdir(backup_dir), reverse=True):
        path = os.path.join(backup_dir, name)
        if not os.path.isfile(path):
            continue
        try:
            with open(path, 'r', encoding='utf-8') as f:
                lines = [line.rstrip('\n') for line in f]
        except Exception:
            lines = []
        non_empty = [line for line in lines if line.strip()]
        kind = 'remove-backup' if name.startswith('crontab-remove-') else 'install-backup' if name.startswith('crontab-') else 'unknown'
        entries.append({
            'file': path,
            'name': name,
            'kind': kind,
            'lineCount': len(non_empty),
            'isEmptyCrontabBackup': len(non_empty) == 0,
            'previewRestoreCommand': f'npm run openlot:restore-crontab -- "{path}"',
            'applyRestoreCommand': f'npm run openlot:restore-crontab -- "{path}" --apply',
        })
summary = {
    'backupDir': backup_dir,
    'exists': os.path.isdir(backup_dir),
    'backupCount': len(entries),
    'latestBackup': entries[0]['file'] if entries else None,
    'entries': entries,
}
print(json.dumps(summary, indent=2))
PY
