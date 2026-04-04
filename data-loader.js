const ExcelJS = require('/root/.openclaw/workspace/node_modules/exceljs');
const fs = require('fs');
const path = require('path');

const MIN_SIZE = 150, MAX_SIZE = 2000;

function parsePrice(v) {
  if (v == null || v === '') return null;
  let s = String(v).replace(/[^0-9.]/g, '');
  let n = parseFloat(s);
  return n > 0 ? n : null;
}

function parseSize(v) {
  if (v == null || v === '') return null;
  let s = String(v).replace(/[^0-9.]/g, '');
  let n = parseFloat(s);
  return n > 0 ? n : null;
}

function parseDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().split('T')[0];
  let s = String(v);
  // Try various date formats
  let m = s.match(/(\w{3}) (\w{3}) (\d{1,2}) (\d{4})/);
  if (m) {
    let d = new Date(`${m[2]} ${m[3]}, ${m[4]}`);
    if (!isNaN(d)) return d.toISOString().split('T')[0];
  }
  m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  // Try JS Date parse
  let d = new Date(s);
  if (!isNaN(d) && d.getFullYear() > 2000) return d.toISOString().split('T')[0];
  return null;
}

function detectColumns(headerRow) {
  const map = {};
  if (!headerRow) return map;
  headerRow.forEach((cell, idx) => {
    let v = String(cell || '').toLowerCase().trim();
    if (v.includes('address') || v === 'name' || v.includes('crux-typo-link')) map.address = idx;
    if (v.includes('suburb') || v === 'locality') map.suburb = idx;
    if (v.includes('lot size') || v === 'lot_size_value' || v.includes('property-attribute-val (4)') || v.includes('css-lvv8is')) {
      if (!map.lotSize) map.lotSize = idx;
    }
    if (v.includes('lot_size_value')) map.lotSize = idx;
    if (v.includes('list price') || v === 'rlp list price' || v === 'price' || v === 'asking price') {
      if (!map.listPrice) map.listPrice = idx;
    }
    if (v.includes('sold price') || v === 'rlp sold price' || v === 'sale-price') {
      if (!map.soldPrice) map.soldPrice = idx;
    }
    if (v === 'price' && !map.listPrice) map.listPrice = idx;
    if (v.includes('last update') || v === 'date' || v.includes('sold_date') || v.includes('col-xs-8 (5)')) {
      if (!map.date) map.date = idx;
    }
    if (v.includes('listing link') || v === 'url' || v.includes('listing_id') || v.includes('css-gg0tkj href')) {
      if (!map.url) map.url = idx;
    }
    if (v.includes('rlp status') || v === 'channel') map.status = idx;
    if (v.includes('growth area') || v === 'lga') map.growthArea = idx;
    if (v.includes('listing_id') || v.includes('listing id') || v === 'unique id') map.listingId = idx;
    if (v.includes('rebates') || v === 'rebates') map.rebates = idx;
  });
  return map;
}

async function loadExcel(filePath, market) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const lots = [];
  
  wb.eachSheet((ws) => {
    const sheetName = ws.name.toLowerCase();
    // Skip RP Data House sheets (houses not land), Openlot Buy (empty)
    if (sheetName.includes('rp data house') || sheetName.includes('openlot')) return;
    
    let headerRow = null;
    let colMap = {};
    let headerRowNum = 0;
    
    ws.eachRow((row, rowNum) => {
      const vals = row.values.slice(1).map(v => v !== null && v !== undefined ? v : '');
      
      // Detect header row
      if (!headerRow) {
        const joined = vals.map(v => String(v).toLowerCase()).join('|');
        if (joined.includes('address') || joined.includes('suburb') || joined.includes('lot size') || 
            joined.includes('listing_id') || joined.includes('crux-typo-link') || joined.includes('css-gg0tkj')) {
          headerRow = vals;
          colMap = detectColumns(vals);
          headerRowNum = rowNum;
          return;
        }
        return;
      }
      
      if (rowNum <= headerRowNum) return;
      
      // Extract values
      let address = colMap.address != null ? String(vals[colMap.address] || '') : '';
      let suburb = colMap.suburb != null ? String(vals[colMap.suburb] || '') : '';
      let lotSize = colMap.lotSize != null ? parseSize(vals[colMap.lotSize]) : null;
      let listPrice = colMap.listPrice != null ? parsePrice(vals[colMap.listPrice]) : null;
      let soldPrice = colMap.soldPrice != null ? parsePrice(vals[colMap.soldPrice]) : null;
      let date = colMap.date != null ? parseDate(vals[colMap.date]) : null;
      let url = colMap.url != null ? String(vals[colMap.url] || '') : '';
      let status = colMap.status != null ? String(vals[colMap.status] || '') : '';
      let listingId = colMap.listingId != null ? String(vals[colMap.listingId] || '') : '';
      
      // Handle css-lvv8is (Domain size column) - "502m²" format
      if (lotSize && String(vals[colMap.lotSize] || '').includes('m')) {
        lotSize = parseSize(vals[colMap.lotSize]);
      }
      
      // Handle REA sold sheet price format
      if (sheetName.includes('rea sold') || sheetName.includes('rea buy')) {
        if (!listPrice && colMap.listPrice != null) {
          let raw = String(vals[colMap.listPrice] || '');
          listPrice = parsePrice(raw.replace(/[^0-9]/g, ''));
        }
      }
      
      // Handle Domain sold price format "SOLD BY PRIVATE TREATY..." + "$xxx,xxx"
      if (sheetName.includes('domain sold')) {
        // css-mgq8yx has the price
        for (let i = 0; i < vals.length; i++) {
          let v = String(vals[i] || '');
          if (v.startsWith('$') && !soldPrice) {
            soldPrice = parsePrice(v);
          }
          if (v.includes('SOLD') && !date) {
            let dm = v.match(/(\d{1,2}) (\w{3}) (\d{4})/);
            if (dm) date = parseDate(`${dm[1]} ${dm[2]} ${dm[3]}`);
          }
        }
        status = 'Sold';
      }
      
      // RP Data Land - special parsing
      if (sheetName.includes('rp data land')) {
        // property-attribute-val (4) is lot size
        for (let i = 0; i < vals.length; i++) {
          let v = String(vals[i] || '');
          if (v.startsWith('$') && v.length > 2 && !soldPrice) {
            soldPrice = parsePrice(v);
          }
        }
        // Address from crux-typo-link
        if (colMap.address != null) {
          address = String(vals[colMap.address] || '').replace(/ VIC \d+$/, '').trim();
        }
        status = 'Sold';
      }
      
      // Determine status
      if (!status) {
        if (soldPrice) status = 'Sold';
        else if (listPrice) status = 'Listing';
      }
      let statusNorm = String(status).toLowerCase();
      if (statusNorm.includes('sold') || statusNorm === 'sold') status = 'Sold';
      else if (statusNorm.includes('list') || statusNorm === 'buy' || statusNorm === 'listing') status = 'Listing';
      else if (soldPrice && !listPrice) status = 'Sold';
      else status = 'Listing';
      
      let price = soldPrice || listPrice;
      if (!price || !lotSize) return;
      if (lotSize < MIN_SIZE || lotSize > MAX_SIZE) return;
      
      // Clean suburb
      suburb = suburb.replace(/[^a-zA-Z\s]/g, '').trim();
      if (suburb.length < 2) return;
      
      // Clean address
      address = address.replace(/https?:\/\/.+/, '').trim();
      if (address.length > 200) address = address.substring(0, 200);
      
      let pricePerSqm = Math.round((price / lotSize) * 100) / 100;
      
      lots.push({
        address: address || 'Unknown',
        suburb,
        market,
        lotSize: Math.round(lotSize),
        listPrice: listPrice ? Math.round(listPrice) : null,
        soldPrice: soldPrice ? Math.round(soldPrice) : null,
        price: Math.round(price),
        status,
        date,
        pricePerSqm,
        source: sheetName.includes('domain') ? 'Domain' : sheetName.includes('rp data') ? 'CoreLogic' : 'REA',
        listingId: listingId.replace(/[^\w-]/g, '').substring(0, 20),
        url: (url && url.startsWith('http')) ? url.substring(0, 200) : ''
      });
    });
  });
  
  return lots;
}

function calcOutliers(lots) {
  // Group by market
  const byMarket = {};
  lots.forEach(l => {
    if (!byMarket[l.market]) byMarket[l.market] = [];
    byMarket[l.market].push(l);
  });
  
  for (const [market, mLots] of Object.entries(byMarket)) {
    const psm = mLots.map(l => l.pricePerSqm).sort((a, b) => a - b);
    const q1 = psm[Math.floor(psm.length * 0.25)];
    const q3 = psm[Math.floor(psm.length * 0.75)];
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    
    mLots.forEach(l => {
      l.isOutlier = l.pricePerSqm < lower || l.pricePerSqm > upper;
      l.outlierBounds = { q1, q3, iqr, lower, upper };
    });
  }
  return lots;
}

function dedup(lots) {
  const seen = new Set();
  return lots.filter(l => {
    const key = `${l.address}|${l.suburb}|${l.lotSize}|${l.price}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function main() {
  const files = [
    { path: path.join(__dirname, '../rlp-training/Scraped-Ballarat-11Jan24.xlsx'), market: 'Ballarat' },
    { path: path.join(__dirname, '../rlp-training/Scraped-Wangaratta-4Dec24.xlsx'), market: 'Wangaratta' },
    { path: path.join(__dirname, '../rlp-training/Scraped-MurrayBridge-28Jan25.xlsx'), market: 'Murray Bridge' },
  ];
  
  let allLots = [];
  
  for (const f of files) {
    if (!fs.existsSync(f.path)) {
      console.log(`Skipping ${f.path} — not found`);
      continue;
    }
    console.log(`Loading ${f.market}...`);
    const lots = await loadExcel(f.path, f.market);
    console.log(`  → ${lots.length} lots parsed`);
    allLots.push(...lots);
  }
  
  // Dedup
  const before = allLots.length;
  allLots = dedup(allLots);
  console.log(`\nDedup: ${before} → ${allLots.length}`);
  
  // Calc outliers
  allLots = calcOutliers(allLots);
  
  // Stats
  const markets = [...new Set(allLots.map(l => l.market))];
  console.log(`\nMarkets: ${markets.join(', ')}`);
  for (const m of markets) {
    const ml = allLots.filter(l => l.market === m);
    const outliers = ml.filter(l => l.isOutlier).length;
    const prices = ml.map(l => l.price).sort((a, b) => a - b);
    const median = prices[Math.floor(prices.length / 2)];
    console.log(`  ${m}: ${ml.length} lots, median $${median?.toLocaleString()}, ${outliers} outliers`);
  }
  
  // Save
  const outPath = path.join(__dirname, 'data', 'lots.json');
  fs.writeFileSync(outPath, JSON.stringify(allLots, null, 0));
  console.log(`\nSaved ${allLots.length} lots to ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB)`);
}

main().catch(console.error);
