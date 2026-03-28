// SQLite database for lot data — local, no external dependencies, fast
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'data', 'lots.db');

function getDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function initDb() {
  const db = getDb();
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS lots (
      id TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      suburb TEXT NOT NULL,
      lga TEXT,
      state TEXT NOT NULL,
      corridor TEXT,
      lot_size REAL,
      list_price REAL,
      sold_price REAL,
      price REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'listing',
      list_date TEXT,
      sold_date TEXT,
      price_per_sqm REAL,
      source TEXT NOT NULL,
      source_id TEXT,
      source_url TEXT,
      is_outlier INTEGER DEFAULT 0,
      dedup_key TEXT,
      first_seen TEXT NOT NULL,
      last_updated TEXT NOT NULL,
      raw_json TEXT
    );
    
    CREATE INDEX IF NOT EXISTS idx_lots_suburb ON lots(suburb);
    CREATE INDEX IF NOT EXISTS idx_lots_lga ON lots(lga);
    CREATE INDEX IF NOT EXISTS idx_lots_state ON lots(state);
    CREATE INDEX IF NOT EXISTS idx_lots_corridor ON lots(corridor);
    CREATE INDEX IF NOT EXISTS idx_lots_status ON lots(status);
    CREATE INDEX IF NOT EXISTS idx_lots_dedup ON lots(dedup_key);
    CREATE INDEX IF NOT EXISTS idx_lots_date ON lots(sold_date, list_date);
    
    CREATE TABLE IF NOT EXISTS scrape_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      suburb TEXT,
      state TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      lots_found INTEGER DEFAULT 0,
      lots_new INTEGER DEFAULT 0,
      lots_updated INTEGER DEFAULT 0,
      status TEXT DEFAULT 'running',
      error TEXT
    );
    
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lot_id TEXT NOT NULL,
      price REAL NOT NULL,
      price_per_sqm REAL,
      status TEXT,
      recorded_at TEXT NOT NULL,
      FOREIGN KEY (lot_id) REFERENCES lots(id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_ph_lot ON price_history(lot_id);
  `);
  
  db.close();
  console.log('Database initialized at', DB_PATH);
}

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

function upsertLot(db, lot) {
  const dedupKey = lot.dedup_key || makeDedupKey(lot.address, lot.suburb, lot.lot_size);
  const id = lot.id || crypto.randomUUID();
  const now = new Date().toISOString();
  
  // Check if exists by dedup key
  const existing = db.prepare('SELECT id, price, status, sold_price FROM lots WHERE dedup_key = ?').get(dedupKey);
  
  if (existing) {
    let priceChanged = false;
    let pricePct = null;
    
    // Track price changes (only for meaningful changes, >0.5% to avoid float noise)
    if (lot.price && existing.price && lot.price !== existing.price) {
      const pctDiff = Math.abs((lot.price - existing.price) / existing.price) * 100;
      if (pctDiff > 0.5) {
        priceChanged = true;
        pricePct = ((lot.price - existing.price) / existing.price) * 100;
        // Record old price in history
        db.prepare(`INSERT INTO price_history (lot_id, price, price_per_sqm, status, recorded_at) VALUES (?, ?, ?, ?, ?)`)
          .run(existing.id, existing.price, null, existing.status, now);
      }
    }
    
    // Record status change to history (e.g. listing → sold)
    if (lot.status && lot.status !== existing.status && !priceChanged) {
      db.prepare(`INSERT INTO price_history (lot_id, price, price_per_sqm, status, recorded_at) VALUES (?, ?, ?, ?, ?)`)
        .run(existing.id, lot.price || existing.price, lot.price_per_sqm, lot.status, now);
    }
    
    db.prepare(`UPDATE lots SET 
      price = COALESCE(?, price),
      sold_price = COALESCE(?, sold_price),
      status = COALESCE(?, status),
      sold_date = COALESCE(?, sold_date),
      price_per_sqm = COALESCE(?, price_per_sqm),
      last_updated = ?,
      last_seen = ?,
      previous_price = CASE WHEN ? = 1 THEN ? ELSE previous_price END,
      price_change_pct = CASE WHEN ? = 1 THEN ? ELSE price_change_pct END,
      status_reason = CASE WHEN ? = 1 THEN 'price_changed' ELSE status_reason END,
      source = CASE WHEN source NOT LIKE '%' || ? || '%' THEN source || ',' || ? ELSE source END
    WHERE dedup_key = ?`).run(
      lot.price, lot.sold_price, lot.status, lot.sold_date,
      lot.price_per_sqm, now, now,
      priceChanged ? 1 : 0, existing.price,
      priceChanged ? 1 : 0, pricePct,
      priceChanged ? 1 : 0,
      lot.source, lot.source, dedupKey
    );
    return { action: priceChanged ? 'price_changed' : 'updated', id: existing.id };
  } else {
    db.prepare(`INSERT INTO lots (id, address, suburb, lga, state, corridor, lot_size, list_price, sold_price, price, status, list_date, sold_date, price_per_sqm, source, source_id, source_url, is_outlier, dedup_key, first_seen, last_updated, last_seen, raw_json) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, lot.address, lot.suburb, lot.lga || '', lot.state, lot.corridor || null,
      lot.lot_size, lot.list_price || null, lot.sold_price || null, lot.price,
      lot.status || 'listing', lot.list_date || null, lot.sold_date || null,
      lot.price_per_sqm || 0, lot.source, lot.source_id || null, lot.source_url || null,
      lot.is_outlier ? 1 : 0, dedupKey, now, now, now, lot.raw_json || null
    );
    return { action: 'inserted', id };
  }
}

function getStats(db) {
  const total = db.prepare('SELECT COUNT(*) as c FROM lots').get().c;
  const sold = db.prepare("SELECT COUNT(*) as c FROM lots WHERE status = 'sold'").get().c;
  const listings = db.prepare("SELECT COUNT(*) as c FROM lots WHERE status = 'listing'").get().c;
  const states = db.prepare('SELECT DISTINCT state FROM lots ORDER BY state').all().map(r => r.state);
  const lgas = db.prepare("SELECT DISTINCT lga FROM lots WHERE lga != '' AND lga IS NOT NULL ORDER BY lga").all().map(r => r.lga);
  const suburbs = db.prepare('SELECT DISTINCT suburb FROM lots ORDER BY suburb').all().map(r => r.suburb);
  return { total, sold, listings, states, lgas: lgas.length, suburbs: suburbs.length };
}

module.exports = { getDb, initDb, upsertLot, makeDedupKey, getStats, DB_PATH };
