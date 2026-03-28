#!/usr/bin/env node
// Sequential national discovery — one state at a time, 3 concurrent workers
// Robust: saves progress after each state, resumes if crashed
// Usage: node discover-all.js

const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
};
const CONCURRENCY = 4;
const DELAY_MS = 1000;
const STATES = ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function checkSuburb(suburb, postcode, state, retries = 2) {
  const slug = suburb.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const url = `https://www.domain.com.au/sale/${slug}-${state.toLowerCase()}-${postcode}/?ptype=vacant-land&ssubs=0`;
  
  try {
    const resp = await fetch(url, { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(15000) });
    if (resp.status === 429) {
      if (retries > 0) { await sleep(20000); return checkSuburb(suburb, postcode, state, retries - 1); }
      return 0;
    }
    if (!resp.ok) return 0;
    
    const html = await resp.text();
    const $ = cheerio.load(html);
    
    let cards = 0;
    $('[data-testid*="listing-card"], article[data-testid]').each(() => cards++);
    if (cards === 0) {
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || '';
        if (href.match(/\/sale\/[a-z].*\d{7,}/)) cards++;
      });
    }
    return cards;
  } catch (e) {
    if (retries > 0) { await sleep(5000); return checkSuburb(suburb, postcode, state, retries - 1); }
    return -1;
  }
}

async function worker(id, queue, results, stats) {
  while (queue.length > 0) {
    const item = queue.shift();
    stats.checked++;
    
    const count = await checkSuburb(item.suburb, item.postcode, item.state);
    
    if (count > 0) {
      results.push({ suburb: item.suburb, postcode: item.postcode, state: item.state, listings: count });
      process.stdout.write(`  + ${item.suburb} ${item.postcode} (${count})\n`);
    }
    
    if (stats.checked % 50 === 0) {
      const elapsed = (Date.now() - stats.start) / 1000;
      const rate = stats.checked / elapsed;
      const eta = Math.round(queue.length / rate / 60);
      console.log(`  [${stats.checked} checked, ${results.length} active, ${queue.length} left, ~${eta}m]`);
    }
    
    await sleep(DELAY_MS);
  }
}

async function discoverState(state, suburbs) {
  const outFile = path.join(DATA_DIR, `active-suburbs-${state.toLowerCase()}.json`);
  
  // Check if already done
  if (fs.existsSync(outFile)) {
    const existing = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    console.log(`${state}: Already discovered (${existing.length} active). Skipping.`);
    return existing;
  }
  
  const targets = suburbs.filter(s => s.state === state);
  console.log(`\n${state}: Discovering ${targets.length} suburbs...`);
  
  const queue = [...targets];
  const results = [];
  const stats = { checked: 0, start: Date.now() };
  
  const workers = [];
  for (let i = 0; i < Math.min(CONCURRENCY, targets.length); i++) {
    workers.push(worker(i, queue, results, stats));
  }
  await Promise.all(workers);
  
  results.sort((a, b) => b.listings - a.listings);
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  
  const elapsed = Math.round((Date.now() - stats.start) / 1000);
  console.log(`${state}: ${results.length} active suburbs found in ${elapsed}s`);
  
  // Pause between states to avoid rate limiting
  console.log(`  Cooling down 10s before next state...`);
  await sleep(10000);
  return results;
}

async function main() {
  const suburbs = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'smart-suburbs.json'), 'utf8'));
  
  console.log('=== Grange Land Intelligence — National Discovery ===');
  console.log(`Total suburbs: ${suburbs.length} across ${STATES.length} states`);
  console.log(`Concurrency: ${CONCURRENCY} per state (sequential states)`);
  console.log(`Started: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}`);
  
  const allActive = [];
  
  for (const state of STATES) {
    const active = await discoverState(state, suburbs);
    allActive.push(...active);
  }
  
  // Save combined national file
  allActive.sort((a, b) => b.listings - a.listings);
  fs.writeFileSync(path.join(DATA_DIR, 'active-suburbs-national.json'), JSON.stringify(allActive, null, 2));
  
  console.log('\n=== National Discovery Complete ===');
  console.log(`Total active suburbs: ${allActive.length}`);
  
  const byState = {};
  for (const r of allActive) {
    if (!byState[r.state]) byState[r.state] = { count: 0, listings: 0 };
    byState[r.state].count++;
    byState[r.state].listings += r.listings;
  }
  
  console.log('\nBy state:');
  for (const [s, d] of Object.entries(byState).sort((a,b) => b[1].listings - a[1].listings)) {
    console.log(`  ${s}: ${d.count} active suburbs, ~${d.listings} visible listings`);
  }
  
  console.log('\nTop 30 nationally:');
  allActive.slice(0, 30).forEach((r, i) => {
    console.log(`  ${String(i+1).padStart(2)}. ${r.suburb.padEnd(25)} ${r.state} ${r.postcode}  ${r.listings}`);
  });
  
  console.log(`\nFinished: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}`);
}

process.on('uncaughtException', (e) => { console.error('Uncaught:', e.message); });
process.on('unhandledRejection', (e) => { console.error('Unhandled:', e.message || e); });
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
