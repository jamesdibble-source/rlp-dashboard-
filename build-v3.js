#!/usr/bin/env node
// Build v3 — Full feature dashboard with time-series and status filtering
const fs = require('fs');
const { getDb } = require('./engine/db');
const db = getDb();

function q(sql) { return db.prepare(sql).all(); }
function q1(sql) { return db.prepare(sql).get(); }

const states = q("SELECT DISTINCT state FROM lots WHERE price > 0").map(r => r.state);

function getData(stateFilter) {
  const w = stateFilter ? `AND state='${stateFilter}'` : '';
  const totals = q1(`SELECT COUNT(*) as total, COUNT(CASE WHEN status='sold' THEN 1 END) as sold, COUNT(CASE WHEN status='listing' OR status='likely_sold' THEN 1 END) as listings, ROUND(AVG(price)) as avg_price, ROUND(AVG(lot_size)) as avg_size, ROUND(AVG(price_per_sqm),2) as avg_rate FROM lots WHERE price>0 AND price<5000000 AND is_outlier=0 ${w}`);
  
  const prices = q(`SELECT price FROM lots WHERE price>0 AND price<5000000 AND is_outlier=0 ${w} ORDER BY price`).map(r=>r.price);
  const sizes = q(`SELECT lot_size FROM lots WHERE lot_size>0 AND lot_size<5000 AND is_outlier=0 ${w} ORDER BY lot_size`).map(r=>r.lot_size);
  const rates = q(`SELECT price_per_sqm FROM lots WHERE price_per_sqm>0 AND price_per_sqm<5000 AND is_outlier=0 ${w} ORDER BY price_per_sqm`).map(r=>r.price_per_sqm);
  
  totals.med_price = prices.length ? prices[Math.floor(prices.length/2)] : 0;
  totals.med_size = sizes.length ? sizes[Math.floor(sizes.length/2)] : 0;
  totals.med_rate = rates.length ? Math.round(rates[Math.floor(rates.length/2)]) : 0;
  totals.months_stock = totals.sold > 0 ? (totals.listings / (totals.sold / 12)).toFixed(1) : '—';

  const corridors = q(`SELECT corridor, COUNT(*) as total, ROUND(AVG(price)) as avg_price, ROUND(AVG(lot_size)) as avg_size, ROUND(AVG(price_per_sqm),2) as avg_rate, COUNT(CASE WHEN status='sold' THEN 1 END) as sold, COUNT(CASE WHEN status='listing' OR status='likely_sold' THEN 1 END) as listings FROM lots WHERE price>0 AND price<5000000 AND corridor IS NOT NULL AND is_outlier=0 ${w} GROUP BY corridor ORDER BY total DESC`);
  const lgas = q(`SELECT lga, corridor, COUNT(*) as total, COUNT(CASE WHEN status='sold' THEN 1 END) as sold, COUNT(CASE WHEN status='listing' OR status='likely_sold' THEN 1 END) as listings, ROUND(AVG(price)) as avg_price, ROUND(AVG(lot_size)) as avg_size, ROUND(AVG(price_per_sqm),2) as avg_rate FROM lots WHERE price>0 AND price<5000000 AND lga!='' AND is_outlier=0 ${w} GROUP BY lga ORDER BY total DESC`);
  const suburbs = q(`SELECT suburb, lga, corridor, state, COUNT(*) as total, COUNT(CASE WHEN status='sold' THEN 1 END) as sold, COUNT(CASE WHEN status='listing' OR status='likely_sold' THEN 1 END) as listings, ROUND(AVG(price)) as avg_price, ROUND(AVG(lot_size)) as avg_size, ROUND(AVG(price_per_sqm),2) as avg_rate FROM lots WHERE price>0 AND price<5000000 AND is_outlier=0 ${w} GROUP BY suburb ORDER BY total DESC`);
  
  const priceDist = q(`SELECT CASE WHEN price<150000 THEN '<150k' WHEN price<200000 THEN '150-200k' WHEN price<250000 THEN '200-250k' WHEN price<300000 THEN '250-300k' WHEN price<350000 THEN '300-350k' WHEN price<400000 THEN '350-400k' WHEN price<450000 THEN '400-450k' WHEN price<500000 THEN '450-500k' WHEN price<600000 THEN '500-600k' ELSE '600k+' END as bracket, COUNT(*) as count FROM lots WHERE price>0 AND price<5000000 AND is_outlier=0 ${w} GROUP BY bracket ORDER BY MIN(price)`);
  const sizeDist = q(`SELECT CASE WHEN lot_size<200 THEN '<200' WHEN lot_size<250 THEN '200-250' WHEN lot_size<300 THEN '250-300' WHEN lot_size<350 THEN '300-350' WHEN lot_size<400 THEN '350-400' WHEN lot_size<450 THEN '400-450' WHEN lot_size<500 THEN '450-500' WHEN lot_size<550 THEN '500-550' WHEN lot_size<600 THEN '550-600' WHEN lot_size<700 THEN '600-700' WHEN lot_size<800 THEN '700-800' ELSE '800+' END as bracket, COUNT(*) as count FROM lots WHERE lot_size>0 AND lot_size<5000 AND is_outlier=0 ${w} GROUP BY bracket ORDER BY MIN(lot_size)`);
  const rateDist = q(`SELECT CASE WHEN price_per_sqm<200 THEN '<200' WHEN price_per_sqm<400 THEN '200-400' WHEN price_per_sqm<600 THEN '400-600' WHEN price_per_sqm<800 THEN '600-800' WHEN price_per_sqm<1000 THEN '800-1k' WHEN price_per_sqm<1200 THEN '1-1.2k' ELSE '1.2k+' END as bracket, COUNT(*) as count FROM lots WHERE price_per_sqm>0 AND price_per_sqm<5000 AND is_outlier=0 ${w} GROUP BY bracket ORDER BY MIN(price_per_sqm)`);
  const topRate = q(`SELECT suburb, corridor, ROUND(AVG(price_per_sqm),2) as avg_rate, ROUND(AVG(price)) as avg_price, COUNT(*) as count FROM lots WHERE price_per_sqm>0 AND price_per_sqm<5000 AND is_outlier=0 ${w} GROUP BY suburb HAVING count>=3 ORDER BY avg_rate DESC LIMIT 15`);
  const bottomRate = q(`SELECT suburb, corridor, ROUND(AVG(price_per_sqm),2) as avg_rate, ROUND(AVG(price)) as avg_price, COUNT(*) as count FROM lots WHERE price_per_sqm>0 AND price_per_sqm<5000 AND is_outlier=0 ${w} GROUP BY suburb HAVING count>=3 ORDER BY avg_rate ASC LIMIT 15`);

  return { totals, corridors, lgas, suburbs, priceDist, sizeDist, rateDist, topRate, bottomRate };
}

// ──── TIME SERIES DATA ────
// Quarter helper: "2024-Q1" format
function toQ(dateStr) {
  if (!dateStr) return null;
  const d = dateStr.slice(0, 10); // YYYY-MM-DD
  const y = parseInt(d.slice(0, 4));
  const m = parseInt(d.slice(5, 7));
  if (isNaN(y) || isNaN(m) || y < 2020 || y > 2030) return null;
  const qtr = Math.ceil(m / 3);
  return `${y}-Q${qtr}`;
}

// Month helper: "2024-03" format
function toM(dateStr) {
  if (!dateStr) return null;
  const d = dateStr.slice(0, 10);
  const y = parseInt(d.slice(0, 4));
  const m = parseInt(d.slice(5, 7));
  if (isNaN(y) || isNaN(m) || y < 2020 || y > 2030) return null;
  return `${y}-${String(m).padStart(2, '0')}`;
}

function getTimeSeries(stateFilter) {
  const w = stateFilter ? `AND state='${stateFilter}'` : '';
  
  // Sold lots with dates — quarterly aggregates
  const soldQ = q(`SELECT sold_date, price, lot_size, price_per_sqm, corridor, suburb 
    FROM lots WHERE status='sold' AND sold_date IS NOT NULL AND price>0 AND price<5000000 
    AND lot_size>0 AND lot_size<5000 AND is_outlier=0 ${w}
    ORDER BY sold_date`);
  
  // Listed lots with dates
  const listedQ = q(`SELECT list_date, price, lot_size, price_per_sqm, corridor, suburb 
    FROM lots WHERE list_date IS NOT NULL AND price>0 AND price<5000000 
    AND lot_size>0 AND lot_size<5000 AND is_outlier=0 ${w}
    ORDER BY list_date`);
  
  // Build quarterly sold aggregates
  const soldByQ = {};
  for (const r of soldQ) {
    const qtr = toQ(r.sold_date);
    if (!qtr) continue;
    if (!soldByQ[qtr]) soldByQ[qtr] = { prices: [], sizes: [], rates: [], corridors: {}, count: 0 };
    soldByQ[qtr].prices.push(r.price);
    soldByQ[qtr].sizes.push(r.lot_size);
    if (r.price_per_sqm > 0) soldByQ[qtr].rates.push(r.price_per_sqm);
    soldByQ[qtr].count++;
    const cor = r.corridor || 'Other';
    soldByQ[qtr].corridors[cor] = (soldByQ[qtr].corridors[cor] || 0) + 1;
  }
  
  // Build monthly sold aggregates (for finer granularity)
  const soldByM = {};
  for (const r of soldQ) {
    const mo = toM(r.sold_date);
    if (!mo) continue;
    if (!soldByM[mo]) soldByM[mo] = { prices: [], sizes: [], rates: [], count: 0 };
    soldByM[mo].prices.push(r.price);
    soldByM[mo].sizes.push(r.lot_size);
    if (r.price_per_sqm > 0) soldByM[mo].rates.push(r.price_per_sqm);
    soldByM[mo].count++;
  }
  
  // Build quarterly listed aggregates
  const listedByQ = {};
  for (const r of listedQ) {
    const qtr = toQ(r.list_date);
    if (!qtr) continue;
    if (!listedByQ[qtr]) listedByQ[qtr] = { prices: [], sizes: [], rates: [], count: 0 };
    listedByQ[qtr].prices.push(r.price);
    listedByQ[qtr].sizes.push(r.lot_size);
    if (r.price_per_sqm > 0) listedByQ[qtr].rates.push(r.price_per_sqm);
    listedByQ[qtr].count++;
  }
  
  // Compute medians helper
  function median(arr) {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  }
  
  // Get all quarters, sorted
  const allQtrs = [...new Set([...Object.keys(soldByQ), ...Object.keys(listedByQ)])].sort();
  // Filter to last 3 years max
  const recentQtrs = allQtrs.filter(q => q >= '2023-Q1');
  
  // Build final time series arrays
  const ts = {
    quarters: recentQtrs,
    sold: recentQtrs.map(q => {
      const d = soldByQ[q];
      if (!d) return { q, count: 0, medPrice: 0, medSize: 0, medRate: 0, corridors: {} };
      return { q, count: d.count, medPrice: Math.round(median(d.prices)), medSize: Math.round(median(d.sizes)), medRate: Math.round(median(d.rates)), corridors: d.corridors };
    }),
    listed: recentQtrs.map(q => {
      const d = listedByQ[q];
      if (!d) return { q, count: 0, medPrice: 0, medSize: 0, medRate: 0 };
      return { q, count: d.count, medPrice: Math.round(median(d.prices)), medSize: Math.round(median(d.sizes)), medRate: Math.round(median(d.rates)) };
    })
  };
  
  // Monthly data (last 12 months)
  const allMonths = [...new Set(Object.keys(soldByM))].sort();
  const recentMonths = allMonths.slice(-12);
  ts.months = recentMonths;
  ts.soldMonthly = recentMonths.map(m => {
    const d = soldByM[m];
    if (!d) return { m, count: 0, medPrice: 0, medSize: 0, medRate: 0 };
    return { m, count: d.count, medPrice: Math.round(median(d.prices)), medSize: Math.round(median(d.sizes)), medRate: Math.round(median(d.rates)) };
  });
  
  // Corridor time series (top 5 corridors by volume)
  const topCorridors = q(`SELECT corridor, COUNT(*) as c FROM lots WHERE status='sold' AND sold_date IS NOT NULL AND corridor IS NOT NULL AND is_outlier=0 ${w} GROUP BY corridor ORDER BY c DESC LIMIT 5`).map(r => r.corridor);
  
  ts.corridorSeries = {};
  for (const cor of topCorridors) {
    const corLots = soldQ.filter(r => r.corridor === cor);
    const byQ = {};
    for (const r of corLots) {
      const qtr = toQ(r.sold_date);
      if (!qtr || qtr < '2023-Q1') continue;
      if (!byQ[qtr]) byQ[qtr] = { prices: [], rates: [] };
      byQ[qtr].prices.push(r.price);
      if (r.price_per_sqm > 0) byQ[qtr].rates.push(r.price_per_sqm);
    }
    ts.corridorSeries[cor] = recentQtrs.map(q => ({
      q, medPrice: byQ[q] ? Math.round(median(byQ[q].prices)) : 0,
      medRate: byQ[q] ? Math.round(median(byQ[q].rates)) : 0,
      count: byQ[q] ? byQ[q].prices.length : 0
    }));
  }
  
  // Suburb time series for top 20 suburbs by volume
  const topSuburbs = q(`SELECT suburb, COUNT(*) as c FROM lots WHERE status='sold' AND sold_date IS NOT NULL AND is_outlier=0 ${w} GROUP BY suburb ORDER BY c DESC LIMIT 20`).map(r => r.suburb);
  ts.suburbSeries = {};
  for (const sub of topSuburbs) {
    const subLots = soldQ.filter(r => r.suburb === sub);
    const byQ = {};
    for (const r of subLots) {
      const qtr = toQ(r.sold_date);
      if (!qtr || qtr < '2023-Q1') continue;
      if (!byQ[qtr]) byQ[qtr] = { prices: [], sizes: [] };
      byQ[qtr].prices.push(r.price);
      byQ[qtr].sizes.push(r.lot_size);
    }
    ts.suburbSeries[sub] = recentQtrs.map(q => ({
      q, medPrice: byQ[q] ? Math.round(median(byQ[q].prices)) : 0,
      medSize: byQ[q] ? Math.round(median(byQ[q].sizes)) : 0,
      count: byQ[q] ? byQ[q].prices.length : 0
    }));
  }
  
  return ts;
}

// Build all data
const allData = getData(null);
const stateData = {};
for (const s of states) stateData[s] = getData(s);

// Build time series
const allTS = getTimeSeries(null);
const stateTS = {};
for (const s of states) stateTS[s] = getTimeSeries(s);

db.close();

// Active suburbs
const activeSuburbs = {};
for (const s of ['vic','nsw','qld','wa','sa','tas','nt','act']) {
  try { activeSuburbs[s.toUpperCase()] = JSON.parse(fs.readFileSync(`engine/data/active-suburbs-${s}.json`,'utf8')); } catch(e) {}
}

// Individual lots for scatter plot + registry (with dates and status)
const db2 = getDb();
const allLots = db2.prepare(`SELECT rowid as id, suburb, corridor, state, price, lot_size, price_per_sqm as rate, status, address, source_url, list_date as ld, sold_date as sd, first_seen as fs FROM lots WHERE price>0 AND price<5000000 AND lot_size>0 AND lot_size<5000 AND price_per_sqm>0 AND price_per_sqm<5000 AND is_outlier=0 ORDER BY suburb`).all();
db2.close();
console.log('  Lots for scatter:', allLots.length);

const DATA = JSON.stringify({ 
  all: allData, states: stateData, 
  ts: allTS, stateTS,
  activeSuburbs, stateList: states, lots: allLots,
  built: new Date().toISOString()
});

console.log('Data prepared:');
console.log('  States:', states.join(', '));
console.log('  Corridors:', allData.corridors.length);
console.log('  Suburbs:', allData.suburbs.length);
console.log('  Median price:', allData.totals.med_price);
console.log('  Median $/m²:', allData.totals.med_rate);
console.log('  Time series quarters:', allTS.quarters.join(', '));
console.log('  Sold with dates:', allTS.sold.reduce((s, q) => s + q.count, 0));
console.log('  Corridor series:', Object.keys(allTS.corridorSeries).join(', '));
console.log('  Active discovery:', Object.keys(activeSuburbs).map(k => k + ':' + activeSuburbs[k].length).join(', '));

// Build HTML
const html = fs.readFileSync('dashboard-template-v4.html', 'utf8').replace('__DATA_INJECT__', DATA);
fs.mkdirSync('deploy', { recursive: true });
fs.writeFileSync('deploy/index.html', html);
console.log('Built:', (html.length / 1024).toFixed(0) + 'KB');
