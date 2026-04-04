/**
 * Grange RLP Intelligence Platform — V3
 * RPM-quality UI: editorial design, large hero numbers, clean typography,
 * dark teal/navy palette, magazine-quality data presentation
 */
const fs = require('fs');
const path = require('path');

const lotsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'lots.json'), 'utf8'));
const geoData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'vic-lga-tiny.geojson'), 'utf8'));

// Assign LGA + corridor (same logic as v2)
const SUBURB_LGA = {
  'Alfredton':'Ballarat','Bonshaw':'Ballarat','Lucas':'Ballarat','Winter Valley':'Ballarat','Sebastopol':'Ballarat',
  'Delacombe':'Ballarat','Miners Rest':'Ballarat','Mount Helen':'Ballarat','Brown Hill':'Ballarat',
  'Invermay Park':'Ballarat','Ballarat East':'Ballarat','Ballarat North':'Ballarat','Canadian':'Ballarat',
  'Mount Clear':'Ballarat','Wendouree':'Ballarat','Buninyong':'Ballarat','Ballarat Central':'Ballarat',
  'Lake Gardens':'Ballarat','Newington':'Ballarat','Redan':'Ballarat','Golden Point':'Ballarat',
  'Eureka':'Ballarat','Bakery Hill':'Ballarat','Nerrina':'Ballarat','Cardigan Village':'Ballarat',
  'Mitchell Park':'Ballarat','Lake Wendouree':'Ballarat','Ballarat':'Ballarat',
  'Wangaratta':'Wangaratta','Waldara':'Wangaratta','Glenrowan':'Wangaratta','Wangaratta South':'Wangaratta',
  'Murray Bridge':'Murray Bridge','Murray Bridge East':'Murray Bridge','Murray Bridge South':'Murray Bridge',
  'Gifford Hill':'Murray Bridge','Mobilong':'Murray Bridge','Riverglen':'Murray Bridge',
};
const LGA_CORRIDOR = {
  'Melton':'Western','Wyndham':'Western','Moorabool':'Western','Brimbank':'Western',
  'Hume':'Northern','Whittlesea':'Northern','Mitchell':'Northern',
  'Casey':'South Eastern','Cardinia':'South Eastern',
  'Greater Geelong':'Geelong','Surf Coast':'Geelong','Golden Plains':'Geelong',
  'Ballarat':'Regional — Ballarat','Greater Bendigo':'Regional — Bendigo',
  'Latrobe':'Regional — Gippsland','Baw Baw':'Regional — Gippsland',
  'Wangaratta':'Regional — North East','Greater Shepparton':'Regional — North East',
  'Macedon Ranges':'Regional — Macedon/Mitchell','Murray Bridge':'SA — Murray Bridge',
};

lotsData.forEach(l => {
  if (!l.lga) l.lga = SUBURB_LGA[l.suburb] || l.market || 'Unknown';
  l.corridor = LGA_CORRIDOR[l.lga] || 'Other';
});

function median(arr) { if(!arr.length) return 0; const s=[...arr].sort((a,b)=>a-b); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; }
function fmt$(n) { return '$' + Math.round(n).toLocaleString(); }

// Compute stats
const lgaStats = {};
lotsData.forEach(l => {
  if (!lgaStats[l.lga]) lgaStats[l.lga] = { lots: [], listings: 0, sold: 0 };
  lgaStats[l.lga].lots.push(l);
  if (l.status === 'Listing') lgaStats[l.lga].listings++;
  else lgaStats[l.lga].sold++;
});
for (const [lga, s] of Object.entries(lgaStats)) {
  s.count = s.lots.length;
  s.medPrice = Math.round(median(s.lots.map(l=>l.price)));
  s.medSize = Math.round(median(s.lots.map(l=>l.lotSize)));
  s.medPsm = Math.round(median(s.lots.map(l=>l.pricePerSqm)));
  s.corridor = s.lots[0]?.corridor || '';
  delete s.lots; // slim down for embedding
}

const totalLots = lotsData.length;
const totalListings = lotsData.filter(l=>l.status==='Listing').length;
const totalSold = lotsData.filter(l=>l.status==='Sold').length;
const overallMedianPrice = Math.round(median(lotsData.map(l=>l.price)));
const overallMedianPsm = Math.round(median(lotsData.map(l=>l.pricePerSqm)));
const overallMedianSize = Math.round(median(lotsData.map(l=>l.lotSize)));

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Grange — Victorian Land Market Intelligence</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=DM+Serif+Display&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
<style>
:root {
  --bg: #0a0f1a;
  --surface: #0f1628;
  --card: #141c2e;
  --card-hover: #1a243a;
  --border: rgba(255,255,255,0.06);
  --text: #e8ecf4;
  --text-secondary: #8b95a8;
  --text-dim: #5a6478;
  --accent: #4f9cf7;
  --accent-glow: rgba(79,156,247,0.15);
  --teal: #2dd4a8;
  --teal-glow: rgba(45,212,168,0.12);
  --coral: #f97066;
  --amber: #fbbf24;
  --purple: #a78bfa;
  --pink: #f472b6;
  --radius: 12px;
  --radius-lg: 16px;
}
* { margin:0; padding:0; box-sizing:border-box; }
body { background:var(--bg); color:var(--text); font-family:'Inter',sans-serif; -webkit-font-smoothing:antialiased; overflow-x:hidden; }

/* Scrollbar */
::-webkit-scrollbar { width:6px }
::-webkit-scrollbar-track { background:var(--bg) }
::-webkit-scrollbar-thumb { background:#2a3450; border-radius:3px }

/* Top Nav */
.topnav { position:sticky; top:0; z-index:100; background:rgba(10,15,26,0.85); backdrop-filter:blur(20px); border-bottom:1px solid var(--border); padding:0 40px; display:flex; align-items:center; justify-content:space-between; height:56px }
.topnav .brand { display:flex; align-items:center; gap:12px }
.topnav .brand h1 { font-family:'DM Serif Display',serif; font-size:18px; font-weight:400; letter-spacing:-0.3px }
.topnav .brand .tag { font-size:10px; font-weight:600; color:var(--teal); background:var(--teal-glow); padding:3px 10px; border-radius:20px; text-transform:uppercase; letter-spacing:1px }
.nav-links { display:flex; gap:0 }
.nav-link { padding:16px 20px; font-size:13px; font-weight:500; color:var(--text-secondary); cursor:pointer; transition:all .2s; border-bottom:2px solid transparent; text-decoration:none }
.nav-link:hover { color:var(--text) }
.nav-link.active { color:var(--accent); border-bottom-color:var(--accent) }

/* Hero Section */
.hero { padding:48px 40px 32px; background:linear-gradient(180deg,var(--surface) 0%,var(--bg) 100%) }
.hero-title { font-family:'DM Serif Display',serif; font-size:42px; font-weight:400; letter-spacing:-1px; line-height:1.1; margin-bottom:8px }
.hero-sub { font-size:15px; color:var(--text-secondary); font-weight:400; max-width:600px; line-height:1.6 }
.hero-stats { display:flex; gap:48px; margin-top:32px; flex-wrap:wrap }
.hero-stat { }
.hero-stat .hs-val { font-size:44px; font-weight:800; letter-spacing:-2px; line-height:1 }
.hero-stat .hs-val.teal { color:var(--teal) }
.hero-stat .hs-val.accent { color:var(--accent) }
.hero-stat .hs-val.coral { color:var(--coral) }
.hero-stat .hs-label { font-size:12px; font-weight:600; color:var(--text-dim); text-transform:uppercase; letter-spacing:1px; margin-top:6px }
.hero-stat .hs-delta { font-size:12px; font-weight:500; margin-top:4px }
.delta-up { color:var(--teal) }
.delta-down { color:var(--coral) }

/* Section */
.section { padding:32px 40px }
.section-title { font-family:'DM Serif Display',serif; font-size:28px; font-weight:400; margin-bottom:6px }
.section-sub { font-size:13px; color:var(--text-secondary); margin-bottom:24px }
.divider { height:1px; background:var(--border); margin:0 40px }

/* Metric Cards (RPM style) */
.metric-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:16px; margin-bottom:24px }
.metric-card { background:var(--card); border:1px solid var(--border); border-radius:var(--radius); padding:20px 24px; transition:all .3s; position:relative; overflow:hidden }
.metric-card:hover { background:var(--card-hover); border-color:rgba(79,156,247,0.2) }
.metric-card::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; background:linear-gradient(90deg,var(--accent),var(--teal)); opacity:0; transition:opacity .3s }
.metric-card:hover::before { opacity:1 }
.mc-val { font-size:32px; font-weight:800; letter-spacing:-1.5px; line-height:1 }
.mc-label { font-size:11px; font-weight:600; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.8px; margin-top:6px }
.mc-sub { font-size:12px; color:var(--text-secondary); margin-top:8px }
.mc-trend { display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:600; padding:2px 8px; border-radius:4px; margin-top:8px }
.mc-trend.up { background:rgba(45,212,168,0.1); color:var(--teal) }
.mc-trend.down { background:rgba(249,112,102,0.1); color:var(--coral) }

/* Map */
.map-container { border-radius:var(--radius-lg); overflow:hidden; border:1px solid var(--border); height:560px; position:relative }
#map { height:100%; background:var(--surface) }
.map-overlay { position:absolute; top:16px; right:16px; background:rgba(10,15,26,0.92); backdrop-filter:blur(12px); padding:14px 18px; border-radius:var(--radius); border:1px solid var(--border); z-index:999; min-width:160px }
.map-overlay h4 { font-size:11px; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:1px; margin-bottom:10px }
.map-leg-item { display:flex; align-items:center; gap:8px; font-size:11px; color:var(--text-secondary); margin-bottom:5px }
.map-leg-color { width:24px; height:8px; border-radius:4px }
.map-info { position:absolute; bottom:16px; left:16px; background:rgba(10,15,26,0.92); backdrop-filter:blur(12px); padding:10px 16px; border-radius:var(--radius); border:1px solid var(--border); z-index:999; font-size:11px; color:var(--text-secondary) }

/* Chart Cards */
.chart-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px }
.chart-card { background:var(--card); border:1px solid var(--border); border-radius:var(--radius); padding:24px; transition:all .3s }
.chart-card:hover { border-color:rgba(79,156,247,0.15) }
.chart-card.span-2 { grid-column:span 2 }
.chart-card h3 { font-size:16px; font-weight:700; margin-bottom:4px }
.chart-card .cc-sub { font-size:11px; color:var(--text-dim); margin-bottom:16px }
canvas { max-height:340px }

/* Data Table (RPM style) */
.table-wrapper { background:var(--card); border:1px solid var(--border); border-radius:var(--radius); overflow:hidden }
.table-wrapper table { width:100%; border-collapse:collapse }
.table-wrapper th { text-align:left; padding:14px 20px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:var(--text-dim); background:rgba(0,0,0,0.2); border-bottom:1px solid var(--border) }
.table-wrapper td { padding:14px 20px; border-bottom:1px solid var(--border); font-size:13px; font-weight:500 }
.table-wrapper tr { transition:background .15s }
.table-wrapper tr:hover td { background:rgba(79,156,247,0.03) }
.table-wrapper .td-link { color:var(--accent); cursor:pointer; font-weight:600 }
.table-wrapper .td-link:hover { text-decoration:underline }

/* Corridor Chips */
.corridor-chip { display:inline-block; padding:3px 10px; border-radius:20px; font-size:10px; font-weight:600; letter-spacing:0.5px }
.chip-western { background:rgba(79,156,247,0.12); color:var(--accent) }
.chip-northern { background:rgba(45,212,168,0.12); color:var(--teal) }
.chip-se { background:rgba(249,112,102,0.12); color:var(--coral) }
.chip-geelong { background:rgba(167,139,250,0.12); color:var(--purple) }
.chip-regional { background:rgba(251,191,36,0.12); color:var(--amber) }

/* Panels */
.panel { display:none }
.panel.active { display:block }

/* Filter Bar */
.filter-bar { display:flex; flex-wrap:wrap; gap:12px; margin-bottom:24px; align-items:flex-end }
.fb-group { display:flex; flex-direction:column; gap:4px }
.fb-group label { font-size:10px; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:1px }
.fb-group select, .fb-group input[type=number] { background:var(--surface); color:var(--text); border:1px solid var(--border); border-radius:8px; padding:8px 14px; font-size:12px; font-weight:500; min-width:130px }
.fb-group select:focus, .fb-group input:focus { outline:none; border-color:var(--accent) }
.fb-check { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--text); cursor:pointer; padding-top:6px }
.fb-check input { accent-color:var(--accent) }

/* Benchmark Section */
.bench-section { background:linear-gradient(135deg,#0d1a2a,#0f1628); border:1px solid var(--border); border-radius:var(--radius-lg); padding:28px; margin-bottom:16px }
.bench-section h3 { font-size:18px; font-weight:700; margin-bottom:4px; display:flex; align-items:center; gap:10px }
.bench-tag { font-size:9px; font-weight:700; color:var(--accent); background:var(--accent-glow); padding:3px 10px; border-radius:20px; text-transform:uppercase; letter-spacing:1px }
.bench-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:10px; margin-top:16px }
.bench-item { display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:rgba(255,255,255,0.02); border-radius:8px; border:1px solid rgba(255,255,255,0.03) }
.bench-item:hover { background:rgba(255,255,255,0.04) }
.bi-label { font-size:11px; color:var(--text-secondary) }
.bi-val { font-size:14px; font-weight:700 }
.bench-note { font-size:11px; color:var(--text-dim); margin-top:14px; line-height:1.6; padding:12px 14px; background:rgba(251,191,36,0.05); border-left:3px solid var(--amber); border-radius:0 8px 8px 0 }

/* Footer */
.footer { padding:40px; text-align:center; color:var(--text-dim); font-size:11px; border-top:1px solid var(--border) }

/* Responsive */
@media(max-width:900px) { .chart-grid{grid-template-columns:1fr} .chart-card.span-2{grid-column:span 1} .hero-stats{gap:24px} .hero-title{font-size:28px} .hero-stat .hs-val{font-size:32px} }
@media(max-width:600px) { .section,.hero{padding:20px} .topnav{padding:0 16px} }

/* Animations */
@keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
.fade-up { animation:fadeUp .5s ease-out }
</style>
</head>
<body>

<!-- Top Navigation -->
<nav class="topnav">
  <div class="brand">
    <h1>Grange</h1>
    <span class="tag">Land Intelligence</span>
  </div>
  <div class="nav-links">
    <a class="nav-link active" onclick="showPanel('overview')" data-p="overview">Overview</a>
    <a class="nav-link" onclick="showPanel('corridors')" data-p="corridors">Growth Corridors</a>
    <a class="nav-link" onclick="showPanel('analysis')" data-p="analysis">Price Analysis</a>
    <a class="nav-link" onclick="showPanel('velocity')" data-p="velocity">Sales Velocity</a>
    <a class="nav-link" onclick="showPanel('benchmarks')" data-p="benchmarks">Market Benchmarks</a>
  </div>
</nav>

<!-- OVERVIEW -->
<div class="panel active" id="p-overview">
  <div class="hero fade-up">
    <div class="hero-title">Victorian Retail Lot Price<br>Market Intelligence</div>
    <div class="hero-sub">Real-time tracking of residential land prices across Victoria's growth corridors and regional markets. Data sourced from REA, Domain, and CoreLogic.</div>
    <div class="hero-stats">
      <div class="hero-stat"><div class="hs-val teal">${totalLots.toLocaleString()}</div><div class="hs-label">Lots Tracked</div></div>
      <div class="hero-stat"><div class="hs-val accent">${fmt$(overallMedianPrice)}</div><div class="hs-label">Median Price</div></div>
      <div class="hero-stat"><div class="hs-val">${fmt$(overallMedianPsm)}/m²</div><div class="hs-label">Median NSA Rate</div></div>
      <div class="hero-stat"><div class="hs-val coral">${overallMedianSize}m²</div><div class="hs-label">Median Lot Size</div></div>
      <div class="hero-stat"><div class="hs-val">${Object.keys(lgaStats).length}</div><div class="hs-label">LGAs</div></div>
    </div>
  </div>
  <div class="divider"></div>
  <div class="section">
    <div class="section-title">Victoria at a Glance</div>
    <div class="section-sub">Click any LGA on the map to drill down into suburb-level data</div>
    <div class="map-container">
      <div id="map"></div>
      <div class="map-overlay">
        <h4>Median $/m²</h4>
        <div class="map-leg-item"><div class="map-leg-color" style="background:#ef4444"></div>> $800</div>
        <div class="map-leg-item"><div class="map-leg-color" style="background:#f97316"></div>$600 – $800</div>
        <div class="map-leg-item"><div class="map-leg-color" style="background:#eab308"></div>$400 – $600</div>
        <div class="map-leg-item"><div class="map-leg-color" style="background:#22c55e"></div>$300 – $400</div>
        <div class="map-leg-item"><div class="map-leg-color" style="background:#3b82f6"></div>$200 – $300</div>
        <div class="map-leg-item"><div class="map-leg-color" style="background:#a855f7"></div>< $200</div>
      </div>
      <div class="map-info">${Object.keys(lgaStats).length} LGAs with data • ${totalLots.toLocaleString()} lots</div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">LGA Performance</div>
    <div class="section-sub">All Victorian local government areas with active residential land market data</div>
    <div class="filter-bar">
      <div class="fb-group"><label>Corridor</label><select id="fCorridor" onchange="updateTable()"><option value="all">All Corridors</option></select></div>
      <div class="fb-group"><label>Sort By</label><select id="fSort" onchange="updateTable()">
        <option value="count-desc">Most Lots</option><option value="medPrice-desc">Highest Price</option><option value="medPrice-asc">Lowest Price</option>
        <option value="medPsm-desc">Highest $/m²</option><option value="medSize-desc">Largest Lots</option>
      </select></div>
    </div>
    <div class="table-wrapper">
      <table><thead><tr><th>LGA</th><th>Corridor</th><th>Total</th><th>Listings</th><th>Sold</th><th>Median Price</th><th>Median Size</th><th>Median $/m²</th></tr></thead>
      <tbody id="lgaTbody"></tbody></table>
    </div>
  </div>
</div>

<!-- CORRIDORS -->
<div class="panel" id="p-corridors">
  <div class="section">
    <div class="section-title">Growth Corridor Analysis</div>
    <div class="section-sub">Performance across Melbourne's metropolitan and regional growth corridors</div>
    <div class="metric-row" id="corridorMetrics"></div>
    <div class="chart-grid">
      <div class="chart-card"><h3>Median Lot Price</h3><div class="cc-sub">By growth corridor</div><canvas id="cCorP"></canvas></div>
      <div class="chart-card"><h3>Median $/m²</h3><div class="cc-sub">NSA rate comparison</div><canvas id="cCorPsm"></canvas></div>
      <div class="chart-card"><h3>Active Lot Count</h3><div class="cc-sub">Total lots tracked per corridor</div><canvas id="cCorCount"></canvas></div>
      <div class="chart-card"><h3>Median Lot Size</h3><div class="cc-sub">Average product being delivered</div><canvas id="cCorSize"></canvas></div>
    </div>
  </div>
</div>

<!-- ANALYSIS -->
<div class="panel" id="p-analysis">
  <div class="section">
    <div class="section-title">Price Analysis</div>
    <div class="section-sub">Deep dive into pricing dynamics, size relationships, and market trends</div>
    <div class="filter-bar">
      <div class="fb-group"><label>Market</label><select id="aMarket" onchange="updateAnalysis()"><option value="all">All Markets</option></select></div>
      <div class="fb-group"><label>Status</label><select id="aStatus" onchange="updateAnalysis()"><option value="all">All</option><option value="Listing">Listing</option><option value="Sold">Sold</option></select></div>
      <div class="fb-group"><label>Min Size (m²)</label><input type="number" id="aMinS" value="150" onchange="updateAnalysis()"></div>
      <div class="fb-group"><label>Max Size (m²)</label><input type="number" id="aMaxS" value="2000" onchange="updateAnalysis()"></div>
      <label class="fb-check"><input type="checkbox" id="aOut" checked onchange="updateAnalysis()"> Show Outliers</label>
    </div>
    <div class="metric-row" id="analysisMetrics"></div>
    <div class="chart-grid">
      <div class="chart-card"><h3>Price vs Lot Size</h3><div class="cc-sub">Each dot represents a single lot, colour-coded by market</div><canvas id="cS1"></canvas></div>
      <div class="chart-card"><h3>$/m² vs Lot Size</h3><div class="cc-sub">The key relationship — how NSA rate varies with lot size</div><canvas id="cS2"></canvas></div>
      <div class="chart-card span-2"><h3>Size Band Analysis</h3><div class="cc-sub">Average price and count across standardised lot size bands</div><canvas id="cBands"></canvas></div>
      <div class="chart-card span-2"><h3>Monthly Median $/m² Trend</h3><div class="cc-sub">How the NSA rate has moved month-to-month across markets</div><canvas id="cTime"></canvas></div>
    </div>
    <div class="bench-section" style="margin-top:24px">
      <h3>RLP Size Adjustment Table <span class="bench-tag">Prorating</span></h3>
      <div class="section-sub" style="margin-bottom:12px">Normalises lot prices to a standard lot size (350m² metro / 467m² regional). Based on Grange empirical analysis across Australian greenfield markets.</div>
      <div class="table-wrapper">
        <table><thead><tr><th>Size Change</th><th>Adjustment</th><th>Example (Base: $350K)</th></tr></thead>
        <tbody>
          <tr><td>0 – 10%</td><td>0.00%</td><td>$350,000</td></tr>
          <tr><td>10 – 20%</td><td>2.24%</td><td>$357,840</td></tr>
          <tr><td>20 – 30%</td><td>5.40%</td><td>$368,900</td></tr>
          <tr><td>30 – 40%</td><td>12.61%</td><td>$394,135</td></tr>
          <tr><td>40 – 50%</td><td>17.37%</td><td>$410,795</td></tr>
          <tr><td>50 – 60%</td><td>24.39%</td><td>$435,365</td></tr>
          <tr><td>60 – 70%</td><td>38.66%</td><td>$485,310</td></tr>
        </tbody></table>
      </div>
    </div>
  </div>
</div>

<!-- VELOCITY -->
<div class="panel" id="p-velocity">
  <div class="section">
    <div class="section-title">Sales Velocity</div>
    <div class="section-sub">Monthly absorption rates and listing-to-sold conversion tracking</div>
    <div class="metric-row" id="velMetrics"></div>
    <div class="chart-grid">
      <div class="chart-card span-2"><h3>Monthly Sales Volume</h3><div class="cc-sub">Lots transitioning from listing to sold, stacked by market</div><canvas id="cVel"></canvas></div>
      <div class="chart-card"><h3>Listings vs Sold</h3><div class="cc-sub">Current market balance per LGA</div><canvas id="cLS"></canvas></div>
      <div class="chart-card"><h3>Sales Distribution</h3><div class="cc-sub">Share of sold lots by market</div><canvas id="cPie"></canvas></div>
    </div>
  </div>
</div>

<!-- BENCHMARKS -->
<div class="panel" id="p-benchmarks">
  <div class="section">
    <div class="section-title">Market Benchmarks</div>
    <div class="section-sub">External reference data from RPM, Oliver Hume, and industry reports</div>
    <div class="bench-section">
      <h3>RPM Victorian Greenfield <span class="bench-tag">Q3 2025</span></h3>
      <div class="bench-grid">
        <div class="bench-item"><span class="bi-label">Melbourne Median Lot</span><span class="bi-val">$399,000</span></div>
        <div class="bench-item"><span class="bi-label">Effective (post 7.5% rebate)</span><span class="bi-val" style="color:var(--amber)">~$369,100</span></div>
        <div class="bench-item"><span class="bi-label">Median Lot Size</span><span class="bi-val">355m²</span></div>
        <div class="bench-item"><span class="bi-label">Quarterly Sales</span><span class="bi-val">3,649</span></div>
        <div class="bench-item"><span class="bi-label">Avg Days on Market</span><span class="bi-val">177</span></div>
        <div class="bench-item"><span class="bi-label">Available Stock</span><span class="bi-val">5,685</span></div>
        <div class="bench-item"><span class="bi-label">Western — Price</span><span class="bi-val">$386,000</span></div>
        <div class="bench-item"><span class="bi-label">Western — Size</span><span class="bi-val">360m²</span></div>
        <div class="bench-item"><span class="bi-label">Western — Q Sales</span><span class="bi-val">1,208</span></div>
        <div class="bench-item"><span class="bi-label">Northern — Price</span><span class="bi-val">$386,650</span></div>
        <div class="bench-item"><span class="bi-label">Northern — Size</span><span class="bi-val">350m²</span></div>
        <div class="bench-item"><span class="bi-label">Northern — Q Sales</span><span class="bi-val">1,106</span></div>
        <div class="bench-item"><span class="bi-label">SE — Price</span><span class="bi-val">$437,500</span></div>
        <div class="bench-item"><span class="bi-label">Geelong — Price</span><span class="bi-val">$376,900</span></div>
        <div class="bench-item"><span class="bi-label">Ballarat — Price</span><span class="bi-val">$285,000</span></div>
        <div class="bench-item"><span class="bi-label">Bendigo — Price</span><span class="bi-val">$262,000</span></div>
      </div>
      <div class="bench-note">⚠️ Developers offering 5-10% rebates on titled/near-titled lots. Headline median $399K but effective ~$369K. House commencements at 8-year low (7,531 in Q2) — supply constraint will push prices. Residential land loan commitments +42% in Q3.</div>
    </div>
    <div class="bench-section">
      <h3>RPM Economic Context <span class="bench-tag">Oct 2025 Report</span></h3>
      <div class="bench-grid">
        <div class="bench-item"><span class="bi-label">RBA Cash Rate</span><span class="bi-val">3.60%</span></div>
        <div class="bench-item"><span class="bi-label">Annual CPI</span><span class="bi-val" style="color:var(--amber)">3.24%</span></div>
        <div class="bench-item"><span class="bi-label">Wage Growth</span><span class="bi-val" style="color:var(--teal)">3.37%</span></div>
        <div class="bench-item"><span class="bi-label">VIC Unemployment</span><span class="bi-val">4.7%</span></div>
        <div class="bench-item"><span class="bi-label">Consumer Sentiment</span><span class="bi-val" style="color:var(--amber)">92.1</span></div>
        <div class="bench-item"><span class="bi-label">VIC Pop Growth</span><span class="bi-val" style="color:var(--teal)">+124,588</span></div>
        <div class="bench-item"><span class="bi-label">Med. House Price</span><span class="bi-val">$954,500</span></div>
        <div class="bench-item"><span class="bi-label">Med. Unit Price</span><span class="bi-val">$645,500</span></div>
        <div class="bench-item"><span class="bi-label">FHB Avg Loan</span><span class="bi-val">$528,426</span></div>
        <div class="bench-item"><span class="bi-label">FHB Share of OO</span><span class="bi-val">42%</span></div>
        <div class="bench-item"><span class="bi-label">Auction Clearance</span><span class="bi-val">81.5%</span></div>
        <div class="bench-item"><span class="bi-label">Dwelling Approvals Q2</span><span class="bi-val">12,662</span></div>
      </div>
    </div>
    <div class="bench-section">
      <h3>RPM Feb 2026 Monthly Update <span class="bench-tag">Latest</span></h3>
      <div class="bench-grid">
        <div class="bench-item"><span class="bi-label">Melbourne Median Lot</span><span class="bi-val" style="color:var(--teal)">$402,000 <small>+1.3%</small></span></div>
        <div class="bench-item"><span class="bi-label">Melbourne Lot Size</span><span class="bi-val">353m²</span></div>
        <div class="bench-item"><span class="bi-label">Geelong Median</span><span class="bi-val">$389,000 <small style="color:var(--coral)">-4% YoY</small></span></div>
        <div class="bench-item"><span class="bi-label">Gross Lot Sales (Feb)</span><span class="bi-val" style="color:var(--teal)">1,169 <small>+41% YoY</small></span></div>
        <div class="bench-item"><span class="bi-label">Top Corridor</span><span class="bi-val">Northern (27%)</span></div>
        <div class="bench-item"><span class="bi-label">Ballarat Share</span><span class="bi-val" style="color:var(--teal)">9% (surging)</span></div>
      </div>
      <div class="bench-note">Purchaser sentiment remained intact despite the February rate rise. Northern corridor overtook Western for highest share of sales. Ballarat surging on affordable price points. Developer rebates and incentives remain critical for offsetting reduced borrowing capacity.</div>
    </div>
    <div class="chart-grid" style="margin-top:16px">
      <div class="chart-card span-2"><h3>Our Data vs RPM Benchmarks</h3><div class="cc-sub">Comparing Grange scraped median prices against RPM reported figures</div><canvas id="cBench"></canvas></div>
    </div>
  </div>
</div>

<!-- LGA Detail (shown on click) -->
<div class="panel" id="p-lgaDetail">
  <div class="section">
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px">
      <button onclick="showPanel('overview')" style="background:var(--card);border:1px solid var(--border);color:var(--accent);padding:10px 20px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600">← Back to Victoria</button>
      <div>
        <div id="lgaName" style="font-family:'DM Serif Display',serif;font-size:28px"></div>
        <span id="lgaCorridor" class="corridor-chip chip-regional"></span>
      </div>
    </div>
    <div class="metric-row" id="lgaMetrics"></div>
    <div class="chart-grid">
      <div class="chart-card"><h3>Price vs Size</h3><canvas id="cLgaS"></canvas></div>
      <div class="chart-card"><h3>$/m² Distribution</h3><canvas id="cLgaH"></canvas></div>
    </div>
    <div class="section-title" style="margin-top:16px">Suburb Breakdown</div>
    <div class="table-wrapper" style="margin-top:12px">
      <table><thead><tr><th>Suburb</th><th>Lots</th><th>Listings</th><th>Sold</th><th>Med. Price</th><th>Med. Size</th><th>Med. $/m²</th></tr></thead>
      <tbody id="subTbody"></tbody></table>
    </div>
  </div>
</div>

<div class="footer">© 2026 Grange Development Pty Ltd — Retail Lot Price Intelligence Platform v3.0 • Data updated continuously</div>

<script>
const ALL=${JSON.stringify(lotsData)};
const GEO=${JSON.stringify(geoData)};
const STATS=${JSON.stringify(lgaStats)};
const C=['#4f9cf7','#2dd4a8','#f97066','#a78bfa','#f472b6','#fbbf24','#34d399','#818cf8','#fb923c','#06b6d4','#84cc16','#f43f5e','#8b5cf6','#d946ef'];
let charts={};

function med(a){if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);const m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2}
function f$(n){return '$'+Math.round(n).toLocaleString()}

// Panel nav
function showPanel(id){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(n=>n.classList.remove('active'));
  const p=document.getElementById('p-'+id);
  if(p){p.classList.add('active');p.classList.add('fade-up')}
  const n=document.querySelector('.nav-link[data-p="'+id+'"]');
  if(n)n.classList.add('active');
  window.scrollTo(0,0);
}

// Init filters
const allLgas=[...new Set(ALL.map(l=>l.lga))].sort();
const allCorridors=[...new Set(ALL.map(l=>l.corridor))].sort();
document.getElementById('fCorridor').innerHTML='<option value="all">All Corridors</option>'+allCorridors.map(c=>'<option value="'+c+'">'+c+'</option>').join('');
document.getElementById('aMarket').innerHTML='<option value="all">All Markets</option>'+allLgas.map(m=>'<option value="'+m+'">'+m+'</option>').join('');

// Map
const map=L.map('map',{zoomControl:true,scrollWheelZoom:true}).setView([-37.5,145.2],7);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{attribution:'©CARTO',maxZoom:18}).addTo(map);
function gc(psm){return psm>800?'#ef4444':psm>600?'#f97316':psm>400?'#eab308':psm>300?'#22c55e':psm>200?'#3b82f6':'#a855f7'}
L.geoJSON(GEO,{
  style:f=>{const s=STATS[f.properties.n];return{fillColor:s?gc(s.medPsm):'#1e293b',fillOpacity:s?0.55:0.08,color:'#2a3450',weight:1,opacity:0.5}},
  onEachFeature:(f,layer)=>{
    const n=f.properties.n,s=STATS[n];
    if(s){
      layer.bindTooltip('<strong>'+n+'</strong><br>'+s.count+' lots | Med '+f$(s.medPrice)+' | '+f$(s.medPsm)+'/m²',{sticky:true,className:'dark-tooltip'});
      layer.on('click',()=>showLga(n));
    }else{layer.bindTooltip('<strong>'+n+'</strong><br>No data',{sticky:true})}
  }
}).addTo(map);

// LGA Table
function updateTable(){
  const cor=document.getElementById('fCorridor').value;
  const [sortKey,sortDir]=document.getElementById('fSort').value.split('-');
  let lgas=Object.entries(STATS);
  if(cor!=='all')lgas=lgas.filter(([n,s])=>s.corridor===cor);
  lgas.sort((a,b)=>sortDir==='asc'?(a[1][sortKey]||0)-(b[1][sortKey]||0):(b[1][sortKey]||0)-(a[1][sortKey]||0));
  document.getElementById('lgaTbody').innerHTML=lgas.map(([n,s])=>{
    const chipClass=s.corridor.includes('Western')?'chip-western':s.corridor.includes('Northern')?'chip-northern':s.corridor.includes('South')?'chip-se':s.corridor.includes('Geelong')?'chip-geelong':'chip-regional';
    return '<tr><td><span class="td-link" onclick="showLga(\\''+n+'\\')">'+n+'</span></td><td><span class="corridor-chip '+chipClass+'">'+s.corridor+'</span></td><td>'+s.count+'</td><td>'+s.listings+'</td><td>'+s.sold+'</td><td>'+f$(s.medPrice)+'</td><td>'+s.medSize+'m²</td><td>'+f$(s.medPsm)+'</td></tr>'
  }).join('');
}
updateTable();

// Corridors
function buildCorridors(){
  const cd={};ALL.forEach(l=>{if(!cd[l.corridor])cd[l.corridor]=[];cd[l.corridor].push(l)});
  const cors=Object.keys(cd).sort();
  document.getElementById('corridorMetrics').innerHTML=cors.map((c,i)=>{
    const lots=cd[c];const mp=med(lots.map(l=>l.price));
    return '<div class="metric-card"><div class="mc-val" style="color:'+C[i%C.length]+'">'+lots.length+'</div><div class="mc-label">'+c+'</div><div class="mc-sub">Median '+f$(mp)+' | '+med(lots.map(l=>l.lotSize))+'m²</div></div>'
  }).join('');
  const opt=(lab,cb)=>({responsive:true,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#5a6478',callback:cb},grid:{color:'rgba(255,255,255,0.04)'}},y:{ticks:{color:'#8b95a8',font:{size:11}},grid:{color:'rgba(255,255,255,0.02)'}}}});
  const cols=cors.map((c,i)=>C[i%C.length]);
  ['cp','cpsm','cc','csz'].forEach(k=>{if(charts[k])charts[k].destroy()});
  charts.cp=new Chart(document.getElementById('cCorP'),{type:'bar',data:{labels:cors,datasets:[{data:cors.map(c=>med(cd[c].map(l=>l.price))),backgroundColor:cols}]},options:opt('$',v=>f$(v))});
  charts.cpsm=new Chart(document.getElementById('cCorPsm'),{type:'bar',data:{labels:cors,datasets:[{data:cors.map(c=>med(cd[c].map(l=>l.pricePerSqm))),backgroundColor:cols}]},options:opt('$/m²',v=>f$(v))});
  charts.cc=new Chart(document.getElementById('cCorCount'),{type:'bar',data:{labels:cors,datasets:[{data:cors.map(c=>cd[c].length),backgroundColor:cols}]},options:opt('Count',v=>v)});
  charts.csz=new Chart(document.getElementById('cCorSize'),{type:'bar',data:{labels:cors,datasets:[{data:cors.map(c=>med(cd[c].map(l=>l.lotSize))),backgroundColor:cols}]},options:opt('m²',v=>v+'m²')});
}
buildCorridors();

// Analysis
function updateAnalysis(){
  const m=document.getElementById('aMarket').value;
  const st=document.getElementById('aStatus').value;
  const minS=+document.getElementById('aMinS').value,maxS=+document.getElementById('aMaxS').value;
  const showO=document.getElementById('aOut').checked;
  let lots=ALL.filter(l=>{
    if(m!=='all'&&l.lga!==m)return false;
    if(st!=='all'&&l.status!==st)return false;
    if(l.lotSize<minS||l.lotSize>maxS)return false;
    if(!showO&&l.isOutlier)return false;
    return true;
  });
  const mkts=[...new Set(lots.map(l=>l.lga))].sort();
  document.getElementById('analysisMetrics').innerHTML=
    '<div class="metric-card"><div class="mc-val" style="color:var(--teal)">'+lots.length.toLocaleString()+'</div><div class="mc-label">Filtered Lots</div></div>'+
    '<div class="metric-card"><div class="mc-val" style="color:var(--accent)">'+f$(med(lots.map(l=>l.price)))+'</div><div class="mc-label">Median Price</div></div>'+
    '<div class="metric-card"><div class="mc-val">'+f$(med(lots.map(l=>l.pricePerSqm)))+'/m²</div><div class="mc-label">Median $/m²</div></div>'+
    '<div class="metric-card"><div class="mc-val">'+Math.round(med(lots.map(l=>l.lotSize)))+'m²</div><div class="mc-label">Median Size</div></div>';
  
  const so={responsive:true,plugins:{legend:{labels:{color:'#8b95a8',font:{size:11}}},tooltip:{callbacks:{label:ctx=>{const l=ctx.raw.l;return l.suburb+' | '+l.lotSize+'m² | '+f$(l.price)+' | '+f$(l.pricePerSqm)+'/m²'}}}},scales:{x:{title:{display:true,text:'Lot Size (m²)',color:'#5a6478'},ticks:{color:'#5a6478'},grid:{color:'rgba(255,255,255,0.03)'}},y:{ticks:{color:'#5a6478',callback:v=>f$(v)},grid:{color:'rgba(255,255,255,0.03)'}}}};
  
  ['s1','s2','bands','tl'].forEach(k=>{if(charts[k])charts[k].destroy()});
  charts.s1=new Chart(document.getElementById('cS1'),{type:'scatter',data:{datasets:mkts.slice(0,10).map((m2,i)=>({label:m2,data:lots.filter(l=>l.lga===m2).map(l=>({x:l.lotSize,y:l.price,l})),backgroundColor:C[i%C.length],pointRadius:2.5}))},options:{...so}});
  const so2={...so};so2.scales={...so.scales,y:{...so.scales.y,title:{display:true,text:'$/m²',color:'#5a6478'}}};
  charts.s2=new Chart(document.getElementById('cS2'),{type:'scatter',data:{datasets:mkts.slice(0,10).map((m2,i)=>({label:m2,data:lots.filter(l=>l.lga===m2).map(l=>({x:l.lotSize,y:l.pricePerSqm,l})),backgroundColor:C[i%C.length],pointRadius:2.5}))},options:so2});
  
  const BB=[[150,250],[250,350],[350,450],[450,550],[550,700],[700,1000],[1000,2000]];
  charts.bands=new Chart(document.getElementById('cBands'),{type:'bar',data:{labels:BB.map(b=>b[0]+'-'+b[1]),datasets:[{label:'Count',data:BB.map(b=>lots.filter(l=>l.lotSize>=b[0]&&l.lotSize<b[1]).length),backgroundColor:'rgba(79,156,247,0.6)',yAxisID:'y'},{label:'Avg $/m²',data:BB.map(b=>{const bl=lots.filter(l=>l.lotSize>=b[0]&&l.lotSize<b[1]);return bl.length?Math.round(bl.reduce((s,l)=>s+l.pricePerSqm,0)/bl.length):0}),backgroundColor:'rgba(45,212,168,0.6)',yAxisID:'y1'}]},options:{responsive:true,plugins:{legend:{labels:{color:'#8b95a8'}}},scales:{y:{position:'left',ticks:{color:'#5a6478'},grid:{color:'rgba(255,255,255,0.03)'}},y1:{position:'right',ticks:{color:'#5a6478',callback:v=>f$(v)},grid:{drawOnChartArea:false}},x:{ticks:{color:'#5a6478'},grid:{color:'rgba(255,255,255,0.03)'}}}}});
  
  const ld=lots.filter(l=>l.date);const mos={};
  ld.forEach(l=>{const mo=l.date.substring(0,7);if(!mos[mo])mos[mo]={};if(!mos[mo][l.lga])mos[mo][l.lga]=[];mos[mo][l.lga].push(l.pricePerSqm)});
  const allMo=Object.keys(mos).sort();
  charts.tl=new Chart(document.getElementById('cTime'),{type:'line',data:{labels:allMo,datasets:mkts.filter(m2=>ld.some(l=>l.lga===m2)).slice(0,6).map((m2,i)=>({label:m2,data:allMo.map(mo=>mos[mo]&&mos[mo][m2]?med(mos[mo][m2]):null),borderColor:C[i%C.length],backgroundColor:C[i%C.length],tension:.35,pointRadius:3,spanGaps:true}))},options:{responsive:true,plugins:{legend:{labels:{color:'#8b95a8'}}},scales:{x:{ticks:{color:'#5a6478',maxRotation:45},grid:{color:'rgba(255,255,255,0.03)'}},y:{ticks:{color:'#5a6478',callback:v=>f$(v)},grid:{color:'rgba(255,255,255,0.03)'}}}}});
}
updateAnalysis();

// Velocity
function buildVelocity(){
  const sold=ALL.filter(l=>l.status==='Sold'&&l.date);
  const byMo={};sold.forEach(l=>{const mo=l.date.substring(0,7);if(!byMo[mo])byMo[mo]={c:0,lga:{}};byMo[mo].c++;if(!byMo[mo].lga[l.lga])byMo[mo].lga[l.lga]=0;byMo[mo].lga[l.lga]++});
  const mos=Object.keys(byMo).sort();const lgas=[...new Set(sold.map(l=>l.lga))].sort();
  document.getElementById('velMetrics').innerHTML=
    '<div class="metric-card"><div class="mc-val" style="color:var(--teal)">'+sold.length.toLocaleString()+'</div><div class="mc-label">Total Sold</div></div>'+
    '<div class="metric-card"><div class="mc-val" style="color:var(--accent)">'+(mos.length?Math.round(sold.length/mos.length):0)+'</div><div class="mc-label">Avg Sold/Month</div></div>'+
    '<div class="metric-card"><div class="mc-val">'+mos.length+'</div><div class="mc-label">Months of Data</div></div>';
  
  ['vel','ls','pie'].forEach(k=>{if(charts[k])charts[k].destroy()});
  charts.vel=new Chart(document.getElementById('cVel'),{type:'bar',data:{labels:mos,datasets:lgas.slice(0,8).map((lga,i)=>({label:lga,data:mos.map(mo=>byMo[mo]?.lga[lga]||0),backgroundColor:C[i%C.length]}))},options:{responsive:true,plugins:{legend:{labels:{color:'#8b95a8'}}},scales:{x:{stacked:true,ticks:{color:'#5a6478'},grid:{color:'rgba(255,255,255,0.03)'}},y:{stacked:true,ticks:{color:'#5a6478'},grid:{color:'rgba(255,255,255,0.03)'}}}}});
  
  const rd=allLgas.map(lga=>({lga,l:ALL.filter(l=>l.lga===lga&&l.status==='Listing').length,s:ALL.filter(l=>l.lga===lga&&l.status==='Sold').length})).filter(d=>d.l+d.s>10);
  charts.ls=new Chart(document.getElementById('cLS'),{type:'bar',data:{labels:rd.map(d=>d.lga),datasets:[{label:'Listings',data:rd.map(d=>d.l),backgroundColor:'rgba(79,156,247,0.6)'},{label:'Sold',data:rd.map(d=>d.s),backgroundColor:'rgba(45,212,168,0.6)'}]},options:{responsive:true,indexAxis:'y',plugins:{legend:{labels:{color:'#8b95a8'}}},scales:{x:{stacked:true,ticks:{color:'#5a6478'},grid:{color:'rgba(255,255,255,0.03)'}},y:{stacked:true,ticks:{color:'#8b95a8',font:{size:11}},grid:{color:'rgba(255,255,255,0.02)'}}}}});
  
  const pieD=lgas.map(lga=>sold.filter(l=>l.lga===lga).length).filter(n=>n>0);
  const pieL=lgas.filter(lga=>sold.filter(l=>l.lga===lga).length>0);
  charts.pie=new Chart(document.getElementById('cPie'),{type:'doughnut',data:{labels:pieL,datasets:[{data:pieD,backgroundColor:C.slice(0,pieL.length)}]},options:{responsive:true,plugins:{legend:{labels:{color:'#8b95a8',font:{size:11}}}}}});
}
buildVelocity();

// Benchmarks chart
const rpmD={'Ballarat':{rpm:285000},'Greater Bendigo':{rpm:262000},'Greater Geelong':{rpm:376900}};
const bLabels=Object.keys(rpmD);
const bRpm=bLabels.map(n=>rpmD[n].rpm);
const bOurs=bLabels.map(n=>STATS[n]?STATS[n].medPrice:null);
if(charts.bench)charts.bench.destroy();
charts.bench=new Chart(document.getElementById('cBench'),{type:'bar',data:{labels:bLabels,datasets:[{label:'RPM Q3 2025',data:bRpm,backgroundColor:'rgba(79,156,247,0.5)',borderColor:'#4f9cf7',borderWidth:1},{label:'Grange Data',data:bOurs,backgroundColor:'rgba(45,212,168,0.5)',borderColor:'#2dd4a8',borderWidth:1}]},options:{responsive:true,plugins:{legend:{labels:{color:'#8b95a8'}}},scales:{x:{ticks:{color:'#8b95a8'},grid:{color:'rgba(255,255,255,0.03)'}},y:{ticks:{color:'#5a6478',callback:v=>f$(v)},grid:{color:'rgba(255,255,255,0.03)'}}}}});

// LGA Detail
function showLga(name){
  showPanel('lgaDetail');
  document.getElementById('lgaName').textContent=name;
  document.getElementById('lgaCorridor').textContent=STATS[name]?.corridor||'';
  const lots=ALL.filter(l=>l.lga===name);
  const listings=lots.filter(l=>l.status==='Listing').length;
  const sold=lots.filter(l=>l.status==='Sold').length;
  document.getElementById('lgaMetrics').innerHTML=
    '<div class="metric-card"><div class="mc-val" style="color:var(--accent)">'+lots.length+'</div><div class="mc-label">Total Lots</div></div>'+
    '<div class="metric-card"><div class="mc-val">'+listings+'</div><div class="mc-label">Listings</div></div>'+
    '<div class="metric-card"><div class="mc-val" style="color:var(--teal)">'+sold+'</div><div class="mc-label">Sold</div></div>'+
    '<div class="metric-card"><div class="mc-val">'+f$(med(lots.map(l=>l.price)))+'</div><div class="mc-label">Median Price</div></div>'+
    '<div class="metric-card"><div class="mc-val">'+Math.round(med(lots.map(l=>l.lotSize)))+'m²</div><div class="mc-label">Median Size</div></div>'+
    '<div class="metric-card"><div class="mc-val">'+f$(med(lots.map(l=>l.pricePerSqm)))+'/m²</div><div class="mc-label">Median $/m²</div></div>';
  
  ['lgaS','lgaH'].forEach(k=>{if(charts[k])charts[k].destroy()});
  charts.lgaS=new Chart(document.getElementById('cLgaS'),{type:'scatter',data:{datasets:[
    {label:'Listing',data:lots.filter(l=>l.status==='Listing').map(l=>({x:l.lotSize,y:l.price,l})),backgroundColor:'rgba(79,156,247,0.7)',pointRadius:3},
    {label:'Sold',data:lots.filter(l=>l.status==='Sold').map(l=>({x:l.lotSize,y:l.price,l})),backgroundColor:'rgba(45,212,168,0.7)',pointRadius:3}
  ]},options:{responsive:true,plugins:{legend:{labels:{color:'#8b95a8'}},tooltip:{callbacks:{label:ctx=>{const l=ctx.raw.l;return l.suburb+' | '+l.lotSize+'m² | '+f$(l.price)}}}},scales:{x:{ticks:{color:'#5a6478'},grid:{color:'rgba(255,255,255,0.03)'}},y:{ticks:{color:'#5a6478',callback:v=>f$(v)},grid:{color:'rgba(255,255,255,0.03)'}}}}});
  
  const psm=lots.map(l=>l.pricePerSqm);
  const mn=Math.floor(Math.min(...psm)/50)*50,mx=Math.ceil(Math.max(...psm)/50)*50;
  const bk=[];for(let i=mn;i<mx;i+=50)bk.push({l:'$'+i+'-$'+(i+50),c:psm.filter(v=>v>=i&&v<i+50).length});
  charts.lgaH=new Chart(document.getElementById('cLgaH'),{type:'bar',data:{labels:bk.map(b=>b.l),datasets:[{data:bk.map(b=>b.c),backgroundColor:'rgba(167,139,250,0.5)',borderColor:'#a78bfa',borderWidth:1}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#5a6478',maxRotation:45},grid:{color:'rgba(255,255,255,0.03)'}},y:{ticks:{color:'#5a6478'},grid:{color:'rgba(255,255,255,0.03)'}}}}});
  
  const subs={};lots.forEach(l=>{if(!subs[l.suburb])subs[l.suburb]={lots:[],li:0,so:0};subs[l.suburb].lots.push(l);if(l.status==='Listing')subs[l.suburb].li++;else subs[l.suburb].so++});
  document.getElementById('subTbody').innerHTML=Object.entries(subs).sort((a,b)=>b[1].lots.length-a[1].lots.length).map(([n,s])=>
    '<tr><td><strong>'+n+'</strong></td><td>'+s.lots.length+'</td><td>'+s.li+'</td><td>'+s.so+'</td><td>'+f$(med(s.lots.map(l=>l.price)))+'</td><td>'+Math.round(med(s.lots.map(l=>l.lotSize)))+'m²</td><td>'+f$(med(s.lots.map(l=>l.pricePerSqm)))+'</td></tr>'
  ).join('');
}
</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'rlp-dashboard.html'), html);
console.log('Dashboard v3 built:', (html.length/1024).toFixed(0), 'KB');
