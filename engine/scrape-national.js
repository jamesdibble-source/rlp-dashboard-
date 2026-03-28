#!/usr/bin/env node
// National-scale parallel scraper
// Runs N concurrent suburb scrapers, respects rate limits per domain
// Usage: node scrape-national.js [--state VIC] [--concurrency 3] [--pages 10]

const { scrapeSuburb } = require('./scrapers/domain-public');
const { getDb, initDb, upsertLot, getStats } = require('./db');
const { getAllSuburbs } = require('./config/national-suburbs');

const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf('--' + name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}

const STATE = getArg('state', null);
const CORRIDOR = getArg('corridor', null);
const CONCURRENCY = parseInt(getArg('concurrency', '3'));
const MAX_PAGES = parseInt(getArg('pages', '5'));

async function worker(id, queue, db) {
  let processed = 0, totalNew = 0, totalUpd = 0;
  
  while (queue.length > 0) {
    const target = queue.shift();
    const label = `[W${id}] ${target.suburb}, ${target.state} (${target.corridor})`;
    console.log(`${label} — starting`);
    
    try {
      const lots = await scrapeSuburb(
        target.suburb, target.state, target.postcode, target.lga, target.corridor
      );
      
      let newC = 0, updC = 0;
      const tx = db.transaction(() => {
        for (const lot of lots) {
          const r = upsertLot(db, lot);
          if (r.action === 'inserted') newC++;
          else updC++;
        }
      });
      tx();
      
      totalNew += newC;
      totalUpd += updC;
      processed++;
      console.log(`${label} — ${lots.length} scraped, +${newC} new, ${updC} updated (queue: ${queue.length})`);
      
    } catch (e) {
      console.error(`${label} — ERROR: ${e.message}`);
    }
  }
  
  return { processed, totalNew, totalUpd };
}

async function main() {
  const targets = getAllSuburbs(STATE, CORRIDOR);
  
  console.log('=== Grange Land Intelligence — National Scraper ===');
  console.log(`Targets: ${targets.length} suburbs`);
  console.log(`Concurrency: ${CONCURRENCY} workers`);
  console.log(`Max pages per suburb: ${MAX_PAGES}`);
  console.log(`State filter: ${STATE || 'ALL'}`);
  console.log(`Started: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}\n`);
  
  initDb();
  const db = getDb();
  
  // Record run
  db.prepare('INSERT INTO scrape_runs (source, started_at, status) VALUES (?, ?, ?)')
    .run('national-domain', new Date().toISOString(), 'running');
  
  // Create shared queue
  const queue = [...targets];
  
  // Launch workers
  const workers = [];
  for (let i = 0; i < Math.min(CONCURRENCY, targets.length); i++) {
    workers.push(worker(i + 1, queue, db));
  }
  
  const results = await Promise.all(workers);
  
  const totalNew = results.reduce((s, r) => s + r.totalNew, 0);
  const totalUpd = results.reduce((s, r) => s + r.totalUpd, 0);
  const totalProcessed = results.reduce((s, r) => s + r.processed, 0);
  
  const stats = getStats(db);
  db.close();
  
  console.log('\n=== Scrape Complete ===');
  console.log(`Suburbs processed: ${totalProcessed}`);
  console.log(`New lots: ${totalNew}`);
  console.log(`Updated: ${totalUpd}`);
  console.log(`\nDatabase totals:`);
  console.log(`  Total lots: ${stats.total}`);
  console.log(`  Sold: ${stats.sold}`);
  console.log(`  Listings: ${stats.listings}`);
  console.log(`  States: ${stats.states.join(', ')}`);
  console.log(`  LGAs: ${stats.lgas}`);
  console.log(`  Suburbs: ${stats.suburbs}`);
  console.log(`\nFinished: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}`);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
