# OpenLot Scheduler Matrix

A compact matrix of the current scheduler toolchain.

## Decision + Inspection

- `npm run openlot:scheduler-help`
- `npm run openlot:scheduler-status`
- `npm run openlot:scheduler-audit`
- `npm run openlot:scheduler-report`
- `npm run openlot:scheduler-decision`
- `npm run openlot:scheduler-go-no-go`
- `npm run openlot:scheduler-stack-smoke`
- `npm run openlot:scheduler-consistency`

## Inventory + Maps

- `npm run openlot:scheduler-command-map`
- `npm run openlot:scheduler-ops-index`
- `npm run openlot:scheduler-categories`
- `npm run openlot:scheduler-install-diff`
- `npm run openlot:scheduler-backup-inventory`
- `npm run openlot:scheduler-runbook-json`
- `npm run openlot:scheduler-docs-consistency`
- `npm run openlot:scheduler-surface-summary`
- `npm run openlot:scheduler-coverage-check`
- `npm run openlot:scheduler-release-card`
- `npm run openlot:scheduler-apply-now-card`
- `npm run openlot:scheduler-operator-checklist`
- `npm run openlot:scheduler-install-preview`
- `npm run openlot:scheduler-command-sheet`

## Preview

- `npm run openlot:print-midday-cron`
- `npm run openlot:print-all-drip-crons`
- `npm run openlot:preview-drip-crons-json`
- `npm run openlot:preview-drip-crons-remove-json`
- `npm run openlot:scheduler-preflight`
- `npm run openlot:scheduler-apply-packet`

## Apply / Remove / Restore

- `npm run openlot:install-drip-crons`
- `npm run openlot:install-drip-crons -- --apply`
- `npm run openlot:remove-drip-crons`
- `npm run openlot:remove-drip-crons -- --apply`
- `npm run openlot:restore-crontab -- <backup-file>`
- `npm run openlot:restore-crontab -- <backup-file> --apply`

## Cycle Entry Points

- `bash engine/openlot-midday-drip.sh`
- `bash engine/openlot-afternoon-drip.sh`
- `bash engine/openlot-evening-drip.sh`
- `npm run openlot:drip:midday`
- `npm run openlot:drip:afternoon`
- `npm run openlot:drip:evening`

## Recommended Order

1. `npm run openlot:scheduler-go-no-go`
2. `npm run openlot:scheduler-apply-packet`
3. `npm run openlot:install-drip-crons -- --apply`
4. `npm run openlot:check-drip-crons`
5. if needed: `npm run openlot:remove-drip-crons -- --apply`
