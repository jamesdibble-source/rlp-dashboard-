#!/usr/bin/env node
// Schema migrations — safe to run multiple times (idempotent)
// Run before any scrape or clean to ensure schema is current

const path = require('path');
const { getDb } = require(path.join(__dirname, 'db'));

function migrate() {
  const db = getDb();
  
  const cols = db.prepare('PRAGMA table_info(lots)').all().map(c => c.name);
  
  // Add last_seen — tracks when a lot was last found in a scrape
  if (!cols.includes('last_seen')) {
    db.exec("ALTER TABLE lots ADD COLUMN last_seen TEXT");
    // Backfill with last_updated for existing data
    db.exec("UPDATE lots SET last_seen = last_updated WHERE last_seen IS NULL");
    console.log('✓ Added last_seen column (backfilled from last_updated)');
  }
  
  // Add status_reason — why status changed (stale_14d, stale_30d, price_changed, sold_confirmed, etc.)
  if (!cols.includes('status_reason')) {
    db.exec("ALTER TABLE lots ADD COLUMN status_reason TEXT");
    console.log('✓ Added status_reason column');
  }
  
  // Add price_change_pct — latest price movement as percentage
  if (!cols.includes('price_change_pct')) {
    db.exec("ALTER TABLE lots ADD COLUMN price_change_pct REAL");
    console.log('✓ Added price_change_pct column');
  }
  
  // Add previous_price — for quick reference without hitting price_history
  if (!cols.includes('previous_price')) {
    db.exec("ALTER TABLE lots ADD COLUMN previous_price REAL");
    console.log('✓ Added previous_price column');
  }
  
  // Ensure price_history table exists (should from db.js initDb, but safety net)
  db.exec(`
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
  
  // Ensure scrape_runs table exists  
  db.exec(`
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
  `);

  // Add daily_summary table for tracking pipeline runs
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_summary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_date TEXT NOT NULL,
      total_lots INTEGER,
      new_lots INTEGER DEFAULT 0,
      updated_lots INTEGER DEFAULT 0,
      price_changes INTEGER DEFAULT 0,
      stale_marked INTEGER DEFAULT 0,
      removed_marked INTEGER DEFAULT 0,
      duplicates_merged INTEGER DEFAULT 0,
      outliers_flagged INTEGER DEFAULT 0,
      errors INTEGER DEFAULT 0,
      duration_seconds INTEGER,
      by_state TEXT,
      created_at TEXT NOT NULL
    );
  `);
  
  // Index for last_seen queries
  db.exec('CREATE INDEX IF NOT EXISTS idx_lots_last_seen ON lots(last_seen)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_lots_status_reason ON lots(status_reason)');
  
  console.log('✓ Schema migration complete');
  db.close();
}

if (require.main === module) {
  migrate();
}

module.exports = { migrate };
