#!/usr/bin/env node
// Builds interactive multi-page dashboard from James's Stitch design template
// Pages: Overview, Pricing, Corridors, Registry
// All data embedded as JSON, all charts rendered client-side

const fs = require('fs');
const { getDb } = require('./engine/db');
const db = getDb();

// ── Pull all data ──
const states = db.prepare("SELECT DISTINCT state FROM lots WHERE price > 0").all().map(r => r.state);

function getStateData(state) {
  const where = state ? `AND state='${state}'` : '';
  const totals = db.prepare(`SELECT COUNT(*) as total, COUNT(CASE WHEN status='sold' THEN 1 END) as sold, COUNT(CASE WHEN status='listing' THEN 1 END) as listings, ROUND(AVG(price)) as avg_price, ROUND(AVG(lot_size)) as avg_size, ROUND(AVG(price_per_sqm),2) as avg_rate FROM lots WHERE price > 0 AND price < 5000000 ${where}`).get();
  
  const corridors = db.prepare(`SELECT corridor, COUNT(*) as total, ROUND(AVG(price)) as avg_price, ROUND(AVG(lot_size)) as avg_size, ROUND(AVG(price_per_sqm),2) as avg_rate, COUNT(CASE WHEN status='sold' THEN 1 END) as sold, COUNT(CASE WHEN status='listing' THEN 1 END) as listings FROM lots WHERE price > 0 AND price < 5000000 AND corridor IS NOT NULL ${where} GROUP BY corridor ORDER BY total DESC`).all();
  
  const lgas = db.prepare(`SELECT lga, corridor, COUNT(*) as total, COUNT(CASE WHEN status='sold' THEN 1 END) as sold, COUNT(CASE WHEN status='listing' THEN 1 END) as listings, ROUND(AVG(price)) as avg_price, ROUND(AVG(lot_size)) as avg_size, ROUND(AVG(price_per_sqm),2) as avg_rate FROM lots WHERE price > 0 AND price < 5000000 AND lga != '' ${where} GROUP BY lga ORDER BY total DESC`).all();
  
  const suburbs = db.prepare(`SELECT suburb, lga, corridor, state, COUNT(*) as total, COUNT(CASE WHEN status='sold' THEN 1 END) as sold, COUNT(CASE WHEN status='listing' THEN 1 END) as listings, ROUND(AVG(price)) as avg_price, ROUND(AVG(lot_size)) as avg_size, ROUND(AVG(price_per_sqm),2) as avg_rate FROM lots WHERE price > 0 AND price < 5000000 ${where} GROUP BY suburb ORDER BY total DESC`).all();
  
  const priceDist = db.prepare(`SELECT CASE WHEN price<150000 THEN '<150k' WHEN price<200000 THEN '150-200k' WHEN price<250000 THEN '200-250k' WHEN price<300000 THEN '250-300k' WHEN price<350000 THEN '300-350k' WHEN price<400000 THEN '350-400k' WHEN price<500000 THEN '400-500k' WHEN price<600000 THEN '500-600k' ELSE '600k+' END as bracket, COUNT(*) as count FROM lots WHERE price > 0 AND price < 5000000 ${where} GROUP BY bracket ORDER BY MIN(price)`).all();
  
  const sizeDist = db.prepare(`SELECT CASE WHEN lot_size<200 THEN '<200' WHEN lot_size<300 THEN '200-300' WHEN lot_size<400 THEN '300-400' WHEN lot_size<500 THEN '400-500' WHEN lot_size<600 THEN '500-600' WHEN lot_size<700 THEN '600-700' WHEN lot_size<800 THEN '700-800' ELSE '800+' END as bracket, COUNT(*) as count FROM lots WHERE lot_size > 0 AND lot_size < 5000 ${where} GROUP BY bracket ORDER BY MIN(lot_size)`).all();

  const rateDist = db.prepare(`SELECT CASE WHEN price_per_sqm<200 THEN '<200' WHEN price_per_sqm<400 THEN '200-400' WHEN price_per_sqm<600 THEN '400-600' WHEN price_per_sqm<800 THEN '600-800' WHEN price_per_sqm<1000 THEN '800-1k' WHEN price_per_sqm<1200 THEN '1-1.2k' ELSE '1.2k+' END as bracket, COUNT(*) as count FROM lots WHERE price_per_sqm > 0 AND price_per_sqm < 5000 ${where} GROUP BY bracket ORDER BY MIN(price_per_sqm)`).all();
  
  const topRate = db.prepare(`SELECT suburb, corridor, ROUND(AVG(price_per_sqm),2) as avg_rate, ROUND(AVG(price)) as avg_price, COUNT(*) as count FROM lots WHERE price_per_sqm > 0 AND price_per_sqm < 5000 ${where} GROUP BY suburb HAVING count >= 3 ORDER BY avg_rate DESC LIMIT 15`).all();
  
  const bottomRate = db.prepare(`SELECT suburb, corridor, ROUND(AVG(price_per_sqm),2) as avg_rate, ROUND(AVG(price)) as avg_price, COUNT(*) as count FROM lots WHERE price_per_sqm > 0 AND price_per_sqm < 5000 ${where} GROUP BY suburb HAVING count >= 3 ORDER BY avg_rate ASC LIMIT 15`).all();

  return { totals, corridors, lgas, suburbs, priceDist, sizeDist, rateDist, topRate, bottomRate };
}

const allData = getStateData(null);
const stateData = {};
for (const s of states) {
  stateData[s] = getStateData(s);
}
db.close();

// Load active suburbs
let activeSuburbs = {};
for (const s of ['vic','nsw','qld','wa','sa','tas','nt','act']) {
  try {
    activeSuburbs[s.toUpperCase()] = JSON.parse(fs.readFileSync(`engine/data/active-suburbs-${s}.json`, 'utf8'));
  } catch(e) {}
}

const DATA = JSON.stringify({ all: allData, states: stateData, activeSuburbs, stateList: states });

// ── Build HTML ──
const html = `<!DOCTYPE html>
<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Grange Land Intelligence</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Inter:wght@300;400;500;600;700&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
<script>
tailwind.config={darkMode:"class",theme:{extend:{colors:{"outline":"#7d747e","on-primary":"#ffffff","on-surface-variant":"#4b444d","background":"#fcf9f1","surface-variant":"#e4e2da","primary":"#513561","error":"#ba1a1a","surface":"#fcf9f1","on-surface":"#1b1c17","surface-container-high":"#eae8e0","surface-container":"#f0eee6","surface-container-low":"#f6f4eb","surface-container-lowest":"#ffffff","surface-dim":"#dcdad2","secondary":"#486456","tertiary":"#61323a","primary-container":"#6a4c7a","tertiary-container":"#7c4951","outline-variant":"#cec3ce"},fontFamily:{"serif":["Playfair Display","serif"],"sans":["Inter","sans-serif"]},borderRadius:{"DEFAULT":"0px","lg":"0px","xl":"0px","full":"9999px"}}}}
</script>
<style>
body{font-family:'Inter',sans-serif;background:#fcf9f1;color:#1b1c17}
.archival-grain{background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");opacity:.03;pointer-events:none}
.hairline-grid{border:0.5px solid #dcdad2}
.sf::-webkit-scrollbar{width:4px}.sf::-webkit-scrollbar-track{background:transparent}.sf::-webkit-scrollbar-thumb{background:#dcdad2;border-radius:4px}
tr.dr:hover td{background:#f6f4eb}
.bar-grow{transition:width .8s cubic-bezier(.4,0,.2,1)}
.bar-rise{transition:height .6s cubic-bezier(.4,0,.2,1)}
.fade-in{animation:fadeIn .4s ease}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.nav-item{transition:all .15s}
.nav-item.active{color:#6a4c7a;font-weight:700;border-left:2px solid #6a4c7a;background:#f6f4eb}
.nav-item:not(.active){color:rgba(27,28,23,.6);border-left:2px solid transparent}
.state-pill{transition:all .2s}.state-pill:hover{background:#eae8e0}.state-pill.active{background:#6a4c7a;color:#fff}
.sort-asc::after{content:'▲';font-size:8px;margin-left:4px}.sort-desc::after{content:'▼';font-size:8px;margin-left:4px}
</style>
</head>
<body class="h-screen overflow-hidden relative">
<div class="absolute inset-0 archival-grain"></div>

<!-- Sidebar -->
<aside class="fixed left-0 top-0 h-full flex flex-col py-8 w-64 border-r border-[#dcdad2] bg-[#fcf9f1] z-20">
  <div class="px-8 mb-12">
    <img alt="Grange Logo" class="h-10 w-auto object-contain mb-8" src="https://lh3.googleusercontent.com/aida/ADBb0ujaAK-9ft62u3dTI9Oaquh8Dqxz-rSaeVnBIpQiuY2ciMkuG6DRa2yCDB36Qog-lF8VKZQ2yF3cDBS7JGb9mBUpkAFACUL5bbIuGi-Xo8gnv5nIz2pSRuaHGd0MyvUwGHJuJsAGlBIQ8UHa2aWTBnXIm-memtnt5kPAXnXOkIqPW3XhF-Lkffb_qCM5iRoSjeRBl_GP7EWKZEWRebGgtT-Fr0elfbEvze5fZ3HZ5v7ITSz2J2ijwbW4laiD-ReU7l92aVPOxfJt"/>
  </div>
  <nav class="flex-1 space-y-1">
    <a class="nav-item active flex items-center pl-6 py-3" href="#" onclick="switchPage('overview');return false">
      <span class="material-symbols-outlined mr-4" style="font-variation-settings:'FILL' 1">dashboard</span>
      <span class="text-xs uppercase tracking-[1.2px]">Overview</span>
    </a>
    <a class="nav-item flex items-center pl-6 py-3" href="#" onclick="switchPage('pricing');return false">
      <span class="material-symbols-outlined mr-4">trending_up</span>
      <span class="text-xs uppercase tracking-[1.2px]">Price Analysis</span>
    </a>
    <a class="nav-item flex items-center pl-6 py-3" href="#" onclick="switchPage('corridors');return false">
      <span class="material-symbols-outlined mr-4">map</span>
      <span class="text-xs uppercase tracking-[1.2px]">Corridors</span>
    </a>
    <a class="nav-item flex items-center pl-6 py-3" href="#" onclick="switchPage('registry');return false">
      <span class="material-symbols-outlined mr-4">analytics</span>
      <span class="text-xs uppercase tracking-[1.2px]">Registry</span>
    </a>
  </nav>
  <div class="px-6 pt-8 border-t border-[#dcdad2]">
    <a class="flex items-center text-[#1b1c17]/60 font-medium py-2 hover:bg-[#f6f4eb]" href="#">
      <span class="material-symbols-outlined mr-4 text-sm">settings</span>
      <span class="text-[10px] uppercase tracking-[1.2px]">Settings</span>
    </a>
  </div>
</aside>

<!-- Main -->
<main class="ml-64 h-screen overflow-y-auto sf bg-[#fcf9f1]" id="main">
  <!-- Top Bar -->
  <header class="flex justify-between items-center w-full px-12 h-20 border-b border-[#dcdad2] bg-[#fcf9f1] sticky top-0 z-10">
    <div class="flex items-center gap-8">
      <nav class="flex gap-6">
        <span class="text-[#1b1c17] uppercase tracking-[0.2em] text-[10px] font-semibold" id="pageTitle">Archive Explorer</span>
      </nav>
    </div>
    <div class="flex items-center gap-8">
      <!-- State Filter -->
      <div class="flex gap-2" id="statePills"></div>
      <!-- Sold Only Toggle -->
      <div class="flex items-center gap-3 cursor-pointer" onclick="toggleSold()">
        <span class="text-[10px] uppercase tracking-[0.15em] font-semibold text-[#1b1c17]/50">Sold Only</span>
        <div class="w-10 h-5 rounded-full bg-[#dcdad2] relative transition-colors" id="soldToggle">
          <div class="w-4 h-4 rounded-full bg-white absolute top-0.5 left-0.5 transition-all shadow-sm" id="soldDot"></div>
        </div>
      </div>
      <div class="relative">
        <input class="bg-transparent border-b border-[#dcdad2] focus:border-[#6a4c7a] focus:ring-0 text-[10px] uppercase tracking-widest py-1 pr-8 w-48 placeholder:text-[#1b1c17]/30" placeholder="Search suburb..." type="text" id="searchInput" oninput="onSearch(this.value)"/>
        <span class="material-symbols-outlined absolute right-0 top-1 text-sm text-[#1b1c17]/60">search</span>
      </div>
      <span class="material-symbols-outlined text-[#1b1c17]/60 cursor-pointer text-lg">notifications</span>
      <span class="material-symbols-outlined text-[#1b1c17]/60 cursor-pointer text-lg">account_circle</span>
    </div>
  </header>

  <!-- Content -->
  <div class="w-full max-w-[1400px] mx-auto flex-1 px-12 py-12" id="content"></div>

  <!-- Footer -->
  <footer class="w-full max-w-[1400px] mx-auto px-12 pb-12 flex justify-between items-center text-[9px] uppercase tracking-[0.4em] font-bold text-[#1b1c17]/30">
    <div>© 2026 Grange Land Intelligence. All rights reserved.</div>
    <div class="flex gap-10">
      <span>Data sourced from Domain.com.au</span>
      <span id="updatedAt"></span>
    </div>
  </footer>
</main>

<script>
const RAW = ${DATA};
let currentPage = 'overview';
let currentState = null;
let soldOnly = false;
let sortCol = null, sortDir = 'desc';
let searchTerm = '';

const CLR = {Western:'#513561',Northern:'#486456','South Eastern':'#61323a','North East':'#7c4951',Ballarat:'#6a4c7a',Geelong:'#314c3f',Bendigo:'#583b68',Shepparton:'#486456','Latrobe Valley':'#61323a','Murray Bridge':'#7c4951'};
const CLRA = ['#513561','#486456','#61323a','#7c4951','#6a4c7a','#314c3f','#583b68','#8b5e3c','#4a6741','#6b4c3b'];

function D(){ return currentState ? RAW.states[currentState] : RAW.all; }
function fmt(n){return n?'$'+Math.round(n).toLocaleString():'-'}
function fmtK(n){if(!n)return'-';return n>=1e6?'$'+(n/1e6).toFixed(1)+'m':n>=1e3?'$'+Math.round(n/1e3)+'k':fmt(n)}
function fmtN(n){return n?n.toLocaleString():'0'}
function pct(a,b){return b?Math.round(a/b*100)+'%':'0%'}

// ── State pills ──
function renderStatePills(){
  const pills = ['<button class="state-pill px-3 py-1 text-[9px] uppercase tracking-wider font-semibold '+(currentState===null?'active bg-[#6a4c7a] text-white':'bg-[#eae8e0] text-[#1b1c17]/60')+'" onclick="setState(null)">All</button>'];
  RAW.stateList.forEach(s=>{
    pills.push('<button class="state-pill px-3 py-1 text-[9px] uppercase tracking-wider font-semibold '+(currentState===s?'active bg-[#6a4c7a] text-white':'bg-[#eae8e0] text-[#1b1c17]/60')+'" onclick="setState(\\''+s+'\\')">'+s+'</button>');
  });
  document.getElementById('statePills').innerHTML = pills.join('');
}

function setState(s){ currentState=s; renderStatePills(); render(); }
function toggleSold(){
  soldOnly=!soldOnly;
  document.getElementById('soldToggle').style.background=soldOnly?'#6a4c7a':'#dcdad2';
  document.getElementById('soldDot').style.left=soldOnly?'22px':'2px';
  render();
}
function onSearch(v){ searchTerm=v.toLowerCase(); render(); }

// ── Page switching ──
function switchPage(page){
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach((el,i)=>{
    const pages=['overview','pricing','corridors','registry'];
    el.classList.toggle('active', pages[i]===page);
    el.querySelector('.material-symbols-outlined').style.fontVariationSettings = pages[i]===page ? "'FILL' 1" : "'FILL' 0";
  });
  const titles = {overview:'Archive Explorer',pricing:'Price Analysis',corridors:'Growth Corridors',registry:'Suburb Registry'};
  document.getElementById('pageTitle').textContent = titles[page];
  render();
}

// ── SVG Helpers ──
function duneChart(data, w, h){
  if(!data.length) return '';
  const max = Math.max(...data.map(d=>d.count));
  const pts = data.map((d,i)=>({x:Math.round(i/(data.length-1)*w), y:h-Math.round(d.count/max*(h-20))-10}));
  function smooth(pts,yOff){
    const p=pts.map(pt=>({x:pt.x,y:Math.min(h,pt.y+(yOff||0))}));
    let d='M0,'+h+' L0,'+p[0].y;
    for(let i=0;i<p.length-1;i++){const cx=(p[i].x+p[i+1].x)/2;d+=' Q'+p[i].x+','+p[i].y+' '+cx+','+(Math.round((p[i].y+p[i+1].y)/2));}
    d+=' L'+w+','+p[p.length-1].y+' L'+w+','+h+' Z';return d;
  }
  function line(pts,yOff){
    const p=pts.map(pt=>({x:pt.x,y:Math.min(h,pt.y+(yOff||0))}));
    let d='M0,'+p[0].y;
    for(let i=0;i<p.length-1;i++){const cx=(p[i].x+p[i+1].x)/2;d+=' Q'+p[i].x+','+p[i].y+' '+cx+','+(Math.round((p[i].y+p[i+1].y)/2));}
    d+=' L'+w+','+p[p.length-1].y;return d;
  }
  return '<svg class="w-full h-full" preserveAspectRatio="none" viewBox="0 0 '+w+' '+h+'">'
    +'<defs>'
    +'<linearGradient id="gs" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#486456" stop-opacity="0.6"/><stop offset="100%" stop-color="#486456" stop-opacity="0"/></linearGradient>'
    +'<linearGradient id="gp" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#513561" stop-opacity="0.5"/><stop offset="100%" stop-color="#513561" stop-opacity="0"/></linearGradient>'
    +'<linearGradient id="gr" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#61323a" stop-opacity="0.7"/><stop offset="100%" stop-color="#61323a" stop-opacity="0"/></linearGradient>'
    +'</defs>'
    +'<path d="'+smooth(pts,0)+'" fill="url(#gs)"/><path d="'+line(pts,0)+'" fill="none" stroke="#486456" stroke-width="0.5"/>'
    +'<path d="'+smooth(pts,30)+'" fill="url(#gp)"/><path d="'+line(pts,30)+'" fill="none" stroke="#513561" stroke-width="0.8"/>'
    +'<path d="'+smooth(pts,60)+'" fill="url(#gr)"/><path d="'+line(pts,60)+'" fill="none" stroke="#61323a" stroke-width="1.2"/>'
    +'</svg>';
}

function vertBars(data, color){
  if(!data.length) return '<div class="text-[11px] text-[#1b1c17]/40">No data</div>';
  const max = Math.max(...data.map(d=>d.count));
  return '<div class="flex items-end gap-2 h-48">'
    +data.map((d,i)=>'<div class="flex-1 flex flex-col items-center justify-end h-full">'
      +'<span class="text-[9px] font-semibold text-[#1b1c17]/50 mb-1">'+fmtN(d.count)+'</span>'
      +'<div class="w-full bar-rise" style="height:'+Math.max(d.count/max*100,3)+'%;background:'+(typeof color==='string'?color:CLRA[i%CLRA.length])+';opacity:0.7"></div>'
      +'</div>').join('')
    +'</div>'
    +'<div class="flex gap-2 mt-2">'+data.map(d=>'<div class="flex-1 text-center text-[8px] text-[#1b1c17]/40 uppercase tracking-wider font-semibold">'+d.bracket+'</div>').join('')+'</div>';
}

function horizBars(data, valKey, labelFn, maxVal){
  if(!data.length) return '';
  const mx = maxVal || Math.max(...data.map(d=>d[valKey]));
  return data.map((d,i)=>'<div class="flex items-center gap-3 mb-2">'
    +'<div class="w-28 text-right text-[11px] font-medium truncate">'+d.suburb+'</div>'
    +'<div class="flex-1 h-5 bg-[#eae8e0] relative overflow-hidden"><div class="h-full bar-grow" style="width:'+Math.max(d[valKey]/mx*100,2)+'%;background:'+CLRA[i%CLRA.length]+';opacity:0.65"></div></div>'
    +'<div class="w-20 text-right text-[11px] font-semibold text-[#513561]">'+labelFn(d)+'</div>'
    +'</div>').join('');
}

function donut(data, size){
  if(!data.length) return '';
  const total = data.reduce((s,d)=>s+d.total,0);
  let cum=0;
  const r=size/2, ir=size/2*0.65, cx=size/2, cy=size/2;
  const paths = data.map((d,i)=>{
    const angle=(d.total/total)*360;
    const sa=cum; cum+=angle;
    if(angle>=359.9) return '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+(CLR[d.corridor]||CLRA[i%CLRA.length])+'" opacity="0.8"/><circle cx="'+cx+'" cy="'+cy+'" r="'+ir+'" fill="#f6f4eb"/>';
    const la=angle>180?1:0;
    const s1=Math.cos((sa-90)*Math.PI/180),c1=Math.sin((sa-90)*Math.PI/180);
    const s2=Math.cos((sa+angle-90)*Math.PI/180),c2=Math.sin((sa+angle-90)*Math.PI/180);
    return '<path d="M'+(cx+ir*s1)+','+(cy+ir*c1)+' L'+(cx+r*s1)+','+(cy+r*c1)+' A'+r+','+r+',0,'+la+',1,'+(cx+r*s2)+','+(cy+r*c2)+' L'+(cx+ir*s2)+','+(cy+ir*c2)+' A'+ir+','+ir+',0,'+la+',0,'+(cx+ir*s1)+','+(cy+ir*c1)+' Z" fill="'+(CLR[d.corridor]||CLRA[i%CLRA.length])+'" opacity="0.8"/>';
  });
  const legend = data.map((d,i)=>'<div class="flex items-center gap-2"><span class="w-2 h-2" style="background:'+(CLR[d.corridor]||CLRA[i%CLRA.length])+'"></span><span class="text-[10px] font-semibold text-[#1b1c17]/70">'+d.corridor+'</span><span class="text-[10px] text-[#1b1c17]/40 ml-1">'+Math.round(d.total/total*100)+'%</span></div>').join('');
  return '<div class="flex items-center gap-10"><div class="relative" style="width:'+size+'px;height:'+size+'px"><svg viewBox="0 0 '+size+' '+size+'">'+paths.join('')+'</svg><div class="absolute inset-0 flex items-center justify-center"><div class="text-center"><span class="font-sans text-2xl font-medium tracking-tight text-[#111]">'+fmtN(total)+'</span><span class="block text-[8px] uppercase tracking-widest text-[#888] mt-1">lots</span></div></div></div><div class="space-y-2">'+legend+'</div></div>';
}

// ── Page Renderers ──
function renderOverview(){
  const d = D();
  const t = d.totals;
  const c = d.corridors;
  const label = currentState || 'National';
  
  let alerts = c.slice(0,3).map((cr,i)=>
    '<div class="flex items-start gap-8"><span class="font-sans text-5xl font-medium tracking-tight text-[#1A1A1A]">'+String(i+1).padStart(2,'0')+'</span><div class="pt-1"><p class="font-bold text-[11px] uppercase tracking-widest text-[#1b1c17] mb-2">'+cr.corridor+': '+fmtN(cr.total)+' Lots · '+fmtK(cr.avg_price)+' avg</p><p class="text-[11px] text-[#1b1c17]/60 leading-relaxed uppercase tracking-tight font-medium">$'+cr.avg_rate+'/m² · '+cr.avg_size+'m² avg · '+pct(cr.sold,cr.total)+' sold</p></div></div>'
  ).join('');

  return '<div class="fade-in">'
    // Hero
    +'<div class="mb-12"><p class="text-[10px] uppercase tracking-[0.4em] text-[#1b1c17]/40 font-bold">'+fmtN(t.total)+' lots tracked across '+(currentState||'Australia')+' · '+d.corridors.length+' corridors · '+fmtN(t.sold)+' sold · '+fmtN(t.listings)+' listed</p></div>'
    // Metrics
    +'<div class="grid grid-cols-4 border-t border-b border-[#dcdad2] py-12 mb-12">'
    +'<div class="px-8 border-r border-[#dcdad2]"><span class="font-sans text-[11px] font-semibold tracking-widest uppercase text-[#888] mb-3 block">Total Tracked</span><span class="font-sans text-6xl font-medium tracking-tighter text-[#111] block">'+fmtN(t.total)+'</span></div>'
    +'<div class="px-8 border-r border-[#dcdad2]"><span class="font-sans text-[11px] font-semibold tracking-widest uppercase text-[#888] mb-3 block">Avg Price</span><span class="font-sans text-6xl font-medium tracking-tighter text-[#111] block">'+fmtK(t.avg_price)+'</span></div>'
    +'<div class="px-8 border-r border-[#dcdad2]"><span class="font-sans text-[11px] font-semibold tracking-widest uppercase text-[#888] mb-3 block">Price Per m²</span><span class="font-sans text-6xl font-medium tracking-tighter text-[#111] block">$'+t.avg_rate+'</span></div>'
    +'<div class="px-8"><span class="font-sans text-[11px] font-semibold tracking-widest uppercase text-[#888] mb-3 block">Active Listings</span><span class="font-sans text-6xl font-medium tracking-tighter text-[#111] block">'+fmtN(t.listings)+'</span></div>'
    +'</div>'
    // Dune Chart
    +'<div class="mb-12 border border-[#dcdad2] p-12 relative overflow-hidden bg-[#f6f4eb]">'
    +'<div class="flex justify-between items-start relative z-10 mb-12"><div><h3 class="text-[11px] uppercase tracking-[0.4em] font-bold text-[#1b1c17] mb-2">Price Distribution</h3><p class="text-[10px] uppercase tracking-[0.1em] text-[#1b1c17]/50 max-w-md leading-relaxed">'+d.priceDist.length+' brackets. Peak: '+d.priceDist.reduce((a,b)=>a.count>b.count?a:b).bracket+' ('+fmtN(d.priceDist.reduce((a,b)=>a.count>b.count?a:b).count)+' lots).</p></div>'
    +'<div class="flex gap-6">'+c.slice(0,3).map(cr=>'<div class="flex items-center gap-2"><span class="w-1.5 h-1.5" style="background:'+(CLR[cr.corridor]||'#513561')+'"></span><span class="text-[9px] uppercase tracking-widest font-bold">'+cr.corridor+'</span></div>').join('')+'</div></div>'
    +'<div class="h-64 w-full relative"><div class="absolute inset-0 pointer-events-none"><svg width="100%" height="100%"><defs><pattern id="dg" patternUnits="userSpaceOnUse" width="100%" height="40"><line x1="0" y1="0" x2="100%" y2="0" stroke="#1b1c17" stroke-opacity="0.1" stroke-dasharray="2 4"/></pattern></defs><rect width="100%" height="100%" fill="url(#dg)"/></svg></div>'
    +duneChart(d.priceDist, 1000, 300)
    +'<div class="absolute bottom-0 left-0 w-full h-full flex justify-between pointer-events-none opacity-10"><div class="w-px h-full bg-[#1b1c17]"></div><div class="w-px h-full bg-[#1b1c17]"></div><div class="w-px h-full bg-[#1b1c17]"></div><div class="w-px h-full bg-[#1b1c17]"></div><div class="w-px h-full bg-[#1b1c17]"></div></div></div></div>'
    // Bottom row
    +'<div class="grid grid-cols-5 gap-12">'
    // Trend
    +'<div class="col-span-3 border border-[#dcdad2] p-12 bg-[#fcf9f1]"><div class="flex justify-between items-end mb-10"><div><h4 class="text-[10px] uppercase tracking-[0.3em] text-[#1b1c17]/50 mb-2 font-bold">Market Composition</h4><span class="text-3xl font-serif text-[#1b1c17]">Corridor Share</span></div><div class="text-right"><span class="font-sans text-5xl font-medium tracking-tight text-[#1A1A1A] block">'+fmtK(t.avg_price)+'</span><span class="text-[9px] block uppercase tracking-[0.2em] font-bold text-[#1b1c17]/40 mt-1">'+label+' Avg</span></div></div>'
    +donut(c, 180)
    +'</div>'
    // Alerts
    +'<div class="col-span-2 space-y-8"><h4 class="text-[11px] uppercase tracking-[0.4em] text-[#1b1c17] font-bold border-b border-[#1b1c17] pb-3">Market Intelligence</h4>'+alerts+'</div>'
    +'</div>'
    // Texture footer
    +'<div class="mt-16 w-full h-32 relative overflow-hidden border-t border-[#dcdad2]"><img class="w-full h-full object-cover grayscale opacity-10 mix-blend-multiply" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAgVsKgtAq8C6WZb5_ZscU3PpSk288LmRvUtfQdGyACqGWWuJHV8V48BAsVYTx9dmI7yzPUjWEAAVx3HVHJLiEJmioZ-EDZIr6aHwthFTUWe1H0M038NXNL706U6VsMq5MyqmsZoyMf-BEoLoroak9S1PzBH1LumZiZEeimMBYKE35s_z5f5KWQmEzi-ygdQHlgNaMCbK1jepXDrKEl9k7LKPu7BZSTlko7zCl2_b7zEl_cxN0IfqmPeOzMIrv7awh522WuZ6O9rlk"/><div class="absolute inset-0 bg-gradient-to-t from-[#fcf9f1] to-transparent"></div></div>'
    +'</div>';
}

function renderPricing(){
  const d = D();
  return '<div class="fade-in">'
    +'<div class="mb-12"><p class="text-[10px] uppercase tracking-[0.4em] text-[#1b1c17]/40 font-bold">Price Analysis</p></div>'
    // Price dist bars
    +'<div class="grid grid-cols-2 gap-12 mb-12">'
    +'<div class="p-10 bg-[#f6f4eb] border border-[#dcdad2]"><h3 class="text-[11px] uppercase tracking-[0.4em] font-bold text-[#1b1c17] mb-1">Price Distribution</h3><p class="text-[10px] text-[#1b1c17]/40 uppercase tracking-wider mb-8">Lot count per price bracket</p>'+vertBars(d.priceDist,'#513561')+'</div>'
    +'<div class="p-10 bg-[#f6f4eb] border border-[#dcdad2]"><h3 class="text-[11px] uppercase tracking-[0.4em] font-bold text-[#1b1c17] mb-1">Lot Size Distribution</h3><p class="text-[10px] text-[#1b1c17]/40 uppercase tracking-wider mb-8">Square metre profile</p>'+vertBars(d.sizeDist,'#486456')+'</div>'
    +'</div>'
    // Rate dist
    +'<div class="mb-12 p-10 bg-[#f6f4eb] border border-[#dcdad2]"><h3 class="text-[11px] uppercase tracking-[0.4em] font-bold text-[#1b1c17] mb-1">$/m² Rate Distribution</h3><p class="text-[10px] text-[#1b1c17]/40 uppercase tracking-wider mb-8">Price efficiency across all lots</p>'+vertBars(d.rateDist,'#61323a')+'</div>'
    // Top / Bottom
    +'<div class="grid grid-cols-2 gap-12 mb-12">'
    +'<div class="border border-[#dcdad2] p-10 bg-[#fcf9f1]"><h4 class="text-[10px] uppercase tracking-[0.3em] text-[#1b1c17]/50 mb-2 font-bold">Premium Index</h4><span class="text-2xl font-serif text-[#1b1c17] block mb-6">Highest $/m²</span>'+horizBars(d.topRate,'avg_rate',d=>'$'+d.avg_rate)+'</div>'
    +'<div class="border border-[#dcdad2] p-10 bg-[#fcf9f1]"><h4 class="text-[10px] uppercase tracking-[0.3em] text-[#1b1c17]/50 mb-2 font-bold">Value Index</h4><span class="text-2xl font-serif text-[#1b1c17] block mb-6">Lowest $/m²</span>'+horizBars(d.bottomRate,'avg_rate',d=>'$'+d.avg_rate)+'</div>'
    +'</div>'
    +'</div>';
}

function renderCorridors(){
  const d = D();
  const maxLots = Math.max(...d.corridors.map(c=>c.total));
  
  let corridorCards = d.corridors.map(c=>{
    const soldPct = Math.round(c.sold/c.total*100);
    const subs = d.suburbs.filter(s=>s.corridor===c.corridor).slice(0,8);
    return '<div class="border border-[#dcdad2] p-10 bg-[#fcf9f1] mb-8 fade-in">'
      +'<div class="flex justify-between items-start mb-6">'
      +'<div><h3 class="text-2xl font-serif text-[#1b1c17] mb-1">'+c.corridor+'</h3><p class="text-[10px] uppercase tracking-wider text-[#1b1c17]/40">'+fmtN(c.total)+' lots · '+c.lgas+' LGAs</p></div>'
      +'<div class="text-right"><span class="font-sans text-4xl font-medium tracking-tight text-[#111]">'+fmtK(c.avg_price)+'</span><span class="text-[9px] block uppercase tracking-widest text-[#888] mt-1">avg price</span></div>'
      +'</div>'
      // Bar
      +'<div class="h-6 bg-[#eae8e0] relative overflow-hidden flex mb-6"><div class="h-full" style="width:'+soldPct+'%;background:'+(CLR[c.corridor]||'#513561')+';opacity:0.8"></div><div class="h-full" style="width:'+(100-soldPct)+'%;background:'+(CLR[c.corridor]||'#513561')+';opacity:0.3"></div></div>'
      +'<div class="flex gap-8 mb-6">'
      +'<div><span class="text-[9px] uppercase tracking-widest text-[#888] block">$/m²</span><span class="text-xl font-medium">$'+c.avg_rate+'</span></div>'
      +'<div><span class="text-[9px] uppercase tracking-widest text-[#888] block">Avg Size</span><span class="text-xl font-medium">'+c.avg_size+'m²</span></div>'
      +'<div><span class="text-[9px] uppercase tracking-widest text-[#888] block">Sold</span><span class="text-xl font-medium text-[#486456]">'+fmtN(c.sold)+'</span></div>'
      +'<div><span class="text-[9px] uppercase tracking-widest text-[#888] block">Listed</span><span class="text-xl font-medium text-[#61323a]">'+fmtN(c.listings)+'</span></div>'
      +'</div>'
      // Top suburbs
      +(subs.length ? '<div class="border-t border-[#dcdad2] pt-6"><p class="text-[9px] uppercase tracking-widest text-[#888] mb-3 font-bold">Top Suburbs</p><div class="grid grid-cols-4 gap-3">'+subs.map(s=>'<div class="bg-[#f6f4eb] p-3"><span class="text-[11px] font-medium block">'+s.suburb+'</span><span class="text-[10px] text-[#513561] font-semibold">'+fmt(s.avg_price)+'</span><span class="text-[9px] text-[#1b1c17]/40 ml-2">'+fmtN(s.total)+' lots</span></div>').join('')+'</div></div>' : '')
      +'</div>';
  }).join('');

  // add lga counts to corridors
  d.corridors.forEach(c => {
    c.lgas = d.lgas.filter(l=>l.corridor===c.corridor).length || '—';
  });

  return '<div class="fade-in">'
    +'<div class="mb-12"><p class="text-[10px] uppercase tracking-[0.4em] text-[#1b1c17]/40 font-bold">Growth Corridor Index</p></div>'
    +corridorCards
    +'</div>';
}

function renderRegistry(){
  const d = D();
  let subs = d.suburbs;
  if(searchTerm) subs = subs.filter(s=>s.suburb.toLowerCase().includes(searchTerm) || (s.lga||'').toLowerCase().includes(searchTerm) || (s.corridor||'').toLowerCase().includes(searchTerm));
  if(sortCol) subs = [...subs].sort((a,b)=> sortDir==='asc' ? (a[sortCol]>b[sortCol]?1:-1) : (a[sortCol]<b[sortCol]?1:-1));

  const cols = [
    {key:'suburb',label:'Suburb',align:'left'},
    {key:'lga',label:'LGA',align:'left'},
    {key:'corridor',label:'Corridor',align:'left'},
    {key:'total',label:'Lots',align:'right'},
    {key:'sold',label:'Sold',align:'right'},
    {key:'listings',label:'Listed',align:'right'},
    {key:'avg_price',label:'Avg Price',align:'right'},
    {key:'avg_size',label:'Avg Size',align:'right'},
    {key:'avg_rate',label:'$/m²',align:'right'}
  ];

  const thead = cols.map(c=>'<th class="text-'+c.align+' text-[10px] font-bold uppercase tracking-[0.15em] text-[#888] py-3 px-3 cursor-pointer'+(sortCol===c.key?(sortDir==='asc'?' sort-asc':' sort-desc'):'')+'" onclick="sortTable(\\''+c.key+'\\')">'+c.label+'</th>').join('');

  const tbody = subs.slice(0,200).map(s=>'<tr class="dr">'
    +'<td class="py-2.5 px-3 text-[12px] font-medium">'+s.suburb+'</td>'
    +'<td class="py-2.5 px-3 text-[11px] text-[#1b1c17]/60">'+(s.lga||'-')+'</td>'
    +'<td class="py-2.5 px-3 text-[11px] text-[#1b1c17]/60">'+(s.corridor||'-')+'</td>'
    +'<td class="py-2.5 px-3 text-[12px] text-right font-medium">'+fmtN(s.total)+'</td>'
    +'<td class="py-2.5 px-3 text-[12px] text-right text-[#486456]">'+fmtN(s.sold)+'</td>'
    +'<td class="py-2.5 px-3 text-[12px] text-right text-[#61323a]">'+fmtN(s.listings)+'</td>'
    +'<td class="py-2.5 px-3 text-[12px] text-right">'+fmt(s.avg_price)+'</td>'
    +'<td class="py-2.5 px-3 text-[12px] text-right">'+s.avg_size+'m²</td>'
    +'<td class="py-2.5 px-3 text-[12px] text-right font-semibold text-[#513561]">$'+s.avg_rate+'</td>'
    +'</tr>').join('');

  // Discovery panel
  const activeKey = currentState || 'VIC';
  const active = RAW.activeSuburbs[activeKey] || [];

  return '<div class="fade-in">'
    +'<div class="mb-8"><p class="text-[10px] uppercase tracking-[0.4em] text-[#1b1c17]/40 font-bold mb-2">Parcel Ledger</p><span class="text-[11px] text-[#1b1c17]/40">Showing '+Math.min(subs.length,200)+' of '+subs.length+' suburbs'+(searchTerm?' matching "'+searchTerm+'"':'')+'</span></div>'
    // LGA summary
    +'<div class="mb-10 p-10 bg-[#f6f4eb] border border-[#dcdad2]"><h3 class="text-[11px] uppercase tracking-[0.4em] font-bold text-[#1b1c17] mb-6">LGA Summary</h3>'
    +'<div class="grid grid-cols-'+Math.min(d.lgas.length,4)+' gap-4">'
    +d.lgas.slice(0,8).map(l=>'<div class="bg-[#fcf9f1] p-4 border border-[#dcdad2]"><span class="text-[12px] font-medium block mb-1">'+l.lga+'</span><span class="text-xl font-medium text-[#111]">'+fmtN(l.total)+'</span><span class="text-[10px] text-[#1b1c17]/40 ml-2">lots</span><div class="mt-2"><span class="text-[10px] text-[#513561] font-semibold">$'+l.avg_rate+'/m²</span><span class="text-[10px] text-[#1b1c17]/40 ml-3">'+fmtK(l.avg_price)+' avg</span></div></div>').join('')
    +'</div></div>'
    // Table
    +'<div class="border border-[#dcdad2] bg-[#fcf9f1] max-h-[600px] overflow-y-auto sf">'
    +'<table class="w-full"><thead class="sticky top-0 bg-[#fcf9f1] border-b border-[#dcdad2]"><tr>'+thead+'</tr></thead><tbody>'+tbody+'</tbody></table></div>'
    // Discovery
    +(active.length ? '<div class="mt-10"><div class="flex justify-between items-end mb-4"><div><h4 class="text-[11px] uppercase tracking-[0.4em] text-[#1b1c17] font-bold">Discovery Index</h4><p class="text-[10px] text-[#1b1c17]/40 mt-1">'+active.length+' active suburbs found via Domain scan</p></div></div><div class="grid grid-cols-5 gap-2 max-h-[300px] overflow-y-auto sf">'+active.slice(0,100).map(a=>'<div class="flex justify-between py-1.5 px-3 bg-[#f6f4eb]"><span class="text-[10px] font-medium">'+a.suburb+'</span><span class="text-[10px] font-semibold text-[#513561]">'+a.listings+'</span></div>').join('')+'</div></div>' : '')
    +'</div>';
}

function sortTable(col){
  if(sortCol===col) sortDir = sortDir==='asc'?'desc':'asc';
  else { sortCol=col; sortDir='desc'; }
  render();
}

// ── Main Render ──
function render(){
  document.getElementById('updatedAt').textContent = 'Updated '+new Date().toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'});
  const pages = {overview:renderOverview, pricing:renderPricing, corridors:renderCorridors, registry:renderRegistry};
  document.getElementById('content').innerHTML = pages[currentPage]();
}

renderStatePills();
render();
</script>
</body></html>`;

fs.mkdirSync('deploy', { recursive: true });
fs.writeFileSync('deploy/index.html', html);
console.log('Built interactive: ' + (html.length / 1024).toFixed(0) + 'KB');
console.log('States:', states.join(', '));
console.log('Corridors:', allData.corridors.length);
console.log('LGAs:', allData.lgas.length);
console.log('Suburbs:', allData.suburbs.length);
console.log('Active discovery:', Object.keys(activeSuburbs).map(k => k + ':' + activeSuburbs[k].length).join(', '));
