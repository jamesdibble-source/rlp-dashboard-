#!/usr/bin/env node
// Simple, robust discovery — one request at a time, saves incrementally
// Usage: NODE_PATH=./node_modules node discover-fast.js VIC

const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const STATE = (process.argv[2] || 'VIC').toUpperCase();
const DATA_DIR = path.join(__dirname, 'data');
const OUT_FILE = path.join(DATA_DIR, `active-suburbs-${STATE.toLowerCase()}.json`);
const PROGRESS_FILE = path.join(DATA_DIR, `discover-progress-${STATE.toLowerCase()}.json`);

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function check(suburb, postcode, state) {
  const slug = suburb.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const url = `https://www.domain.com.au/sale/${slug}-${state.toLowerCase()}-${postcode}/?ptype=vacant-land&ssubs=0`;
  
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(12000) });
      if (resp.status === 429) { await sleep(15000); continue; }
      if (!resp.ok) return 0;
      const html = await resp.text();
      let cards = 0;
      const $ = cheerio.load(html);
      $('[data-testid*="listing-card"], article[data-testid]').each(() => cards++);
      return cards;
    } catch (e) {
      await sleep(3000);
    }
  }
  return 0;
}

async function main() {
  const allSuburbs = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'smart-suburbs.json'), 'utf8'));
  const suburbs = allSuburbs.filter(s => s.state === STATE);
  
  // Load progress if exists
  let startIdx = 0;
  let results = [];
  if (fs.existsSync(PROGRESS_FILE)) {
    const prog = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    startIdx = prog.lastIndex + 1;
    results = prog.results || [];
    console.log(`Resuming from index ${startIdx} (${results.length} active found so far)`);
  }
  
  console.log(`${STATE}: ${suburbs.length} suburbs, starting from ${startIdx}`);
  const start = Date.now();
  
  for (let i = startIdx; i < suburbs.length; i++) {
    const s = suburbs[i];
    const count = await check(s.suburb, s.postcode, s.state);
    
    if (count > 0) {
      results.push({ suburb: s.suburb, postcode: s.postcode, state: s.state, listings: count });
      process.stdout.write(`+ ${s.suburb} ${s.postcode} (${count})\n`);
    }
    
    // Save progress every 50
    if (i % 50 === 0 || i === suburbs.length - 1) {
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ lastIndex: i, results }));
      const elapsed = (Date.now() - start) / 1000;
      const rate = (i - startIdx + 1) / elapsed;
      const eta = Math.round((suburbs.length - i) / rate / 60);
      console.log(`[${i+1}/${suburbs.length}] ${results.length} active, ~${eta}m left`);
    }
    
    await sleep(800);
  }
  
  // Save final
  results.sort((a, b) => b.listings - a.listings);
  fs.writeFileSync(OUT_FILE, JSON.stringify(results, null, 2));
  
  // Clean up progress file
  try { fs.unlinkSync(PROGRESS_FILE); } catch(e) {}
  
  console.log(`\n${STATE} DONE: ${results.length} active suburbs`);
  console.log(`Top 10:`);
  results.slice(0, 10).forEach((r, i) => console.log(`  ${i+1}. ${r.suburb} ${r.postcode} — ${r.listings}`));
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
