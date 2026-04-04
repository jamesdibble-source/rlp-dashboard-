#!/usr/bin/env node
// Scrapes all discovered active suburbs for a given state
// Usage: node engine/scrape-discovered.js VIC [startIndex]
// Saves progress every 20 suburbs for resume

const path = require('path');
const fs = require('fs');
const { getDb, upsertLot } = require(path.join(__dirname, 'db'));
const { scrapeSuburb } = require(path.join(__dirname, 'scrapers', 'domain-public'));

const STATE = (process.argv[2] || 'VIC').toUpperCase();
const START = parseInt(process.argv[3]) || 0;
const DELAY = 900; // ms between suburbs (each suburb = 1 page request)
const sleep = ms => new Promise(r => setTimeout(r, ms));

const progressFile = path.join(__dirname, 'data', `scrape-progress-${STATE.toLowerCase()}.json`);
const activeFile = path.join(__dirname, 'data', `active-suburbs-${STATE.toLowerCase()}.json`);

if (!fs.existsSync(activeFile)) {
  console.error(`No active suburbs file for ${STATE}: ${activeFile}`);
  process.exit(1);
}

const suburbs = JSON.parse(fs.readFileSync(activeFile, 'utf8'));
console.log(`${STATE}: ${suburbs.length} active suburbs to scrape, starting from ${START}`);

// Load or init progress
let progress = { lastIndex: START, lotsAdded: 0, errors: 0, startedAt: new Date().toISOString() };
if (START === 0 && fs.existsSync(progressFile)) {
  try {
    progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
    console.log(`Resuming from index ${progress.lastIndex} (${progress.lotsAdded} lots added so far)`);
  } catch(e) {}
}

const startIdx = progress.lastIndex;

// Corridor mapping by LGA/suburb patterns
function inferCorridor(suburb, lga, state) {
  if (state !== 'VIC') return lga || 'Unknown';
  const s = (suburb || '').toLowerCase();
  const l = (lga || '').toLowerCase();
  // Melbourne metro corridors
  if (/melton|caroline springs|rockbank|plumpton|cobblebank|aintree|bonnie brook|thornhill park|deanside|grangefields|strathtulloh|weir views|harkness|kurunjang|brookfield|eynesbury|toolern|exford/.test(s)) return 'Western';
  if (/tarneit|truganina|werribee|wyndham|manor lakes|williams landing|point cook|hoppers crossing|laverton/.test(s)) return 'Western';
  if (/mickleham|wollert|donnybrook|kalkallo|merrifield|cloverton|lockerbie|beveridge|wallan|upper kallista/.test(s)) return 'Northern';
  if (/craigieburn|roxburgh park|greenvale|attwood|coolaroo|dallas|meadow heights/.test(s)) return 'Northern';
  if (/sunbury|diggers rest|gisborne|macedon|riddells creek|romsey|lancefield|woodend/.test(s)) return 'Sunbury-Macedon';
  if (/pakenham|officer|clyde|berwick|cranbourne|narre warren|hampton park|hallam|lynbrook|lyndhurst|botanic ridge/.test(s)) return 'South Eastern';
  if (/cardinia|casey/.test(l)) return 'South Eastern';
  if (/armstrong creek|charlemont|mount duneed|waurn ponds|lara|leopold|ocean grove|torquay|highton|grovedale|clifton springs|drysdale/.test(s)) return 'Geelong';
  if (/greater geelong|surf coast/.test(l)) return 'Geelong';
  if (/ballarat|smythes creek|alfredton|delacombe|bonshaw|lucas|winter valley|mount helen|buninyong|sebastopol|wendouree/.test(s)) return 'Ballarat';
  if (/bendigo|strathfieldsaye|huntly|kangaroo flat|eaglehawk|epsom|golden square|maiden gully/.test(s)) return 'Bendigo';
  if (/wangaratta|benalla|wodonga|albury/.test(s)) return 'North East';
  if (/shepparton|mooroopna|kialla/.test(s)) return 'Shepparton';
  if (/warrnambool|hamilton|portland/.test(s)) return 'Western District';
  if (/drouin|warragul|moe|morwell|traralgon|sale/.test(s)) return 'Gippsland';
  if (/melton|wyndham/.test(l)) return 'Western';
  if (/hume|whittlesea|mitchell/.test(l)) return 'Northern';
  return lga || 'Other VIC';
}

async function run() {
  // Run migration first (idempotent, safe)
  try { require(path.join(__dirname, 'migrate')).migrate(); } catch(e) {}
  
  const db = getDb();
  let added = progress.lotsAdded;
  let updated = 0;
  let priceChanges = 0;
  let errors = progress.errors;
  let consecutive429 = 0;

  for (let i = startIdx; i < suburbs.length; i++) {
    const sub = suburbs[i];
    try {
      const corridor = inferCorridor(sub.suburb, '', STATE);
      
      let lots;
      try {
        lots = await scrapeSuburb(sub.suburb, STATE, sub.postcode, '', corridor);
      } catch(e) {
        // Handle rate limiting gracefully
        if (e.message && (e.message.includes('429') || e.message.includes('rate'))) {
          consecutive429++;
          const backoff = Math.min(consecutive429 * 10000, 60000); // 10s, 20s, ... 60s max
          process.stdout.write(`⏳ Rate limited on ${sub.suburb}, waiting ${backoff/1000}s (${consecutive429} consecutive)...\n`);
          await sleep(backoff);
          if (consecutive429 >= 10) {
            process.stdout.write(`⚠ Too many 429s, pausing 5 minutes...\n`);
            await sleep(300000);
            consecutive429 = 0;
          }
          // Retry once
          try { lots = await scrapeSuburb(sub.suburb, STATE, sub.postcode, '', corridor); } catch(e2) { lots = []; errors++; }
        } else if (e.message && e.message.includes('ETIMEDOUT')) {
          process.stdout.write(`⏳ Timeout on ${sub.suburb}, skipping\n`);
          errors++;
          lots = [];
        } else {
          throw e;
        }
      }
      
      if (lots && lots.length > 0) consecutive429 = 0; // Reset on success
      
      let subAdded = 0;
      for (const lot of (lots || [])) {
        if (!lot.lot_size || lot.lot_size < 50 || lot.lot_size > 10000) continue;
        if (!lot.price || lot.price < 20000 || lot.price > 5000000) continue;
        
        lot.corridor = corridor;
        lot.state = STATE;
        lot.price_per_sqm = lot.lot_size > 0 ? Math.round(lot.price / lot.lot_size * 100) / 100 : 0;
        
        try {
          const result = upsertLot(db, lot);
          if (result.action === 'inserted') subAdded++;
          else if (result.action === 'price_changed') { updated++; priceChanges++; }
          else if (result.action === 'updated') updated++;
        } catch(e) { /* skip bad lot, don't crash */ }
      }
      added += subAdded;
      if (subAdded > 0) {
        process.stdout.write(`✓ ${sub.suburb} ${sub.postcode}: +${subAdded} new (total ${added})\n`);
      }
    } catch(e) {
      errors++;
      process.stdout.write(`✗ ${sub.suburb}: ${e.message || e}\n`);
    }

    // Save progress every 20 suburbs
    if ((i + 1) % 20 === 0 || i === suburbs.length - 1) {
      progress = { lastIndex: i + 1, lotsAdded: added, errors, updatedAt: new Date().toISOString() };
      try { fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2)); } catch(e) {}
    }

    await sleep(DELAY);
  }

  db.close();
  console.log(`\n=== DONE: ${STATE} ===`);
  console.log(`New: ${added} | Updated: ${updated} | Price changes: ${priceChanges} | Errors: ${errors}`);
  console.log(`Suburbs scraped: ${suburbs.length}`);
}

run().catch(e => { console.error('FATAL:', e.message || e); process.exit(0); }); // exit 0 — never crash the pipeline
