# Grange Land Intelligence — Gap Analysis & Feature Roadmap
## RPM + Oliver Hume vs. What We Have vs. What We'll Build

---

## PART 1: What RPM & Oliver Hume Deliver (Benchmark)

### RPM Group — Victorian Greenfield Market Report (Q3 2025)
**Published quarterly. ~26 pages. PDF only. Gated behind email signup.**

| Data Point | Detail | We Have? |
|---|---|---|
| **Gross Lot Sales** (quarterly) | 3,649 Q3 2025 (+16% QoQ, +54% YoY) | ❌ No — we track listings/sold counts but not quarterly transaction volume with QoQ/YoY deltas |
| **Median Lot Price** (metro-wide) | $399,000 (+1.5% QoQ) | ⚠️ Partial — we have avg price but not true median, no QoQ delta |
| **Median Lot Size** (metro-wide) | 355m² (+1.1% QoQ) | ⚠️ Same — avg not median, no QoQ |
| **Average Trading Days / DOM** | 177 days (improved from 185) | ❌ No — we scrape listing dates but don't compute DOM |
| **Total Available Stock** | 5,685 lots (down 5.5%) | ❌ No — we track current listings but not stock pipeline (future titled lots, estates in market) |
| **New Estate Launches** | 13 new estates in Q3 (highest since Q4 2021) | ❌ No — we don't track estates or new project launches |
| **Corridor Breakdown** (4 metro + regions): | | |
| — Western | 1,208 sales, $386K median, 360m², 49% titled | ⚠️ Partial — have corridor grouping + avg price/size, missing sales count, titled %, DOM |
| — Northern | 1,106 sales, $386.65K, 350m² | Same |
| — South Eastern | 957 sales, $437.5K, 364m² | ❌ No — no SE corridor data yet |
| — Greater Geelong | 378 sales, $376.9K, 390m², 338 DOM | ❌ No Geelong data yet |
| **Regional Markets** (Ballarat, Bendigo, Drouin/Warragul, Macedon/Mitchell) | Sales counts, median price, lot size, QoQ % changes | ⚠️ Have Ballarat data, missing others |
| **Buyer Demographics** | FHB 47%, upgraders 42%, Indian-born 46%, Aus 30% | ❌ No — we have no buyer data |
| **Buyer Budget Ranges** | Bulk $600K-$750K H&L | ❌ No |
| **Building Intent** | 52% build immediately, 54% purchased after 1 visit | ❌ No |
| **First Home Buyer Share of Loans** | 42% of OO loans in Q2 | ❌ No — macro data we don't aggregate |
| **Stock Returns** | Northern corridor returns -43% | ❌ No — we don't track listing withdrawals |
| **Titled vs Untitled Split** | 49% titled (Western), 61% titled (Geelong) | ❌ No — we don't distinguish titled/untitled |
| **Rebate/Incentive Tracking** | ~7.5% avg rebate, effective median $369K | ❌ No — rebates not scraped |
| **Economic Context** | GDP, CPI, cash rate, employment, consumer sentiment, population | ❌ No macro overlay |
| **Property Price Trends** | House/Unit/Lot median 10-year charts with YoY/2Y/5Y/10Y % changes | ❌ No historical trend charts |
| **Loan Commitments** | Owner occupier loans, FHB vs non-FHB, avg loan size | ❌ No |
| **Construction Activity** | Approvals, commencements, completions by dwelling type | ❌ No |

### Oliver Hume — Quarterly Market Insights (QMI, Dec 2025)
**Published quarterly. ~36 pages. PDF. Gated. 3 markets: Melbourne, SEQ, Adelaide.**

| Data Point | Detail | We Have? |
|---|---|---|
| **National Coverage** | Melbourne, SEQ, Adelaide (+ Sydney, Perth via Cotality) | ⚠️ Building — VIC + SA in DB, discovery running all 8 states |
| **Quarterly Sales Volume** | Mel: 2,137 Q4 (down 7% QoQ, +24% YoY). SEQ: 1,184 (-15% QoQ). Adl: 550 (-9% QoQ) | ❌ No quarterly transaction tracking |
| **Rolling 12-Month Sales** | Mel: ~9,100 lots in 2025 (+40% vs 2024). SEQ: -6% YoY. Adl: -13% YoY | ❌ No rolling annual aggregation |
| **Median Lot Price** | Mel: $408,000. SEQ: $498,400. Adl: $371,000 | ⚠️ We have avg, not median; no multi-state comparison |
| **Median Lot Size** | Mel: 392m². SEQ: 420m². Adl: 378m² | ⚠️ Same — avg not median |
| **$/m² Rate** | Mel: $1,041. SEQ: $1,187. Adl: $981 | ⚠️ Have rate but not at median level |
| **QoQ / YoY Price Growth** | Mel: +0.02% QoQ, +3% YoY. SEQ: +3.1% QoQ, +27.5% YoY. Adl: +6% QoQ, +27% YoY | ❌ No period-over-period delta tracking |
| **Corridor-Level Sales + Pricing** | Mel: Melton + Wyndham 43% of sales. SEQ: Logan top corridor. Adl: Playford #1 | ⚠️ Have corridor grouping but no sales volume per corridor |
| **Suburb-Level Pricing Map** | Prices at TWO standard lot sizes per suburb (e.g. 400m² and 448m² for VIC, 375m² and 400m² for SEQ, 300m² and 375m² for SA) | ❌ No — this is CRITICAL. They normalize to standard sizes per suburb |
| **Available Stock / Months of Supply** | SEQ: <0.5 months of supply. Mel: 5,685 lots (-5.5%) | ❌ No supply pipeline |
| **Rebate/Incentive Commentary** | "Rebates fallen back to normalised levels" | ❌ No incentive tracking |
| **CEO Market Commentary** | Julian Coppini narrative outlook | ❌ Can generate AI commentary |
| **Chief Economist Outlook** | Matt Bell: 3-market outlook with rate expectations, supply/demand | ❌ Can generate |
| **Commonly Sold Lot Dimensions** | VIC: 12.5x28m, 14x28m, 14x32m. SEQ: 12.5x30m, 12.5x28m, 12.5x32m | ❌ No lot dimensions, only m² |
| **Cross-Market Comparison** | Mel median vs SEQ vs Adl — price convergence tracking | ❌ No cross-market comparison tools |
| **Established Market Context** | Mel: underperforming Syd/Bris. 15% below historical benchmark. Replacement cost equation | ❌ No established dwelling market data |
| **Investor vs OO Split** | Implied through commentary | ❌ No |
| **FHB Lending Analysis** | MyFirstHome partnership, HGS, APRA DTI exemptions for new builds | ❌ No lending data |
| **Global Market Comparison** | Cotality: AU vs US/UK/NZ/Canada/China/Europe property indices | ❌ Not relevant for our product |
| **Proprietary Data Scale** | "338,000 new land and dwelling sales captured", 400+ projects, 45,000+ buyer profiles | ❌ They have 20+ years. We're at 4,909 lots day one |
| **Marketing/Design Content** | Home design trends, Black Friday campaign, digital vs traditional marketing | ❌ Not our product — they're a sales agency, we're a data platform |

#### Oliver Hume's Killer Feature: Suburb Price Map at Standard Lot Sizes
This is the single most valuable page in their report. For every active suburb, they show the **median price at two standard lot sizes** (e.g. Tarneit: 400m²=$425,500, 448m²=$479,900). This normalizes comparison across suburbs instantly. A developer scanning the map immediately sees: Mambourin 400m²=$461,800 vs Tarneit 400m²=$425,500 — that's $36K premium for Mambourin at the same lot size.

**We MUST replicate this.** It requires our lot-size adjustment table (which we have from Carl's training data) applied at the suburb level.

### Grange Internal RLP Methodology (from Carl/Dwayne training files)

| Data Point | Detail | We Have? |
|---|---|---|
| **RLP by Estate** | Individual estate pricing (Riverbank, Affinity, etc.) | ❌ No — we group by suburb, not estate |
| **NSA Rate ($/m²)** | Computed per lot | ✅ Yes |
| **For Sale vs Sold Status** | Per lot | ✅ Yes |
| **Lot Size Adjustment Table** | 0-10%→0%, 10-20%→2.24%, etc. to normalize to target size | ❌ Not implemented |
| **OPC (Opinion of Probable Cost)** | Per-LGA construction costs | ❌ No — need OPC database |
| **Wholesale Lot Price (WLP)** | Revenue - Cost - Hurdle ÷ Lots | ❌ No |
| **RLV/HA** | Residual Land Value per Hectare | ❌ No |
| **Product Classification** | Super PPB / PPB / BMV based on WLP | ❌ No |
| **LGA Ranking System** | Ranked by investment attractiveness | ❌ No |
| **Escalation Rates** | 3%, 5%, 7.4% scenarios over 1-8 years | ❌ No escalation modelling |
| **Market Pressure** | Increasing/Decreasing per LGA | ❌ No |
| **Property Cycle Clock** | Rising Market / Peak / Declining per LGA | ❌ No |
| **OPC @ Normalized Lot Size** | OPC adjusted to 500m² standard | ❌ No |
| **DCP per Lot** | Development contributions | ❌ No |
| **Englobo Comparables** | Large-lot (10ha+) sale prices $/ha | ❌ No |

---

## PART 2: What We Currently Have (Grange Land Intelligence v1)

| Feature | Status |
|---|---|
| National suburb discovery | ✅ VIC complete (835 suburbs), NSW running (544+), 6 states queued |
| SQLite database | ✅ 4,909 lots, 8 LGAs, 70 suburbs |
| Domain public scraping | ✅ Working (HTML parsing, rate limiting, dedup) |
| Price per lot | ✅ |
| Lot size per lot | ✅ |
| $/m² (NSA rate) per lot | ✅ |
| Sold vs Listed status | ✅ |
| Suburb/LGA/Corridor grouping | ✅ |
| State-level filtering | ✅ |
| Corridor comparison | ✅ |
| Distribution charts (price, size, rate) | ✅ |
| Top/bottom $/m² ranking | ✅ |
| Sold Only toggle | ✅ |
| Search + sort | ✅ |
| Stitch-designed UI | ✅ (James's Digital Archivist template) |

---

## PART 3: Feature Roadmap — Matching RPM/OH, Then Destroying Them

### TIER 1: MATCH RPM/OH (Must Have — Close the Gap)

| # | Feature | What It Does | How We Build It |
|---|---|---|---|
| 1 | **Median Calculations** | True median (not average) for price, size, rate at every level | Simple — sort + pick middle value from DB |
| 2 | **QoQ / YoY Delta** | % change vs last quarter and last year for every metric | Need time-series — tag scrape_date, compute period-over-period |
| 3 | **Days on Market (DOM)** | Listing date → sold date = DOM per lot | Scrape listing_date from Domain, compute delta when status flips to sold |
| 4 | **Quarterly Sales Volume** | Total transactions per quarter per corridor/LGA/suburb | Aggregate sold lots by scrape_date quarter |
| 5 | **Available Stock Count** | Current active listings at any point in time | Already have listings count — add historical snapshots |
| 6 | **Growth Corridor Coverage** | Western, Northern, South Eastern, Geelong, Regional VIC | Add SE corridor scraping (Casey, Cardinia), Geelong (G21) |
| 7 | **Historical Trend Charts** | Median price/size/rate over 8+ quarters | Build time-series from periodic scrapes. Backfill via Domain sold data |
| 8 | **Rebate/Incentive Tracking** | Capture "price guide", "offers from", discount language | Parse listing descriptions for rebate signals |
| 9 | **Estate-Level Grouping** | Group lots by estate name (Riverbank, Affinity, etc.) | Parse estate name from listing address/description |
| 10 | **Economic Macro Overlay** | GDP, CPI, cash rate, employment, population | Pull from ABS APIs (free), RBA data |
| 11 | **National State Data** | All 8 states with corridor definitions | Discovery + scraping pipeline (in progress) |

### TIER 2: EXCEED RPM/OH (Differentiation — Things They Can't Do)

| # | Feature | What It Does | Why It's Killer |
|---|---|---|---|
| 12 | **Real-Time Data** | Daily scraping, live dashboard | RPM/OH publish quarterly PDFs. We update daily. A developer checking Tuesday gets Tuesday's data, not last September's. |
| 13 | **Individual Lot Drill-Down** | Click any suburb → see every lot with address, price, size, date, DOM, listing link | RPM gives you corridor-level aggregates. We give you the actual lots. |
| 14 | **Custom Corridor Builder** | User defines their own corridors by selecting suburbs/LGAs | RPM uses fixed corridor definitions. A developer buying in Sunbury doesn't care about "Northern Corridor" — they want Sunbury + Diggers Rest + Gisborne. |
| 15 | **Price Alert System** | "Notify me when median $/m² in Melton drops below $900" | No one does this. Developers checking markets daily would kill for this. |
| 16 | **Sold Only Mode** | Strip unsold listings from all analytics | RPM mixes listed and sold. In a soft market, list prices inflate the picture. Our toggle shows reality. |
| 17 | **Lot Size Normalization** | Adjust all prices to a standard lot size (350m² metro, 467m² regional) using the adjustment table | Apples-to-apples comparison. A 600m² lot at $400K isn't comparable to a 350m² lot at $350K. Normalised rate tells the truth. |
| 18 | **OPC Integration** | Embedded OPC database per LGA with auto-calculation of Wholesale Lot Price | Developers don't just want to know the RLP — they want to know what they'd PAY for the land. WLP = (RLP - OPC - margin) / lots. This is deal-level intelligence. |
| 19 | **Feasibility Calculator** | Enter gross HA, NDH, lot size → get RLV/ha using live RLP + OPC data | Connect to our Australian Feaso Model. RPM tells you the market. We tell you whether the deal works. |
| 20 | **Competitor Estate Monitor** | Track specific estates: lot releases, sell-through rate, price changes over time | A developer in Wollert wants to know what Stockland is pricing at this week vs. last month. |

### TIER 3: DESTROY THEM (SaaS Moat — Things They'll Never Build)

| # | Feature | What It Does | Why It's Unassailable |
|---|---|---|---|
| 21 | **AI Market Commentary** | Auto-generated quarterly market reports per corridor, LGA, suburb | RPM pays Michael Staedler to write 26 pages. We generate corridor-specific reports for EVERY market, updated weekly, powered by the data we're already collecting. |
| 22 | **Predictive Pricing Model** | ML model: predict median lot price 3-6 months out based on sales velocity, stock levels, macro signals | No one in Australian resi land does this. A developer pricing lots in Q2 wants to know where the market will be in Q4. |
| 23 | **Supply Pipeline Intelligence** | Track planning permits, subdivision approvals, estate registrations from council APIs | Know how many lots are COMING before they hit market. A developer buying englobo needs to know competing supply 2-3 years out. |
| 24 | **Velocity Scoring** | Proprietary sell-through rate: lots sold per month per active estate, benchmarked against corridor average | RPM gives quarterly sales totals. We give granular velocity per estate — "Woodlea selling 45 lots/month vs corridor avg of 30." |
| 25 | **Investment Scorecard** | Auto-rate every LGA: population growth, price trend, supply/demand ratio, DOM trend, infrastructure investment → composite score | Grange's internal LGA Ranking on steroids. Automated, always current. A new analyst can open the tool and instantly see the top 20 LGAs nationally. |
| 26 | **Land Assembly Mode** | Map view: highlight all lots >2ha, filter by zoning, overlay PSP boundaries, show englobo sale comps | For developers sourcing sites. No one aggregates this data with RLP. |
| 27 | **Export to Feaso** | One click: export a suburb's RLP, OPC, average lot size into our Feaso Model for instant IRR calculation | The pipeline: Find market → Assess pricing → Model the deal → Make the offer. All in one platform. |
| 28 | **White-Label Reports** | Generate branded PDF reports with user's logo, custom corridor, custom date range | Oliver Hume charges $20K+ for bespoke reports. Our users generate them in 30 seconds. |
| 29 | **API Access** | RESTful API for enterprise users to pull data into their own models/dashboards | RPM and OH don't offer data APIs. Institutional investors and REITs want programmatic access. |
| 30 | **Multi-Source Cross-Reference** | Domain + REA + OpenLot + CoreLogic: same lot matched across sources, price discrepancy flagged | No single source is complete. Cross-referencing catches errors and gives confidence scores. |

---

## PART 4: Data Sources & How We Get There

| Data | Source | Status | Cost |
|---|---|---|---|
| Lot listings (national) | Domain public scrape | ✅ Working | Free |
| Lot listings (national) | Domain Developer API | 🔜 Next | Free (500/day) or paid |
| Lot listings (national) | REA via Apify | 🔜 Next | $49/mo |
| Sold data | Domain Sold section | ⚠️ Partial | Free |
| Sold data | CoreLogic RP Data | 💰 Need subscription | ~$5K/yr |
| OPC data | Grange internal OPC database | 📋 Need to digitize | Free |
| Economic macro | ABS.Stat API | 🔜 Easy | Free |
| Population | ABS quarterly estimates | 🔜 Easy | Free |
| Interest rates | RBA data tables | 🔜 Easy | Free |
| Consumer sentiment | Westpac-MI survey | 🔜 Easy | Free (published monthly) |
| Planning permits | Council open data / DELWP | 🔜 Medium | Free (varies by state) |
| Construction activity | ABS Building Approvals | 🔜 Easy | Free |
| Estate-level data | OpenLot.com.au scrape | 🔜 Medium | Free |
| Buyer demographics | Not available publicly | ❌ | RPM gets this from their sales agency — we can't match this |

---

## PART 5: Immediate Build Priority (Next 72 Hours)

### CRITICAL (from Oliver Hume analysis)
1. **Suburb Price Map at Standard Lot Sizes** — THE killer feature from OH. Show median price at 400m² and 448m² (VIC), 375m² and 400m² (SEQ), 300m² and 375m² (SA) for every suburb. Uses our adjustment table. This alone makes our tool instantly useful to any developer.
2. **Complete national discovery** (all 8 states) — already running
3. **Full lot scrape** on all discovered active suburbs — ~50K+ lots expected
4. **Implement median calculations** across all aggregation levels
5. **Cross-market comparison** — Melbourne vs SEQ vs Adelaide side-by-side (OH's key narrative is the convergence of Adelaide → Melbourne pricing)

### HIGH
6. **QoQ / YoY deltas** — every metric needs period-over-period change
7. **DOM tracking** — listing_date field, compute days on market
8. **Quarterly sales volume** — aggregate sold lots by quarter
9. **Corridor definitions for all states** — SEQ (Ipswich, Logan, Moreton Bay, Gold Coast, Brisbane, Redlands), Adelaide (Playford, Mt Barker, Onkaparinga, Light), VIC (add SE + Geelong)
10. **Available stock / months of supply** — current listings ÷ monthly sales rate

### MEDIUM
11. **Historical trend engine** — start building time-series from daily scrapes
12. **Estate name parsing** — extract estate from listing descriptions
13. **ABS macro data integration** — GDP, CPI, unemployment, population
14. **Commonly sold lot dimensions** — parse from descriptions where available
15. **Rebate/incentive detection** — parse listing text for "from", "offers", discount language

### Key Oliver Hume Market Data Points (for reference)
- **Melbourne Dec 2025:** $408K median, 392m², $1,041/m², ~9,100 annual sales (+40% YoY), 2,137 quarterly
- **SEQ Dec 2025:** $498.4K median, 420m², $1,187/m², 1,184 quarterly sales (-15% QoQ), 27.5% YoY price growth, <0.5 months supply
- **Adelaide Dec 2025:** $371K median, 378m², $981/m², 550 quarterly (-9% QoQ), 27% YoY price growth
- **Adelaide-Melbourne gap shrunk from $180K (mid-2022) to only $37K**
- **SEQ now more expensive than Melbourne on $/m² basis (14% premium)**
- **Melbourne: 15% below historical benchmark vs national median** — OH says "primed for outperformance"

---

## Summary

**RPM and Oliver Hume are quarterly PDF publishers.** They are research consultancies that happen to have data. Their product is a 26-page document that's outdated the day it ships.

**We are building a real-time data platform.** Our product is living, breathing intelligence that a developer can open at 7am Monday and see what happened in their market over the weekend. They can drill down from Australia → VIC → Western → Melton → Tarneit → see every individual lot. They can toggle Sold Only to strip noise. They can normalise lot sizes. They can run a feaso on the spot.

**The only thing RPM/OH have that we genuinely can't match** is buyer demographics (they get it from being sales agents on 400+ projects). Everything else — pricing, velocity, DOM, supply, trends, corridors — we can match with data and exceed with technology.

The moat: **once we have 12 months of daily scrape data, no one can catch us.** That time-series is the asset. Start now.
