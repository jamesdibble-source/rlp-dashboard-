# Executive Handover — RLP Dashboard / National Land Scraper

## Goal
Build a production-ready Australian **land-only** scraping system covering:
- Domain
- REA
- OpenLot

with:
- national coverage
- queue-first ingest
- daily refresh capability
- clean DB writes
- dashboard output + deploy
- unattended operation

## Current status
- **Whole 3-source system:** ~85% complete to go-live
- **Domain + REA national buy-side path:** ~90%+
- **Main remaining gap:** OpenLot broader positive-result confidence + final recurring cutover

## Current source status
- **Domain:** production-close
- **REA:** production-close, now live-validated in TAS/ACT/NT as well as core states
- **OpenLot:** materially improved; now first-class in queue-runner and proven positive outside VIC, but still the least mature source

## Biggest achievements to date
1. Built a **queue-first national scraper architecture**
2. Added **shared land-only filtering and normalization**
3. Integrated **Domain + REA + OpenLot** into one per-suburb source contract
4. Hardened **REA** with:
   - retries/failover
   - hard timeouts
   - paginated reads
   - broader live geography validation
5. Converted **OpenLot** from payload injection toward a **first-class live source**
6. Achieved real OpenLot-positive queue-runner results in:
   - VIC / Tarneit
   - NSW / Leppington
   - SA / Angle Vale
   - WA / Yanchep
7. Added **official unattended buy-side production wrapper**:
   - `engine/production-buy-side-cycle.sh`
8. Live-validated the production wrapper on bounded national smoke runs
9. Hardened queue creation/concurrency
10. Hardened DB dedup / cleaning alignment

## Biggest remaining blockers
1. **OpenLot broader robustness**
   - still needs more positive-result validation across more states/suburbs
   - browser runtime/session/tab stability still needs continued hardening
2. **Final recurring production cutover**
   - scheduler install / recurring go-live not fully enacted yet
3. **Production repo pinning / cutover hygiene**
   - final clean production state should be committed/pinned before true go-live

## Current honest summary
This is no longer a vague prototype.
It is now a real multi-source national scraping system with live validation across multiple states.
The remaining work is increasingly:
- OpenLot confidence
- ops cutover
- recurring production rollout

## Start here
For full context read:
1. `HANDOVER.md`
2. `SYSTEM_MAP.md`
3. `RLP-PIPELINE-OPS.md`
4. `RLP-HANDOVER-SCOUT.md`
