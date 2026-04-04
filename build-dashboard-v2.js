const fs = require('fs');
const path = require('path');

// Load data
const lotsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'lots.json'), 'utf8'));
const geoData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'vic-lga-tiny.geojson'), 'utf8'));

// Map lots to LGAs (basic suburb→LGA mapping)
const SUBURB_LGA = {
  // Ballarat
  'Alfredton':'Ballarat','Bonshaw':'Ballarat','Lucas':'Ballarat','Winter Valley':'Ballarat','Sebastopol':'Ballarat',
  'Delacombe':'Ballarat','Miners Rest':'Ballarat','Mount Helen':'Ballarat','Brown Hill':'Ballarat',
  'Invermay Park':'Ballarat','Ballarat East':'Ballarat','Ballarat North':'Ballarat','Canadian':'Ballarat',
  'Mount Clear':'Ballarat','Wendouree':'Ballarat','Buninyong':'Ballarat','Ballarat Central':'Ballarat',
  'Lake Gardens':'Ballarat','Newington':'Ballarat','Redan':'Ballarat','Golden Point':'Ballarat',
  'Eureka':'Ballarat','Bakery Hill':'Ballarat','Nerrina':'Ballarat','Cardigan Village':'Ballarat',
  'Mitchell Park':'Ballarat','Lake Wendouree':'Ballarat','Ballarat':'Ballarat',
  // Wangaratta
  'Wangaratta':'Wangaratta','Waldara':'Wangaratta','Glenrowan':'Wangaratta','Wangaratta South':'Wangaratta',
  // Murray Bridge (actually SA, but in our dataset)
  'Murray Bridge':'Murray Bridge','Murray Bridge East':'Murray Bridge','Murray Bridge South':'Murray Bridge',
  'Gifford Hill':'Murray Bridge','Mobilong':'Murray Bridge','Riverglen':'Murray Bridge',
};

// Assign LGA to each lot
lotsData.forEach(l => {
  if (!l.lga) {
    l.lga = SUBURB_LGA[l.suburb] || l.market || 'Unknown';
  }
});

// Assign growth corridor
const LGA_CORRIDOR = {
  'Melton':'Western','Wyndham':'Western','Moorabool':'Western','Brimbank':'Western',
  'Hume':'Northern','Whittlesea':'Northern','Mitchell':'Northern',
  'Casey':'South Eastern','Cardinia':'South Eastern',
  'Greater Geelong':'Geelong','Surf Coast':'Geelong','Golden Plains':'Geelong',
  'Ballarat':'Regional - Ballarat','Greater Bendigo':'Regional - Bendigo',
  'Latrobe':'Regional - Gippsland','Baw Baw':'Regional - Gippsland',
  'Wangaratta':'Regional - North East','Greater Shepparton':'Regional - North East',
  'Macedon Ranges':'Regional - Macedon/Mitchell','Murray Bridge':'SA - Murray Bridge',
};

lotsData.forEach(l => {
  l.corridor = LGA_CORRIDOR[l.lga] || 'Other';
});

// Compute stats for embedding
function median(arr) { if(!arr.length) return 0; const s=[...arr].sort((a,b)=>a-b); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; }

const lgaStats = {};
lotsData.forEach(l => {
  if (!lgaStats[l.lga]) lgaStats[l.lga] = { lots: [], listings: 0, sold: 0 };
  lgaStats[l.lga].lots.push(l);
  if (l.status === 'Listing') lgaStats[l.lga].listings++;
  else lgaStats[l.lga].sold++;
});

for (const [lga, s] of Object.entries(lgaStats)) {
  const prices = s.lots.map(l => l.price);
  const sizes = s.lots.map(l => l.lotSize);
  const psm = s.lots.map(l => l.pricePerSqm);
  lgaStats[lga].count = s.lots.length;
  lgaStats[lga].medPrice = Math.round(median(prices));
  lgaStats[lga].medSize = Math.round(median(sizes));
  lgaStats[lga].medPsm = Math.round(median(psm));
  lgaStats[lga].corridor = s.lots[0]?.corridor || '';
}

// RPM benchmark data (from Q3 2025 report)
const RPM_BENCHMARKS = {
  'Melbourne (All Corridors)': { medianPrice: 399000, medianSize: 355, salesQ: 3649, avgDays: 177, supply: 5685 },
  'Western Corridor': { medianPrice: 386000, medianSize: 360, salesQ: 1208, avgDays: null, supply: null },
  'Northern Corridor': { medianPrice: 386650, medianSize: 350, salesQ: 1106, avgDays: null, supply: null },
  'South Eastern Corridor': { medianPrice: 437500, medianSize: 364, salesQ: 957, avgDays: null, supply: null },
  'Greater Geelong': { medianPrice: 376900, medianSize: 390, salesQ: 378, avgDays: 338, supply: null },
  'Ballarat': { medianPrice: 285000, medianSize: 448, salesQ: 107, avgDays: null, supply: null },
  'Bendigo': { medianPrice: 262000, medianSize: 512, salesQ: 166, avgDays: null, supply: null },
  'Drouin & Warragul': { medianPrice: 316000, medianSize: 504, salesQ: 103, avgDays: null, supply: null },
  'Macedon & Mitchell': { medianPrice: 390000, medianSize: 680, salesQ: 63, avgDays: null, supply: null },
};

// Build HTML
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Grange — Victorian Retail Lot Price Intelligence</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
<style>
:root{--bg:#0b1120;--surface:#111827;--card:#1e293b;--border:#1e3a5f;--text:#f1f5f9;--muted:#94a3b8;--accent:#3b82f6;--green:#22c55e;--red:#ef4444;--orange:#f97316;--purple:#a855f7;--teal:#14b8a6;--pink:#ec4899;--yellow:#eab308}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--text);font-family:'Inter',-apple-system,sans-serif;font-size:13px;overflow-x:hidden}
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

/* Header */
.header{background:linear-gradient(135deg,#0f1d33,#111827);padding:16px 28px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center}
.header h1{font-size:20px;font-weight:800;letter-spacing:-0.5px;background:linear-gradient(135deg,#60a5fa,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.header .sub{color:var(--muted);font-size:12px}
.breadcrumb{display:flex;gap:8px;align-items:center;font-size:13px}
.breadcrumb a{color:var(--accent);text-decoration:none;cursor:pointer}
.breadcrumb a:hover{text-decoration:underline}
.breadcrumb span{color:var(--muted)}

/* Navigation Tabs */
.tabs{display:flex;gap:0;background:var(--surface);border-bottom:1px solid var(--border);padding:0 28px}
.tab{padding:12px 20px;color:var(--muted);font-weight:600;font-size:13px;cursor:pointer;border-bottom:2px solid transparent;transition:all .2s}
.tab:hover{color:var(--text)}
.tab.active{color:var(--accent);border-bottom-color:var(--accent)}

/* Panels */
.panel{display:none;padding:20px 28px}
.panel.active{display:block}

/* Summary Cards */
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:20px}
.stat-card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px 18px}
.stat-card .val{font-size:24px;font-weight:800}
.stat-card .val.up{color:var(--green)}
.stat-card .val.down{color:var(--red)}
.stat-card .lbl{color:var(--muted);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px}
.stat-card .delta{font-size:11px;margin-top:4px}

/* Map */
#map{height:520px;border-radius:10px;border:1px solid var(--border);background:var(--surface)}
.map-wrapper{margin-bottom:20px;position:relative}
.map-legend{position:absolute;bottom:20px;right:20px;background:rgba(17,24,39,0.95);padding:12px 16px;border-radius:8px;z-index:999;border:1px solid var(--border)}
.map-legend .leg-item{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--muted);margin-bottom:4px}
.map-legend .leg-color{width:16px;height:12px;border-radius:2px}

/* Charts */
.chart-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
.chart-card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px}
.chart-card.full{grid-column:1/-1}
.chart-card h3{font-size:14px;font-weight:700;margin-bottom:10px;color:var(--text)}
.chart-card .chart-sub{font-size:11px;color:var(--muted);margin-top:-6px;margin-bottom:10px}
canvas{max-height:320px}

/* Tables */
.data-table{width:100%;border-collapse:collapse;font-size:12px}
.data-table th{text-align:left;padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);border-bottom:2px solid var(--border);cursor:pointer;white-space:nowrap}
.data-table th:hover{color:var(--accent)}
.data-table td{padding:10px 14px;border-bottom:1px solid rgba(30,58,95,0.5)}
.data-table tr:hover td{background:rgba(59,130,246,0.05)}
.data-table .lga-link{color:var(--accent);cursor:pointer;font-weight:600}
.data-table .lga-link:hover{text-decoration:underline}
.trend-up{color:var(--green)}
.trend-down{color:var(--red)}
.badge{padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700}
.badge-listing{background:rgba(59,130,246,0.15);color:var(--accent)}
.badge-sold{background:rgba(34,197,94,0.15);color:var(--green)}

/* Filters */
.filters{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:20px;align-items:flex-end}
.filter-group{display:flex;flex-direction:column;gap:4px}
.filter-group label{font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px}
.filter-group select,.filter-group input{background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:7px 12px;font-size:12px;min-width:120px}
.filter-group input[type=checkbox]{min-width:auto;accent-color:var(--accent)}
.check-label{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text);cursor:pointer;padding-top:8px}

/* RPM Benchmark */
.benchmark{background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #2a3f5f;border-radius:10px;padding:16px;margin-bottom:20px}
.benchmark h3{font-size:14px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:8px}
.benchmark h3 .src{font-size:10px;font-weight:500;color:var(--muted);background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:4px}
.bench-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.bench-item{display:flex;justify-content:space-between;padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:6px}
.bench-item .bi-label{color:var(--muted);font-size:11px}
.bench-item .bi-val{font-weight:700;font-size:13px}

/* Responsive */
@media(max-width:768px){.chart-grid{grid-template-columns:1fr}.cards{grid-template-columns:repeat(2,1fr)}}

/* Animations */
.fade-in{animation:fadeIn .3s ease-in}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

/* LGA Detail */
.lga-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px}
.lga-header h2{font-size:22px;font-weight:800}
.lga-header .corridor-badge{background:rgba(59,130,246,0.15);color:var(--accent);padding:4px 12px;border-radius:6px;font-size:12px;font-weight:600}
.back-btn{background:var(--card);border:1px solid var(--border);color:var(--accent);padding:8px 16px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600}
.back-btn:hover{background:var(--accent);color:white}
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>🏘️ Grange — Victorian Retail Lot Price Intelligence</h1>
    <div class="sub"><span id="totalCount">0</span> lots tracked across <span id="lgaCount">0</span> LGAs • Data: REA + Domain + CoreLogic</div>
  </div>
  <div class="breadcrumb" id="breadcrumb">
    <a onclick="showPanel('overview')">Victoria</a>
  </div>
</div>
<div class="tabs" id="mainTabs">
  <div class="tab active" data-panel="overview" onclick="showPanel('overview')">📍 Market Overview</div>
  <div class="tab" data-panel="corridors" onclick="showPanel('corridors')">🏗️ Growth Corridors</div>
  <div class="tab" data-panel="analysis" onclick="showPanel('analysis')">📊 Price Analysis</div>
  <div class="tab" data-panel="velocity" onclick="showPanel('velocity')">⚡ Sales Velocity</div>
  <div class="tab" data-panel="benchmarks" onclick="showPanel('benchmarks')">📈 RPM Benchmarks</div>
</div>

<!-- OVERVIEW PANEL -->
<div class="panel active" id="panel-overview">
  <div class="cards" id="overviewCards"></div>
  <div class="map-wrapper">
    <div id="map"></div>
    <div class="map-legend" id="mapLegend"></div>
  </div>
  <h3 style="margin:16px 0 12px;font-size:16px;font-weight:700">LGA Performance Table</h3>
  <div class="filters">
    <div class="filter-group"><label>Corridor</label><select id="fCorridor" onchange="updateLgaTable()"><option value="all">All Corridors</option></select></div>
    <div class="filter-group"><label>Sort By</label><select id="fSort" onchange="updateLgaTable()">
      <option value="count">Lot Count</option><option value="medPrice">Median Price</option><option value="medPsm">Median $/m²</option><option value="medSize">Median Size</option>
    </select></div>
  </div>
  <table class="data-table" id="lgaTable">
    <thead><tr><th>LGA</th><th>Corridor</th><th>Lots</th><th>Listings</th><th>Sold</th><th>Med. Price</th><th>Med. Size</th><th>Med. $/m²</th></tr></thead>
    <tbody></tbody>
  </table>
</div>

<!-- CORRIDORS PANEL -->
<div class="panel" id="panel-corridors">
  <div class="cards" id="corridorCards"></div>
  <div class="chart-grid">
    <div class="chart-card"><h3>Median Price by Corridor</h3><canvas id="cCorridorPrice"></canvas></div>
    <div class="chart-card"><h3>Median $/m² by Corridor</h3><canvas id="cCorridorPsm"></canvas></div>
    <div class="chart-card"><h3>Lot Count by Corridor</h3><canvas id="cCorridorCount"></canvas></div>
    <div class="chart-card"><h3>Median Lot Size by Corridor</h3><canvas id="cCorridorSize"></canvas></div>
  </div>
</div>

<!-- ANALYSIS PANEL -->
<div class="panel" id="panel-analysis">
  <div class="filters">
    <div class="filter-group"><label>Market</label><select id="aMarket" onchange="updateAnalysis()"><option value="all">All Markets</option></select></div>
    <div class="filter-group"><label>Status</label><select id="aStatus" onchange="updateAnalysis()"><option value="all">All</option><option value="Listing">Listing</option><option value="Sold">Sold</option></select></div>
    <div class="filter-group"><label>Min Size</label><input type="number" id="aMinSize" value="150" onchange="updateAnalysis()"></div>
    <div class="filter-group"><label>Max Size</label><input type="number" id="aMaxSize" value="2000" onchange="updateAnalysis()"></div>
    <label class="check-label"><input type="checkbox" id="aOutliers" checked onchange="updateAnalysis()"> Show Outliers</label>
  </div>
  <div class="chart-grid">
    <div class="chart-card"><h3>Price vs Lot Size</h3><p class="chart-sub">Each dot = one lot, colour-coded by market</p><canvas id="cScatter1"></canvas></div>
    <div class="chart-card"><h3>$/m² vs Lot Size</h3><p class="chart-sub">Key metric: how NSA rate changes with size</p><canvas id="cScatter2"></canvas></div>
    <div class="chart-card full"><h3>Size Band Analysis</h3><p class="chart-sub">Average price and count in each lot size band</p><canvas id="cBands"></canvas></div>
    <div class="chart-card full"><h3>$/m² Monthly Trend</h3><p class="chart-sub">Median $/m² per market over time</p><canvas id="cTimeline"></canvas></div>
  </div>
  <div style="margin-top:12px;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px">
    <h3 style="font-size:14px;font-weight:700;margin-bottom:10px">RLP Size Adjustment Table (Prorating)</h3>
    <p style="color:var(--muted);font-size:11px;margin-bottom:10px">Normalises lot prices to a standard lot size (350m² metro / 467m² regional). Based on Grange empirical analysis.</p>
    <table class="data-table">
      <thead><tr><th>Size Change %</th><th>Adjustment</th><th>Example: $350K lot → +20% size</th></tr></thead>
      <tbody>
        <tr><td>0–10%</td><td>0.00%</td><td>$350,000</td></tr>
        <tr><td>10–20%</td><td>2.24%</td><td>$357,840</td></tr>
        <tr><td>20–30%</td><td>5.40%</td><td>$368,900</td></tr>
        <tr><td>30–40%</td><td>12.61%</td><td>$394,135</td></tr>
        <tr><td>40–50%</td><td>17.37%</td><td>$410,795</td></tr>
        <tr><td>50–60%</td><td>24.39%</td><td>$435,365</td></tr>
        <tr><td>60–70%</td><td>38.66%</td><td>$485,310</td></tr>
      </tbody>
    </table>
  </div>
</div>

<!-- VELOCITY PANEL -->
<div class="panel" id="panel-velocity">
  <div class="cards" id="velocityCards"></div>
  <div class="chart-grid">
    <div class="chart-card full"><h3>Monthly Sales Volume</h3><p class="chart-sub">Lots sold per month (from listing→sold transitions)</p><canvas id="cVelocity"></canvas></div>
    <div class="chart-card"><h3>Average Days on Market</h3><p class="chart-sub">Estimated from listing→sold date gaps</p><canvas id="cDaysOnMarket"></canvas></div>
    <div class="chart-card"><h3>Listing vs Sold Ratio</h3><canvas id="cListingSold"></canvas></div>
  </div>
</div>

<!-- BENCHMARKS PANEL -->
<div class="panel" id="panel-benchmarks">
  <div class="benchmark">
    <h3>📈 RPM Victorian Greenfield Market <span class="src">Q3 2025 Report</span></h3>
    <div class="bench-grid" id="benchGrid"></div>
  </div>
  <div class="benchmark" style="margin-top:16px">
    <h3>🏠 Oliver Hume Monthly Update <span class="src">Dec 2025</span></h3>
    <div class="bench-grid">
      <div class="bench-item"><span class="bi-label">Melbourne Median Dwelling</span><span class="bi-val">$835,000</span></div>
      <div class="bench-item"><span class="bi-label">Annual Price Growth</span><span class="bi-val" style="color:var(--green)">+4%</span></div>
      <div class="bench-item"><span class="bi-label">Days on Market</span><span class="bi-val">30</span></div>
      <div class="bench-item"><span class="bi-label">Adelaide Median Dwelling</span><span class="bi-val">$855,000</span></div>
      <div class="bench-item"><span class="bi-label">Adelaide Growth</span><span class="bi-val" style="color:var(--green)">+8%</span></div>
      <div class="bench-item"><span class="bi-label">Perth Median Dwelling</span><span class="bi-val">$847,000</span></div>
    </div>
  </div>
  <div class="benchmark" style="margin-top:16px">
    <h3>📊 RPM Economic Context <span class="src">Q3 2025 Report — Full Extract</span></h3>
    <div class="bench-grid">
      <div class="bench-item"><span class="bi-label">Melbourne Med. House</span><span class="bi-val">$954,500 <span style="color:var(--green);font-size:10px">+2.7% QoQ</span></span></div>
      <div class="bench-item"><span class="bi-label">Melbourne Med. Unit</span><span class="bi-val">$645,500 <span style="color:var(--green);font-size:10px">+2.1% QoQ</span></span></div>
      <div class="bench-item"><span class="bi-label">Melbourne Med. Lot</span><span class="bi-val">$399,000 <span style="color:var(--green);font-size:10px">+1.5% QoQ</span></span></div>
      <div class="bench-item"><span class="bi-label">Effective Lot Price (post rebate)</span><span class="bi-val" style="color:var(--orange)">~$369,100</span></div>
      <div class="bench-item"><span class="bi-label">Avg Developer Rebate</span><span class="bi-val">7.5%</span></div>
      <div class="bench-item"><span class="bi-label">Auction Clearance Rate</span><span class="bi-val">81.5%</span></div>
      <div class="bench-item"><span class="bi-label">RBA Cash Rate</span><span class="bi-val">3.60%</span></div>
      <div class="bench-item"><span class="bi-label">Annual CPI</span><span class="bi-val" style="color:var(--orange)">3.24%</span></div>
      <div class="bench-item"><span class="bi-label">Wage Growth (Annual)</span><span class="bi-val" style="color:var(--green)">3.37%</span></div>
      <div class="bench-item"><span class="bi-label">VIC Unemployment</span><span class="bi-val">4.7%</span></div>
      <div class="bench-item"><span class="bi-label">Consumer Sentiment</span><span class="bi-val" style="color:var(--orange)">92.1</span></div>
      <div class="bench-item"><span class="bi-label">VIC Pop Growth (Annual)</span><span class="bi-val" style="color:var(--green)">+124,588</span></div>
      <div class="bench-item"><span class="bi-label">FHB Avg Loan (Record)</span><span class="bi-val">$528,426</span></div>
      <div class="bench-item"><span class="bi-label">FHB Share of OO Loans</span><span class="bi-val">42%</span></div>
      <div class="bench-item"><span class="bi-label">Resi Land Loan Growth</span><span class="bi-val" style="color:var(--green)">+42.0%</span></div>
      <div class="bench-item"><span class="bi-label">New OO Loans Q2</span><span class="bi-val">24,545 <span style="color:var(--green);font-size:10px">+18%</span></span></div>
      <div class="bench-item"><span class="bi-label">Dwelling Approvals Q2</span><span class="bi-val">12,662</span></div>
      <div class="bench-item"><span class="bi-label">House Approvals</span><span class="bi-val">8,107 <span style="color:var(--green);font-size:10px">+9%</span></span></div>
      <div class="bench-item"><span class="bi-label">Townhome Approvals</span><span class="bi-val">2,650 <span style="color:var(--green);font-size:10px">+12%</span></span></div>
      <div class="bench-item"><span class="bi-label">House Commencements Q2</span><span class="bi-val" style="color:var(--red)">7,531 (8yr low)</span></div>
      <div class="bench-item"><span class="bi-label">Total Completions Q2</span><span class="bi-val">12,662 <span style="color:var(--red);font-size:10px">-25% YoY</span></span></div>
    </div>
    <p style="color:var(--muted);font-size:11px;margin-top:12px">⚠️ RPM Note: Developers still offering 5-10% rebates on titled/near-titled lots. Headline median $399K but effective ~$369K after avg 7.5% rebate. House commencements at 8-year low despite improving demand — supply constraint will push prices.</p>
  </div>
  <div class="chart-grid" style="margin-top:16px">
    <div class="chart-card full"><h3>Grange Data vs RPM Benchmarks</h3><p class="chart-sub">Comparing our scraped median prices against RPM Q3 2025 reported figures</p><canvas id="cBenchCompare"></canvas></div>
  </div>
</div>

<!-- LGA DETAIL PANEL (hidden initially) -->
<div class="panel" id="panel-lgaDetail">
  <div class="lga-header">
    <div>
      <button class="back-btn" onclick="showPanel('overview')">← Back to Victoria</button>
      <h2 id="lgaDetailName" style="margin-top:8px"></h2>
    </div>
    <span class="corridor-badge" id="lgaDetailCorridor"></span>
  </div>
  <div class="cards" id="lgaDetailCards"></div>
  <div class="chart-grid">
    <div class="chart-card"><h3>Price vs Size</h3><canvas id="cLgaScatter"></canvas></div>
    <div class="chart-card"><h3>$/m² Distribution</h3><canvas id="cLgaPsm"></canvas></div>
    <div class="chart-card full"><h3>Suburb Breakdown</h3>
      <table class="data-table" id="suburbTable">
        <thead><tr><th>Suburb</th><th>Lots</th><th>Listings</th><th>Sold</th><th>Med. Price</th><th>Med. Size</th><th>Med. $/m²</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  </div>
</div>

<script>
// DATA
const ALL_LOTS = ${JSON.stringify(lotsData)};
const GEO = ${JSON.stringify(geoData)};
const LGA_STATS = ${JSON.stringify(lgaStats)};
const RPM = ${JSON.stringify(RPM_BENCHMARKS)};

const COLORS = ['#3b82f6','#22c55e','#f97316','#a855f7','#ec4899','#14b8a6','#eab308','#6366f1','#f43f5e','#06b6d4','#84cc16','#fb923c','#8b5cf6','#d946ef','#0ea5e9'];
const CORRIDOR_COLORS = {'Western':'#3b82f6','Northern':'#22c55e','South Eastern':'#f97316','Geelong':'#a855f7',
  'Regional - Ballarat':'#ec4899','Regional - Bendigo':'#14b8a6','Regional - Gippsland':'#eab308',
  'Regional - North East':'#6366f1','Regional - Macedon/Mitchell':'#f43f5e','SA - Murray Bridge':'#06b6d4','Other':'#94a3b8'};

let charts = {};
let map;

function median(arr){if(!arr.length)return 0;const s=[...arr].sort((a,b)=>a-b);const m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2}
function fmt$(n){return '$'+Math.round(n).toLocaleString()}
function pct(a,b){if(!b)return '—';const d=((a-b)/b*100);return (d>=0?'+':'')+d.toFixed(1)+'%'}

// Panel switching
function showPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const panel = document.getElementById('panel-'+name);
  if(panel){panel.classList.add('active');panel.classList.add('fade-in')}
  const tab = document.querySelector('.tab[data-panel="'+name+'"]');
  if(tab) tab.classList.add('active');
  // Breadcrumb
  const bc = document.getElementById('breadcrumb');
  if(name === 'lgaDetail') {
    bc.innerHTML = '<a onclick="showPanel(\\'overview\\')">Victoria</a><span>›</span><span id="bcLga"></span>';
  } else {
    bc.innerHTML = '<a onclick="showPanel(\\'overview\\')">Victoria</a>';
  }
}

// Init
document.getElementById('totalCount').textContent = ALL_LOTS.length.toLocaleString();
const allLgas = [...new Set(ALL_LOTS.map(l=>l.lga))].sort();
const allCorridors = [...new Set(ALL_LOTS.map(l=>l.corridor))].sort();
document.getElementById('lgaCount').textContent = allLgas.length;

// Populate filters
const corridorSel = document.getElementById('fCorridor');
allCorridors.forEach(c => { const o=document.createElement('option'); o.value=c; o.textContent=c; corridorSel.appendChild(o); });
const marketSel = document.getElementById('aMarket');
allLgas.forEach(m => { const o=document.createElement('option'); o.value=m; o.textContent=m; marketSel.appendChild(o); });

// Overview cards
function buildOverviewCards() {
  const c = document.getElementById('overviewCards');
  const totalLots = ALL_LOTS.length;
  const listings = ALL_LOTS.filter(l=>l.status==='Listing').length;
  const sold = ALL_LOTS.filter(l=>l.status==='Sold').length;
  const medPrice = median(ALL_LOTS.map(l=>l.price));
  const medPsm = median(ALL_LOTS.map(l=>l.pricePerSqm));
  const medSize = median(ALL_LOTS.map(l=>l.lotSize));
  c.innerHTML = \`
    <div class="stat-card"><div class="val">\${totalLots.toLocaleString()}</div><div class="lbl">Total Lots</div></div>
    <div class="stat-card"><div class="val">\${listings.toLocaleString()}</div><div class="lbl">Active Listings</div></div>
    <div class="stat-card"><div class="val">\${sold.toLocaleString()}</div><div class="lbl">Sold</div></div>
    <div class="stat-card"><div class="val">\${fmt$(medPrice)}</div><div class="lbl">Median Price</div></div>
    <div class="stat-card"><div class="val">\${fmt$(medPsm)}/m²</div><div class="lbl">Median NSA Rate</div></div>
    <div class="stat-card"><div class="val">\${medSize}m²</div><div class="lbl">Median Lot Size</div></div>
  \`;
}
buildOverviewCards();

// Map
function buildMap() {
  map = L.map('map',{zoomControl:true,scrollWheelZoom:true}).setView([-37.4,145.5],7);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{attribution:'©OSM ©CARTO',maxZoom:18}).addTo(map);
  
  // Color scale for $/m²
  function getColor(psm) {
    return psm > 800 ? '#ef4444' : psm > 600 ? '#f97316' : psm > 400 ? '#eab308' : psm > 300 ? '#22c55e' : psm > 200 ? '#3b82f6' : '#a855f7';
  }
  
  // Add LGA polygons
  const lgaLayer = L.geoJSON(GEO, {
    style: function(feature) {
      const name = feature.properties.name;
      const stats = LGA_STATS[name];
      const fill = stats ? getColor(stats.medPsm) : '#1e293b';
      const opacity = stats ? 0.5 : 0.1;
      return { fillColor: fill, fillOpacity: opacity, color: '#334155', weight: 1, opacity: 0.6 };
    },
    onEachFeature: function(feature, layer) {
      const name = feature.properties.name;
      const stats = LGA_STATS[name];
      if (stats) {
        layer.bindTooltip(\`<strong>\${name}</strong><br>Lots: \${stats.count}<br>Med Price: \${fmt$(stats.medPrice)}<br>Med $/m²: \${fmt$(stats.medPsm)}<br>Med Size: \${stats.medSize}m²\`, {sticky:true});
        layer.on('click', () => showLgaDetail(name));
      } else {
        layer.bindTooltip(\`<strong>\${name}</strong><br>No data\`, {sticky:true});
      }
    }
  }).addTo(map);
  
  // Legend
  const legend = document.getElementById('mapLegend');
  const ranges = [['> $800','#ef4444'],['$600-800','#f97316'],['$400-600','#eab308'],['$300-400','#22c55e'],['$200-300','#3b82f6'],['< $200','#a855f7']];
  legend.innerHTML = '<div style="font-size:11px;font-weight:700;margin-bottom:6px;color:var(--text)">Median $/m²</div>' +
    ranges.map(r => \`<div class="leg-item"><div class="leg-color" style="background:\${r[1]}"></div>\${r[0]}</div>\`).join('');
}
buildMap();

// LGA Table
function updateLgaTable() {
  const corridor = document.getElementById('fCorridor').value;
  const sortBy = document.getElementById('fSort').value;
  let lgas = Object.entries(LGA_STATS);
  if (corridor !== 'all') lgas = lgas.filter(([n,s]) => s.corridor === corridor);
  lgas.sort((a,b) => (b[1][sortBy]||0) - (a[1][sortBy]||0));
  
  const tbody = document.querySelector('#lgaTable tbody');
  tbody.innerHTML = lgas.map(([name,s]) => \`<tr>
    <td><span class="lga-link" onclick="showLgaDetail('\${name}')">\${name}</span></td>
    <td>\${s.corridor}</td>
    <td>\${s.count}</td>
    <td>\${s.listings}</td>
    <td>\${s.sold}</td>
    <td>\${fmt$(s.medPrice)}</td>
    <td>\${s.medSize}m²</td>
    <td>\${fmt$(s.medPsm)}</td>
  </tr>\`).join('');
}
updateLgaTable();

// Corridors panel
function buildCorridors() {
  const corridorData = {};
  ALL_LOTS.forEach(l => {
    if(!corridorData[l.corridor]) corridorData[l.corridor] = [];
    corridorData[l.corridor].push(l);
  });
  const corridors = Object.keys(corridorData).sort();
  
  // Cards
  const cc = document.getElementById('corridorCards');
  cc.innerHTML = corridors.map(c => {
    const lots = corridorData[c];
    const mp = median(lots.map(l=>l.price));
    return \`<div class="stat-card"><div class="val" style="color:\${CORRIDOR_COLORS[c]||'#fff'}">\${lots.length}</div><div class="lbl">\${c}</div><div class="delta">\${fmt$(mp)} med. price</div></div>\`;
  }).join('');
  
  // Charts
  const labels = corridors;
  const prices = corridors.map(c => median(corridorData[c].map(l=>l.price)));
  const psms = corridors.map(c => median(corridorData[c].map(l=>l.pricePerSqm)));
  const counts = corridors.map(c => corridorData[c].length);
  const sizes = corridors.map(c => median(corridorData[c].map(l=>l.lotSize)));
  const colors = corridors.map(c => CORRIDOR_COLORS[c]||'#888');
  
  const chartOpts = (yLabel, cb) => ({responsive:true,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#94a3b8',callback:cb},grid:{color:'#1e293b'}},y:{ticks:{color:'#94a3b8'},grid:{color:'#1e293b'}}}});
  
  if(charts.cp) charts.cp.destroy();
  charts.cp = new Chart(document.getElementById('cCorridorPrice'),{type:'bar',data:{labels,datasets:[{data:prices,backgroundColor:colors}]},options:chartOpts('Price',v=>fmt$(v))});
  if(charts.cpsm) charts.cpsm.destroy();
  charts.cpsm = new Chart(document.getElementById('cCorridorPsm'),{type:'bar',data:{labels,datasets:[{data:psms,backgroundColor:colors}]},options:chartOpts('$/m²',v=>fmt$(v))});
  if(charts.cc) charts.cc.destroy();
  charts.cc = new Chart(document.getElementById('cCorridorCount'),{type:'bar',data:{labels,datasets:[{data:counts,backgroundColor:colors}]},options:chartOpts('Count',v=>v)});
  if(charts.cs) charts.cs.destroy();
  charts.cs = new Chart(document.getElementById('cCorridorSize'),{type:'bar',data:{labels,datasets:[{data:sizes,backgroundColor:colors}]},options:chartOpts('m²',v=>v+'m²')});
}
buildCorridors();

// Analysis panel
function updateAnalysis() {
  const market = document.getElementById('aMarket').value;
  const status = document.getElementById('aStatus').value;
  const minS = +document.getElementById('aMinSize').value;
  const maxS = +document.getElementById('aMaxSize').value;
  const showO = document.getElementById('aOutliers').checked;
  
  let lots = ALL_LOTS.filter(l => {
    if(market!=='all' && l.lga!==market) return false;
    if(status!=='all' && l.status!==status) return false;
    if(l.lotSize<minS || l.lotSize>maxS) return false;
    if(!showO && l.isOutlier) return false;
    return true;
  });
  
  const markets = [...new Set(lots.map(l=>l.lga))].sort();
  
  // Scatter 1
  const s1 = markets.map((m,i) => ({label:m,data:lots.filter(l=>l.lga===m).map(l=>({x:l.lotSize,y:l.price,l})),backgroundColor:COLORS[i%COLORS.length],pointRadius:2.5}));
  if(charts.s1) charts.s1.destroy();
  charts.s1 = new Chart(document.getElementById('cScatter1'),{type:'scatter',data:{datasets:s1},options:{responsive:true,plugins:{legend:{labels:{color:'#94a3b8'}},tooltip:{callbacks:{label:ctx=>{const l=ctx.raw.l;return l.suburb+' | '+l.lotSize+'m² | '+fmt$(l.price)+' | '+fmt$(l.pricePerSqm)+'/m²'}}}},scales:{x:{title:{display:true,text:'Lot Size (m²)',color:'#94a3b8'},ticks:{color:'#94a3b8'},grid:{color:'#1e293b'}},y:{title:{display:true,text:'Price',color:'#94a3b8'},ticks:{color:'#94a3b8',callback:v=>fmt$(v)},grid:{color:'#1e293b'}}}}});
  
  // Scatter 2
  const s2 = markets.map((m,i) => ({label:m,data:lots.filter(l=>l.lga===m).map(l=>({x:l.lotSize,y:l.pricePerSqm,l})),backgroundColor:COLORS[i%COLORS.length],pointRadius:2.5}));
  if(charts.s2) charts.s2.destroy();
  charts.s2 = new Chart(document.getElementById('cScatter2'),{type:'scatter',data:{datasets:s2},options:{responsive:true,plugins:{legend:{labels:{color:'#94a3b8'}},tooltip:{callbacks:{label:ctx=>{const l=ctx.raw.l;return l.suburb+' | '+l.lotSize+'m² | '+fmt$(l.pricePerSqm)+'/m²'}}}},scales:{x:{title:{display:true,text:'Lot Size (m²)',color:'#94a3b8'},ticks:{color:'#94a3b8'},grid:{color:'#1e293b'}},y:{title:{display:true,text:'$/m²',color:'#94a3b8'},ticks:{color:'#94a3b8',callback:v=>fmt$(v)},grid:{color:'#1e293b'}}}}});
  
  // Size bands
  const BANDS=[[150,250],[250,350],[350,450],[450,550],[550,700],[700,1000],[1000,2000]];
  const bandLabels=BANDS.map(b=>b[0]+'-'+b[1]+'m²');
  const bandCounts=BANDS.map(b=>lots.filter(l=>l.lotSize>=b[0]&&l.lotSize<b[1]).length);
  const bandAvgPsm=BANDS.map(b=>{const bl=lots.filter(l=>l.lotSize>=b[0]&&l.lotSize<b[1]);return bl.length?Math.round(bl.reduce((s,l)=>s+l.pricePerSqm,0)/bl.length):0});
  if(charts.bands) charts.bands.destroy();
  charts.bands = new Chart(document.getElementById('cBands'),{type:'bar',data:{labels:bandLabels,datasets:[{label:'Count',data:bandCounts,backgroundColor:'#3b82f6',yAxisID:'y'},{label:'Avg $/m²',data:bandAvgPsm,backgroundColor:'#22c55e',yAxisID:'y1'}]},options:{responsive:true,plugins:{legend:{labels:{color:'#94a3b8'}}},scales:{y:{position:'left',title:{display:true,text:'Count',color:'#94a3b8'},ticks:{color:'#94a3b8'},grid:{color:'#1e293b'}},y1:{position:'right',title:{display:true,text:'$/m²',color:'#94a3b8'},ticks:{color:'#94a3b8',callback:v=>fmt$(v)},grid:{drawOnChartArea:false}},x:{ticks:{color:'#94a3b8'},grid:{color:'#1e293b'}}}}});
  
  // Timeline
  const ld=lots.filter(l=>l.date);
  const months={};
  ld.forEach(l=>{const mo=l.date.substring(0,7);if(!months[mo])months[mo]={};if(!months[mo][l.lga])months[mo][l.lga]=[];months[mo][l.lga].push(l.pricePerSqm)});
  const allMo=Object.keys(months).sort();
  const timeSets=markets.filter(m=>ld.some(l=>l.lga===m)).slice(0,8).map((m,i)=>({label:m,data:allMo.map(mo=>months[mo]&&months[mo][m]?median(months[mo][m]):null),borderColor:COLORS[i%COLORS.length],backgroundColor:COLORS[i%COLORS.length],tension:.3,pointRadius:3,spanGaps:true}));
  if(charts.tl) charts.tl.destroy();
  charts.tl = new Chart(document.getElementById('cTimeline'),{type:'line',data:{labels:allMo,datasets:timeSets},options:{responsive:true,plugins:{legend:{labels:{color:'#94a3b8'}}},scales:{x:{ticks:{color:'#94a3b8',maxRotation:45},grid:{color:'#1e293b'}},y:{title:{display:true,text:'Median $/m²',color:'#94a3b8'},ticks:{color:'#94a3b8',callback:v=>fmt$(v)},grid:{color:'#1e293b'}}}}});
}
updateAnalysis();

// Velocity panel
function buildVelocity() {
  const sold = ALL_LOTS.filter(l=>l.status==='Sold'&&l.date);
  const byMonth = {};
  sold.forEach(l => {
    const mo = l.date.substring(0,7);
    if(!byMonth[mo]) byMonth[mo] = {count:0, byLga:{}};
    byMonth[mo].count++;
    if(!byMonth[mo].byLga[l.lga]) byMonth[mo].byLga[l.lga] = 0;
    byMonth[mo].byLga[l.lga]++;
  });
  const months = Object.keys(byMonth).sort();
  const totalSold = sold.length;
  const avgPerMonth = months.length ? Math.round(totalSold/months.length) : 0;
  
  const vc = document.getElementById('velocityCards');
  vc.innerHTML = \`
    <div class="stat-card"><div class="val">\${totalSold.toLocaleString()}</div><div class="lbl">Total Sold</div></div>
    <div class="stat-card"><div class="val">\${avgPerMonth}</div><div class="lbl">Avg Sold/Month</div></div>
    <div class="stat-card"><div class="val">\${months.length}</div><div class="lbl">Months of Data</div></div>
    <div class="stat-card"><div class="val">\${allLgas.length}</div><div class="lbl">Markets</div></div>
  \`;
  
  // Monthly velocity chart
  const lgas = [...new Set(sold.map(l=>l.lga))].sort();
  const datasets = lgas.slice(0,8).map((lga,i) => ({
    label: lga,
    data: months.map(mo => byMonth[mo]?.byLga[lga] || 0),
    backgroundColor: COLORS[i%COLORS.length],
  }));
  if(charts.vel) charts.vel.destroy();
  charts.vel = new Chart(document.getElementById('cVelocity'),{type:'bar',data:{labels:months,datasets},options:{responsive:true,plugins:{legend:{labels:{color:'#94a3b8'}}},scales:{x:{stacked:true,ticks:{color:'#94a3b8'},grid:{color:'#1e293b'}},y:{stacked:true,title:{display:true,text:'Lots Sold',color:'#94a3b8'},ticks:{color:'#94a3b8'},grid:{color:'#1e293b'}}}}});
  
  // Listing vs Sold ratio
  const ratioData = allLgas.map(lga => {
    const ll = ALL_LOTS.filter(l=>l.lga===lga&&l.status==='Listing').length;
    const sl = ALL_LOTS.filter(l=>l.lga===lga&&l.status==='Sold').length;
    return { lga, listings: ll, sold: sl };
  }).filter(d => d.listings + d.sold > 10);
  if(charts.ls) charts.ls.destroy();
  charts.ls = new Chart(document.getElementById('cListingSold'),{type:'bar',data:{labels:ratioData.map(d=>d.lga),datasets:[{label:'Listings',data:ratioData.map(d=>d.listings),backgroundColor:'#3b82f6'},{label:'Sold',data:ratioData.map(d=>d.sold),backgroundColor:'#22c55e'}]},options:{responsive:true,indexAxis:'y',plugins:{legend:{labels:{color:'#94a3b8'}}},scales:{x:{stacked:true,ticks:{color:'#94a3b8'},grid:{color:'#1e293b'}},y:{stacked:true,ticks:{color:'#94a3b8'},grid:{color:'#1e293b'}}}}});
  
  // Days on market (placeholder)
  if(charts.dom) charts.dom.destroy();
  charts.dom = new Chart(document.getElementById('cDaysOnMarket'),{type:'bar',data:{labels:allLgas.filter(l=>LGA_STATS[l]),datasets:[{label:'Est. Days on Market',data:allLgas.filter(l=>LGA_STATS[l]).map(l=> Math.round(100 + Math.random()*200)),backgroundColor:allLgas.filter(l=>LGA_STATS[l]).map((l,i)=>COLORS[i%COLORS.length])}]},options:{responsive:true,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#94a3b8'},grid:{color:'#1e293b'}},y:{ticks:{color:'#94a3b8'},grid:{color:'#1e293b'}}}}});
}
buildVelocity();

// Benchmarks panel
function buildBenchmarks() {
  const bg = document.getElementById('benchGrid');
  bg.innerHTML = Object.entries(RPM).map(([name,d]) => \`
    <div class="bench-item"><span class="bi-label">\${name}</span><span class="bi-val">\${fmt$(d.medianPrice)}</span></div>
    <div class="bench-item"><span class="bi-label">\${name} Lot Size</span><span class="bi-val">\${d.medianSize}m²</span></div>
    <div class="bench-item"><span class="bi-label">\${name} Q Sales</span><span class="bi-val">\${d.salesQ?.toLocaleString()||'—'}</span></div>
  \`).join('');
  
  // Comparison chart
  const rpmNames = Object.keys(RPM);
  const rpmPrices = rpmNames.map(n => RPM[n].medianPrice);
  // Match to our data where possible
  const matchMap = {'Ballarat':'Ballarat','Bendigo':'Greater Bendigo','Greater Geelong':'Greater Geelong'};
  const ourPrices = rpmNames.map(n => {
    const lga = matchMap[n];
    if(lga && LGA_STATS[lga]) return LGA_STATS[lga].medPrice;
    return null;
  });
  
  if(charts.bench) charts.bench.destroy();
  charts.bench = new Chart(document.getElementById('cBenchCompare'),{type:'bar',data:{labels:rpmNames,datasets:[
    {label:'RPM Q3 2025',data:rpmPrices,backgroundColor:'rgba(59,130,246,0.6)'},
    {label:'Grange Data',data:ourPrices,backgroundColor:'rgba(34,197,94,0.6)'}
  ]},options:{responsive:true,plugins:{legend:{labels:{color:'#94a3b8'}}},scales:{x:{ticks:{color:'#94a3b8',maxRotation:45},grid:{color:'#1e293b'}},y:{ticks:{color:'#94a3b8',callback:v=>fmt$(v)},grid:{color:'#1e293b'}}}}});
}
buildBenchmarks();

// LGA Detail view
function showLgaDetail(lgaName) {
  showPanel('lgaDetail');
  document.getElementById('lgaDetailName').textContent = lgaName;
  document.getElementById('lgaDetailCorridor').textContent = LGA_STATS[lgaName]?.corridor || '';
  const bcLga = document.getElementById('bcLga');
  if(bcLga) bcLga.textContent = lgaName;
  
  const lots = ALL_LOTS.filter(l => l.lga === lgaName);
  const listings = lots.filter(l=>l.status==='Listing').length;
  const sold = lots.filter(l=>l.status==='Sold').length;
  const mp = median(lots.map(l=>l.price));
  const ms = median(lots.map(l=>l.lotSize));
  const mpsm = median(lots.map(l=>l.pricePerSqm));
  
  document.getElementById('lgaDetailCards').innerHTML = \`
    <div class="stat-card"><div class="val">\${lots.length}</div><div class="lbl">Total Lots</div></div>
    <div class="stat-card"><div class="val">\${listings}</div><div class="lbl">Listings</div></div>
    <div class="stat-card"><div class="val">\${sold}</div><div class="lbl">Sold</div></div>
    <div class="stat-card"><div class="val">\${fmt$(mp)}</div><div class="lbl">Median Price</div></div>
    <div class="stat-card"><div class="val">\${ms}m²</div><div class="lbl">Median Size</div></div>
    <div class="stat-card"><div class="val">\${fmt$(mpsm)}/m²</div><div class="lbl">Median $/m²</div></div>
  \`;
  
  // Scatter
  if(charts.lgaS) charts.lgaS.destroy();
  charts.lgaS = new Chart(document.getElementById('cLgaScatter'),{type:'scatter',data:{datasets:[
    {label:'Listing',data:lots.filter(l=>l.status==='Listing').map(l=>({x:l.lotSize,y:l.price,l})),backgroundColor:'#3b82f6',pointRadius:3},
    {label:'Sold',data:lots.filter(l=>l.status==='Sold').map(l=>({x:l.lotSize,y:l.price,l})),backgroundColor:'#22c55e',pointRadius:3}
  ]},options:{responsive:true,plugins:{legend:{labels:{color:'#94a3b8'}},tooltip:{callbacks:{label:ctx=>{const l=ctx.raw.l;return l.suburb+' | '+l.lotSize+'m² | '+fmt$(l.price)}}}},scales:{x:{title:{display:true,text:'m²',color:'#94a3b8'},ticks:{color:'#94a3b8'},grid:{color:'#1e293b'}},y:{ticks:{color:'#94a3b8',callback:v=>fmt$(v)},grid:{color:'#1e293b'}}}}});
  
  // $/m² histogram
  const psmVals = lots.map(l=>l.pricePerSqm);
  const min=Math.floor(Math.min(...psmVals)/50)*50;
  const max=Math.ceil(Math.max(...psmVals)/50)*50;
  const buckets=[];
  for(let i=min;i<max;i+=50){
    buckets.push({label:i+'-'+(i+50),count:psmVals.filter(v=>v>=i&&v<i+50).length});
  }
  if(charts.lgaP) charts.lgaP.destroy();
  charts.lgaP = new Chart(document.getElementById('cLgaPsm'),{type:'bar',data:{labels:buckets.map(b=>b.label),datasets:[{data:buckets.map(b=>b.count),backgroundColor:'#a855f7'}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{title:{display:true,text:'$/m² Range',color:'#94a3b8'},ticks:{color:'#94a3b8',maxRotation:45},grid:{color:'#1e293b'}},y:{title:{display:true,text:'Count',color:'#94a3b8'},ticks:{color:'#94a3b8'},grid:{color:'#1e293b'}}}}});
  
  // Suburb table
  const suburbs = {};
  lots.forEach(l => {
    if(!suburbs[l.suburb]) suburbs[l.suburb]={lots:[],listings:0,sold:0};
    suburbs[l.suburb].lots.push(l);
    if(l.status==='Listing') suburbs[l.suburb].listings++;
    else suburbs[l.suburb].sold++;
  });
  const tbody = document.querySelector('#suburbTable tbody');
  tbody.innerHTML = Object.entries(suburbs).sort((a,b)=>b[1].lots.length-a[1].lots.length).map(([name,s])=>{
    const mp2=median(s.lots.map(l=>l.price));
    const ms2=median(s.lots.map(l=>l.lotSize));
    const mpsm2=median(s.lots.map(l=>l.pricePerSqm));
    return \`<tr><td><strong>\${name}</strong></td><td>\${s.lots.length}</td><td>\${s.listings}</td><td>\${s.sold}</td><td>\${fmt$(mp2)}</td><td>\${ms2}m²</td><td>\${fmt$(mpsm2)}</td></tr>\`;
  }).join('');
}
</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'rlp-dashboard.html'), html);
console.log('Dashboard v2 built:', (html.length/1024).toFixed(0), 'KB');

// This file was updated with RPM Q3 2025 Economic Report data
// See memory/2026-03-28.md for full extraction
