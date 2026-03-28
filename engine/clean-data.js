#!/usr/bin/env node
// Production data cleaning pipeline — bulletproof, no crashes, thorough dedup
// Run after every scrape. Safe to run multiple times.

const fs = require('fs');
const path = require('path');
const { getDb } = require(path.join(__dirname, 'db'));

// Run migration first (idempotent)
try { require(path.join(__dirname, 'migrate')).migrate(); } catch(e) { console.warn('Migration warning:', e.message); }

const db = getDb();
const startTime = Date.now();
const summary = { 
  removed_bad_price: 0, removed_bad_size: 0, removed_no_suburb: 0,
  normalised: 0, deduped: 0, outliers: 0, stale_14d: 0, stale_30d: 0,
  corridors_updated: 0, sold_detected: 0, errors: 0
};

console.log('=== PRODUCTION DATA CLEANING ===');
console.log(`Started: ${new Date().toISOString()}`);
const before = db.prepare('SELECT COUNT(*) as c FROM lots').get().c;
console.log('Lots before:', before);

// =========================================
// 1. REMOVE CLEARLY INVALID DATA
// =========================================
try {
  // Delete orphaned price_history first (for lots we're about to remove)
  db.prepare("DELETE FROM price_history WHERE lot_id IN (SELECT id FROM lots WHERE price <= 20000 OR price > 5000000)").run();
  db.prepare("DELETE FROM price_history WHERE lot_id IN (SELECT id FROM lots WHERE lot_size IS NOT NULL AND lot_size > 0 AND (lot_size < 50 OR lot_size > 10000))").run();
  db.prepare("DELETE FROM price_history WHERE lot_id IN (SELECT id FROM lots WHERE suburb IS NULL OR TRIM(suburb) = '')").run();
  db.prepare("DELETE FROM price_history WHERE lot_id IN (SELECT id FROM lots WHERE address IS NULL OR TRIM(address) = '')").run();
  
  summary.removed_bad_price = db.prepare("DELETE FROM lots WHERE price <= 20000 OR price > 5000000").run().changes;
  summary.removed_bad_size = db.prepare("DELETE FROM lots WHERE lot_size IS NOT NULL AND lot_size > 0 AND (lot_size < 50 OR lot_size > 10000)").run().changes;
  summary.removed_no_suburb = db.prepare("DELETE FROM lots WHERE suburb IS NULL OR TRIM(suburb) = ''").run().changes;
  const noAddr = db.prepare("DELETE FROM lots WHERE address IS NULL OR TRIM(address) = ''").run().changes;
  console.log(`[1] Removed: ${summary.removed_bad_price} bad price, ${summary.removed_bad_size} bad size, ${summary.removed_no_suburb} no suburb, ${noAddr} no address`);
} catch(e) {
  console.error('[1] Error removing invalid data:', e.message);
  summary.errors++;
}

// =========================================
// 2. NORMALISE DATA
// =========================================
try {
  // Title case suburbs
  const rawSuburbs = db.prepare("SELECT DISTINCT suburb FROM lots").all();
  const titleCase = s => s.trim().replace(/\s+/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  const updateSub = db.prepare("UPDATE lots SET suburb = ? WHERE suburb = ?");
  let normCount = 0;
  for (const { suburb } of rawSuburbs) {
    const normalised = titleCase(suburb);
    if (normalised !== suburb) {
      updateSub.run(normalised, suburb);
      normCount++;
    }
  }
  
  // Uppercase state codes
  db.prepare("UPDATE lots SET state = UPPER(TRIM(state)) WHERE state != UPPER(TRIM(state))").run();
  
  // Strip whitespace from addresses
  db.prepare("UPDATE lots SET address = TRIM(address) WHERE address != TRIM(address)").run();
  
  summary.normalised = normCount;
  console.log(`[2] Normalised: ${normCount} suburb names, states uppercased`);
} catch(e) {
  console.error('[2] Normalisation error:', e.message);
  summary.errors++;
}

// =========================================
// 3. RECALCULATE PRICE PER SQM
// =========================================
try {
  db.prepare("UPDATE lots SET price_per_sqm = ROUND(CAST(price AS REAL) / lot_size, 2) WHERE lot_size > 0 AND price > 0").run();
  console.log('[3] Recalculated $/m² for all lots');
} catch(e) {
  console.error('[3] Price/sqm error:', e.message);
  summary.errors++;
}

// =========================================
// 4. BULLETPROOF DEDUPLICATION
// =========================================
try {
  // Recompute dedup keys for consistency
  const allLots = db.prepare("SELECT rowid, address, suburb, lot_size, dedup_key FROM lots").all();
  const keyMap = new Map(); // dedupKey -> [rowids]
  const updateKey = db.prepare("UPDATE lots SET dedup_key = ? WHERE rowid = ?");
  
  function makeDedupKey(address, suburb, lotSize) {
    const addr = (address || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/lot\s*\d+[\s,]*/i, '')
      .replace(/[^\w\s]/g, '')
      .trim();
    const sub = (suburb || '').toLowerCase().trim();
    const size = Math.round((lotSize || 0) / 5) * 5;
    return `${addr}|${sub}|${size}`;
  }
  
  for (const lot of allLots) {
    const key = makeDedupKey(lot.address, lot.suburb, lot.lot_size);
    if (key !== lot.dedup_key) {
      updateKey.run(key, lot.rowid);
    }
    if (!keyMap.has(key)) keyMap.set(key, []);
    keyMap.get(key).push(lot.rowid);
  }
  
  // For each group of duplicates, keep the most recent, merge sold info
  let dupsRemoved = 0;
  const getRow = db.prepare("SELECT * FROM lots WHERE rowid = ?");
  const delRow = db.prepare("DELETE FROM lots WHERE rowid = ?");
  const mergeSold = db.prepare("UPDATE lots SET sold_price = ?, sold_date = ?, status = 'sold', status_reason = 'sold_confirmed' WHERE rowid = ?");
  
  for (const [key, rowids] of keyMap) {
    if (rowids.length <= 1) continue;
    
    // Get full data for all duplicates
    const rows = rowids.map(rid => ({ ...getRow.get(rid), _rowid: rid })).filter(Boolean);
    if (rows.length <= 1) continue;
    
    // Sort: prefer ones with sold data, then most recently updated
    rows.sort((a, b) => {
      if (a.sold_price && !b.sold_price) return -1;
      if (!a.sold_price && b.sold_price) return 1;
      return (b.last_updated || '').localeCompare(a.last_updated || '');
    });
    
    const keeper = rows[0];
    
    // Check if any duplicate has sold info that the keeper doesn't
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].sold_price && !keeper.sold_price) {
        mergeSold.run(rows[i].sold_price, rows[i].sold_date, keeper._rowid);
      }
      delRow.run(rows[i]._rowid);
      dupsRemoved++;
    }
  }
  
  summary.deduped = dupsRemoved;
  console.log(`[4] Deduplication: removed ${dupsRemoved} duplicates`);
} catch(e) {
  console.error('[4] Dedup error:', e.message);
  summary.errors++;
}

// =========================================
// 5. OUTLIER FLAGGING
// =========================================
try {
  // Reset outlier flags first
  db.prepare("UPDATE lots SET is_outlier = 0").run();
  
  const suburbs = db.prepare("SELECT DISTINCT suburb, state FROM lots WHERE price_per_sqm > 0").all();
  let outliers = 0;
  
  for (const { suburb, state } of suburbs) {
    const rates = db.prepare("SELECT price_per_sqm FROM lots WHERE suburb = ? AND state = ? AND price_per_sqm > 0 ORDER BY price_per_sqm")
      .all(suburb, state).map(r => r.price_per_sqm);
    if (rates.length < 3) continue;
    
    // IQR method (more robust than simple multiplier)
    const q1 = rates[Math.floor(rates.length * 0.25)];
    const q3 = rates[Math.floor(rates.length * 0.75)];
    const iqr = q3 - q1;
    const lo = q1 - 2.5 * iqr;  // generous bounds for property data
    const hi = q3 + 2.5 * iqr;
    
    // Also use simple median bounds as safety net
    const median = rates[Math.floor(rates.length / 2)];
    const absLo = median * 0.25;
    const absHi = median * 4;
    
    const finalLo = Math.max(lo, absLo);
    const finalHi = Math.min(hi, absHi);
    
    const flagged = db.prepare("UPDATE lots SET is_outlier = 1 WHERE suburb = ? AND state = ? AND price_per_sqm > 0 AND (price_per_sqm < ? OR price_per_sqm > ?)")
      .run(suburb, state, finalLo, finalHi).changes;
    outliers += flagged;
  }
  
  summary.outliers = outliers;
  console.log(`[5] Flagged ${outliers} outliers (IQR + median bounds)`);
} catch(e) {
  console.error('[5] Outlier flagging error:', e.message);
  summary.errors++;
}

// =========================================
// 6. STALE/DELISTED DETECTION
// =========================================
try {
  const now = new Date();
  const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  
  // Mark lots not seen in 30+ days as 'removed' (likely sold or withdrawn)
  summary.stale_30d = db.prepare(`
    UPDATE lots SET status = 'removed', status_reason = 'stale_30d' 
    WHERE status = 'listing' AND last_seen IS NOT NULL AND last_seen < ? 
    AND status_reason IS NOT 'stale_30d'
  `).run(thirtyDaysAgo).changes;
  
  // Mark lots not seen in 14+ days as 'likely_sold'
  summary.stale_14d = db.prepare(`
    UPDATE lots SET status = 'likely_sold', status_reason = 'stale_14d' 
    WHERE status = 'listing' AND last_seen IS NOT NULL AND last_seen < ? 
    AND last_seen >= ?
  `).run(fourteenDaysAgo, thirtyDaysAgo).changes;
  
  console.log(`[6] Stale detection: ${summary.stale_14d} likely_sold (14d), ${summary.stale_30d} removed (30d)`);
} catch(e) {
  console.error('[6] Stale detection error:', e.message);
  summary.errors++;
}

// =========================================
// 7. SOLD STATUS DETECTION
// =========================================
try {
  summary.sold_detected = db.prepare(`
    UPDATE lots SET status = 'sold', status_reason = 'sold_confirmed' 
    WHERE sold_price IS NOT NULL AND sold_price > 0 AND status != 'sold'
  `).run().changes;
  
  // Clean up null statuses
  db.prepare("UPDATE lots SET status = 'listing' WHERE status IS NULL OR TRIM(status) = ''").run();
  
  console.log(`[7] Sold detection: ${summary.sold_detected} confirmed sold`);
} catch(e) {
  console.error('[7] Sold detection error:', e.message);
  summary.errors++;
}

// =========================================
// 8. CORRIDOR ASSIGNMENT (ALL STATES)
// =========================================
try {
  const vicMap = {
    'Western': /tarneit|truganina|werribee|wyndham vale|manor lakes|mambourin|point cook|hoppers crossing|laverton|melton|caroline springs|rockbank|plumpton|cobblebank|aintree|bonnie brook|thornhill park|deanside|grangefields|strathtulloh|weir views|harkness|kurunjang|brookfield|eynesbury|toolern|exford|fraser rise|melton south|melton west/i,
    'Northern': /mickleham|wollert|donnybrook|kalkallo|merrifield|cloverton|lockerbie|beveridge|wallan|craigieburn|roxburgh park|greenvale|attwood|coolaroo|dallas|meadow heights|kilmore|broadford|seymour/i,
    'South Eastern': /pakenham|officer|clyde|clyde north|berwick|cranbourne|narre warren|hampton park|hallam|lynbrook|lyndhurst|botanic ridge|beaconsfield|cardinia|casey/i,
    'Geelong': /armstrong creek|charlemont|mount duneed|waurn ponds|lara|leopold|ocean grove|torquay|highton|grovedale|clifton springs|drysdale|corio|norlane|bell park|bell post hill|lovely banks|manor/i,
    'Ballarat': /ballarat|smythes creek|alfredton|delacombe|bonshaw|lucas|winter valley|mount helen|buninyong|sebastopol|wendouree|miners rest|mount clear|canadian|brown hill/i,
    'Bendigo': /bendigo|strathfieldsaye|huntly|kangaroo flat|eaglehawk|epsom|golden square|maiden gully|flora hill|spring gully/i,
    'Sunbury-Macedon': /sunbury|diggers rest|gisborne|macedon|riddells creek|romsey|lancefield|woodend|kyneton/i,
    'Gippsland': /drouin|warragul|moe|morwell|traralgon|sale|wonthaggi|inverloch|san remo|cowes|venus bay|leongatha/i,
    'North East': /wangaratta|benalla|wodonga|albury|myrtleford|bright|mount beauty/i,
    'Shepparton': /shepparton|mooroopna|kialla|tatura/i,
    'Western District': /warrnambool|hamilton|portland|colac|camperdown/i,
  };
  const nswMap = {
    'Sydney South West': /oran park|leppington|catherine field|gledswood hills|gregory hills|camden|spring farm|elderslie|currans hill|mount annan|narellan|harrington park|cobbitty|marsden park south|austral|kemps creek|rossmore/i,
    'Sydney North West': /marsden park|schofields|box hill|rouse hill|kellyville|the ponds|riverstone|vineyard|colebee|tallawong|north kellyville|bella vista/i,
    'Hunter': /maitland|cessnock|thornton|gillieston heights|chisholm|aberglasslyn|heddon greta|cliftleigh|raworth|farley|lochinvar|huntlee|north rothbury/i,
    'Central Coast': /hamlyn terrace|woongarrah|wadalba|wyong|san remo|gorokan|toukley|halekulani|budgewoi/i,
    'Illawarra': /calderwood|tullimbar|albion park|shell cove|flinders|dunmore|haywards bay|gerringong/i,
    'Wollongong': /wollongong|dapto|horsley|west dapto|kembla grange|unanderra/i,
  };
  const qldMap = {
    'Brisbane': /brisbane|springfield|ripley|yarrabilba|flagstone|south ripley|deebing heights|collingwood park|redbank plains|augustine heights|brookwater/i,
    'Gold Coast': /pimpama|coomera|ormeau|jacobs well|helensvale|pacific pines|upper coomera|oxenford|maudsland|highland park|nerang/i,
    'Sunshine Coast': /caloundra|aura|palmview|sippy downs|baringa|nirimba|bells creek|harmony|maleny/i,
    'Logan': /logan|yarrabilba|park ridge|logan reserve|chambers flat|jimboomba|greenbank|boronia heights|regents park/i,
    'Moreton Bay': /caboolture|morayfield|burpengary|narangba|north lakes|mango hill|griffin|dakabin|kallangur/i,
    'Ipswich': /ipswich|ripley|springfield|redbank|collingwood park|augustine heights|deebing heights|walloon|rosewood|fernvale/i,
    'Toowoomba': /toowoomba|highfields|westbrook|cotswold hills|harristown|drayton|darling heights|kleinton/i,
    'Townsville': /townsville|burdell|bushland beach|mount low|deeragun|kirwan|thuringowa|bohle plains|jensen/i,
  };
  const saMap = {
    'Adelaide North': /munno para|angle vale|two wells|virginia|davoren park|elizabeth|salisbury|paralowie|parafield gardens|mawson lakes|smithfield|playford|andrews farm|blakeview|craigmore|hillbank/i,
    'Adelaide South': /seaford|aldinga|sellicks beach|moana|noarlunga|morphett vale|hackham|onkaparinga|christie downs|reynella|happy valley|flagstaff hill|aberfoyle park/i,
    'Adelaide Hills': /mount barker|nairne|littlehampton|hahndorf|echunga|lobethal|woodside|birdwood/i,
    'Murray Bridge': /murray bridge|gifford hill|callington|mypolonga|tailem bend/i,
  };
  const waMap = {
    'Perth North': /alkimos|yanchep|two rocks|clarkson|butler|merriwa|ridgewood|jindalee|tamala park|eglinton|shorehaven|amberton/i,
    'Perth South East': /baldivis|wellard|bertram|calista|caversham|byford|mundijong|serpentine|haynes|hilbert|piara waters|treeby|harrisdale|southern river/i,
    'Perth South West': /rockingham|port kennedy|warnbro|golden bay|secret harbour|singleton|safety bay/i,
    'Perth North East': /ellenbrook|the vines|henley brook|aveley|upper swan|stratton|midland|jane brook|bullsbrook/i,
    'Mandurah-Peel': /mandurah|meadow springs|lakelands|halls head|erskine|greenfields|pinjarra/i,
  };

  const allMaps = { VIC: vicMap, NSW: nswMap, QLD: qldMap, SA: saMap, WA: waMap };
  
  let updated = 0;
  for (const [state, corridorMap] of Object.entries(allMaps)) {
    const lots = db.prepare("SELECT rowid, suburb FROM lots WHERE state = ? AND (corridor IS NULL OR corridor = '' OR corridor = 'Unknown' OR corridor LIKE 'Other%')").all(state);
    for (const lot of lots) {
      const s = lot.suburb.toLowerCase();
      let matched = false;
      for (const [corridor, regex] of Object.entries(corridorMap)) {
        if (regex.test(s)) {
          db.prepare("UPDATE lots SET corridor = ? WHERE rowid = ?").run(corridor, lot.rowid);
          updated++;
          matched = true;
          break;
        }
      }
      if (!matched) {
        const fallback = state === 'VIC' ? 'Other VIC' : state === 'NSW' ? 'Other NSW' : `Other ${state}`;
        db.prepare("UPDATE lots SET corridor = ? WHERE rowid = ? AND (corridor IS NULL OR corridor = '' OR corridor = 'Unknown')").run(fallback, lot.rowid);
      }
    }
  }
  
  summary.corridors_updated = updated;
  console.log(`[8] Corridor assignment: ${updated} lots updated`);
} catch(e) {
  console.error('[8] Corridor assignment error:', e.message);
  summary.errors++;
}

// =========================================
// 9. FINAL STATS + SUMMARY
// =========================================
const after = db.prepare('SELECT COUNT(*) as c FROM lots').get().c;
const duration = Math.round((Date.now() - startTime) / 1000);

console.log(`\n=== CLEANING COMPLETE (${duration}s) ===`);
console.log(`Before: ${before} | After: ${after} | Net removed: ${before - after}`);

const stateStats = db.prepare('SELECT state, COUNT(*) as c, ROUND(AVG(price)) as avg, COUNT(DISTINCT suburb) as subs FROM lots WHERE is_outlier = 0 GROUP BY state ORDER BY c DESC').all();
console.log('\nBy state (excl. outliers):');
stateStats.forEach(s => console.log(`  ${s.state}: ${s.c} lots, ${s.subs} suburbs, avg $${s.avg}`));

const statusStats = db.prepare('SELECT status, COUNT(*) as c FROM lots GROUP BY status ORDER BY c DESC').all();
console.log('\nBy status:');
statusStats.forEach(s => console.log(`  ${s.status}: ${s.c}`));

const corridorStats = db.prepare('SELECT corridor, COUNT(*) as c FROM lots WHERE corridor IS NOT NULL GROUP BY corridor ORDER BY c DESC LIMIT 15').all();
console.log('\nTop corridors:');
corridorStats.forEach(s => console.log(`  ${s.corridor}: ${s.c}`));

// Write daily summary to DB
try {
  const byState = {};
  stateStats.forEach(s => { byState[s.state] = { lots: s.c, suburbs: s.subs, avgPrice: s.avg }; });
  
  db.prepare(`INSERT INTO daily_summary (run_date, total_lots, new_lots, updated_lots, price_changes, stale_marked, removed_marked, duplicates_merged, outliers_flagged, errors, duration_seconds, by_state, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      new Date().toISOString().slice(0, 10),
      after, 0, 0, 0,
      summary.stale_14d, summary.stale_30d,
      summary.deduped, summary.outliers, summary.errors,
      duration, JSON.stringify(byState),
      new Date().toISOString()
    );
} catch(e) {
  console.warn('Could not write daily summary to DB:', e.message);
}

// Write JSON summary file
try {
  const summaryFile = path.join(__dirname, 'data', 'daily-summary.json');
  const summaryData = {
    date: new Date().toISOString().slice(0, 10),
    timestamp: new Date().toISOString(),
    total_lots: after,
    removed: before - after,
    deduped: summary.deduped,
    outliers_flagged: summary.outliers,
    stale_14d: summary.stale_14d,
    stale_30d: summary.stale_30d,
    sold_detected: summary.sold_detected,
    errors: summary.errors,
    duration_seconds: duration,
    by_state: stateStats.map(s => ({ state: s.state, lots: s.c, suburbs: s.subs, avg_price: s.avg }))
  };
  fs.writeFileSync(summaryFile, JSON.stringify(summaryData, null, 2));
  console.log(`\nSummary written to ${summaryFile}`);
} catch(e) {
  console.warn('Could not write summary file:', e.message);
}

db.close();
