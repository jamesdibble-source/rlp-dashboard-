#!/usr/bin/env node
// Full scrape pipeline — iterates all VIC suburbs, scrapes Domain, loads into SQLite
// Usage: node scrape-all.js [--state VIC] [--corridor Western] [--suburb Tarneit]

const { scrapeSuburb } = require('./scrapers/domain-public');
const { getDb, initDb, upsertLot, getStats } = require('./db');

// VIC growth corridor suburbs
const VIC_SUBURBS = [
  // Western
  { suburb: 'Melton South', postcode: '3338', lga: 'Melton', corridor: 'Western' },
  { suburb: 'Brookfield', postcode: '3338', lga: 'Melton', corridor: 'Western' },
  { suburb: 'Thornhill Park', postcode: '3335', lga: 'Melton', corridor: 'Western' },
  { suburb: 'Cobblebank', postcode: '3338', lga: 'Melton', corridor: 'Western' },
  { suburb: 'Weir Views', postcode: '3338', lga: 'Melton', corridor: 'Western' },
  { suburb: 'Bonnie Brook', postcode: '3335', lga: 'Melton', corridor: 'Western' },
  { suburb: 'Aintree', postcode: '3336', lga: 'Melton', corridor: 'Western' },
  { suburb: 'Fraser Rise', postcode: '3336', lga: 'Melton', corridor: 'Western' },
  { suburb: 'Tarneit', postcode: '3029', lga: 'Wyndham', corridor: 'Western' },
  { suburb: 'Truganina', postcode: '3029', lga: 'Wyndham', corridor: 'Western' },
  { suburb: 'Wyndham Vale', postcode: '3024', lga: 'Wyndham', corridor: 'Western' },
  { suburb: 'Manor Lakes', postcode: '3024', lga: 'Wyndham', corridor: 'Western' },
  { suburb: 'Point Cook', postcode: '3030', lga: 'Wyndham', corridor: 'Western' },
  { suburb: 'Werribee', postcode: '3030', lga: 'Wyndham', corridor: 'Western' },
  // Northern
  { suburb: 'Craigieburn', postcode: '3064', lga: 'Hume', corridor: 'Northern' },
  { suburb: 'Mickleham', postcode: '3064', lga: 'Hume', corridor: 'Northern' },
  { suburb: 'Kalkallo', postcode: '3064', lga: 'Hume', corridor: 'Northern' },
  { suburb: 'Donnybrook', postcode: '3064', lga: 'Hume', corridor: 'Northern' },
  { suburb: 'Sunbury', postcode: '3429', lga: 'Hume', corridor: 'Northern' },
  { suburb: 'Wollert', postcode: '3750', lga: 'Whittlesea', corridor: 'Northern' },
  { suburb: 'Mernda', postcode: '3754', lga: 'Whittlesea', corridor: 'Northern' },
  { suburb: 'Doreen', postcode: '3754', lga: 'Whittlesea', corridor: 'Northern' },
  { suburb: 'Beveridge', postcode: '3753', lga: 'Mitchell', corridor: 'Northern' },
  { suburb: 'Wallan', postcode: '3756', lga: 'Mitchell', corridor: 'Northern' },
  { suburb: 'Kilmore', postcode: '3764', lga: 'Mitchell', corridor: 'Northern' },
  // South Eastern
  { suburb: 'Cranbourne East', postcode: '3977', lga: 'Casey', corridor: 'South Eastern' },
  { suburb: 'Cranbourne West', postcode: '3977', lga: 'Casey', corridor: 'South Eastern' },
  { suburb: 'Clyde', postcode: '3978', lga: 'Casey', corridor: 'South Eastern' },
  { suburb: 'Clyde North', postcode: '3978', lga: 'Casey', corridor: 'South Eastern' },
  { suburb: 'Botanic Ridge', postcode: '3977', lga: 'Casey', corridor: 'South Eastern' },
  { suburb: 'Officer', postcode: '3809', lga: 'Cardinia', corridor: 'South Eastern' },
  { suburb: 'Pakenham', postcode: '3810', lga: 'Cardinia', corridor: 'South Eastern' },
  { suburb: 'Beaconsfield', postcode: '3807', lga: 'Cardinia', corridor: 'South Eastern' },
  // Geelong
  { suburb: 'Armstrong Creek', postcode: '3217', lga: 'Greater Geelong', corridor: 'Geelong' },
  { suburb: 'Charlemont', postcode: '3217', lga: 'Greater Geelong', corridor: 'Geelong' },
  { suburb: 'Mount Duneed', postcode: '3217', lga: 'Greater Geelong', corridor: 'Geelong' },
  { suburb: 'Lara', postcode: '3212', lga: 'Greater Geelong', corridor: 'Geelong' },
  { suburb: 'Leopold', postcode: '3224', lga: 'Greater Geelong', corridor: 'Geelong' },
  // Ballarat
  { suburb: 'Lucas', postcode: '3350', lga: 'Ballarat', corridor: 'Ballarat' },
  { suburb: 'Alfredton', postcode: '3350', lga: 'Ballarat', corridor: 'Ballarat' },
  { suburb: 'Winter Valley', postcode: '3358', lga: 'Ballarat', corridor: 'Ballarat' },
  { suburb: 'Smythes Creek', postcode: '3351', lga: 'Ballarat', corridor: 'Ballarat' },
  { suburb: 'Bonshaw', postcode: '3352', lga: 'Ballarat', corridor: 'Ballarat' },
  { suburb: 'Delacombe', postcode: '3356', lga: 'Ballarat', corridor: 'Ballarat' },
  { suburb: 'Miners Rest', postcode: '3352', lga: 'Ballarat', corridor: 'Ballarat' },
  // Bendigo
  { suburb: 'Strathfieldsaye', postcode: '3551', lga: 'Greater Bendigo', corridor: 'Bendigo' },
  { suburb: 'Huntly', postcode: '3551', lga: 'Greater Bendigo', corridor: 'Bendigo' },
  { suburb: 'Epsom', postcode: '3551', lga: 'Greater Bendigo', corridor: 'Bendigo' },
  { suburb: 'Maiden Gully', postcode: '3551', lga: 'Greater Bendigo', corridor: 'Bendigo' },
  { suburb: 'Kangaroo Flat', postcode: '3555', lga: 'Greater Bendigo', corridor: 'Bendigo' },
  // Wangaratta
  { suburb: 'Wangaratta', postcode: '3677', lga: 'Wangaratta', corridor: 'North East' },
  // Shepparton
  { suburb: 'Shepparton', postcode: '3630', lga: 'Greater Shepparton', corridor: 'Shepparton' },
  { suburb: 'Kialla', postcode: '3631', lga: 'Greater Shepparton', corridor: 'Shepparton' },
  // Latrobe Valley
  { suburb: 'Warragul', postcode: '3820', lga: 'Baw Baw', corridor: 'Latrobe Valley' },
  { suburb: 'Drouin', postcode: '3818', lga: 'Baw Baw', corridor: 'Latrobe Valley' },
  { suburb: 'Traralgon', postcode: '3844', lga: 'Latrobe', corridor: 'Latrobe Valley' },
  // Seymour
  { suburb: 'Seymour', postcode: '3660', lga: 'Mitchell', corridor: 'Northern' },
];

async function main() {
  const args = process.argv.slice(2);
  const corridorFilter = args.includes('--corridor') ? args[args.indexOf('--corridor') + 1] : null;
  const suburbFilter = args.includes('--suburb') ? args[args.indexOf('--suburb') + 1] : null;
  
  let targets = VIC_SUBURBS;
  if (corridorFilter) targets = targets.filter(s => s.corridor === corridorFilter);
  if (suburbFilter) targets = targets.filter(s => s.suburb === suburbFilter);
  
  console.log(`=== Grange Land Intelligence Scraper ===`);
  console.log(`Targets: ${targets.length} suburbs`);
  console.log(`Started: ${new Date().toISOString()}\n`);
  
  initDb();
  const db = getDb();
  
  let totalNew = 0, totalUpdated = 0, totalErrors = 0;
  
  // Record scrape run
  const runStmt = db.prepare('INSERT INTO scrape_runs (source, started_at, status) VALUES (?, ?, ?)');
  const runResult = runStmt.run('domain-public', new Date().toISOString(), 'running');
  const runId = runResult.lastInsertRowid;
  
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    console.log(`\n[${i+1}/${targets.length}] ${t.suburb}, ${t.lga} (${t.corridor})`);
    
    try {
      const lots = await scrapeSuburb(t.suburb, 'VIC', t.postcode, t.lga, t.corridor);
      
      let newCount = 0, updCount = 0;
      const insertTx = db.transaction(() => {
        for (const lot of lots) {
          const result = upsertLot(db, lot);
          if (result.action === 'inserted') newCount++;
          else updCount++;
        }
      });
      insertTx();
      
      totalNew += newCount;
      totalUpdated += updCount;
      console.log(`  → DB: +${newCount} new, ${updCount} updated`);
      
    } catch (e) {
      console.error(`  ERROR: ${e.message}`);
      totalErrors++;
    }
  }
  
  // Update run record
  db.prepare('UPDATE scrape_runs SET completed_at = ?, lots_found = ?, lots_new = ?, lots_updated = ?, status = ? WHERE id = ?')
    .run(new Date().toISOString(), totalNew + totalUpdated, totalNew, totalUpdated, 'completed', runId);
  
  const stats = getStats(db);
  db.close();
  
  console.log(`\n=== Scrape Complete ===`);
  console.log(`New lots: ${totalNew}`);
  console.log(`Updated: ${totalUpdated}`);
  console.log(`Errors: ${totalErrors}`);
  console.log(`\nDatabase totals:`);
  console.log(`  Total lots: ${stats.total}`);
  console.log(`  Sold: ${stats.sold}`);
  console.log(`  Listings: ${stats.listings}`);
  console.log(`  States: ${stats.states.join(', ')}`);
  console.log(`  LGAs: ${stats.lgas}`);
  console.log(`  Suburbs: ${stats.suburbs}`);
  console.log(`\nFinished: ${new Date().toISOString()}`);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
