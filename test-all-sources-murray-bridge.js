#!/usr/bin/env node
// Test script: scrape Murray Bridge SA 5253 from all three sources and export to Excel.
// Run: node test-all-sources-murray-bridge.js

const path = require('path');
const ExcelJS = require('exceljs');

const SUBURB = 'Murray Bridge';
const STATE = 'SA';
const POSTCODE = '5253';
const LGA = 'Rural City of Murray Bridge';
const CORRIDOR = 'Murray Bridge';

const OUTPUT_FILE = path.join(__dirname, 'test-output-murray-bridge.xlsx');

// Bug 5: maxLandSize enforced at 2000m² per product spec
const SCRAPE_OPTIONS = {
  maxPages: 5,
  minPrice: 1,
  maxPrice: 99999999,
  minLandSize: 0,
  maxLandSize: 2000,
};

// ──── Scraper wrappers ────

async function scrapeDomain() {
  const { scrapeSuburb } = require('./engine/scrapers/domain-public');
  console.log('\n[Domain] Starting scrape...');
  const lots = await scrapeSuburb(SUBURB, STATE, POSTCODE, LGA, CORRIDOR, SCRAPE_OPTIONS);
  console.log(`[Domain] Done: ${lots.length} lots`);
  return lots.map(l => ({ ...l, _source: 'Domain' }));
}

// OpenLot removed from pipeline
// async function scrapeOpenLot() {
//   const { scrapeSuburb } = require('./engine/scrapers/openlot-public');
//   console.log('\n[OpenLot] Starting scrape (Chrome CDP)...');
//   const lots = await scrapeSuburb(SUBURB, STATE, POSTCODE, LGA, CORRIDOR, SCRAPE_OPTIONS);
//   console.log(`[OpenLot] Done: ${lots.length} lots`);
//   return lots.map(l => ({ ...l, _source: 'OpenLot' }));
// }

async function scrapeREA() {
  const { scrapeSuburb } = require('./engine/scrapers/rea-custom');
  console.log('\n[REA] Starting scrape (Chrome CDP)...');
  const lots = await scrapeSuburb(SUBURB, STATE, POSTCODE, LGA, CORRIDOR, SCRAPE_OPTIONS);
  console.log(`[REA] Done: ${lots.length} lots`);
  return lots.map(l => ({ ...l, _source: 'REA' }));
}

// ──── Helpers ────

function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function toLotRow(lot) {
  return {
    source: lot._source || lot.source || '',
    listing_type: lot.status === 'sold' ? 'sold' : (lot.status === 'under_contract' ? 'under_contract' : (lot.status === 'contact_agent' ? 'contact_agent' : 'buy')),
    address: lot.address || '',
    price: lot.price || null,
    lot_size_m2: lot.lot_size || lot.lotSize || null,
    sold_date: lot.sold_date || null,
    listing_url: lot.source_url || '',
    listing_id: lot.source_id || '',
  };
}

function computeSummary(lots, sourceName) {
  const prices = lots.map(l => l.price).filter(p => p && p > 0);
  const sizes = lots.map(l => l.lot_size || l.lotSize || 0).filter(s => s > 0);
  const buyCount = lots.filter(l => l.status !== 'sold').length;
  const soldCount = lots.filter(l => l.status === 'sold').length;
  const missingPrice = lots.filter(l => !l.price || l.price === 0).length;
  const missingSize = lots.filter(l => !l.lot_size && !l.lotSize).length;

  return {
    source: sourceName,
    count: lots.length,
    avg_price: prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0,
    median_price: Math.round(median(prices)),
    avg_lot_size: sizes.length ? Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length) : 0,
    min_price: prices.length ? Math.min(...prices) : 0,
    max_price: prices.length ? Math.max(...prices) : 0,
    buy_count: buyCount,
    sold_count: soldCount,
    missing_price_count: missingPrice,
    missing_size_count: missingSize,
  };
}

// ──── Excel builder ────

const LOT_COLUMNS = [
  { header: 'source', key: 'source', width: 12 },
  { header: 'listing_type', key: 'listing_type', width: 16 },
  { header: 'address', key: 'address', width: 40 },
  { header: 'price', key: 'price', width: 16 },
  { header: 'lot_size_m2', key: 'lot_size_m2', width: 14 },
  { header: 'sold_date', key: 'sold_date', width: 14 },
  { header: 'listing_url', key: 'listing_url', width: 55 },
  { header: 'listing_id', key: 'listing_id', width: 16 },
];

const SUMMARY_COLUMNS = [
  { header: 'source', key: 'source', width: 12 },
  { header: 'count', key: 'count', width: 10 },
  { header: 'avg_price', key: 'avg_price', width: 14 },
  { header: 'median_price', key: 'median_price', width: 14 },
  { header: 'avg_lot_size', key: 'avg_lot_size', width: 14 },
  { header: 'min_price', key: 'min_price', width: 14 },
  { header: 'max_price', key: 'max_price', width: 14 },
  { header: 'buy_count', key: 'buy_count', width: 12 },
  { header: 'sold_count', key: 'sold_count', width: 12 },
  { header: 'missing_price_count', key: 'missing_price_count', width: 20 },
  { header: 'missing_size_count', key: 'missing_size_count', width: 18 },
];

const LIGHT_YELLOW = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFCC' } };
const LIGHT_ORANGE = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFDEAD' } };
const LIGHT_BLUE = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCE5FF' } };
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };

function addLotSheet(workbook, sheetName, rows) {
  const ws = workbook.addWorksheet(sheetName);
  ws.columns = LOT_COLUMNS;

  // Style header row
  const headerRow = ws.getRow(1);
  headerRow.eachCell(cell => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle' };
  });

  // Add data
  for (const row of rows) {
    const r = ws.addRow(row);

    // Format price as currency
    const priceCell = r.getCell('price');
    if (priceCell.value != null) {
      priceCell.numFmt = '$#,##0';
    }

    // Format lot_size as integer
    const sizeCell = r.getCell('lot_size_m2');
    if (sizeCell.value != null) {
      sizeCell.numFmt = '#,##0';
    }

    // Highlight under_contract / contact_agent rows in light blue
    if (row.listing_type === 'under_contract' || row.listing_type === 'contact_agent') {
      r.eachCell({ includeEmpty: true }, cell => { cell.fill = LIGHT_BLUE; });
    }
    // Highlight missing price rows (yellow overrides blue if no price)
    else if (row.price == null || row.price === 0) {
      r.eachCell({ includeEmpty: true }, cell => { cell.fill = LIGHT_YELLOW; });
    }
    // Highlight missing lot_size rows (orange takes priority if both missing)
    if (row.lot_size_m2 == null || row.lot_size_m2 === 0) {
      r.eachCell({ includeEmpty: true }, cell => { cell.fill = LIGHT_ORANGE; });
    }
  }

  // Freeze top row
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  // Auto-fit columns (use max content length, with cap)
  ws.columns.forEach(col => {
    let maxLen = col.header.length;
    col.eachCell({ includeEmpty: false }, cell => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 4, 80);
  });

  return ws;
}

function addSummarySheet(workbook, summaryRows) {
  const ws = workbook.addWorksheet('Summary');
  ws.columns = SUMMARY_COLUMNS;

  const headerRow = ws.getRow(1);
  headerRow.eachCell(cell => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle' };
  });

  for (const row of summaryRows) {
    const r = ws.addRow(row);
    // Format currency columns
    for (const key of ['avg_price', 'median_price', 'min_price', 'max_price']) {
      const cell = r.getCell(key);
      if (cell.value != null) cell.numFmt = '$#,##0';
    }
    r.getCell('avg_lot_size').numFmt = '#,##0';
  }

  ws.views = [{ state: 'frozen', ySplit: 1 }];

  ws.columns.forEach(col => {
    let maxLen = col.header.length;
    col.eachCell({ includeEmpty: false }, cell => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 4, 40);
  });

  return ws;
}

// ──── Main ────

async function main() {
  console.log('='.repeat(60));
  console.log(`Test scrape: ${SUBURB} ${STATE} ${POSTCODE}`);
  console.log('='.repeat(60));

  const results = { Domain: [], REA: [] };
  const errors = {};

  // Run scrapers sequentially (OpenLot removed from pipeline)
  for (const [name, fn] of [['Domain', scrapeDomain], ['REA', scrapeREA]]) {
    try {
      results[name] = await fn();
    } catch (err) {
      errors[name] = err;
      console.error(`\n[${name}] ERROR: ${err.message}`);
      if (err.code) console.error(`  Code: ${err.code}`);
    }
  }

  // ── Bug 2: Cross-source deduplication ──
  // Normalize address: lowercase, strip punctuation, match on street number + street name
  function dedupeKey(addr) {
    const norm = String(addr || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    const match = norm.match(/^(\d+\S*)\s+(.+)/);
    return match ? `${match[1]} ${match[2]}` : norm;
  }

  const totalBeforeDedup = Object.values(results).reduce((s, a) => s + a.length, 0);
  const seen = new Map(); // key → source name
  let dupsRemoved = 0;

  // Process REA first so REA records are kept over Domain duplicates
  for (const src of ['REA', 'Domain']) {
    const deduped = [];
    for (const lot of results[src]) {
      const key = dedupeKey(lot.address);
      if (!key) { deduped.push(lot); continue; }
      if (seen.has(key)) {
        dupsRemoved++;
        console.log(`  Dedup: dropping ${src} "${lot.address}" (duplicate of ${seen.get(key)})`);
      } else {
        seen.set(key, src);
        deduped.push(lot);
      }
    }
    results[src] = deduped;
  }
  if (dupsRemoved > 0) {
    console.log(`\n  Cross-source dedup: removed ${dupsRemoved} duplicates (${totalBeforeDedup} → ${totalBeforeDedup - dupsRemoved})`);
  }

  // ── Bug 5: Verify no oversized lots slipped through ──
  let oversizedRemoved = 0;
  for (const src of ['Domain', 'REA']) {
    results[src] = results[src].filter(lot => {
      const size = lot.lot_size || lot.lotSize || null;
      if (size != null && size > 2000) {
        oversizedRemoved++;
        return false;
      }
      return true;
    });
  }
  if (oversizedRemoved > 0) {
    console.log(`  Post-filter: removed ${oversizedRemoved} lots over 2000m²`);
  }

  // ── Terminal summary ──
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  for (const src of ['Domain', 'REA']) {
    const count = results[src].length;
    const errMsg = errors[src] ? ` (ERROR: ${errors[src].message.slice(0, 80)})` : '';
    console.log(`  ${src.padEnd(10)} ${String(count).padStart(4)} lots${errMsg}`);
  }
  const total = Object.values(results).reduce((s, a) => s + a.length, 0);
  console.log(`  ${'TOTAL'.padEnd(10)} ${String(total).padStart(4)} lots`);
  if (Object.keys(errors).length > 0) {
    console.log(`\n  Errors: ${Object.keys(errors).join(', ')}`);
  }

  // ── Bug summary stats ──
  const allLots = Object.values(results).flat();
  const underContract = allLots.filter(l => l.status === 'under_contract' || l.status === 'contact_agent');
  const soldLots = allLots.filter(l => l.status === 'sold');
  const soldWithDate = soldLots.filter(l => l.sold_date);
  const soldDatePct = soldLots.length > 0 ? Math.round((soldWithDate.length / soldLots.length) * 100) : 0;

  console.log('\n  Bug fix verification:');
  console.log(`    Duplicates removed (Bug 2): ${dupsRemoved}`);
  console.log(`    Under-contract included (Bug 4): ${underContract.length}`);
  console.log(`    Oversized excluded (Bug 5): ${oversizedRemoved}`);
  console.log(`    Sold date coverage (Bug 1): ${soldWithDate.length}/${soldLots.length} (${soldDatePct}%)`);

  // ── Build Excel workbook ──
  console.log('\nBuilding Excel workbook...');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RLP Dashboard Scout';
  workbook.created = new Date();

  // Combined sheet — all lots sorted by price ascending
  const allRows = Object.values(results).flat().map(toLotRow)
    .sort((a, b) => (a.price || 999999999) - (b.price || 999999999));
  addLotSheet(workbook, 'Combined', allRows);

  // Per-source sheets (OpenLot removed from pipeline)
  addLotSheet(workbook, 'Domain', results.Domain.map(toLotRow));
  addLotSheet(workbook, 'REA', results.REA.map(toLotRow));

  // Summary sheet
  const summaryRows = [
    computeSummary(results.Domain, 'Domain'),
    computeSummary(results.REA, 'REA'),
    computeSummary(Object.values(results).flat(), 'TOTAL'),
  ];
  addSummarySheet(workbook, summaryRows);

  // Write file
  await workbook.xlsx.writeFile(OUTPUT_FILE);
  console.log(`\nExcel file saved: ${OUTPUT_FILE}`);
  console.log('Done.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
