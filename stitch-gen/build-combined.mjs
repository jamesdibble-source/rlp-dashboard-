// Combine Stitch screens + inject real data into a single deployable HTML app
import { readFileSync, writeFileSync } from 'fs';

// Read the Stitch screens
const overview = readFileSync('output/overview.html', 'utf8');
const analysis = readFileSync('output/price-analysis.html', 'utf8');
const benchmarks = readFileSync('output/benchmarks.html', 'utf8');

// Read our real data
const lotsRaw = JSON.parse(readFileSync('../data/lots.json', 'utf8'));
const clean = lotsRaw.filter(l => l.price > 0 && l.price < 5000000 && l.lotSize > 100 && l.lotSize < 5000 && l.pricePerSqm > 50 && l.pricePerSqm < 5000);

// Slim data for embedding
const slimLots = clean.map(l => ({
  s: l.suburb, m: l.market, p: l.price, z: l.lotSize, 
  r: Math.round(l.pricePerSqm * 100) / 100, 
  t: l.status === 'Sold' ? 1 : 0,
  d: l.date ? l.date.substring(0, 7) : null,
}));

// Extract the main content from each screen (between <main> tags)
function extractMain(html) {
  const mainMatch = html.match(/<main[\s\S]*?<\/main>/);
  return mainMatch ? mainMatch[0] : '';
}

// Extract the sidebar (common across screens)
function extractSidebar(html) {
  const sidebarMatch = html.match(/<aside[\s\S]*?<\/aside>/);
  return sidebarMatch ? sidebarMatch[0] : '';
}

// Extract the head (styles, tailwind config)
function extractHead(html) {
  const headMatch = html.match(/<head>([\s\S]*?)<\/head>/);
  return headMatch ? headMatch[1] : '';
}

const sidebar = extractSidebar(overview);
const head = extractHead(overview);
const overviewMain = extractMain(overview);
const analysisMain = extractMain(analysis);
const benchmarksMain = extractMain(benchmarks);

const combined = `<!DOCTYPE html>
<html class="light" lang="en">
<head>
${head}
<title>Grange Land Intelligence | Victorian Land Market Platform</title>
<style>
  .page-section { display: none; }
  .page-section.active { display: flex; flex-direction: column; }
  .nav-link { cursor: pointer; }
  .nav-link.active-nav { background: rgba(255,255,255,0.1); color: #a3ecf0 !important; font-weight: 700; }
  .sold-toggle-btn.active-toggle { background: white; color: #001b44; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .suburb-row:hover { background: rgba(20,105,109,0.04); }
  .sortable { cursor: pointer; user-select: none; }
  .sortable:hover { color: #001b44; }
  .metric-card { transition: transform 0.2s, box-shadow 0.2s; }
  .metric-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,27,68,0.06); }
</style>
</head>
<body class="bg-surface font-body text-on-surface">

${sidebar.replace(
  /(<a[^>]*>[\s\S]*?<\/a>)/g,
  (match, a) => {
    // Make sidebar links into nav triggers
    if (a.includes('Overview') || a.includes('dashboard')) return a.replace('<a', '<a onclick="showPage(\'overview\')" data-page="overview"').replace(/class="[^"]*"/, 'class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm"');
    if (a.includes('Price Analysis') || a.includes('payments')) return a.replace('<a', '<a onclick="showPage(\'analysis\')" data-page="analysis"').replace(/class="[^"]*"/, 'class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm"');
    if (a.includes('Market Benchmarks') || a.includes('analytics')) return a.replace('<a', '<a onclick="showPage(\'benchmarks\')" data-page="benchmarks"').replace(/class="[^"]*"/, 'class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm"');
    if (a.includes('Growth Corridors') || a.includes('explore')) return a.replace('<a', '<a onclick="showPage(\'corridors\')" data-page="corridors"').replace(/class="[^"]*"/, 'class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm"');
    if (a.includes('Sales Velocity') || a.includes('trending_up')) return a.replace('<a', '<a onclick="showPage(\'velocity\')" data-page="velocity"').replace(/class="[^"]*"/, 'class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm"');
    return a;
  }
)}

<!-- OVERVIEW PAGE -->
<div id="page-overview" class="page-section active ml-64 min-h-screen">
${overviewMain.replace(/<main[^>]*>/, '').replace(/<\/main>/, '')}
</div>

<!-- PRICE ANALYSIS PAGE -->
<div id="page-analysis" class="page-section ml-64 min-h-screen">
${analysisMain.replace(/<main[^>]*>/, '').replace(/<\/main>/, '')}
</div>

<!-- BENCHMARKS PAGE -->
<div id="page-benchmarks" class="page-section ml-64 min-h-screen">
${benchmarksMain.replace(/<main[^>]*>/, '').replace(/<\/main>/, '')}
</div>

<!-- CORRIDORS PAGE (placeholder) -->
<div id="page-corridors" class="page-section ml-64 min-h-screen">
<div class="p-8">
  <h2 class="text-4xl font-headline font-extrabold text-primary tracking-tight">Growth Corridors</h2>
  <p class="text-on-surface-variant text-sm mt-2 mb-8">Interactive choropleth map of all 80 VIC LGAs — coming with live scraping pipeline</p>
  <div class="bg-surface-container-lowest rounded-xl p-12 shadow-sm text-center">
    <span class="material-symbols-outlined text-6xl text-secondary mb-4" style="font-variation-settings: 'FILL' 1;">map</span>
    <h3 class="text-xl font-headline font-extrabold text-primary mb-2">Interactive Map Loading</h3>
    <p class="text-sm text-on-surface-variant max-w-md mx-auto">80 VIC LGA boundaries ready. Heat colouring by median $/m². Click-through drill-down: corridor → LGA → suburb.</p>
  </div>
</div>
</div>

<!-- VELOCITY PAGE (placeholder) -->
<div id="page-velocity" class="page-section ml-64 min-h-screen">
<div class="p-8">
  <h2 class="text-4xl font-headline font-extrabold text-primary tracking-tight">Sales Velocity</h2>
  <p class="text-on-surface-variant text-sm mt-2 mb-8">Monthly listing and sales volume, absorption rates, and days on market analysis</p>
  <div class="grid grid-cols-4 gap-6 mb-8">
    <div class="bg-surface-container-lowest rounded-xl p-6 shadow-sm metric-card">
      <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em]">Total Sold</p>
      <p class="text-3xl font-headline font-extrabold text-primary mt-1" id="vel-sold">—</p>
    </div>
    <div class="bg-surface-container-lowest rounded-xl p-6 shadow-sm metric-card">
      <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em]">Active Listings</p>
      <p class="text-3xl font-headline font-extrabold text-secondary mt-1" id="vel-listed">—</p>
    </div>
    <div class="bg-surface-container-lowest rounded-xl p-6 shadow-sm metric-card">
      <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em]">Avg Sales/Month</p>
      <p class="text-3xl font-headline font-extrabold text-primary mt-1" id="vel-avg">—</p>
    </div>
    <div class="bg-surface-container-lowest rounded-xl p-6 shadow-sm metric-card">
      <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em]">Months of Supply</p>
      <p class="text-3xl font-headline font-extrabold text-primary mt-1" id="vel-supply">—</p>
    </div>
  </div>
</div>
</div>

<script>
// Real lot data
const LOTS = ${JSON.stringify(slimLots)};

// Page navigation
function showPage(page) {
  document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  
  // Update nav highlights
  document.querySelectorAll('.nav-link').forEach(el => {
    el.classList.remove('active-nav');
    if (el.dataset.page === page) el.classList.add('active-nav');
  });
}

// Set initial active nav
document.querySelector('[data-page="overview"]')?.classList.add('active-nav');

// Compute velocity stats
const sold = LOTS.filter(l => l.t === 1).length;
const listed = LOTS.filter(l => l.t === 0).length;
const months = new Set(LOTS.filter(l => l.d).map(l => l.d)).size || 1;
const avgPerMonth = Math.round(sold / months);
const supply = listed > 0 ? (listed / avgPerMonth).toFixed(1) : '—';

if (document.getElementById('vel-sold')) document.getElementById('vel-sold').textContent = sold.toLocaleString();
if (document.getElementById('vel-listed')) document.getElementById('vel-listed').textContent = listed.toLocaleString();
if (document.getElementById('vel-avg')) document.getElementById('vel-avg').textContent = avgPerMonth.toLocaleString();
if (document.getElementById('vel-supply')) document.getElementById('vel-supply').textContent = supply + ' mo';
</script>

</body>
</html>`;

writeFileSync('output/combined.html', combined);
console.log(`Combined app: ${(combined.length / 1024).toFixed(0)}KB`);
console.log(`Lots embedded: ${slimLots.length}`);
