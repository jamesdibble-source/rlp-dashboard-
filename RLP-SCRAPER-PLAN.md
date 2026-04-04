# RLP Scraper Plan — Land-Only Daily Pipeline

## Product spec locked in from James (2 Apr 2026)
- Scope: **all lots for sale across Australia**
- Refresh cadence: **daily**
- Property type: **land**
- Preferred land-size band: **0–2,000 m²**
- Optional broader mode: **0–4,000 m²**
- Sources to support in the pipeline: **OpenLot, Domain, REA**

## What was implemented in this work cycle
### 1. Central land filter
Created `engine/lib/land-filter.js` so every source can share the same product rules:
- property type = land
- configurable min/max land size
- configurable min/max price sanity bounds
- normalized `propertyType`, `lotSize`, and `pricePerSqm`

### 2. Domain scraper upgraded to shared filters
Updated `engine/scrapers/domain-public.js` to:
- build search URLs with land-size filters
- normalize records through the shared land filter
- enforce a configurable `0–2000m²` default window
- support runtime overrides via options or env vars:
  - `RLP_MIN_LAND_SIZE`
  - `RLP_MAX_LAND_SIZE`
  - `RLP_MIN_PRICE`
  - `RLP_MAX_PRICE`

### 3. REA ingestion normalized to the same spec
Updated `engine/scrapers/rea-apify.js` to:
- use the same shared land filter helpers
- normalize `propertyType`, `lotSize`, and price fields consistently
- allow the same size-band rules as Domain

### 4. OpenLot adapter scaffold created
Added `engine/scrapers/openlot-public.js` with:
- URL builder
- transform hook
- shared lot filtering
- placeholder `scrapeSuburb()` contract

This means the engine now has a **proper multi-source contract**, even though the OpenLot parser itself still needs to be implemented.

## Immediate next build steps
1. Implement the OpenLot page parser against the live page structure
2. Add a source orchestrator so one suburb run can call `domain`, `openlot`, and optionally `rea`
3. Add source-priority merge logic in the DB layer / dedup layer
4. Add daily diff outputs: new, repriced, sold, removed
5. Add estate/developer direct-site adapters for estates that portals miss or mislabel

## Runtime examples
### Default band (0–2000m²)
```bash
node engine/scrape-discovered.js VIC
```

### Broader band (0–4000m²)
```bash
RLP_MAX_LAND_SIZE=4000 node engine/scrape-discovered.js VIC
```

### One suburb, custom band
```bash
RLP_MIN_LAND_SIZE=0 RLP_MAX_LAND_SIZE=2000 node engine/scrape-all.js --suburb Tarneit
```
