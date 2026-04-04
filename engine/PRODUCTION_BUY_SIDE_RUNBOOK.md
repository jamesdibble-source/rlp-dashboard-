# Production Buy-Side Runbook

## Official unattended entrypoint

Use this for the national buy-side production cycle in this workspace:

```bash
bash engine/production-buy-side-cycle.sh
```

Or via npm:

```bash
npm run ops:prod:buy-side
```

## What it does

1. resolves the repo root from the script location
2. runs `engine/migrate.js`
3. runs weekly `discover-fast.js` refresh on Sundays by default
4. drains the national `queue-runner.js` queue in repeated passes
5. runs `clean-data.js`
6. runs `build-v3.js`
7. deploys via Wrangler when a Cloudflare token file is present

## Why this is the official path

This replaces the old hard-coded `/root/.openclaw/...` assumption with a workspace-relative unattended path.

It also makes the buy-side ingest path queue-first:
- one official queue name
- one official source contract
- one wrapper that keeps running until the queue is drained or a pass limit is hit

## Defaults

- `states=VIC,NSW,QLD,WA,SA,TAS,NT,ACT`
- `sources=domain,rea`
- `mode=delta`
- `maxJobsPerPass=100`
- `maxPasses=500`
- weekly discovery refresh = `auto` (Sunday)

REA is requested by default, but `queue-runner.js` will skip it automatically if Apify credentials are not configured on the machine.

## Dry-run / verification

Non-destructive preview:

```bash
bash engine/production-buy-side-cycle.sh --dry-run
npm run ops:prod:buy-side:dry-run
```

## Common overrides

```bash
RLP_PROD_SOURCES=domain npm run ops:prod:buy-side
RLP_PROD_MODE=bulk RLP_PROD_MAX_JOBS_PER_PASS=200 npm run ops:prod:buy-side
RLP_PROD_RUN_DISCOVERY=false npm run ops:prod:buy-side
RLP_PROD_QUEUE_NAME=prod-national-buy-side-rebuild npm run ops:prod:buy-side
```

## Logs

Wrapper logs:
- `tmp/logs/production-buy-side-YYYY-MM-DD_HH-MM-SS.log`

Per-pass queue summaries:
- `tmp/logs/production-buy-side-summary-*-pass-*.json`

## Legacy fallback

The old split-source shell path is still available for debugging only:

```bash
npm run ops:daily:legacy
```

The old `engine/daily-scrape.sh` path is now just a compatibility shim to the official production buy-side wrapper.
