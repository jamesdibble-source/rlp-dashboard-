#!/usr/bin/env node
// Scrapes Domain SOLD listings for all discovered suburbs in a state
// Usage: node engine/scrape-sold.js VIC [startIndex]
// Bulletproof — never crashes, logs errors, continues

const path = require('path');
const fs = require('fs');
const { getDb, upsertLot } = require(path.join(__dirname, 'db'));
const { scrapeSoldPage, DELAY } = require(path.join(__dirname, 'scrapers', 'domain-sold'));

const STATE = (process.argv[2] || 'VIC').toUpperCase();
const START = parseInt(process.argv[3]) || 0;
const MAX_PAGES = 5; // Max pages per suburb for sold listings
const sleep = ms => new Promise(r => setTimeout(r, ms));

const progressFile = path.join(__dirname, 'data', `sold-progress-${STATE.toLowerCase()}.json`);
const activeFile = path.join(__dirname, 'data', `active-suburbs-${STATE.toLowerCase()}.json`);

if (!fs.existsSync(activeFile)) {
  console.error(`No active suburbs file for ${STATE}: ${activeFile}`);
  process.exit(0); // Exit clean, not fatal
}

const suburbs = JSON.parse(fs.readFileSync(activeFile, 'utf8'));
console.log(`${STATE} SOLD: ${suburbs.length} suburbs, starting from ${START}`);

// Load progress
let progress = { lastIndex: START, lotsAdded: 0, errors: 0, startedAt: new Date().toISOString() };
if (START === 0 && fs.existsSync(progressFile)) {
  try {
    progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
    if (progress.lastIndex >= suburbs.length) {
      console.log(`${STATE} SOLD: Already completed`);
      process.exit(0);
    }
    console.log(`Resuming from index ${progress.lastIndex}`);
  } catch(e) {}
}

const startIdx = progress.lastIndex;

async function run() {
  const db = getDb();
  let added = progress.lotsAdded;
  let errors = progress.errors;

  for (let i = startIdx; i < suburbs.length; i++) {
    const sub = suburbs[i];
    let subAdded = 0;
    
    try {
      // Scrape up to MAX_PAGES of sold listings
      for (let page = 1; page <= MAX_PAGES; page++) {
        let result;
        try {
          result = await scrapeSoldPage(sub.suburb, STATE, sub.postcode, page);
        } catch(e) {
          if (e.message && e.message.includes('429')) {
            console.log(`  Rate limited on ${sub.suburb} page ${page}, waiting 15s...`);
            await sleep(15000);
            try { result = await scrapeSoldPage(sub.suburb, STATE, sub.postcode, page); } catch(e2) { break; }
          } else {
            break;
          }
        }
        
        if (!result || !result.lots || result.lots.length === 0) break;
        
        for (const lot of result.lots) {
          try {
            if (!lot.lot_size || lot.lot_size < 50 || lot.lot_size > 10000) continue;
            if (!lot.price || lot.price < 20000 || lot.price > 5000000) continue;
            
            lot.state = STATE;
            lot.sold_price = lot.price;
            lot.status = 'sold';
            lot.price_per_sqm = lot.lot_size > 0 ? Math.round(lot.price / lot.lot_size * 100) / 100 : 0;
            
            upsertLot(db, lot);
            subAdded++;
          } catch(e) { /* skip bad lot */ }
        }
        
        if (!result.hasMore) break;
        await sleep(DELAY || 900);
      }
      
      added += subAdded;
      if (subAdded > 0) {
        process.stdout.write(`✓ ${sub.suburb}: +${subAdded} sold (total ${added})\n`);
      }
    } catch(e) {
      errors++;
      process.stdout.write(`✗ ${sub.suburb}: ${e.message}\n`);
    }

    // Save progress every 20 suburbs
    if ((i + 1) % 20 === 0 || i === suburbs.length - 1) {
      progress = { lastIndex: i + 1, lotsAdded: added, errors, updatedAt: new Date().toISOString() };
      fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));
    }

    await sleep(DELAY || 900);
  }

  db.close();
  console.log(`\n=== DONE: ${STATE} SOLD ===`);
  console.log(`Sold lots added: ${added} | Errors: ${errors}`);
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(0); }); // exit 0 even on fatal
