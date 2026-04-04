# Retail Lot Price (RLP) Intelligence Platform — Full Handover to Scout

**Prepared by:** Luna (Senior Development Manager, Grange Development)
**Date:** 30 March 2026
**Handover to:** Scout (Head of Research)

---

## 1. WHAT IS THIS PROJECT

A national retail lot price intelligence platform that tracks, analyses, and visualises greenfield land sales across all Australian states. Think of it as a real-time, always-updating version of what Research4/UDIA charge tens of thousands per year for, but better — graph-heavy, data-deep, and accessible.

**James's vision:**
- "Let's just get the fundamental basis of reporting retail lot pricing and trends and that analysis correct."
- **Phase 1:** Match competitor PDF reports with dynamic, always-updating data — no OPC/WLP/RLV/investment analysis (that's internal Grange tooling, separate).
- **Phase 2:** Predictive modelling, auto-research (Karpathy's tool), deal pipeline.
- **Graph-heavy, text-light** — 80% visualisation, 20% text.
- **Historical depth critical** — wants 5-10 year view if possible.
- **"All these guys just look at a one-point-in-time snapshot"** — our differentiator is time-series depth + dynamic daily updates.

---

## 2. REPOSITORIES & URLS

| Item | Location |
|------|----------|
| **Live dashboard** | `https://rlp-dashboard.pages.dev` |
| **GitHub repo** | Was waiting for James to create `rlp-dashboard` repo — local commits exist but may not be pushed. **Confirm with James.** |
| **Cloudflare Account** | `c06d03e1f7ae57b77cb8413945fea6bc` |
| **Deploy token** | Was at `/root/.openclaw-luna/credentials/cloudflare-token.txt` on old machine — James to confirm new path |
| **Apify token** | Was at `/root/.openclaw-luna/credentials/apify-token.txt` — James to confirm. Apify Starter plan, $49/mo. |
| **Local project directory** | Was at `rlp-project/` in the workspace |
| **Stitch design reference** | `rlp-project/stitch-design.html` (16.9KB) — James's original design, the gold standard |

---

## 3. ARCHITECTURE

### Data Pipeline
```
Discovery (one-off)          Scraping (daily cron)           Processing              Dashboard
───────────────────     ─────────────────────────────     ──────────────     ──────────────────────
discover-fast.js    →   Domain buy (scrape-discovered.js)     clean-data.js   →   build-v3.js
(per-state, resumable)  Domain sold (scrape-sold.js)      →   (9-step pipeline)    dashboard-template-v4.html
                        REA buy+sold (scrape-rea.js)          IQR outliers         → deploy to Cloudflare Pages
                        ↓                                     corridor assignment
                        SQLite (lots.db)                      stale detection
                                                              dedup
```

### Key Engine Files
| File | Purpose |
|------|---------|
| `engine/db.js` | SQLite database — lots, scrape_runs, price_history, daily_summary tables. Dedup engine (address normalisation + suburb + lot size). Cross-source merging. Price change tracking (>0.5% triggers history entry). |
| `engine/discover-fast.js` | One-state suburb discovery against Domain. Hits page 1, counts listing cards. Saves progress every 50 suburbs — fully resumable on crash. |
| `engine/scrapers/domain-public.js` | Domain.com.au HTML scraper (Cheerio). Rate limited at 1 req/800ms. 429 retry. **CRITICAL: Uses `__NEXT_DATA__` JSON blob, not HTML cards.** Domain renders only 3 HTML cards but full data (20-30 lots/page) in the `__NEXT_DATA__` JSON. The old parser found 3 lots/page; the new parser finds 20-30. This fix alone 4x'd the NSW data. Commit `64782c0`. |
| `engine/scrapers/domain-sold.js` | Domain.com.au sold listings scraper — gives 12-18 months of historical sales. |
| `engine/scrapers/rea-apify.js` | REA wrapper using Apify actor `abotapi/realestate-au-scraper`. Land-only filter, Kasada bypass, 70-100 listings/min. |
| `engine/scrape-national.js` | Parallel lot scraper — N concurrent workers from shared queue. Configurable concurrency/state/corridor. |
| `engine/scrape-discovered.js` | Domain scraper for all discovered active suburbs. Resumable. Exponential backoff on 429s. |
| `engine/scrape-rea.js` | Batch REA scraper (25 suburbs/batch). Uses Apify. |
| `engine/scrape-sold.js` | Domain sold listings scraper. |
| `engine/clean-data.js` | 9-step pipeline: FK-safe deletes, IQR outlier detection, stale detection (14d/30d), bulletproof dedup, corridor assignment (all states). |
| `engine/overnight-scrape.sh` | Master overnight pipeline: VIC→NSW→QLD→WA→SA→TAS→NT→ACT sequentially. |
| `engine/production-buy-side-cycle.sh` | Official unattended national buy-side entrypoint. Queue-first, repo-relative, drains the queue in repeated passes, then cleans/builds/deploys. |
| `engine/daily-scrape.sh` | Compatibility shim to `engine/production-buy-side-cycle.sh`. |
| `engine/daily-scrape-legacy.sh` | Preserved split-source fallback: Domain buy+sold → REA buy+sold → clean → build → deploy. |
| `engine/config/national-suburbs.js` | Original hand-picked 184 suburbs across 8 states, 34 corridors (superseded by discovery data). |
| `engine/data/au-postcodes.json` | Full Australian postcode database: 18,519 localities. |
| `engine/data/smart-suburbs.json` | 8,778 metro + regional filtered suburbs. |
| `engine/data/active-suburbs-{state}.json` | Per-state discovery results. |

### Dashboard Files
| File | Purpose |
|------|---------|
| `dashboard-template-v4.html` | Main template (57KB). 7 pages. |
| `build-v3.js` | Build script — pulls from SQLite, computes medians/quartiles/time-series, injects into template, outputs static HTML. |
| `DESIGN.md` | Design tokens from James's Stitch design. |
| `rlp-project/stitch-design.html` | James's original Stitch design — the aesthetic gold standard. |

### Database Schema
- **lots** — address, suburb, state, postcode, price, land_size, price_per_sqm, bedrooms, source (domain/rea), source_url, listing_type (buy/sold), sold_date, first_seen, last_seen, previous_price, price_change_pct, status, status_reason, corridor, lga, dedup_key
- **scrape_runs** — timestamp, source, state, suburb, lots_found, lots_new, lots_updated, errors
- **price_history** — lot_id, old_price, new_price, change_pct, detected_at
- **daily_summary** — date, state, corridor, suburb, listed_count, sold_count, median_price, median_size, median_rate

### Cron
- `0 16 * * *` UTC = 3am AEST daily
- Official unattended buy-side path now runs `production-buy-side-cycle.sh`
- `daily-scrape.sh` remains as a shim to that official wrapper
- `daily-scrape-legacy.sh` preserves the old split-source flow for fallback/debugging only
- **First automated run was scheduled for 30 March 2026** — may or may not have run depending on migration timing

---

## 4. CURRENT DATA STATUS (as of 30 March 2026)

### National Discovery — COMPLETE
| State | Active Suburbs |
|-------|---------------|
| VIC | 835 |
| NSW | 981 |
| QLD | 1,115 |
| WA | 448 |
| SA | 499 |
| TAS | 301 |
| NT | 56 |
| ACT | 63 |
| **Total** | **4,298** |

### Scrape Status — National Scrape Complete
| State | Lots Scraped |
|-------|-------------|
| VIC | 11,536 |
| NSW | 9,434 |
| WA | 8,498 |
| QLD | 5,658 |
| SA | 525 |
| TAS/NT/ACT | ~0 (may need re-scrape — pipeline may have ended after WA) |
| **Total** | **35,651** |

### Data Sources
- **REA (via Apify)** — PRIMARY source for land. Better coverage than Domain for greenfield lots.
- **Domain** — Supplementary. Weaker for land specifically.
- **OpenLot** — Secondary. Not yet scraped but identified as valuable.
- **CoreLogic** — For 5-10 year historical depth. Not yet integrated.

### Time-Series Data
- 10 quarters of sold data: 2023-Q1 through 2026-Q1
- 6,659 sold lots with dates (from Domain sold scraper)
- Domain sold gives 12-18 months of historical lookback

### Accuracy Benchmarks
- **Melbourne metro median (industry):** $402,750 / 361m² / $1,116/m² (R4/UDIA 2024) or $408,000 / 392m² / $1,041/m² (Oliver Hume Q4 2025)
- **Our VIC median at time of build:** ~$295,000 — skewed by Ballarat/regional inclusion. Metro-only filter should hit $400-410K range.
- **UDIA State of the Land 2025 nationals:** 38,690 sales (+25% YoY), Melbourne $403K, SEQ $417K, Adelaide $307K, Perth $329K, Sydney $667K, ACT $652K

---

## 5. DASHBOARD — CURRENT STATE (v5.0)

### 7 Pages
1. **Overview** — Hero scatter plot (every lot as clickable dot → jumps to Registry), "Key Market Themes" (AI-generated insights from live data), cross-market snapshot
2. **Pricing** — Median price trend (sold + listed + top corridor), price distributions, $/m² analysis, affordability squeeze (butterfly/divergence chart)
3. **Sales Velocity** — Quarterly sales volume, monthly sold volume, sell-through rates, new listings
4. **Corridors** — Corridor volume + $/m² trends over time, top suburbs per corridor
5. **Registry** — Full lot table with filtering, source URLs (clickable)
6. **Market Health** — 6 gauge placeholders: DOM, $/m² momentum, lot size trend, stock levels, velocity, cycle position
7. **Cross-Market** — Dual dropdown for state-vs-state or corridor-vs-corridor comparison

### Three-Way View Toggle
- **Both** — Full picture (all listings)
- **Sold** — Feasibility lens (completed transactions only)
- **For Sale** — Current market (active listings only)
- Flows through scatter, distributions, suburb profiles, registry

### Design Aesthetic
- **"Digital Archivist"** — James's Stitch design
- Light-mode, editorial/magazine feel
- Stone/cream backgrounds (`#fcf9f1`), archival grain texture
- Typography: Inter sans for metrics, Playfair Display serif for section headers, JetBrains Mono for code/numbers
- Purple `#513561` primary, sage `#486456`, rose `#61323a`, gold `#e09f3e`
- No borders (tonal shifts only), hairline grids (0.5px solid `#dcdad2`)
- Chart palette: archival/dune tones with gradient fills
- Material Symbols icons
- Info tooltips (ⓘ) on every section with "what it shows" + "how it's computed"

### Real Charts (replacing mocks)
- Median Price Trend (sold + listed + top corridor)
- Quarterly Sales Volume (sold counts per quarter)
- Corridor Volume + $/m² trends over time
- Monthly sold volume (12 months)
- Median lot size trend
- Suburb-level quarterly medians (top 20)
- State price convergence
- Affordability ranking
- Supply/demand balance

---

## 6. COMPETITOR LANDSCAPE

### Research4 (r4research.com.au)
- Institutional data provider powering UDIA reports
- Operating since 2005
- 4,451 estates monitored, 48 submarkets, 72 quarterly surveys
- Products: Metro Performance Reports, Submarket Performance Reports, National Greenfield Report, Strategic Reports, Custom Datacubes
- Expensive subscription, quarterly PDFs, no public SaaS tool
- **Our advantage:** Real-time vs quarterly, interactive vs PDF, national vs metro-focused

### GRIP Insights
- VIC-only SaaS
- Monthly updates, lot-level data
- UDIA PropTech Award winner
- **Our advantage:** National coverage, daily updates, deeper time-series

### Oliver Hume / RPM / Colliers
- Quarterly market reports, often metro-specific
- Paywall or client-only
- **Our advantage:** More granular (suburb-level, lot-level), more frequent, accessible

### Full competitor analysis in: `COMPETITOR-DEEP-ANALYSIS.md` (38KB+)

---

## 7. JAMES'S UNIMPLEMENTED FEEDBACK (PRIORITY LIST)

These are specific requests James made that haven't been built yet:

### HIGH PRIORITY
1. **Relative value scatter** — hover should show suburb name, bubble size = market size (number of lots)
2. **Months of stock** — use rolling 3-month average for baseline velocity (not total/total)
3. **Every tab needs suburb-level AND LGA-level filtering** — currently some tabs lack granular filters
4. **Corridors: LGA boundary maps** — Google Maps embed with cadastral overlay
5. **Corridors: top suburbs click through** to individual Suburb Profile page
6. **Sell-through and listings charts too small** — make bigger relative to available space
7. **Source listing links** — clickable Domain/REA URLs in Registry and Suburb Profile tables for data verification. Already stored in `source_url` field.

### MEDIUM PRIORITY
8. **User flagging** — flag icon on each lot → mark as "non-suitable comparison" with reason (bush block, steep, irregular shape, etc.) → excluded from median calculations → AI learns patterns over time
9. **Listing archival** — DB already persists permanently. When a source URL goes 404 (Domain/REA remove after 60-90 days), show "Verified on [date] at [price] from [source]" instead of broken link.
10. **Suburb Profile page** — exists as mock, needs full wiring: dropdown selector, individual lot scatter, neighbour comparison, price/size distributions, full lot table with source links
11. **Standard lot sizes dynamic per state** — VIC 350/400m², QLD 420/500m², SA 375/450m² (partially implemented)
12. **Compare page** — dual dropdown for side-by-side: state-vs-state, corridor-vs-corridor, suburb-vs-suburb

### FUTURE PHASE
13. **Predictive modelling** — on front page. Auto-research integration (Karpathy's tool).
14. **Lot depth and frontage** — can't scrape from Domain/REA, leave for later or find alternative source.
15. **OpenLot scraper** — identified as secondary source, not yet built.
16. **CoreLogic integration** — for 5-10 year historical depth.
17. **Move from SQLite to Supabase/Postgres** — needed for web frontend with live queries (currently static HTML rebuilt from SQLite).

---

## 8. KEY TECHNICAL LEARNINGS

### Domain Scraping
- **CRITICAL:** Domain renders only 3 HTML listing cards on the page, but the FULL dataset (20-30 lots/page) is in a `__NEXT_DATA__` JSON blob in the page source. The old HTML parser found 3 lots/page; the JSON parser finds 20-30. This single fix 4x'd the NSW data volume. **Do NOT revert to HTML parsing.**
- Rate limiting: 1 request per 800ms works fine, no 429s at this rate.
- Discovery scraper is single-threaded per state — concurrent processes caused SQLite lock crashes.
- Progress saves every 50 suburbs — fully resumable on crash.

### REA Scraping
- REA has Kasada bot protection — cannot scrape directly.
- Apify actor `abotapi/realestate-au-scraper` bypasses Kasada. Land-only filter. 70-100 listings/min.
- 25 suburbs per batch is the sweet spot for Apify runs.
- James is on Apify Starter ($49/mo) — 49 compute units.

### Data Quality
- Dedup key = normalised address + suburb + lot size. Cross-source merging handles Domain + REA duplicates.
- IQR outlier detection flags extreme prices/sizes.
- Stale detection: 14-day warning, 30-day flagged.
- Price changes >0.5% trigger price_history entries.
- VIC median skews low when regional included — Melbourne metro filter needed for benchmark comparison.

### Deploy
- **Cloudflare Pages branch must be `main`** (not `master`). Wrangler defaults to master. Deploys to wrong branch go to alias URL only — production root serves stale content. Always use `--branch=main`.
- **Always verify what the production URL actually serves after deploy** — don't trust the wrangler success message alone.

---

## 9. KEY INSIGHTS FOR ANALYSIS (JAMES'S THINKING)

These are strategic insights James shared that should inform how the platform presents data:

1. **Affordability ceiling at $300-350K** — when prices hit this, lot sizes shrink. The "squeeze" is the key story. Dual-axis chart (price + lot size over time) is critical.
2. **Relative value hierarchy** — location relative to neighbours matters more than absolute price. Premium/discount index vs corridor median.
3. **Time-series depth is the differentiator** — competitors give point-in-time snapshots. We show trends.
4. **Supply vs demand** — months of trading stock is the leading indicator. Rolling 3-month velocity average for baseline.
5. **DOM conversion** — days on market from listed to sold tells you demand intensity.
6. **Melbourne only 19% of national sales** (was 33% historically) — the national story has shifted. SEQ and Perth are the growth stories now.
7. **National dwelling shortfall: 393,000 homes** (UDIA 2025) — the macro backdrop for everything.

---

## 10. WHAT SCOUT SHOULD DO FIRST

### Immediate (Week 1)
1. **Locate the codebase** — confirm with James whether the repo was created on GitHub or if it's still local-only. Get it cloned.
2. **Verify the daily cron is running** — `0 16 * * *` UTC (3am AEST). Check if the data is updating daily.
3. **Check TAS/NT/ACT data** — these showed 0 lots in the final scrape. May need re-scraping.
4. **Verify the `__NEXT_DATA__` parser is the active one** — this is the single most important technical detail. If someone reverts to HTML parsing, data drops 4x.
5. **Compare Melbourne metro median against benchmarks** — should be $400-410K. If it's not, the metro filter or data coverage needs work.

### Near-Term (Weeks 2-3)
6. **Implement James's unimplemented feedback** (Section 7, items 1-7) — these are all specific, actionable requests.
7. **Wire the Suburb Profile page** — exists as mock, needs real data.
8. **Build the user flagging system** — flag inappropriate comparisons, exclude from medians.
9. **Add OpenLot as a data source** — secondary to REA but fills gaps.

### Medium-Term
10. **Move to Supabase/Postgres** — SQLite works for static builds but won't scale for live web queries.
11. **CoreLogic integration** for deep historical data.
12. **Predictive modelling / auto-research** integration.

---

## 11. THINGS TO NOT BREAK

- The `__NEXT_DATA__` JSON parser in `domain-public.js` (commit `64782c0`) — DO NOT revert to HTML card parsing
- The dedup logic in `db.js` — address normalisation + suburb + lot size key
- The daily pipeline order: scrape → clean → build → deploy
- The cron schedule (3am AEST)
- The Apify actor reference (`abotapi/realestate-au-scraper`)
- The Cloudflare deploy branch (`--branch=main`, not master)
- The three-way toggle architecture (Both/Sold/For Sale)
- James's Stitch design aesthetic — do NOT hand-code replacement layouts. Extend HIS design.

---

## 12. DATA FILES & CREDENTIALS

| Item | Old Path | Notes |
|------|----------|-------|
| SQLite database | `rlp-project/engine/data/lots.db` | 35,651 lots as of 30 Mar |
| Apify token | `/root/.openclaw-luna/credentials/apify-token.txt` | $49/mo Starter plan |
| Cloudflare token | `/root/.openclaw-luna/credentials/cloudflare-token.txt` | Shared with feaso model |
| Discovery data | `engine/data/active-suburbs-{state}.json` | 4,298 suburbs across 8 states |
| Postcode database | `engine/data/au-postcodes.json` | 18,519 Australian localities |
| Smart suburbs | `engine/data/smart-suburbs.json` | 8,778 filtered suburbs |
| GeoJSON | `grange-land-intel/public/aus-states.geojson` | 8-state boundaries (405KB) |
| Competitor analysis | `COMPETITOR-DEEP-ANALYSIS.md` | 38KB+ — R4, UDIA, GRIP, OH, RPM |
| Gap analysis | `RLP-GAP-ANALYSIS.md` | Phase 1 vs competitors |
| Feature list | `FEATURE-LIST.md` | Full Phase 1 + Phase 2 features |

**Note:** All paths above are from the OLD machine (`/root/.openclaw/workspace/` or `/root/.openclaw-luna/`). James migrated to a Mac Mini on 30 March. Confirm new paths.

---

## 13. CONTACTS & CONTEXT

- **James Dibble** — final decision maker on design and strategy. Has a very specific visual taste (Stitch design). Wants graph-heavy, text-light. Will give detailed voice note feedback.
- **Luna** — available for development management context if RLP analysis intersects with specific Grange projects (lot pricing in Murray Bridge, Wangaratta, etc.).
- **Vault** — the document processing engine. Has read ~2,000 project documents. If you need data from consultant reports, Vault may have extracted it into the shared brain.

---

*End of handover. The data engine is solid — 35,651 lots nationally, daily pipeline wired, all 8 states discovered. The main work now is making the dashboard match James's vision (beautiful, graph-heavy, deep time-series) and filling the gaps against institutional competitors like Research4. The data moat grows every day the cron runs.*

— Luna
