# OpenLot Scheduler — Ready to Apply

## Current Verdict

- **Release ready:** yes
- **Coverage complete:** yes
- **Current crontab state:** empty
- **Recommended next action:** `npm run openlot:install-drip-crons -- --apply`

## Exact Apply Command

```bash
npm run openlot:install-drip-crons -- --apply
```

## Exact Rollback Command

```bash
npm run openlot:remove-drip-crons -- --apply
```

## Exact Restore Command Template

```bash
npm run openlot:restore-crontab -- <backup-file> --apply
```

## Proposed Cron Entries

```cron
15 13 * * * bash /Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard/engine/openlot-midday-drip.sh
30 15 * * * bash /Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard/engine/openlot-afternoon-drip.sh
45 18 * * * bash /Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard/engine/openlot-evening-drip.sh
```

## Current Backup Inventory

- `crontab-remove-2026-04-03_18-01-38.txt`
- `crontab-2026-04-03_17-59-22.txt`

Both saved backups represent the clean empty-crontab baseline.
