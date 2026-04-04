# OpenLot Scheduler — Handoff Manifest

## Status

- **Release ready:** yes
- **Coverage complete:** yes
- **Current crontab state:** empty
- **Apply command:** `npm run openlot:install-drip-crons -- --apply`
- **Rollback command:** `npm run openlot:remove-drip-crons -- --apply`
- **Restore template:** `npm run openlot:restore-crontab -- <backup-file> --apply`

## Core Handoff Commands

- `npm run openlot:scheduler-release-card`
- `npm run openlot:scheduler-apply-now-card`
- `npm run openlot:scheduler-operator-checklist`
- `npm run openlot:scheduler-install-preview`
- `npm run openlot:scheduler-command-sheet`
- `npm run openlot:scheduler-handoff-index`
- `npm run openlot:scheduler-handoff-manifest`

## Handoff Artifacts

- `engine/OPENLOT_SCHEDULER_READY_TO_APPLY.md`
- `engine/openlot-scheduler-release-card.sh`
- `engine/openlot-scheduler-apply-now-card.sh`
- `engine/openlot-scheduler-operator-checklist.sh`
- `engine/openlot-scheduler-install-preview.sh`
- `engine/openlot-scheduler-command-sheet.sh`
- `engine/openlot-scheduler-handoff-index.sh`
- `engine/openlot-scheduler-handoff-manifest.sh`

## Proposed Cron Entries

```cron
15 13 * * * bash /Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard/engine/openlot-midday-drip.sh
30 15 * * * bash /Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard/engine/openlot-afternoon-drip.sh
45 18 * * * bash /Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard/engine/openlot-evening-drip.sh
```
