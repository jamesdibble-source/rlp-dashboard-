#!/usr/bin/env node
// REA runner with queue-first default for buy listings.
// Usage:
//   node engine/scrape-rea.js VIC [buy|sold] [batchSize]
//   node engine/scrape-rea.js VIC buy 25 --legacy
// Buy defaults to queue-runner for production parity; sold remains on the legacy batch path.

const fs = require('fs');
const path = require('path');
const { getDb, upsertLot } = require(path.join(__dirname, 'db'));
const { runReaActor, resolveReaLimits, transformLot, filterLot, batchLocations, hasApifyToken } = require(path.join(__dirname, 'scrapers', 'rea-apify'));
const { loadActiveSuburbs, buildQueue, processJob } = require(path.join(__dirname, 'queue-runner'));
const { getLandFilterConfig } = require(path.join(__dirname, 'lib', 'land-filter'));

function parseArgs(argv) {
  const positional = [];
  const flags = new Set();
  for (const arg of argv) {
    if (arg.startsWith('--')) flags.add(arg);
    else positional.push(arg);
  }
  return { positional, flags };
}

const { positional, flags } = parseArgs(process.argv.slice(2));
const STATE = (positional[0] || 'VIC').toUpperCase();
const LISTING_TYPE = positional[1] || 'buy';
const BATCH_SIZE = parseInt(positional[2], 10) || 25;
const USE_LEGACY = flags.has('--legacy');

const progressFile = path.join(__dirname, 'data', `rea-progress-${STATE.toLowerCase()}-${LISTING_TYPE}.json`);
const activeFile = path.join(__dirname, 'data', `active-suburbs-${STATE.toLowerCase()}.json`);

if (!fs.existsSync(activeFile)) {
  console.error(`No active suburbs file for ${STATE}`);
  process.exit(1);
}

if (!hasApifyToken()) {
  console.error('APIFY token not configured. Skipping REA scrape.');
  process.exit(0);
}

const suburbs = JSON.parse(fs.readFileSync(activeFile, 'utf8'));
console.log(`REA ${LISTING_TYPE} scrape: ${STATE} — ${suburbs.length} suburbs in batches of ${BATCH_SIZE}`);

// Load progress
let progress = { lastBatch: 0, totalAdded: 0, totalSkipped: 0, totalRaw: 0 };
if (fs.existsSync(progressFile)) {
  try {
    progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
    console.log(`Resuming from batch ${progress.lastBatch} (${progress.totalAdded} lots added so far)`);
  } catch (e) {}
}

// Corridor inference (reuse from scrape-discovered.js)
function inferCorridor(suburb, state) {
  if (state !== 'VIC') return 'Unknown';
  const s = suburb.toLowerCase();
  if (/melton|caroline springs|rockbank|plumpton|cobblebank|aintree|bonnie brook|thornhill park|deanside|strathtulloh|weir views|harkness|kurunjang|brookfield|eynesbury|toolern|exford/.test(s)) return 'Western';
  if (/tarneit|truganina|werribee|wyndham|manor lakes|williams landing|point cook|hoppers crossing|laverton|mambourin/.test(s)) return 'Western';
  if (/mickleham|wollert|donnybrook|kalkallo|merrifield|cloverton|lockerbie|beveridge|wallan/.test(s)) return 'Northern';
  if (/craigieburn|roxburgh park|greenvale|attwood|coolaroo|dallas|meadow heights/.test(s)) return 'Northern';
  if (/sunbury|diggers rest|gisborne|macedon|riddells creek|romsey|lancefield|woodend/.test(s)) return 'Sunbury-Macedon';
  if (/pakenham|officer|clyde|berwick|cranbourne|narre warren|hampton park|hallam|lynbrook|lyndhurst|botanic ridge/.test(s)) return 'South Eastern';
  if (/armstrong creek|charlemont|mount duneed|waurn ponds|lara|leopold|ocean grove|torquay|highton|grovedale|clifton springs|drysdale/.test(s)) return 'Geelong';
  if (/ballarat|smythes creek|alfredton|delacombe|bonshaw|lucas|winter valley|mount helen|buninyong|sebastopol|wendouree/.test(s)) return 'Ballarat';
  if (/bendigo|strathfieldsaye|huntly|kangaroo flat|eaglehawk|epsom|golden square|maiden gully/.test(s)) return 'Bendigo';
  if (/wangaratta|benalla|wodonga|albury/.test(s)) return 'North East';
  if (/shepparton|mooroopna|kialla/.test(s)) return 'Shepparton';
  if (/warrnambool|hamilton|portland/.test(s)) return 'Western District';
  if (/drouin|warragul|moe|morwell|traralgon|sale/.test(s)) return 'Gippsland';
  return 'Other VIC';
}

async function runQueueMode() {
  const rows = loadActiveSuburbs([STATE]);
  const queue = buildQueue(rows, {
    mode: 'bulk',
    reaMaxListings: resolveReaLimits('bulk').maxListings,
    reaDateRange: resolveReaLimits('bulk').dateRange,
  });
  const db = getDb();
  const filters = getLandFilterConfig({});
  const maxPages = resolveReaLimits('bulk').maxPages;

  let processed = 0;
  let partial = 0;
  for (const job of queue) {
    await processJob(job, ['rea'], filters, maxPages, db);
    processed += 1;
    if (job.status === 'partial') partial += 1;
  }

  db.close();
  console.log(`Queue mode complete: ${processed} jobs processed, ${partial} partial`);
}

async function runLegacyMode() {
  const db = getDb();
  const batches = batchLocations(suburbs.map(s => ({ suburb: s.suburb, state: STATE, postcode: s.postcode })), BATCH_SIZE);

  console.log(`${batches.length} batches total, starting from batch ${progress.lastBatch}`);

  for (let i = progress.lastBatch; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`\n=== Batch ${i + 1}/${batches.length}: ${batch.length} suburbs ===`);
    console.log(`  Suburbs: ${batch.map(b => b.suburb).join(', ')}`);

    try {
      const reaLimits = resolveReaLimits('bulk');
      const items = await runReaActor(batch, LISTING_TYPE, reaLimits.maxListings, reaLimits.maxPages, reaLimits.dateRange);

      let added = 0, skipped = 0;
      for (const item of items) {
        const lot = transformLot(item, LISTING_TYPE);

        if (!filterLot(lot)) {
          skipped++;
          continue;
        }

        lot.corridor = inferCorridor(lot.suburb, lot.state);

        try {
          upsertLot(db, lot);
          added++;
        } catch (e) {
          skipped++;
        }
      }

      progress.totalRaw += items.length;
      progress.totalAdded += added;
      progress.totalSkipped += skipped;
      console.log(`  Results: ${items.length} raw → ${added} added, ${skipped} filtered/skipped`);

    } catch (e) {
      console.error(`  Batch error: ${e.message}`);
    }

    progress.lastBatch = i + 1;
    progress.updatedAt = new Date().toISOString();
    fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));
    console.log(`  Progress saved: batch ${i + 1}/${batches.length}, ${progress.totalAdded} total lots`);
  }

  db.close();
  console.log(`\n=== COMPLETE ===`);
  console.log(`Raw: ${progress.totalRaw} | Added: ${progress.totalAdded} | Skipped: ${progress.totalSkipped}`);
}

async function run() {
  if (LISTING_TYPE === 'buy' && !USE_LEGACY) {
    await runQueueMode();
    return;
  }

  await runLegacyMode();
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
