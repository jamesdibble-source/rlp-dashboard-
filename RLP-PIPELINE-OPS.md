# RLP Pipeline Operations

## Purpose
This document defines the **production operating model** for the current RLP land pipeline.

It reflects the code that exists today:
- `engine/queue-runner.js` = national queue executor
- `engine/scrape-sources.js` = suburb-level multi-source orchestrator
- `engine/daily-scrape.sh` = legacy daily shell pipeline
- `engine/scrape-discovered.js` / `engine/scrape-rea.js` = legacy per-source runners still available during transition

The current architecture should be treated as a **combined queue flow**:
1. discover active suburbs
2. build / resume a national queue
3. run one suburb job at a time
4. scrape one or more sources under the same job contract
5. deduplicate to one combined lot set
6. upsert into SQLite
7. record run metadata in `scrape_runs`

---

## Production default

### Official unattended production entrypoint
Use:
```bash
bash engine/production-buy-side-cycle.sh
```

Or via npm:
```bash
npm run ops:prod:buy-side
```

This is now the official national buy-side production path for this workspace.
It is machine-correct for the current repo because it:
- resolves the repo root relative to the script itself
- avoids the old `/root/.openclaw/...` assumption
- runs the queue-first buy-side path in repeated passes until the queue is drained or a pass cap is reached
- runs clean/build/deploy after the buy-side queue cycle
- keeps the old split-source shell flow only as a legacy fallback

A dry-run preview is available via:
```bash
bash engine/production-buy-side-cycle.sh --dry-run
npm run ops:prod:buy-side:dry-run
```

See also:
- `engine/PRODUCTION_BUY_SIDE_RUNBOOK.md`

### Default production source mix
Use:
- **Domain** as the default production source
- **OpenLot** when browser capture/parser support is available for the target run
- **REA** as an optional second/third source when Apify credentials and budget are available

Current validation status:
- **Domain + REA** has now been proven live through the queue path on this machine
- **Domain + OpenLot + REA** has now also been proven live through the same queue path for targeted Tarneit validation

### Default production mode
Use:
- **mode=`delta`** for daily refreshes
- **mode=`bulk`** for initial backfills / rebuilds
- **mode=`test`** for smoke tests only

### Default land filter
Use the shared land filter defaults unless a run explicitly overrides them:
- land only
- `minLandSize=0`
- `maxLandSize=2000`
- price sanity bounds from shared filter / runtime env

Broader market sweeps can use:
- `maxLandSize=4000`

---

## Runtime model

## 1) Source orchestration layer
`engine/scrape-sources.js`

This is the **single suburb job contract**.

It accepts:
- a suburb target
- shared land filters
- a source list
- a mode-derived page limit
- optional REA/OpenLot runtime controls

It then:
- runs each source in sequence
- captures source-level success/error status
- deduplicates the combined lot list
- returns both per-source and combined summaries

### Supported source names
- `domain`
- `openlot`
- `rea`

### Mode to page-depth behaviour
- `test` → `maxPages=1`
- `delta` → `maxPages=3`
- `bulk` → `maxPages=999` unless explicitly overridden

---

## 2) Queue execution layer
`engine/queue-runner.js`

This is the **production batch runner**.

It:
- loads `active-suburbs-<state>.json`
- builds a queue ordered by mode
- resumes from `engine/data/queue-progress/<queueName>.json`
- processes a bounded number of jobs per invocation
- writes combined lots to DB
- records a combined scrape run tagged like `queue-domain+rea`

### Queue ordering
- `bulk` = highest listing count first
- other modes = suburb alphabetical

### Queue state
Progress is stored in:
- `engine/data/queue-progress/*.json`

This makes the queue runner safe for:
- cron
- repeated invocations
- partial reruns after failures

---

## Default commands

## Smoke test one suburb
```bash
node engine/scrape-sources.js --suburb Tarneit --state VIC --postcode 3029 --sources domain --mode test
```

## Smoke test one suburb with Domain + REA through queue-runner
```bash
node engine/queue-runner.js \
  --states VIC \
  --suburb Tarneit \
  --state VIC \
  --postcode 3029 \
  --sources domain,rea \
  --mode test \
  --maxJobs 1 \
  --queueName targeted-test-domain-rea
```

## Smoke test one suburb with Domain + OpenLot + REA through queue-runner
```bash
node engine/queue-runner.js \
  --states VIC \
  --suburb Tarneit \
  --state VIC \
  --postcode 3029 \
  --sources domain,openlot,rea \
  --mode test \
  --maxJobs 1 \
  --queueName targeted-test-domain-openlot-rea \
  --openlotBrowserResultsManifest ./tmp/openlot-payloads-cli/manifest.json
```

## Daily delta run for one suburb with Domain + REA
```bash
node engine/scrape-sources.js \
  --suburb Tarneit \
  --state VIC \
  --postcode 3029 \
  --sources domain,rea \
  --mode delta
```

## National daily delta queue, Domain only
```bash
node engine/queue-runner.js \
  --states VIC,NSW,QLD,WA,SA,TAS,NT,ACT \
  --sources domain \
  --mode delta \
  --maxJobs 50 \
  --queueName national-delta-domain
```

## National daily delta queue, Domain + REA
```bash
node engine/queue-runner.js \
  --states VIC,NSW,QLD,WA,SA \
  --sources domain,rea \
  --mode delta \
  --maxJobs 50 \
  --reaMaxListings 1000 \
  --queueName national-delta-domain-rea
```

## Broader land-size queue (0-4000m²)
```bash
RLP_MAX_LAND_SIZE=4000 node engine/queue-runner.js \
  --states VIC,NSW,QLD,WA,SA \
  --sources domain \
  --mode delta \
  --maxJobs 50 \
  --queueName national-delta-domain-4k
```

## Bulk backfill queue
```bash
node engine/queue-runner.js \
  --states VIC,NSW,QLD,WA,SA,TAS,NT,ACT \
  --sources domain,rea \
  --mode bulk \
  --maxJobs 200 \
  --queueName national-bulk-domain-rea
```

---

## Source combinations

## 1) `domain`
Use when:
- running the cheapest, safest default daily refresh
- validating queue mechanics
- recovering from REA token or OpenLot parser issues

Operational note:
- this is the best current default because it has the least external dependency overhead

## 2) `domain,rea`
Use when:
- production daily runs need broader portal coverage
- Apify token is available
- you want combined deduped lots under one queue job

Operational note:
- this is the main migration target from the old split Domain/REA shell flow
- this path is now validated live on this machine with Tarneit VIC 3029 in `mode=test`, returning Domain `41`, REA `18`, and canonical combined `50`

## 3) `domain,openlot`
Use when:
- OpenLot browser capture/parsing support is wired for the target market
- you want estate-style lots that portals may miss

Operational note:
- queue runner now supports both a single-file OpenLot browser-payload path using `--openlotBrowserResultsFile` plus `--openlotBrowserResultKey`, and a directory-based path using `--openlotBrowserResultsDir`
- targeted queue runs can also be scoped with `--suburb --state --postcode`
- directory mode expects JSON filenames keyed by suburb job id, e.g. `VIC:Tarneit:3029.json`
- `engine/scrapers/openlot-browser-runner.js` now exposes `buildTargetKey()` and `saveBrowserPayload()` so browser-captured payloads can be written to the same queue-ingest naming convention automatically
- this makes OpenLot operable in production-style targeted runs, but a broader payload-generation process is still needed before making it a default national source

## 4) `domain,openlot,rea`
Use when:
- doing full-coverage runs
- validating multi-source dedup quality
- running controlled higher-cost backfills

Operational note:
- use this as an explicit full-coverage mode, not the default cron path
- this path is now validated live on this machine with Tarneit VIC 3029 in `mode=test`, returning Domain `41`, OpenLot `10`, REA `18`, and canonical combined `60`

---

## Filters and overrides

Shared land filter overrides can be passed via CLI or env-backed config:
- `--minLandSize`
- `--maxLandSize`
- `--minPrice`
- `--maxPrice`
- `RLP_MIN_LAND_SIZE`
- `RLP_MAX_LAND_SIZE`
- `RLP_MIN_PRICE`
- `RLP_MAX_PRICE`

### Production default band
```bash
RLP_MIN_LAND_SIZE=0
RLP_MAX_LAND_SIZE=2000
```

### Optional broader band
```bash
RLP_MIN_LAND_SIZE=0
RLP_MAX_LAND_SIZE=4000
```

---

## Migration: legacy REA flow → combined queue flow

## Legacy pattern
The old production shell flow in `engine/daily-scrape.sh` runs separate stages:
1. Domain buy via `scrape-discovered.js`
2. Domain sold via `scrape-sold.js`
3. REA buy via `scrape-rea.js`
4. REA sold via `scrape-rea.js`
5. clean, build, deploy

This works, but has operating drawbacks:
- source runs are split across separate scripts and progress files
- Domain and REA do not share one suburb-level job record
- dedup happens later instead of at the job contract boundary
- daily ops are harder to reason about when one source partially fails
- the shell pipeline reflects a source-centric architecture, not a queue-centric architecture

## Combined queue target state
The new production model should be:
1. keep discovery as a separate refresh concern
2. run a queue of active suburbs
3. execute all required sources inside one suburb job
4. dedup immediately into one combined result
5. write one combined job outcome to DB / progress state
6. clean, build, deploy after queue completion

## What stays legacy for now
These scripts still matter during transition:
- `engine/scrape-discovered.js`
- `engine/scrape-rea.js`
- `engine/scrape-sold.js`
- `engine/daily-scrape.sh`

They remain useful for:
- source-specific debugging
- sold-history collection
- fallback operation if queue flow needs isolating by source

## Recommended migration sequence

### Stage 1 — now
Treat `queue-runner.js` + `scrape-sources.js` as the primary **buy-side listing ingest path**.

### Stage 2
Refactor daily ops so the shell script calls queue-runner for buy-side ingest instead of calling Domain and REA separately.

Status:
- done for the official unattended buy-side path via `engine/production-buy-side-cycle.sh`
- `engine/daily-scrape.sh` is now a compatibility shim to that wrapper
- the original split-source behavior remains preserved in `engine/daily-scrape-legacy.sh`

### Stage 3
Keep sold ingestion as a distinct historical enrichment path until it is folded into the same queue/job model.

### Stage 4
Retire the old split buy-side scripts once queue-runner coverage is proven stable.

---

## Proposed production cron model

## Daily buy-side delta
Run multiple invocations until queue drains, for example:
```bash
node engine/queue-runner.js \
  --states VIC,NSW,QLD,WA,SA,TAS,NT,ACT \
  --sources domain,rea \
  --mode delta \
  --maxJobs 100 \
  --queueName national-daily-delta
```

## Targeted OpenLot suburb ingest from captured browser payload
Use this when browser capture has already produced a suburb payload file and you want to ingest it through the same queue/DB contract.

### Single payload file
```bash
node engine/queue-runner.js \
  --states VIC \
  --suburb Tarneit \
  --state VIC \
  --postcode 3029 \
  --sources openlot \
  --mode test \
  --maxJobs 1 \
  --queueName targeted-openlot-tarneit \
  --openlotBrowserResultsFile ./tmp/openlot-live-tarneit.json \
  --openlotBrowserResultKey 'VIC:Tarneit:3029'
```

### Payload directory
```bash
mkdir -p ./tmp/openlot-payloads
cp ./tmp/openlot-live-tarneit.json './tmp/openlot-payloads/VIC:Tarneit:3029.json'

node engine/queue-runner.js \
  --states VIC \
  --suburb Tarneit \
  --state VIC \
  --postcode 3029 \
  --sources openlot \
  --mode test \
  --maxJobs 1 \
  --queueName targeted-openlot-tarneit-dir \
  --openlotBrowserResultsDir ./tmp/openlot-payloads
```

### Canonical payload naming helper
For browser-driven capture code, derive the storage key/filename using the shared helper in `engine/scrapers/openlot-browser-runner.js`:
```js
const { saveBrowserPayload } = require('./engine/scrapers/openlot-browser-runner');
const result = saveBrowserPayload(payload, { suburb: 'Tarneit', state: 'VIC', postcode: '3029' }, './tmp/openlot-payloads');
// result.key => 'VIC:Tarneit:3029'
// result.filePath => './tmp/openlot-payloads/VIC:Tarneit:3029.json'
```

### CLI helper for capture-to-queue handoff
A production operator can also store a captured payload into the canonical directory structure without writing ad hoc JS:
```bash
node engine/save-openlot-payload.js \
  --input ./tmp/openlot-live-tarneit.json \
  --dir ./tmp/openlot-payloads-cli \
  --suburb Tarneit \
  --state VIC \
  --postcode 3029
```

Then ingest it through queue-runner:
```bash
node engine/queue-runner.js \
  --states VIC \
  --suburb Tarneit \
  --state VIC \
  --postcode 3029 \
  --sources openlot \
  --mode test \
  --maxJobs 1 \
  --queueName targeted-openlot-cli-save \
  --openlotBrowserResultsDir ./tmp/openlot-payloads-cli
```

### Raw browser rows -> canonical payload bridge
If browser automation yields a raw JSON object containing `rows`, you can normalize and save it in one step:
```bash
node engine/normalize-openlot-browser-result.js \
  --input ./tmp/openlot-raw-browser-rows-tarneit.json \
  --dir ./tmp/openlot-payloads-normalized \
  --suburb Tarneit \
  --state VIC \
  --postcode 3029
```

Then ingest it through queue-runner:
```bash
node engine/queue-runner.js \
  --states VIC \
  --suburb Tarneit \
  --state VIC \
  --postcode 3029 \
  --sources openlot \
  --mode test \
  --maxJobs 1 \
  --queueName targeted-openlot-normalize-bridge \
  --openlotBrowserResultsDir ./tmp/openlot-payloads-normalized
```

### Save raw browser output into the batch-prep input directory
If browser automation already produced a raw OpenLot browser-result JSON file containing `rows`, save it into the canonical raw-batch directory first:

```bash
node engine/save-openlot-raw-browser-result.js \
  --input ./tmp/openlot-raw-browser-rows-tarneit.json \
  --dir ./tmp/openlot-raw-batch \
  --suburb Tarneit \
  --state VIC \
  --postcode 3029
```

This writes a raw batch file like:
- `./tmp/openlot-raw-batch/VIC:Tarneit:3029.json`

### Browser-tool export runner
If you want a browser-automation/operator handoff object that already contains the browser-side extractor JS plus the exact follow-up pipeline command, use:

```bash
node engine/openlot-browser-tool-export-runner.js \
  --suburb Tarneit \
  --state VIC \
  --postcode 3029
```

This returns:
- the canonical target key
- the canonical raw export file path
- the browser-side extractor JS to run on the results page
- the exact `openlot-browser-export-pipeline.js` command to run after saving that raw JSON export

If you want one operator bundle that contains the extractor JS plus the exact save/ingest commands and canonical paths for a live run, use:

```bash
node engine/openlot-live-browser-capture-bundle.js \
  --suburb Tarneit \
  --state VIC \
  --postcode 3029
```

If you want the full browser-tool live-run sequence as structured JSON, use:

```bash
node engine/openlot-browser-tool-live-runner.js \
  --suburb Tarneit \
  --state VIC \
  --postcode 3029
```

This returns a step-by-step browser sequence covering:
1. opening the search wizard
2. selecting price / land-size filters
3. entering the suburb target
4. triggering search
5. running the extractor into a canonical browser-export file
6. the exact save + ingest commands for the exported JSON

If you want that same live-run sequence translated into a browser-act friendly plan artifact, use:

```bash
node engine/openlot-browser-act-plan.js \
  --input ./tmp/openlot-browser-tool-live-runner.json \
  --output ./tmp/openlot-browser-act-plan.json
```

This produces a plan that maps each emitted live-run step into an act-oriented representation such as open / snapshot-ref / click / select / type / evaluate.

If you want a JSONL-style action bundle for an external browser executor, use:

```bash
node engine/openlot-browser-a2ui-plan.js \
  --input ./tmp/openlot-browser-act-plan.json \
  --output ./tmp/openlot-browser-a2ui-plan.jsonl
```

This emits line-delimited action records derived from the act plan, preserving the downstream save + ingest commands.

If you want one more layer toward executable browser-tool automation, turn that JSONL plan into either:
- a validated dry-run execution transcript,
- an OpenClaw browser request bundle with label-resolution metadata,
- a thin resolved executor transcript/bundle that consumes snapshot data and injects `params.ref` values for the next real browser pass, or
- a live OpenClaw CLI executor run that opens the browser, snapshots the page, resolves refs, and executes the plan end-to-end

```bash
node engine/openlot-browser-a2ui-runner.js \
  --input ./tmp/openlot-browser-a2ui-plan.jsonl \
  --adapter openclaw-browser-bundle \
  --output ./tmp/openlot-browser-execution-bundle.json
```

Use `--adapter dry-run` to sanity-check the plan order without touching a browser.

Use `--adapter thin-executor` when you already have snapshot output (or fixture snapshots) and want the runner to resolve labels into concrete refs:

```bash
node engine/openlot-browser-a2ui-runner.js \
  --input ./tmp/openlot-browser-a2ui-plan.jsonl \
  --adapter thin-executor \
  --snapshotFile ./tmp/openlot-browser-snapshot-fixture.json \
  --evaluateResultFile ./tmp/openlot-browser-export.json \
  --output ./tmp/openlot-browser-thin-executor.json
```

The thin executor can also consume the generated bundle JSON directly instead of the JSONL plan. It does **not** call the browser tool from Node; it resolves labels against supplied snapshot frames, emits a browser bundle with concrete `ref`s, and can copy an evaluate-result fixture into the requested `outputFile` to validate the downstream save/ingest handoff.

If you want the runner to execute the plan against the local OpenClaw browser CLI in real time, use the new `openclaw-cli-executor` adapter:

```bash
node engine/openlot-browser-a2ui-runner.js \
  --input ./tmp/openlot-browser-a2ui-plan.jsonl \
  --adapter openclaw-cli-executor \
  --snapshotFormat ai \
  --snapshotOutDir ./tmp/openlot-browser-cli-snapshots \
  --output ./tmp/openlot-browser-cli-execution.json
```

This adapter:
- shells out to `openclaw browser --json ...`
- keeps the opened tab `targetId` threaded through the full run
- snapshots before each interactive step, resolves labels into live refs, then executes `click` / `select` / `type`
- for OpenLot suburb suggestions, now includes a DOM-click fallback path when the initial ref click leaves `Search` disabled
- writes the `evaluate` result JSON to the requested `outputFile`
- optionally persists every raw snapshot response for audit/debugging via `--snapshotOutDir`

Live validation note:
- Tarneit VIC 3029 now runs end-to-end through `openclaw-cli-executor` on this machine.
- In that live run, the suburb-suggestion step required the new DOM-click fallback (`search-wizard-suburb-item`) before `Search` became clickable.
- The live executor then reached the filtered results URL `https://www.openlot.com.au/tarneit-vic-3029/land-for-sale?min-price=50000&max-price=5000000&max-land-size=2000` and saved a real extractor payload to `tmp/openlot-browser-export-live.json` with heading `172 Land for Sale in Tarneit VIC 3029` and `count=10` rows.

If the browser tool/export step already produced a JSON file from that extractor, you can save it directly into the canonical raw export path with:

```bash
node engine/save-openlot-browser-tool-export.js \
  --input ./tmp/openlot-browser-export.json \
  --rawDir ./tmp/openlot-raw-batch-live \
  --suburb Tarneit \
  --state VIC \
  --postcode 3029
```

If you want the shortest path from browser-tool extractor JSON to DB refresh, use the one-command ingest helper:

```bash
node engine/ingest-openlot-browser-tool-export.js \
  --input ./tmp/openlot-browser-export.json \
  --suburb Tarneit \
  --state VIC \
  --postcode 3029
```

This performs all three downstream steps automatically:
1. save browser-tool export into the canonical raw export path
2. build canonical payload + manifest
3. ingest through `queue-runner.js`

If you want to take the next step and run a real OpenLot live capture first, then immediately run the combined shared suburb job with Domain/OpenLot/REA using that generated manifest, use:

```bash
node engine/openlot-live-combined-suburb-job.js \
  --suburb Tarneit \
  --state VIC \
  --postcode 3029 \
  --sources domain,openlot,rea \
  --mode test \
  --output ./tmp/openlot-live-combined-suburb-job.json
```

This wrapper:
1. runs `openlot-browser-live-to-ingest.js`
2. reuses the generated OpenLot manifest
3. runs `queue-runner.js` for the shared combined-source suburb job

Hardening notes:
- live OpenLot artifacts now support a per-run directory stamp so browser exports, manifests, snapshots, and payloads do not collide across repeated runs
- the combined wrapper now includes that run stamp in the default combined queue name to reduce stale progress-file reuse across targeted reruns

For a controlled multi-suburb batch/drip run built on the same isolated wrapper, use:

```bash
node engine/openlot-live-combined-batch.js \
  --states VIC \
  --maxSuburbs 2 \
  --sources domain,openlot,rea \
  --mode test \
  --runStampPrefix hb-batch \
  --queuePrefix hb-drip \
  --output ./tmp/openlot-live-combined-batch.json
```

This wrapper:
1. loads a limited suburb set (or a single explicit suburb)
2. assigns each suburb its own stamped run directory
3. assigns each suburb a stable queue name derived from `queuePrefix + mode + index + suburb slug`
4. runs `openlot-live-combined-suburb-job.js` once per suburb
5. returns a single batch summary with per-suburb output files and queue outcomes

Scheduling note:
- for drip-style production cadence, keep `mode=test` or a small controlled suburb count first, then increase `maxSuburbs` gradually while keeping a clear `queuePrefix` so batch runs are easy to distinguish in queue progress files and ops logs

For a small production-style drip wrapper with explicit cycle naming, use:

```bash
node engine/openlot-live-drip-cycle.js \
  --states VIC \
  --cycleName midday \
  --maxSuburbs 1 \
  --mode delta \
  --sources domain,openlot,rea \
  --output ./tmp/openlot-live-drip-cycle-midday.json
```

This wrapper:
1. sets a cycle-specific `queuePrefix` like `drip-midday`
2. sets a cycle-specific `runStampPrefix` like `midday-YYYY-MM-DD`
3. runs the controlled batch wrapper underneath
4. returns one summary JSON for that drip cycle

Recommended initial recurring cadence:
- **midday** → `maxSuburbs=1`
- **afternoon** → `maxSuburbs=2`
- **evening** → `maxSuburbs=3`
- keep all three on `mode=delta` initially
- keep source mix at `domain,openlot,rea`

Convenience scripts now exist for that starting cadence:
```bash
npm run openlot:drip:midday
npm run openlot:drip:afternoon
npm run openlot:drip:evening
```

Suggested scheduler pattern:
- midday cycle first, observe stability/data quality
- add afternoon once midday is clean
- add evening last after queue/runtime costs look acceptable

Recommended first scheduler entry (manual install):
```bash
bash /Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard/engine/openlot-midday-drip.sh
```

Example cron line for the first recurring cycle:
```cron
15 13 * * * bash /Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard/engine/openlot-midday-drip.sh
```

To print the exact cron entry and one-line install command without modifying crontab, run:
```bash
npm run openlot:print-midday-cron
```

To print the full initial three-cycle cadence without modifying crontab, run:
```bash
npm run openlot:print-all-drip-crons
```

To check whether those proposed cron entries are already installed, run:
```bash
npm run openlot:check-drip-crons
```

To get a one-shot JSON scheduler readiness summary, run:
```bash
npm run openlot:scheduler-status
```

For a concise scheduler operations cheat sheet, run:
```bash
npm run openlot:scheduler-help
```

For a compact matrix of the full scheduler toolchain, see:
- `engine/OPENLOT_SCHEDULER_MATRIX.md`

For a machine-readable runbook summary of the recommended scheduler rollout order, run:
```bash
npm run openlot:scheduler-runbook-json
```

To verify that the compact scheduler matrix only references npm commands that actually exist in `package.json`, run:
```bash
npm run openlot:scheduler-docs-consistency
```

To emit a machine-readable diff between the current crontab and the proposed managed install state, run:
```bash
npm run openlot:scheduler-install-diff
```

This diff reports:
- missing managed entries that would be added by a clean install
- extra managed entries already in crontab but not in the current proposal
- unmanaged current entries that would be preserved
- whether the machine is ready for a clean install from an empty crontab

To emit a machine-readable inventory of saved crontab backups with ready-to-run restore commands, run:
```bash
npm run openlot:scheduler-backup-inventory
```

This inventory reports:
- backup file paths and kinds
- non-empty line counts per backup
- whether a backup represents an empty crontab baseline
- preview/apply restore commands for each backup

For a one-shot JSON audit of scheduler helper readiness, backup inventory, and executable bits, run:
```bash
npm run openlot:scheduler-audit
```

For a compact combined readiness+audit summary with a recommended next action, run:
```bash
npm run openlot:scheduler-report
```

For a human-readable apply-now decision summary, run:
```bash
npm run openlot:scheduler-decision
```

For a machine-readable command map of the whole scheduler toolchain, run:
```bash
npm run openlot:scheduler-command-map
```

To verify that the report / decision / command-map helpers all point at the same apply command, run:
```bash
npm run openlot:scheduler-consistency
```

To run a compact preflight before actually applying the scheduler entries, run:
```bash
npm run openlot:scheduler-preflight
```

For a very compact human-readable go/no-go card, run:
```bash
npm run openlot:scheduler-go-no-go
```

To smoke-check the full scheduler helper stack in one command, run:
```bash
npm run openlot:scheduler-stack-smoke
```

To emit a machine-readable index of the current scheduler-related npm scripts, run:
```bash
npm run openlot:scheduler-ops-index
```

To emit a categorized machine-readable view of the scheduler command surface, run:
```bash
npm run openlot:scheduler-categories
```

That categorized view now includes the install-diff and backup-inventory helpers inside the scheduler inspection surface, and now also covers the runbook-json, docs-consistency, and surface-summary helpers under inventory-and-maps so the categorized view spans the full current scheduler script inventory.

To emit a compact machine-readable summary of the full scheduler surface across ops-index, categories, and matrix consistency, run:
```bash
npm run openlot:scheduler-surface-summary
```

This summary reports:
- total scheduler-related npm scripts in the ops index
- how many of those are currently categorized
- how many npm commands the compact matrix references
- whether all matrix commands exist in `package.json`
- how many scripts remain outside the categorized view

To emit a compact machine-readable coverage verdict for the scheduler surface, run:
```bash
npm run openlot:scheduler-coverage-check
```

This verdict reports whether:
- categorized count matches the ops index
- uncategorized script count is zero
- all matrix commands still exist in `package.json`

The categorized scheduler surface and compact matrix now also include this coverage-check helper so the coverage verdict is itself part of the tracked inspection surface.

For a compact human-readable handoff file showing the current ready-to-apply state, exact commands, and proposed cron entries, see:
```text
engine/OPENLOT_SCHEDULER_READY_TO_APPLY.md
```

To emit a compact machine-readable release/readiness card that combines preflight, coverage, and current scheduler state, run:
```bash
npm run openlot:scheduler-release-card
```

This card reports:
- overall releaseReady verdict
- preflightReady and coverageComplete sub-verdicts
- recommended next action
- crontab state and entry states
- backup count and current surface counts

The categorized scheduler surface and compact matrix now also include this release-card helper so the final release verdict stays inside the tracked inspection surface.

To emit a compact machine-readable apply-now card with the exact next apply/remove/restore commands, run:
```bash
npm run openlot:scheduler-apply-now-card
```

This card reports:
- whether the rollout is ready to apply now
- the exact apply command
- the exact remove command
- the restore command template
- current crontab state and proposed entries

The categorized scheduler surface and compact matrix now also include this apply-now helper so the final operator handoff remains inside the tracked inspection surface.

To emit a compact machine-readable operator checklist for applying the rollout, run:
```bash
npm run openlot:scheduler-operator-checklist
```

This checklist reports:
- whether the rollout is ready to execute from the current baseline
- the ordered apply / rollback / restore steps
- the proposed cron entries to verify

The categorized scheduler surface and compact matrix now also include this operator-checklist helper so the final human/operator execution flow stays inside the tracked inspection surface.

For a compact human-readable preview of exactly what would be installed, run:
```bash
npm run openlot:scheduler-install-preview
```

This preview prints:
- apply-now verdict
- exact apply / remove / restore commands
- proposed cron entries
- resulting crontab preview

The categorized scheduler surface and compact matrix now also include this install-preview helper so the human-readable install preview stays inside the tracked inspection surface.

For a minimal shell-ready command sheet showing the exact apply / rollback / restore commands and the proposed cron lines, run:
```bash
npm run openlot:scheduler-command-sheet
```

To emit a machine-readable index of the current scheduler handoff artifacts, run:
```bash
npm run openlot:scheduler-handoff-index
```

For a compact human-readable manifest of the current handoff set, see:
```text
engine/OPENLOT_SCHEDULER_HANDOFF_MANIFEST.md
```

The official unattended buy-side production wrapper now resolves token files from repo-local `credentials/` first, then falls back to legacy home-directory credential locations.

To emit one machine-readable manifest that bundles the handoff artifacts, core handoff commands, apply/rollback/restore commands, and proposed cron entries, run:
```bash
npm run openlot:scheduler-handoff-manifest
```

To emit one machine-readable apply packet containing the apply command, rollback command, restore template, latest backup, and proposed cron entries, run:
```bash
npm run openlot:scheduler-apply-packet
```

To generate a machine-readable dry-run preview of the proposed cron install state, run:
```bash
npm run openlot:preview-drip-crons-json
```

To generate a machine-readable dry-run preview of the removal state, run:
```bash
npm run openlot:preview-drip-crons-remove-json
```

To generate a backup-backed dry-run install preview for the proposed cron set, run:
```bash
npm run openlot:install-drip-crons
```

To actually apply the install from the same helper, run:
```bash
npm run openlot:install-drip-crons -- --apply
```

To preview removal of the proposed drip cron set without changing crontab, run:
```bash
npm run openlot:remove-drip-crons
```

Rollback note:
- every install/remove helper run writes a backup into `tmp/cron-backups/`
- backup files can be restored manually with:
```bash
bash engine/restore-crontab-backup.sh <backup-file>
bash engine/restore-crontab-backup.sh <backup-file> --apply
```
- or via npm wrapper:
```bash
npm run openlot:restore-crontab -- <backup-file>
npm run openlot:restore-crontab -- <backup-file> --apply
```

Suggested starting cron set for the proposed cadence:
```cron
15 13 * * * bash /Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard/engine/openlot-midday-drip.sh
30 15 * * * bash /Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard/engine/openlot-afternoon-drip.sh
45 18 * * * bash /Users/jamesdibble/.openclaw-scout/workspace/rlp-dashboard/engine/openlot-evening-drip.sh
```

This writes logs to:
- `tmp/logs/openlot-midday-drip-YYYY-MM-DD.log`
- `tmp/logs/openlot-afternoon-drip-YYYY-MM-DD.log`
- `tmp/logs/openlot-evening-drip-YYYY-MM-DD.log`

If you want the browser execution itself to flow straight into that ingest step with effectively zero handoff, use the new end-to-end wrapper:

```bash
node engine/openlot-browser-live-to-ingest.js \
  --suburb Tarneit \
  --state VIC \
  --postcode 3029 \
  --mode test
```

Or via npm:

```bash
npm run openlot:browser-live-to-ingest -- \
  --suburb Tarneit \
  --state VIC \
  --postcode 3029 \
  --mode test
```

This wrapper now:
1. builds the live runner / act plan / A2UI plan artifacts
2. executes them through the live `openclaw-cli-executor`
3. reuses the saved `browserExportFile`
4. immediately runs `ingest-openlot-browser-tool-export.js`
5. returns one summary JSON covering both browser execution and ingest

For local verification or reruns after a successful live capture, you can skip the browser half and ingest the existing export directly through the same wrapper:

```bash
node engine/openlot-browser-live-to-ingest.js \
  --suburb Tarneit \
  --state VIC \
  --postcode 3029 \
  --browserExportFile ./tmp/openlot-browser-export-live.json \
  --skipBrowser \
  --mode test
```

### One-shot browser export -> payload -> manifest pipeline
If you already have one raw browser export file and want the shortest path into queue-runner prep, use:

```bash
node engine/openlot-browser-export-pipeline.js \
  --input ./tmp/openlot-raw-browser-rows-tarneit.json \
  --rawDir ./tmp/openlot-raw-batch \
  --payloadDir ./tmp/openlot-payloads-batch \
  --manifest ./tmp/openlot-payloads-batch/manifest.json \
  --suburb Tarneit \
  --state VIC \
  --postcode 3029
```

This performs the whole handoff in one command:
1. saves the raw browser result into the canonical raw-batch directory
2. normalizes it into the canonical payload directory
3. rebuilds a manifest for queue-runner ingestion

### Batch-prep raw browser rows into canonical payloads + manifest
If browser automation is dropping multiple raw row JSON files into one directory, you can normalize the whole batch and build a manifest in one step.

Expected raw filename pattern:
- `STATE:Suburb:Postcode.json`
- example: `VIC:Tarneit:3029.json`

Command:
```bash
node engine/prepare-openlot-payload-batch.js \
  --inputDir ./tmp/openlot-raw-batch \
  --outputDir ./tmp/openlot-payloads-batch \
  --manifest ./tmp/openlot-payloads-batch/manifest.json
```

Then ingest it through queue-runner:
```bash
node engine/queue-runner.js \
  --states VIC \
  --sources openlot \
  --mode test \
  --maxJobs 10 \
  --queueName targeted-openlot-batch-manifest \
  --openlotBrowserResultsManifest ./tmp/openlot-payloads-batch/manifest.json
```

### Inventory the payload directory before ingest
Operators can inspect which suburb payloads are ready for queue ingestion:
```bash
node engine/list-openlot-payloads.js --dir ./tmp/openlot-payloads-cli
```

### Build a machine-readable manifest
Schedulers or operators can snapshot a payload directory into one manifest file:
```bash
node engine/build-openlot-payload-manifest.js \
  --dir ./tmp/openlot-payloads-cli \
  --output ./tmp/openlot-payloads-cli/manifest.json
```

### Ingest from a manifest directly
Queue-runner can now consume the manifest directly instead of rescanning the directory:
```bash
node engine/queue-runner.js \
  --states VIC \
  --suburb Tarneit \
  --state VIC \
  --postcode 3029 \
  --sources openlot \
  --mode test \
  --maxJobs 1 \
  --queueName targeted-openlot-manifest \
  --openlotBrowserResultsManifest ./tmp/openlot-payloads-cli/manifest.json
```

## Weekly discovery refresh
Keep discovery separate:
```bash
node engine/discover-fast.js VIC
node engine/discover-fast.js NSW
# ...repeat for all states
```

## Post-ingest maintenance
After queue completion:
```bash
node engine/clean-data.js
node build-v3.js
npx wrangler pages deploy deploy/ --project-name=rlp-dashboard --branch=main --commit-dirty=true
```

---

## Ops guidance

## Use `test` mode when
- validating credentials
- checking parser output
- checking one suburb after a code deploy

## Use `delta` mode when
- running daily production refreshes
- keeping request volume bounded
- prioritising changed/new stock over exhaustive backfill depth

## Use `bulk` mode when
- rebuilding from scratch
- backfilling new states
- validating broad source coverage after parser changes

---

## Current caveats
- sold ingestion is still outside the queue-first buy-side wrapper; the official unattended path covers national buy-side production only.
- `engine/daily-scrape-legacy.sh` preserves the old split-source flow for debugging/fallback, but it is no longer the recommended unattended entrypoint.
- OpenLot browser-payload ingestion is now production-style for targeted runs, and raw browser exports can now be pushed through canonical raw-save, one-shot export-pipeline, or batch-prep flows into queue-ready payloads + manifests, but the upstream browser capture itself is still not nationally automated.
- Sold ingestion is still operated outside the queue contract.
- `package.json` now includes queue-oriented operational scripts, including targeted REA-backed smoke-test entrypoints, but these are only entrypoints; they do not replace scheduler configuration.

---

## Recommended operator baseline
For normal production operation today:
1. run `bash engine/production-buy-side-cycle.sh` or `npm run ops:prod:buy-side`
2. let that wrapper handle weekly discovery, queue-first buy-side ingest, clean, build, and deploy
3. use `domain` as minimum viable source set
4. prefer `domain,rea` when broader portal coverage is worth the added cost/runtime and REA credentials are available
5. use targeted `domain,openlot,rea` or `openlot` queue runs when a browser payload manifest/file exists for a suburb/market you want to ingest
6. keep sold scripts separate until folded into the queue model
7. use `npm run ops:daily:legacy` only when debugging or deliberately falling back to the old split-source path

That is the clearest current operational model for the codebase as it exists now.
