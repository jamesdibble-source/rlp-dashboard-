#!/usr/bin/env node
// Discovery scraper — hits Domain page 1 for every suburb in Australia
// Finds which ones have active vacant land listings
// Run weekly to build/refresh the active suburb list
// Usage: node discover-suburbs.js [--state VIC] [--concurrency 3]

const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-AU,en;q=0.9',
};

const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf('--' + name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}

const STATE_FILTER = getArg('state', null);
const CONCURRENCY = parseInt(getArg('concurrency', '3'));
const DELAY_MS = parseInt(getArg('delay', '1500'));

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function checkSuburb(suburb, postcode, state) {
  const slug = suburb.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const stateSlug = state.toLowerCase();
  const url = `https://www.domain.com.au/sale/${slug}-${stateSlug}-${postcode}/?ptype=vacant-land&ssubs=0`;
  
  try {
    const resp = await fetch(url, { headers: HEADERS, redirect: 'follow' });
    if (resp.status === 404 || resp.status === 301) return { suburb, postcode, state, count: 0 };
    if (resp.status === 429) {
      await sleep(30000);
      return checkSuburb(suburb, postcode, state); // retry
    }
    
    const html = await resp.text();
    const $ = cheerio.load(html);
    
    // Count listing cards on page
    let cardCount = 0;
    $('[data-testid="listing-card-wrapper-premiumplus"], [data-testid="listing-card-wrapper-premium"], [data-testid="listing-card-wrapper-standard"], article[data-testid]').each(() => cardCount++);
    
    // Also check for "no results" indicators
    const noResults = html.includes('no results') || html.includes('No properties') || html.includes('0 results') || html.includes('could not find');
    
    if (noResults && cardCount === 0) return { suburb, postcode, state, count: 0 };
    
    // Try to extract total count from page
    let totalStr = '';
    $('strong, span').each((_, el) => {
      const t = $(el).text().trim();
      const m = t.match(/^([\d,]+)$/);
      if (m) {
        const n = parseInt(m[1].replace(/,/g, ''));
        if (n > 0 && n < 10000) totalStr = m[1];
      }
    });
    
    const count = totalStr ? parseInt(totalStr.replace(/,/g, '')) : cardCount;
    return { suburb, postcode, state, count, cardCount };
    
  } catch (e) {
    return { suburb, postcode, state, count: -1, error: e.message };
  }
}

async function worker(id, queue, results) {
  while (queue.length > 0) {
    const item = queue.shift();
    const result = await checkSuburb(item.suburb, item.postcode, item.state);
    
    if (result.count > 0) {
      results.push(result);
      console.log(`[W${id}] ✓ ${result.suburb}, ${result.state} ${result.postcode} — ${result.count} listings`);
    }
    // Only log errors, skip zeros silently
    if (result.count < 0) {
      console.log(`[W${id}] ✗ ${result.suburb}, ${result.state} — ${result.error}`);
    }
    
    await sleep(DELAY_MS);
    
    // Progress update every 50
    if ((queue.length) % 50 === 0 && queue.length > 0) {
      console.log(`  ... ${queue.length} remaining, ${results.length} active suburbs found so far`);
    }
  }
}

async function main() {
  const postcodes = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'au-postcodes.json'), 'utf8'));
  
  let targets = postcodes;
  if (STATE_FILTER) targets = targets.filter(p => p.state === STATE_FILTER.toUpperCase());
  
  console.log('=== Grange Land Intelligence — Suburb Discovery ===');
  console.log(`Total suburbs to check: ${targets.length}`);
  console.log(`State filter: ${STATE_FILTER || 'ALL'}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Estimated time: ~${Math.round(targets.length * DELAY_MS / 1000 / CONCURRENCY / 60)} minutes`);
  console.log(`Started: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}\n`);
  
  const queue = [...targets];
  const results = [];
  
  const workers = [];
  for (let i = 0; i < Math.min(CONCURRENCY, targets.length); i++) {
    workers.push(worker(i + 1, queue, results));
  }
  
  await Promise.all(workers);
  
  // Sort by count descending
  results.sort((a, b) => b.count - a.count);
  
  // Save active suburbs list
  const outPath = path.join(__dirname, 'data', `active-suburbs-${STATE_FILTER ? STATE_FILTER.toLowerCase() : 'national'}.json`);
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  
  console.log(`\n=== Discovery Complete ===`);
  console.log(`Active suburbs with land listings: ${results.length} / ${targets.length}`);
  console.log(`Saved to: ${outPath}`);
  console.log(`\nTop 20 by listing count:`);
  results.slice(0, 20).forEach((r, i) => {
    console.log(`  ${i+1}. ${r.suburb}, ${r.state} ${r.postcode} — ${r.count} listings`);
  });
  
  // Summary by state
  const byState = {};
  for (const r of results) {
    if (!byState[r.state]) byState[r.state] = { count: 0, listings: 0 };
    byState[r.state].count++;
    byState[r.state].listings += r.count;
  }
  console.log('\nBy state:');
  for (const [s, d] of Object.entries(byState).sort((a,b) => b[1].listings - a[1].listings)) {
    console.log(`  ${s}: ${d.count} suburbs, ${d.listings} total listings`);
  }
  
  console.log(`\nFinished: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}`);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
