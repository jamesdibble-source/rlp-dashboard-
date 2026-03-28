# Grange Land Intelligence — Full Feature List
## Phase 1: Match the Reports (MVP)

### Overview Page
- [ ] Hero metrics: Total lots tracked, Median price, Median $/m², Median lot size, Active listings, Months of stock
- [ ] All metrics show QoQ and YoY delta with ▲▼ indicators
- [ ] National lot sales trend chart (quarterly, as far back as data allows)
- [ ] National median price trend chart (quarterly)
- [ ] Cross-market comparison: side-by-side cards for each capital city (price, size, $/m², sales, stock months)
- [ ] Market health indicators per city: ▲ Rising / ▬ Flat / ▼ Declining

### Pricing Page
- [ ] Median price trend chart — multi-year, per corridor (layered lines, different colours)
- [ ] $/m² trend chart — multi-year, per corridor
- [ ] Lot size trend chart — **THE key visual James described**: show how lot sizes shrink when prices hit affordability ceiling ($300-350K) — dual-axis chart: price on left, lot size on right, time on X
- [ ] Price distribution — bar chart in $25K or $50K bands
- [ ] $/m² distribution — bar chart
- [ ] Suburb price map at standard lot sizes (OH's killer feature) — table showing normalized price at 400m²/448m² per suburb
- [ ] Rebate/discount detection flags

### Corridors Page
- [ ] Corridor comparison bars — sales volume, median price, $/m², lot size
- [ ] Per-corridor detail cards: median price, QoQ, YoY, lot size trend, DOM, months of stock
- [ ] Corridor sales volume trend (quarterly, stacked area chart — shows corridor share shifting)
- [ ] **Relative value hierarchy** — what's the value of this corridor relative to its neighbours? Scatter plot: $/m² vs median price, bubble size = sales volume

### Registry Page (Suburb Drill-Down)
- [ ] Sortable table: suburb, LGA, corridor, lots, sold, listed, median price, median size, $/m², DOM
- [ ] Click suburb → individual lot list (address, price, size, $/m², date, status, listing link)
- [ ] Search + filter by name, corridor, price range, size range
- [ ] Lot size distribution per suburb (50m² bands)

### Market Health Page (NEW — the James insight)
- [ ] **Price cycle position per market**: Rising / Peak / Flattening / Declining / Bottom / Recovering — derived from:
  - DOM trend (falling = recovering, rising = softening)
  - $/m² trend (accelerating, steady, decelerating)
  - Lot size trend (shrinking = affordability pressure)
  - Stock levels (months of supply rising or falling)
  - Sales velocity trend
- [ ] **Affordability ceiling visualisation**: chart showing where lot prices cluster vs the $300-350K threshold
- [ ] **Supply vs demand gauge**: months of stock as a dial/gauge per market
- [ ] **Historical context panel**: "This market's current $/m² is X% above/below its 5-year average"
- [ ] **Neighbour comparison**: select a suburb → auto-show its 5 closest suburbs and relative positioning

### Cross-Market Page
- [ ] All capital cities on one page — same metrics, same layout, easy visual comparison
- [ ] Price convergence tracking: chart showing how Adelaide/Perth are catching Melbourne
- [ ] Affordability ranking: cheapest to most expensive by $/m²
- [ ] Sales momentum ranking: which markets are accelerating/decelerating

### Discovery Page
- [ ] Map view: all discovered suburbs with active listings, colour-coded by listing count
- [ ] Discovery stats per state: suburbs checked, active found, hit rate
- [ ] "Last scraped" timestamps

---

## Phase 2: Differentiate

- [ ] **Real-time daily updates** — scraping pipeline runs daily, all charts update
- [ ] **Sold Only toggle** — strip current listings from all analytics (already built)
- [ ] **Lot size normalization calculator** — "what would this lot cost at 400m²?" using the adjustment table
- [ ] **Price alerts** — user sets threshold, gets notified (email/push)
- [ ] **Custom corridor definitions** — user selects suburbs, saves as custom corridor
- [ ] **Historical sold data backfill** — scrape Domain sold section for 1-2 years of history
- [ ] **DOM tracking** — listing date → sold date → days on market per lot
- [ ] **Predictive pricing** — ML model on price trends per corridor
- [ ] **AI market commentary** — auto-generated weekly text summary per corridor

---

## Visualisation Priority (James wants graph-heavy, text-light)

Every page should be 80% charts, 20% text. Key chart types:

1. **Line charts** (multi-year trends) — price, $/m², lot size, sales volume
2. **Dual-axis charts** — price + lot size over time (the affordability squeeze story)
3. **Bar charts** — distributions (price bands, lot size bands), corridor comparisons
4. **Dune/area charts** — stacked corridor share of sales over time
5. **Scatter plots** — $/m² vs price per suburb (relative value positioning)
6. **Gauge/dial** — months of stock (supply indicator)
7. **Donut charts** — market composition (corridor share, sold vs listed)
8. **Horizontal bars** — suburb rankings (top/bottom $/m², most sales)
9. **Heat indicators** — ▲▼ arrows with green/red colour for QoQ/YoY changes
10. **Sparklines** — tiny inline trend charts next to each metric in tables
