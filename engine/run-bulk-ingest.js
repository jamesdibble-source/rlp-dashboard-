#!/usr/bin/env node
// engine/run-bulk-ingest.js
// Top-level runner for bulk REA ingestion.
// Reads suburbs.csv, applies CLI filters, runs the scraper, and saves to SQLite.

const fs = require('fs');
const path = require('path');
const { runBulkREA } = require('./scrapers/rea-bulk-runner');
const { getDb, initDb, upsertLot, insertScrapeRun } = require('./db');

// ──── Paths ────

const DATA_DIR = path.join(__dirname, 'data');
const CSV_PATH = path.join(DATA_DIR, 'suburbs.csv');
const PROGRESS_PATH = path.join(DATA_DIR, 'rea-progress.json');
const LOG_PATH = path.join(DATA_DIR, 'rea-run.log');

// ──── Parse CLI arguments ────

function parseArgs(argv) {
  const args = { state: null, corridor: null, limit: null, fresh: false };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--state':
        args.state = argv[++i];
        break;
      case '--corridor':
        args.corridor = argv[++i];
        break;
      case '--limit':
        args.limit = parseInt(argv[++i], 10);
        break;
      case '--fresh':
        args.fresh = true;
        break;
    }
  }
  return args;
}

// ──── Parse suburbs.csv ────

function loadSuburbs() {
  const raw = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = raw.trim().split(/\r?\n/);
  const header = lines[0].split(',');

  return lines.slice(1).map(line => {
    const cols = line.split(',');
    const row = {};
    header.forEach((h, idx) => { row[h.trim()] = (cols[idx] || '').trim(); });
    return {
      suburb: row.suburb,
      state: row.state,
      postcode: row.postcode,
      lga: row.lga,
      corridor: row.corridor,
    };
  }).filter(s => s.suburb && s.state && s.postcode);
}

// ──── Filter suburbs ────

function filterSuburbs(suburbs, args) {
  let filtered = suburbs;

  if (args.state) {
    const st = args.state.toUpperCase();
    filtered = filtered.filter(s => s.state.toUpperCase() === st);
  }

  if (args.corridor) {
    const cor = args.corridor.toLowerCase();
    filtered = filtered.filter(s => (s.corridor || '').toLowerCase() === cor);
  }

  if (args.limit && args.limit > 0) {
    filtered = filtered.slice(0, args.limit);
  }

  return filtered;
}

// ──── Estimate runtime ────

function estimateHours(count) {
  // Average delay ~45s per suburb (midpoint of 30–60s default range)
  const avgSecondsPerSuburb = 90; // ~45s delay + ~45s scrape
  return (count * avgSecondsPerSuburb) / 3600;
}

// ──── Save lots to database ────

function saveLots(lots) {
  const db = getDb();
  let saved = 0;
  let inserted = 0;
  let updated = 0;
  let errors = 0;

  const runInTransaction = db.transaction((lotsToSave) => {
    for (const lot of lotsToSave) {
      try {
        const result = upsertLot(db, lot);
        saved++;
        if (result.action === 'inserted') inserted++;
        else updated++;
      } catch (err) {
        errors++;
        if (errors <= 5) {
          console.error(`  DB error for ${lot.address}: ${err.message}`);
        }
      }
    }
  });

  runInTransaction(lots);
  db.close();

  return { saved, inserted, updated, errors };
}

// ──── Main ────

async function main() {
  const startTime = Date.now();
  const args = parseArgs(process.argv);

  // Load and filter suburbs
  const allSuburbs = loadSuburbs();
  const suburbs = filterSuburbs(allSuburbs, args);

  if (suburbs.length === 0) {
    console.error('No suburbs match the given filters.');
    process.exit(1);
  }

  // Handle --fresh flag
  if (args.fresh) {
    if (fs.existsSync(PROGRESS_PATH)) {
      fs.unlinkSync(PROGRESS_PATH);
      console.log('Deleted rea-progress.json (fresh start)');
    }
  }

  // Initialize database
  initDb();

  // Pre-run summary
  const estHours = estimateHours(suburbs.length);
  const filters = [];
  if (args.state) filters.push(`state=${args.state}`);
  if (args.corridor) filters.push(`corridor="${args.corridor}"`);
  if (args.limit) filters.push(`limit=${args.limit}`);

  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('  Starting bulk REA ingestion');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Suburbs to scrape: ${suburbs.length} (after filters${filters.length ? ': ' + filters.join(', ') : ''})`);
  console.log(`  Estimated time: ~${estHours.toFixed(1)} hours at normal delays`);
  console.log(`  Progress file: ${PROGRESS_PATH}`);
  console.log(`  Log file: ${LOG_PATH}`);
  console.log('═══════════════════════════════════════════════');
  console.log('');

  // Run the bulk scraper
  let lots = [];
  let scrapeError = null;
  try {
    lots = await runBulkREA(suburbs, {});
  } catch (err) {
    scrapeError = err;
    console.error(`\nFATAL scrape error: ${err.message}`);
  }

  // Save lots to database
  console.log(`\nSaving ${lots.length} lots to database...`);
  const dbResult = saveLots(lots);

  // Record the scrape run
  try {
    const db = getDb();
    insertScrapeRun(db, {
      source: 'rea-bulk',
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      lots_found: lots.length,
      lots_new: dbResult.inserted,
      lots_updated: dbResult.updated,
      status: scrapeError ? 'error' : 'completed',
      error: scrapeError ? scrapeError.message : null,
    });
    db.close();
  } catch (_) {}

  // Load final progress for summary
  let progress = null;
  try {
    if (fs.existsSync(PROGRESS_PATH)) {
      progress = JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf-8'));
    }
  } catch (_) {}

  // Completion summary
  const elapsed = Date.now() - startTime;
  const elapsedMin = (elapsed / 60000).toFixed(1);
  const elapsedHrs = (elapsed / 3600000).toFixed(2);
  const elapsedStr = elapsed > 3600000 ? `${elapsedHrs} hours` : `${elapsedMin} minutes`;

  const completedCount = progress ? progress.completedSuburbs.length : 0;
  const failedSuburbs = progress ? progress.failedSuburbs : [];

  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('  Bulk REA Ingestion Complete');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Total suburbs attempted:  ${suburbs.length}`);
  console.log(`  Suburbs completed:        ${completedCount}`);
  console.log(`  Total lots scraped:       ${lots.length}`);
  console.log(`  Lots saved to database:   ${dbResult.saved} (${dbResult.inserted} new, ${dbResult.updated} updated)`);
  if (dbResult.errors > 0) {
    console.log(`  Database errors:          ${dbResult.errors}`);
  }
  if (failedSuburbs.length > 0) {
    console.log(`  Failed suburbs:           ${failedSuburbs.length}`);
    for (const f of failedSuburbs.slice(0, 10)) {
      console.log(`    - ${f.suburb} (${f.reason})`);
    }
    if (failedSuburbs.length > 10) {
      console.log(`    ... and ${failedSuburbs.length - 10} more`);
    }
  }
  console.log(`  Total runtime:            ${elapsedStr}`);
  console.log('═══════════════════════════════════════════════');
  console.log('');

  if (scrapeError) process.exit(1);
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
