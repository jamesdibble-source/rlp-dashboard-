# RLP Dashboard / National Land Scraper — Full Handover

**Prepared by:** Scout  
**Date:** 4 April 2026  
**Audience:** James, Claude Code, future operators/engineers  
**Purpose:** Full-state handover of the current national land-scraping system across **Domain, REA, and OpenLot**, including what has been achieved, what remains broken or incomplete, what the actual goal is, and what should happen next.

---

# 1. Executive Summary

## The goal
Build a **production-ready national land scraping system** for Australia that:
- scrapes **land-only** listings
- covers **all states and territories**
- combines **Domain + REA + OpenLot**
- supports **full ingest first** and then **daily refresh / drip updates**
- writes into the RLP database cleanly and consistently
- powers the dashboard and downstream analytics
- can run **unattended** and be considered truly operational, not just manually demoable

## Current honest status
The system is **substantially closer to production** than it was at the start of this work, but it is **not yet fully signed off** as a finished national unattended production system.

### Best blunt summary
- **Domain:** effectively production-close
- **REA:** production-close and now validated more broadly geographically
- **OpenLot:** major architectural progress; now first-class in the queue path and validated outside VIC, but still the least mature of the three
- **Production wrapper / ops path:** now real, machine-correct, and live-validated
- **Recurring production cutover:** not yet fully installed/switched on

## Current estimated readiness
- **Whole 3-source system:** ~85% to go-live
- **Domain + REA national buy-side path:** ~90%+
- **Main remaining gap:** OpenLot robustness / broader positive validation / final recurring cutover

---

# 2. What James asked for

James clarified the target as:
- custom land scrapers for **OpenLot**, **Domain**, and **REA**
- property type must be **land**
- preferred land-size band = **0–2,000m²** (optionally 0–4,000m²)
- refreshed **daily** across Australia
- architecture must scale to national active inventory, potentially **~17k–40k+ live lots**
- **REA is non-negotiable**
- task is not complete until it **actually works**, including architecting around REA bot issues

That has been the working definition used throughout.

---

# 3. Where the retail lot price HTML interface lives

## Live/public interface
- Public dashboard URL: `https://rlp-dashboard.pages.dev`

## Main dashboard/build files in this repo
- Primary handover/dashboard context file from earlier project work: `RLP-HANDOVER-SCOUT.md`
- Main dashboard template / HTML interface source of truth in earlier project notes: `dashboard-template-v4.html`
- Build script that injects DB-derived data into the HTML template: `build-v3.js`
- Original design reference from James / Stitch aesthetic: `stitch-design.html` (see prior handover references and older project notes)
- Supporting operational/documentation context: `RLP-PIPELINE-OPS.md`

## Current production interface path
The production data pipeline now centers on the queue-first scraper/runtime in `engine/`, but the retail lot price **HTML interface** is still the built dashboard output generated from the template/build layer above and deployed to Cloudflare Pages.

In practical terms:
- scraper/runtime/data pipeline lives mainly under: `engine/`
- dashboard HTML/template/build layer lives around: `dashboard-template-v4.html` + `build-v3.js`
- deployed interface is served at: `https://rlp-dashboard.pages.dev`

# 4. Current architecture (high level)

## Core production shape
The system now centers around a **queue-first national pipeline**.

### Main layers
1. **Discovery / suburb universe**
   - `engine/data/active-suburbs-*.json`
   - These provide the candidate suburb queue across Australia.

2. **Per-suburb source orchestration**
   - `engine/scrape-sources.js`
   - Runs one or more sources for a suburb under a shared contract.

3. **National queue execution**
   - `engine/queue-runner.js`
   - Builds/resumes persistent queues, processes suburb jobs, writes DB updates, saves progress.

4. **Source implementations**
   - Domain scraper
   - REA via Apify actor path
   - OpenLot live browser-assisted path

5. **DB + dedup + canonicalization**
   - `engine/db.js`
   - `engine/lib/dedup-js.js`
   - `engine/clean-data.js`

6. **Official unattended buy-side wrapper**
   - `engine/production-buy-side-cycle.sh`
   - This is now the official national buy-side production entrypoint.

7. **Dashboard build / deploy path**
   - clean/build/deploy after queue execution, when enabled

---

# 4. What has been achieved

## 4.1 National seed coverage exists
Discovery coverage exists for all 8 jurisdictions:
- VIC
- NSW
- QLD
- WA
- SA
- TAS
- NT
- ACT

This means the system has a real national suburb seed set and is not limited to a few manually-curated markets.

---

## 4.2 Shared land-only filtering / normalization exists
A shared land filter / normalization layer was built so sources operate under the same land-oriented spec.

### Important characteristics
- land-only target
- standard land-size filters
- shared normalization into canonical lot objects
- common queue/orchestrator contract

This was necessary to stop the system from being just 3 separate scrapers stitched together inconsistently.

---

## 4.3 Domain path is strong
Domain is now the most mature source.

### Domain status
- integrated into the shared queue/orchestrator
- validated live repeatedly
- supports test / delta / bulk behavior
- working in official production wrapper
- working across broader geography
- all-8-state production scope supported

### Practical status
If forced to go live with only one source, **Domain would be the easiest to trust first**.

---

## 4.4 REA is now operational and much more hardened
REA was a major blocker because it is bot-protected and non-negotiable.

### What has been done
- REA integrated into the queue-first orchestration path
- REA token handling fixed so it uses the real machine/workspace paths
- REA mode helper behavior defined for test/delta/bulk
- actor failover + retry architecture added
- hard runtime timeouts added
- paginated dataset reads added
- truncation/runtime metadata added
- broader geography validation added

### Live REA evidence now exists in:
- VIC
- NSW
- WA
- TAS
- ACT
- NT

### Example broader geography validations
- **TAS / Sorell 7172** → REA 13
- **ACT / Denman Prospect 2611** → REA 9
- **NT / Katherine 0850** → REA 11

This materially improved confidence that REA is not just working in a narrow “happy path.”

### Current REA status
REA is now **production-close**, not speculative.

---

## 4.5 OpenLot moved from payload-injection prototype toward first-class source
This is one of the most important changes in the entire effort.

### Earlier state
OpenLot originally behaved like:
- browser-run → export payload → inject manifest/file → parse later

In other words, it was not a true first-class queue source.

### What changed
OpenLot was progressively moved through stages:
- browser-result parsing path
- manifest/file-based queue ingestion path
- live combined wrapper path
- production-style drip/batch helpers
- finally: **first-class live queue-runner invocation via `--openlotLive true`**

### Result
`queue-runner` can now invoke OpenLot through the normal source contract rather than only through external manifest injection.

That is a major architectural improvement.

---

## 4.6 OpenLot now has confirmed positive results outside VIC
This is another major milestone.

### Confirmed positive first-class OpenLot queue runs outside VIC
- **NSW / Leppington 2179**
  - OpenLot count: **10**
- **SA / Angle Vale 5117**
  - OpenLot count: **3**
- **WA / Yanchep 6035**
  - OpenLot count: **10**

### Also confirmed earlier in VIC
- **VIC / Tarneit 3029**
  - OpenLot count: **10**

This means OpenLot is no longer “only proven in VIC” and no longer only “website-level positive.” It has real queue-runner evidence in at least:
- VIC
- NSW
- SA
- WA

---

## 4.7 OpenLot browser path has been hardened
OpenLot’s biggest weakness has been browser-flow brittleness.

### Hardening added
- suggestion label variants instead of exact-string-only matching
- fresh snapshot/retry plumbing
- DOM fallback recovery for suburb suggestion selection
- disabled-search recovery
- no-match tolerance for suburbs where Search remains disabled
- first-class queue path now treats some cases as tolerated zero-result outcomes rather than hard failures
- limited tab-loss retry behavior

### Verified effects
- suburb selection became more resilient outside VIC
- Search enablement issues improved
- no-match suburbs now no longer blow up the whole queue job

### Example no-match tolerance result
- **TAS / Aberdeen 7310**
  - previously: hard failure
  - now: `status=done`, `openlot status=ok`, `count=0`

That is operationally important for unattended runs.

---

## 4.8 Queue runner has been hardened
The queue path itself was a major focus.

### Improvements made
- bounded queue creation for test runs
- bounded worker concurrency
- safe default behavior preserving REA sequentialism
- queue progress persistence
- queue-level broader smoke validations

### Important fixes
#### Queue-bounding bug fixed
Before:
- `maxJobs` limited processing count only
- queue creation could still explode to thousands of jobs

Now:
- queue creation is bounded for test-mode runs
- bounded validation queues remain truly bounded

#### Concurrency added safely
- bounded worker pool added
- REA remains effectively sequential by default unless explicitly overridden
- non-REA work now has safer scaling path

---

## 4.9 DB / dedup / cleaning path hardened
The DB path is materially stronger than before.

### Improvements made
- national dedup key now includes **state**
- multi-source observations preserved in `raw_json`
- earliest `list_date` and latest `sold_date` preserved when merging
- `clean-data.js` aligned with the production dedup key logic instead of using stale legacy key rules
- duplicate-key audit run against live DB showed:
  - `duplicateKeyGroups=0`

### Why that matters
This reduces:
- cross-state false merges
- source-enrichment loss
- cleanup logic undoing live dedup improvements

This is not the end of DB hardening forever, but it removed real integrity risks.

---

## 4.10 Official production wrapper now exists and is live-validated
This is a huge improvement in operational maturity.

### Official entrypoint
- `engine/production-buy-side-cycle.sh`
- npm alias:
  - `npm run ops:prod:buy-side`

### Why it matters
Before, the production path was muddied by legacy shell flows and old machine assumptions.

Now there is a machine-correct, queue-first official unattended buy-side wrapper.

### It now does things properly
- uses repo-relative paths
- resolves credentials for this workspace
- supports all 8 states
- loops queue passes until drain/pass cap
- supports dry-run and bounded live validation
- can run build/deploy when enabled

### Live wrapper validations completed
- bounded live runs for NSW/WA/VIC
- TAS-specific bounded live run
- bounded all-8-state smoke run

This means the production wrapper is **not just planned — it has been exercised live**.

---

## 4.11 Production credential resolution fixed
The new production wrapper now resolves credentials correctly for this machine.

### Important fix
Repo-local credentials are now preferred first, including:
- `credentials/apify-token.txt`
- `credentials/cloudflare-token.txt`

### Verified dry-run outcome
- `apifyTokenPresent=yes`
- `cloudflareTokenPresent=yes`
- national states all present
- queue `prod-national-buy-side`

This removed a real cutover blocker.

---

## 4.12 Scheduler / operator tooling massively expanded
A very large amount of scheduler/cutover tooling now exists.

### This includes:
- scheduler status / audit / preflight / stack smoke
- install/remove/restore helpers
- rollback/backup inventory
- install diff
- command maps
- categories / coverage checks
- release cards / apply-now cards
- operator checklist
- human-readable handoff files
- handoff manifests / indexes
- cutover check helpers

This means operator clarity is dramatically improved compared with the earlier state.

---

# 5. What is currently proven live

## Domain + REA combined wrapper path
Broader all-8-state bounded wrapper smoke succeeded.

### Example bounded all-8-state live smoke
Queue:
- `prod-smoke-all8-3jobs`

Results included:
- **WA / Abbey 6280** → Domain 35, REA 2, canonical 17
- **NSW / Abbotsbury 2176** → Domain 13, REA 0, canonical 13
- **VIC / Abbotsford 3067** → Domain 16, REA 1, canonical 8

Outcome:
- `processedThisRun=3`
- `done=3`
- `partial=0`
- `pending=0`

This is strong evidence the production wrapper is real.

---

## REA broader geography proof
Verified in under-tested jurisdictions:
- TAS
- ACT
- NT

Examples:
- **Sorell TAS** → REA 13
- **Denman Prospect ACT** → REA 9
- **Katherine NT** → REA 11

This substantially improved the REA confidence profile.

---

## OpenLot positive results outside VIC
Confirmed queue-runner positives in:
- **Leppington NSW** → 10
- **Angle Vale SA** → 3
- **Yanchep WA** → 10

Plus earlier positive in:
- **Tarneit VIC** → 10

This is one of the most important current state changes.

---

# 6. What is still incomplete / not yet signed off

## 6.1 Full recurring production cutover is not yet complete
This is now more of an **operations/cutover issue** than a basic scraper architecture problem.

### What remains
- recurring crons not yet fully installed/committed as final production cutover state
- working tree / production state not yet pinned the way I’d want before final go-live
- final production cadence decision still needs to be explicitly enacted

## 6.2 OpenLot is still the least mature source
Even though OpenLot has progressed enormously, it is still the biggest remaining uncertainty.

### Why
- browser path still more fragile than Domain/REA
- more positive-result validation is still needed across additional states/suburbs
- runtime/tab/session persistence still needs continued attention
- some suburbs still end in zero-result tolerant outcomes or partials rather than clean positive ingest

## 6.3 OpenLot broader confidence still needs more work
We now know OpenLot positive suburbs exist and can ingest outside VIC.

But to fully sign off national unattended production, I still want:
- more confirmed positives in additional states/suburbs
- especially QLD / ACT and other broader corridors
- more confidence that browser/runtime issues are not going to destabilize recurring unattended runs

## 6.4 Repo hygiene / clean pinning still matters before final go-live
Before true cutover, I want:
- clean git state
- clear commit / tag / rollback point
- explicit production handoff state

This is not because the system is conceptually broken, but because go-live should be reproducible.

---

# 7. Current practical blockers

## Blocker A — OpenLot still needs broader positive-result confidence
This is the biggest technical blocker left.

### Current positive outside-VIC proof exists
Yes.

### Is that enough for final signoff?
Not yet.

Need more:
- more suburbs
- more states
- fewer browser-runtime edge cases

## Blocker B — final recurring cutover has not been enacted
The scheduler and cutover tooling is ready, but the actual recurring live state is not yet fully flipped over as the final production regime.

## Blocker C — final OpenLot runtime hardening
The selection path has improved, but the browser-runtime layer still needs continued hardening where tabs/session context or page persistence become unstable.

---

# 8. Current % estimate

## Whole 3-source national system
**~85% complete to go-live**

## Domain + REA national buy-side wrapper path
**~90%+**

## Main reason the total system is not higher
OpenLot still needs broader confidence and the final recurring cutover still needs to be installed/committed/enacted cleanly.

---

# 9. Recommended next steps

## Immediate next steps
1. Continue OpenLot positive-result hunt in more non-VIC suburbs
   - best candidates already identified include places like:
     - Austral NSW
     - Box Hill NSW
     - Yanchep / Two Rocks / Byford WA
     - Mount Barker / Munno Para West SA
     - Denman Prospect / Whitlam ACT
     - Ripley / Yarrabilba QLD

2. Continue OpenLot browser/runtime hardening
   - especially post-search stability
   - session/tab persistence
   - multi-state selection/result loading

3. Run broader bounded production validations
   - continue bounded all-8-state smoke tests
   - broaden positive suburb validations

4. Finalize recurring production cutover
   - install recurring scheduler entries if that is the chosen operating model
   - pin repo state cleanly
   - confirm post-install validation

## After that
5. Run a slightly broader recurring dry production window
6. Validate DB freshness / scrape_runs / dashboard output
7. Only then call it truly “go-live ready”

---

# 10. Exact current strengths and weaknesses by source

## Domain
### Strengths
- stable
- strong integration
- low-friction ops
- proven repeatedly
- broad geography confidence

### Weaknesses
- not the richest source in every land market
- less of a blocker than the others now

### Status
**Production-close / almost ready**

---

## REA
### Strengths
- non-negotiable source now functioning live
- broader geography proof exists
- timeout / pagination / retry hardening added
- good queue integration

### Weaknesses
- still more expensive and operationally heavier than Domain
- still benefits from more scaled validation/runtime observation

### Status
**Production-close**

---

## OpenLot
### Strengths
- now first-class in queue contract
- positive results in VIC + NSW + SA + WA
- no-match tolerance exists
- selection resilience materially improved

### Weaknesses
- browser path still inherently more brittle
- more positive-result validation still needed
- runtime/tab/session stability still under active hardening

### Status
**Significantly improved, but still the main remaining technical risk**

---

# 11. Exact files that matter most right now

## Core queue / orchestration
- `engine/queue-runner.js`
- `engine/scrape-sources.js`
- `engine/production-buy-side-cycle.sh`

## REA
- `engine/scrapers/rea-apify.js`

## OpenLot
- `engine/scrapers/openlot-public.js`
- `engine/openlot-browser-a2ui-runner.js`
- `engine/openlot-browser-tool-live-runner.js`
- `engine/openlot-browser-act-plan.js`
- `engine/openlot-browser-a2ui-plan.js`
- `engine/openlot-live-combined-suburb-job.js`
- `engine/openlot-live-combined-batch.js`
- `engine/openlot-live-drip-cycle.js`

## DB / dedup / cleaning
- `engine/db.js`
- `engine/lib/dedup-js.js`
- `engine/clean-data.js`

## Ops / runbooks / cutover
- `RLP-PIPELINE-OPS.md`
- `RLP-HANDOVER-SCOUT.md`
- `engine/PRODUCTION_BUY_SIDE_RUNBOOK.md`
- `engine/openlot-production-cutover-plan.sh`
- `engine/OPENLOT_SCHEDULER_READY_TO_APPLY.md`
- `engine/OPENLOT_SCHEDULER_HANDOFF_MANIFEST.md`

---

# 12. If another coding agent is taking over

## The highest-value question to ask is:
> “What is the shortest path from the current OpenLot first-class queue integration to broad, repeatable positive-result unattended operation across multiple states?”

That is the key remaining technical frontier.

## The second most valuable task is:
> “What is the cleanest final recurring production cutover/install path now that the production wrapper is live-validated?”

## The biggest mistake to avoid
Do **not** assume this is still a vague prototype. It is not.
A lot of real architecture has already been built and validated live.

The system is now much closer to:
- production wrapper
- real queue
- real DB writes
- real multi-source ingestion
- real bounded national validation

The remaining work is mainly:
- OpenLot hardening
- broader confidence
- final ops cutover

---

# 13. Final blunt summary

If you asked me right now:

## “Is the whole system fully production-ready today?”
**Not quite.**

## “Is it still mostly architecture work?”
**No.**

## “What is left?”
Mostly:
- OpenLot robustness / broader positive-result proof
- recurring production cutover
- clean production pinning

## “Could Domain + REA go live soon?”
**Yes. Very close.**

## “Has OpenLot moved from experimental to real?”
**Yes — materially.**
It is now integrated, queue-runner proven outside VIC, and no longer just an externally injected payload path.

## “Main current estimate?”
**~85% complete to go-live for the full 3-source national system.**

---

# 14. Suggested next command sequence for a new coding session

If a fresh coding agent is taking over, start here:

1. Read:
   - `HANDOVER.md`
   - `RLP-PIPELINE-OPS.md`
   - `RLP-HANDOVER-SCOUT.md`

2. Inspect current live core files:
   - `engine/production-buy-side-cycle.sh`
   - `engine/queue-runner.js`
   - `engine/scrapers/rea-apify.js`
   - `engine/scrapers/openlot-public.js`
   - `engine/openlot-browser-a2ui-runner.js`

3. Continue from the current frontier:
   - broaden OpenLot positive-result validations
   - harden OpenLot runtime/session stability
   - finalize recurring production cutover

---

End of handover.
