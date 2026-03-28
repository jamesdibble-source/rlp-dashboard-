const fs = require('fs');
const path = require('path');

const lotsData = fs.readFileSync(path.join(__dirname, 'data', 'lots.json'), 'utf8');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Grange Development — Retail Lot Price Dashboard</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
<style>
:root{--bg:#0f172a;--card:#1e293b;--border:#334155;--text:#f1f5f9;--muted:#94a3b8;--accent:#3b82f6;--green:#22c55e;--red:#ef4444;--orange:#f97316;--purple:#a855f7}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px}
.header{background:linear-gradient(135deg,#1e3a5f,#0f172a);padding:20px 32px;border-bottom:1px solid var(--border)}
.header h1{font-size:24px;font-weight:700;letter-spacing:-0.5px}
.header .sub{color:var(--muted);font-size:13px;margin-top:4px}
.filters{display:flex;flex-wrap:wrap;gap:12px;padding:16px 32px;background:var(--card);border-bottom:1px solid var(--border);align-items:center}
.filters label{color:var(--muted);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px}
.filters select,.filters input[type=number]{background:#0f172a;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:13px}
.filters .check{display:flex;align-items:center;gap:6px;cursor:pointer}
.filters input[type=checkbox]{accent-color:var(--accent)}
.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;padding:20px 32px}
.card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px 20px}
.card .val{font-size:28px;font-weight:700;color:var(--accent)}
.card .lbl{color:var(--muted);font-size:12px;font-weight:600;text-transform:uppercase;margin-top:4px}
.charts{display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:0 32px 20px}
.chart-card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:20px;min-height:360px}
.chart-card.full{grid-column:1/-1}
.chart-card h3{font-size:15px;font-weight:600;margin-bottom:12px;color:var(--muted)}
canvas{width:100%!important;max-height:400px}
table{width:100%;border-collapse:collapse;margin-top:8px}
th{text-align:left;padding:8px 12px;font-size:12px;font-weight:600;text-transform:uppercase;color:var(--muted);border-bottom:2px solid var(--border)}
td{padding:8px 12px;border-bottom:1px solid var(--border);font-size:13px}
tr:hover td{background:#1a2744}
.outlier-tag{background:var(--orange);color:#000;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600}
.size-adj{margin:20px 32px;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:20px}
.size-adj h3{font-size:15px;font-weight:600;margin-bottom:12px;color:var(--muted)}
.size-adj table th{background:#0f172a}
@media(max-width:900px){.charts{grid-template-columns:1fr}.chart-card.full{grid-column:1}}
</style>
</head>
<body>
<div class="header">
  <h1>🏘️ Grange Development — Retail Lot Price Dashboard</h1>
  <div class="sub">VIC Land Subdivision Markets • <span id="dataDate"></span> • <span id="totalCount"></span> lots loaded</div>
</div>
<div class="filters">
  <div><label>Market</label><br><select id="fMarket"><option value="all">All Markets</option></select></div>
  <div><label>Status</label><br><select id="fStatus"><option value="all">All</option><option value="Listing">Listing</option><option value="Sold">Sold</option></select></div>
  <div><label>Min Size (m²)</label><br><input type="number" id="fMinSize" value="150" min="150" max="2000" step="50"></div>
  <div><label>Max Size (m²)</label><br><input type="number" id="fMaxSize" value="2000" min="150" max="2000" step="50"></div>
  <div><label>Min Price ($)</label><br><input type="number" id="fMinPrice" value="0" min="0" step="10000"></div>
  <div><label>Max Price ($)</label><br><input type="number" id="fMaxPrice" value="1000000" min="0" step="10000"></div>
  <div><label class="check"><input type="checkbox" id="fOutliers" checked> Show Outliers</label></div>
</div>
<div class="summary">
  <div class="card"><div class="val" id="sTotal">0</div><div class="lbl">Total Lots</div></div>
  <div class="card"><div class="val" id="sMedianPsm">$0</div><div class="lbl">Median $/m²</div></div>
  <div class="card"><div class="val" id="sMedianPrice">$0</div><div class="lbl">Median Price</div></div>
  <div class="card"><div class="val" id="sMarkets">0</div><div class="lbl">Markets</div></div>
  <div class="card"><div class="val" id="sListings">0</div><div class="lbl">Listings</div></div>
  <div class="card"><div class="val" id="sSold">0</div><div class="lbl">Sold</div></div>
</div>
<div class="charts">
  <div class="chart-card"><h3>Price vs Lot Size</h3><canvas id="cScatter1"></canvas></div>
  <div class="chart-card"><h3>$/m² vs Lot Size</h3><canvas id="cScatter2"></canvas></div>
  <div class="chart-card"><h3>Median $/m² by Market</h3><canvas id="cBar"></canvas></div>
  <div class="chart-card"><h3>Size Band Analysis</h3><canvas id="cBands"></canvas></div>
  <div class="chart-card full"><h3>$/m² Over Time (Monthly Median)</h3><canvas id="cTime"></canvas></div>
  <div class="chart-card full"><h3>Market Comparison</h3>
    <table id="tMarket">
      <thead><tr><th>Market</th><th>Count</th><th>Listings</th><th>Sold</th><th>Med. Price</th><th>Med. Size</th><th>Med. $/m²</th><th>Min $/m²</th><th>Max $/m²</th><th>Outliers</th></tr></thead>
      <tbody></tbody>
    </table>
  </div>
</div>
<div class="size-adj">
  <h3>RLP Size Adjustment Table</h3>
  <p style="color:var(--muted);font-size:12px;margin-bottom:12px">Used to normalize lot prices to a standard lot size. Based on Grange empirical analysis across Australian markets.</p>
  <table>
    <thead><tr><th>Size Change %</th><th>Price Adjustment</th></tr></thead>
    <tbody>
      <tr><td>0–10%</td><td>0.00%</td></tr>
      <tr><td>10–20%</td><td>2.24%</td></tr>
      <tr><td>20–30%</td><td>5.40%</td></tr>
      <tr><td>30–40%</td><td>12.61%</td></tr>
      <tr><td>40–50%</td><td>17.37%</td></tr>
      <tr><td>50–60%</td><td>24.39%</td></tr>
      <tr><td>60–70%</td><td>38.66%</td></tr>
    </tbody>
  </table>
</div>
<script>
const ALL_LOTS = ${lotsData};
const COLORS = {Ballarat:'#3b82f6',Wangaratta:'#22c55e','Murray Bridge':'#f97316',Bendigo:'#a855f7',Geelong:'#ec4899',Melton:'#14b8a6',Sunbury:'#eab308',Craigieburn:'#6366f1',Pakenham:'#f43f5e',Traralgon:'#06b6d4',Warragul:'#84cc16',Seymour:'#fb923c','Bacchus Marsh':'#8b5cf6'};
const BANDS = [[150,250],[250,350],[350,450],[450,550],[550,700],[700,1000],[1000,2000]];
let charts = {};

function median(arr){if(!arr.length)return 0;const s=[...arr].sort((a,b)=>a-b);const m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2}
function fmt$(n){return '$'+Math.round(n).toLocaleString()}

function getFiltered(){
  const m=document.getElementById('fMarket').value;
  const st=document.getElementById('fStatus').value;
  const minS=+document.getElementById('fMinSize').value;
  const maxS=+document.getElementById('fMaxSize').value;
  const minP=+document.getElementById('fMinPrice').value;
  const maxP=+document.getElementById('fMaxPrice').value;
  const showO=document.getElementById('fOutliers').checked;
  return ALL_LOTS.filter(l=>{
    if(m!=='all'&&l.market!==m)return false;
    if(st!=='all'&&l.status!==st)return false;
    if(l.lotSize<minS||l.lotSize>maxS)return false;
    if(l.price<minP||l.price>maxP)return false;
    if(!showO&&l.isOutlier)return false;
    return true;
  });
}

function updateAll(){
  const lots=getFiltered();
  const markets=[...new Set(lots.map(l=>l.market))].sort();
  // Summary
  document.getElementById('sTotal').textContent=lots.length.toLocaleString();
  document.getElementById('sMedianPsm').textContent=fmt$(median(lots.map(l=>l.pricePerSqm)));
  document.getElementById('sMedianPrice').textContent=fmt$(median(lots.map(l=>l.price)));
  document.getElementById('sMarkets').textContent=markets.length;
  document.getElementById('sListings').textContent=lots.filter(l=>l.status==='Listing').length.toLocaleString();
  document.getElementById('sSold').textContent=lots.filter(l=>l.status==='Sold').length.toLocaleString();
  
  // Scatter 1: Price vs Size
  const s1Data=markets.map(m=>({label:m,data:lots.filter(l=>l.market===m).map(l=>({x:l.lotSize,y:l.price,lot:l})),backgroundColor:COLORS[m]||'#888',pointRadius:3,pointHoverRadius:6}));
  if(charts.s1)charts.s1.destroy();
  charts.s1=new Chart(document.getElementById('cScatter1'),{type:'scatter',data:{datasets:s1Data},options:{responsive:true,plugins:{legend:{labels:{color:'#94a3b8'}},tooltip:{callbacks:{label:ctx=>{const l=ctx.raw.lot;return l.address+' | '+l.suburb+' | '+l.lotSize+'m² | '+fmt$(l.price)+' | '+fmt$(l.pricePerSqm)+'/m²'}}}},scales:{x:{title:{display:true,text:'Lot Size (m²)',color:'#94a3b8'},ticks:{color:'#94a3b8'},grid:{color:'#1e293b'}},y:{title:{display:true,text:'Price ($)',color:'#94a3b8'},ticks:{color:'#94a3b8',callback:v=>fmt$(v)},grid:{color:'#1e293b'}}}}});
  
  // Scatter 2: $/m² vs Size
  const s2Data=markets.map(m=>({label:m,data:lots.filter(l=>l.market===m).map(l=>({x:l.lotSize,y:l.pricePerSqm,lot:l})),backgroundColor:COLORS[m]||'#888',pointRadius:3,pointHoverRadius:6}));
  if(charts.s2)charts.s2.destroy();
  charts.s2=new Chart(document.getElementById('cScatter2'),{type:'scatter',data:{datasets:s2Data},options:{responsive:true,plugins:{legend:{labels:{color:'#94a3b8'}},tooltip:{callbacks:{label:ctx=>{const l=ctx.raw.lot;return l.address+' | '+l.suburb+' | '+l.lotSize+'m² | '+fmt$(l.pricePerSqm)+'/m²'}}}},scales:{x:{title:{display:true,text:'Lot Size (m²)',color:'#94a3b8'},ticks:{color:'#94a3b8'},grid:{color:'#1e293b'}},y:{title:{display:true,text:'$/m²',color:'#94a3b8'},ticks:{color:'#94a3b8',callback:v=>fmt$(v)},grid:{color:'#1e293b'}}}}});
  
  // Bar: Median $/m² by market
  const barLabels=markets;
  const barData=markets.map(m=>median(lots.filter(l=>l.market===m).map(l=>l.pricePerSqm)));
  if(charts.bar)charts.bar.destroy();
  charts.bar=new Chart(document.getElementById('cBar'),{type:'bar',data:{labels:barLabels,datasets:[{label:'Median $/m²',data:barData,backgroundColor:markets.map(m=>COLORS[m]||'#888')}]},options:{responsive:true,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#94a3b8',callback:v=>fmt$(v)},grid:{color:'#1e293b'}},y:{ticks:{color:'#94a3b8'},grid:{color:'#1e293b'}}}}});
  
  // Size bands
  const bandLabels=BANDS.map(b=>b[0]+'-'+b[1]+'m²');
  const bandCounts=BANDS.map(b=>lots.filter(l=>l.lotSize>=b[0]&&l.lotSize<b[1]).length);
  const bandAvgPrice=BANDS.map(b=>{const bl=lots.filter(l=>l.lotSize>=b[0]&&l.lotSize<b[1]);return bl.length?Math.round(bl.reduce((s,l)=>s+l.price,0)/bl.length):0});
  const bandAvgPsm=BANDS.map(b=>{const bl=lots.filter(l=>l.lotSize>=b[0]&&l.lotSize<b[1]);return bl.length?Math.round(bl.reduce((s,l)=>s+l.pricePerSqm,0)/bl.length):0});
  if(charts.bands)charts.bands.destroy();
  charts.bands=new Chart(document.getElementById('cBands'),{type:'bar',data:{labels:bandLabels,datasets:[{label:'Count',data:bandCounts,backgroundColor:'#3b82f6',yAxisID:'y'},{label:'Avg $/m²',data:bandAvgPsm,backgroundColor:'#22c55e',yAxisID:'y1'}]},options:{responsive:true,plugins:{legend:{labels:{color:'#94a3b8'}}},scales:{y:{type:'linear',position:'left',title:{display:true,text:'Count',color:'#94a3b8'},ticks:{color:'#94a3b8'},grid:{color:'#1e293b'}},y1:{type:'linear',position:'right',title:{display:true,text:'Avg $/m²',color:'#94a3b8'},ticks:{color:'#94a3b8',callback:v=>fmt$(v)},grid:{drawOnChartArea:false}},x:{ticks:{color:'#94a3b8'},grid:{color:'#1e293b'}}}}});
  
  // Time series
  const lotsWithDate=lots.filter(l=>l.date);
  const months={};
  lotsWithDate.forEach(l=>{const m=l.date.substring(0,7);if(!months[m])months[m]={};if(!months[m][l.market])months[m][l.market]=[];months[m][l.market].push(l.pricePerSqm)});
  const allMonths=Object.keys(months).sort();
  const timeDatasets=markets.filter(m=>lotsWithDate.some(l=>l.market===m)).map(m=>({label:m,data:allMonths.map(mo=>months[mo]&&months[mo][m]?median(months[mo][m]):null),borderColor:COLORS[m]||'#888',backgroundColor:COLORS[m]||'#888',tension:0.3,pointRadius:3,spanGaps:true}));
  if(charts.time)charts.time.destroy();
  charts.time=new Chart(document.getElementById('cTime'),{type:'line',data:{labels:allMonths,datasets:timeDatasets},options:{responsive:true,plugins:{legend:{labels:{color:'#94a3b8'}}},scales:{x:{ticks:{color:'#94a3b8',maxRotation:45},grid:{color:'#1e293b'}},y:{title:{display:true,text:'Median $/m²',color:'#94a3b8'},ticks:{color:'#94a3b8',callback:v=>fmt$(v)},grid:{color:'#1e293b'}}}}});
  
  // Market table
  const tbody=document.querySelector('#tMarket tbody');
  tbody.innerHTML='';
  markets.forEach(m=>{
    const ml=lots.filter(l=>l.market===m);
    const prices=ml.map(l=>l.price).sort((a,b)=>a-b);
    const sizes=ml.map(l=>l.lotSize).sort((a,b)=>a-b);
    const psms=ml.map(l=>l.pricePerSqm).sort((a,b)=>a-b);
    const tr=document.createElement('tr');
    tr.innerHTML='<td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:'+(COLORS[m]||'#888')+';margin-right:8px"></span>'+m+'</td>'+
      '<td>'+ml.length+'</td>'+
      '<td>'+ml.filter(l=>l.status==='Listing').length+'</td>'+
      '<td>'+ml.filter(l=>l.status==='Sold').length+'</td>'+
      '<td>'+fmt$(median(prices))+'</td>'+
      '<td>'+Math.round(median(sizes))+'m²</td>'+
      '<td>'+fmt$(median(psms))+'</td>'+
      '<td>'+fmt$(psms[0]||0)+'</td>'+
      '<td>'+fmt$(psms[psms.length-1]||0)+'</td>'+
      '<td>'+ml.filter(l=>l.isOutlier).length+'</td>';
    tbody.appendChild(tr);
  });
}

// Init
const allMarkets=[...new Set(ALL_LOTS.map(l=>l.market))].sort();
const sel=document.getElementById('fMarket');
allMarkets.forEach(m=>{const o=document.createElement('option');o.value=m;o.textContent=m;sel.appendChild(o)});
document.getElementById('totalCount').textContent=ALL_LOTS.length.toLocaleString();
const dates=ALL_LOTS.filter(l=>l.date).map(l=>l.date).sort();
document.getElementById('dataDate').textContent=dates.length?dates[0]+' to '+dates[dates.length-1]:'No dates';

// Bind filters
['fMarket','fStatus','fMinSize','fMaxSize','fMinPrice','fMaxPrice','fOutliers'].forEach(id=>{
  document.getElementById(id).addEventListener('change',updateAll);
  document.getElementById(id).addEventListener('input',updateAll);
});

updateAll();
</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'rlp-dashboard.html'), html);
console.log('Dashboard built: rlp-dashboard.html (' + (html.length / 1024).toFixed(0) + ' KB)');
