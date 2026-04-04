# System Map — RLP Dashboard

This is the fastest orientation map for a new coding session.

## 1. UI / retail lot price HTML interface
### Public URL
- `https://rlp-dashboard.pages.dev`

### Main UI / build files
- `dashboard-template-v4.html` — main dashboard HTML/template layer
- `build-v3.js` — builds/injects data into the HTML/dashboard output
- `stitch-design.html` — design/reference artifact
- `RLP-HANDOVER-SCOUT.md` — prior dashboard/project handover context

### Edit here if you want to change
- HTML structure
- display layout
- rendered dashboard output
- page-level interface behavior driven by built data

---

## 2. Scraper/runtime/data pipeline
### Main orchestration files
- `engine/queue-runner.js` — national queue executor
- `engine/scrape-sources.js` — per-suburb multi-source contract
- `engine/production-buy-side-cycle.sh` — official unattended production wrapper

### Source implementations
- `engine/scrapers/rea-apify.js` — REA via Apify actor path
- `engine/scrapers/openlot-public.js` — OpenLot first-class live source entrypoint
- Domain scraper code in `engine/` source stack / shared runtime path

### Shared normalization / filtering
- `engine/lib/land-filter.js`
- `engine/lib/dedup-js.js`

### DB / cleaning
- `engine/db.js`
- `engine/clean-data.js`
- `engine/data/lots.db`

### Discovery / suburb universe
- `engine/data/active-suburbs-*.json`

### Edit here if you want to change
- scraping logic
- queue behavior
- source combinations
- retries/timeouts/pagination
- DB writes / dedup
- production ingestion flow

---

## 3. OpenLot-specific live browser stack
These files matter most for remaining OpenLot hardening.

- `engine/scrapers/openlot-public.js`
- `engine/openlot-browser-tool-live-runner.js`
- `engine/openlot-browser-act-plan.js`
- `engine/openlot-browser-a2ui-plan.js`
- `engine/openlot-browser-a2ui-runner.js`
- `engine/openlot-live-combined-suburb-job.js`
- `engine/openlot-live-combined-batch.js`
- `engine/openlot-live-drip-cycle.js`

### Edit here if you want to change
- browser interaction resilience
- suburb suggestion selection
- Search enablement
- post-search persistence/results extraction
- first-class OpenLot queue behavior

---

## 4. Ops / runbooks / cutover
### Main docs
- `HANDOVER.md` — full current-state handover
- `EXECUTIVE_HANDOVER.md` — short version
- `RLP-PIPELINE-OPS.md` — operational runbook
- `engine/PRODUCTION_BUY_SIDE_RUNBOOK.md` — official production wrapper runbook

### Scheduler / cutover helpers
- `engine/openlot-production-cutover-plan.sh`
- `engine/OPENLOT_SCHEDULER_READY_TO_APPLY.md`
- `engine/OPENLOT_SCHEDULER_HANDOFF_MANIFEST.md`
- scheduler helper scripts in `engine/openlot-scheduler-*.sh`

### Edit here if you want to change
- recurring ops
- cutover plan
- cron install/remove/restore behavior
- operator-facing docs

---

## 5. Deploy
### Production wrapper handles build/deploy path
- `engine/production-buy-side-cycle.sh`

### Build/output path
- `build-v3.js`
- deployed to `https://rlp-dashboard.pages.dev`

### Credentials
Repo-local preferred:
- `credentials/apify-token.txt`
- `credentials/cloudflare-token.txt`

---

## 6. Best place for a new coding agent to start
If the goal is final production readiness:
1. Read `EXECUTIVE_HANDOVER.md`
2. Read `HANDOVER.md`
3. Read `RLP-PIPELINE-OPS.md`
4. Inspect:
   - `engine/production-buy-side-cycle.sh`
   - `engine/queue-runner.js`
   - `engine/scrapers/rea-apify.js`
   - `engine/scrapers/openlot-public.js`
   - `engine/openlot-browser-a2ui-runner.js`

## 7. Main remaining frontier
- OpenLot broader positive-result validation
- OpenLot browser/runtime hardening
- final recurring production cutover
