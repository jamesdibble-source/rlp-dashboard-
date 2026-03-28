#!/usr/bin/env node
// Smart discovery — only check metro + regional suburbs
// Fast: ~30 min for all of Australia at 5 concurrent workers
// Usage: node discover-smart.js [--state VIC] [--concurrency 5]

const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
};

const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf('--' + name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}

const STATE_FILTER = getArg('state', null);
const CONCURRENCY = parseInt(getArg('concurrency', '5'));
const DELAY_MS = parseInt(getArg('delay', '1200'));

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function checkSuburb(suburb, postcode, state, retries = 2) {
  const slug = suburb.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const stateSlug = state.toLowerCase();
  // Check both listings and sold
  const listUrl = `https://www.domain.com.au/sale/${slug}-${stateSlug}-${postcode}/?ptype=vacant-land&ssubs=0`;
  
  try {
    const resp = await fetch(listUrl, { headers: HEADERS, redirect: 'follow' });
    if (resp.status === 429) {
      if (retries > 0) {
        await sleep(15000);
        return checkSuburb(suburb, postcode, state, retries - 1);
      }
      return { suburb, postcode, state, listings: 0, error: 'rate_limited' };
    }
    if (!resp.ok) return { suburb, postcode, state, listings: 0 };
    
    const html = await resp.text();
    const $ = cheerio.load(html);
    
    // Count cards
    let cards = 0;
    $('[data-testid*="listing-card"], article[data-testid]').each(() => cards++);
    
    // Also count from any links that look like listing pages
    if (cards === 0) {
      $('a[href*="/sale/"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        if (href.match(/\d{7,}/)) cards++;
      });
    }
    
    return { suburb, postcode, state, listings: cards };
  } catch (e) {
    return { suburb, postcode, state, listings: 0, error: e.message };
  }
}

async function worker(id, queue, results, stats) {
  while (queue.length > 0) {
    const item = queue.shift();
    stats.checked++;
    
    const result = await checkSuburb(item.suburb, item.postcode, item.state);
    
    if (result.listings > 0) {
      results.push(result);
      console.log(`[W${id}] ✓ ${result.suburb}, ${result.state} ${result.postcode} — ${result.listings} listings`);
    }
    
    if (stats.checked % 100 === 0) {
      const elapsed = (Date.now() - stats.startTime) / 1000;
      const rate = stats.checked / elapsed;
      const remaining = queue.length / rate;
      console.log(`  --- Progress: ${stats.checked} checked, ${results.length} active, ${queue.length} remaining (~${Math.round(remaining/60)}m left) ---`);
    }
    
    await sleep(DELAY_MS);
  }
}

async function main() {
  const suburbs = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'smart-suburbs.json'), 'utf8'));
  
  let targets = suburbs;
  if (STATE_FILTER) targets = targets.filter(p => p.state === STATE_FILTER.toUpperCase());
  
  console.log('=== Grange Land Intelligence — Smart Discovery ===');
  console.log(`Suburbs to check: ${targets.length}`);
  console.log(`State filter: ${STATE_FILTER || 'ALL'}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Est. time: ~${Math.round(targets.length * DELAY_MS / 1000 / CONCURRENCY / 60)} minutes`);
  console.log(`Started: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}\n`);
  
  const queue = [...targets];
  const results = [];
  const stats = { checked: 0, startTime: Date.now() };
  
  const workers = [];
  for (let i = 0; i < Math.min(CONCURRENCY, targets.length); i++) {
    workers.push(worker(i + 1, queue, results, stats));
  }
  
  await Promise.all(workers);
  
  results.sort((a, b) => b.listings - a.listings);
  
  const outPath = path.join(__dirname, 'data', `active-suburbs${STATE_FILTER ? '-' + STATE_FILTER.toLowerCase() : ''}.json`);
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  
  console.log(`\n=== Discovery Complete ===`);
  console.log(`Active suburbs: ${results.length} / ${targets.length} checked (${((results.length/targets.length)*100).toFixed(1)}%)`);
  console.log(`Saved to: ${path.basename(outPath)}`);
  
  const byState = {};
  for (const r of results) {
    if (!byState[r.state]) byState[r.state] = { suburbs: 0, listings: 0 };
    byState[r.state].suburbs++;
    byState[r.state].listings += r.listings;
  }
  console.log('\nBy state:');
  for (const [s, d] of Object.entries(byState).sort((a,b) => b[1].listings - a[1].listings)) {
    console.log(`  ${s}: ${d.suburbs} active suburbs, ~${d.listings} listings visible`);
  }
  
  console.log('\nTop 30:');
  results.slice(0, 30).forEach((r, i) => {
    console.log(`  ${String(i+1).padStart(2)}. ${r.suburb.padEnd(25)} ${r.state} ${r.postcode}  ${r.listings} listings`);
  });
  
  console.log(`\nFinished: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}`);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
