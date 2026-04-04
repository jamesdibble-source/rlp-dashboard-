#!/usr/bin/env node
// Test script for rea-bulk-runner.js
// Runs 3 suburbs, verifies checkpoint/resume and session rotation.

const fs = require('fs');
const path = require('path');

// ── Set env vars BEFORE requiring the module (they're read at load time) ──
process.env.REA_SUBURB_DELAY_MIN = '5000';
process.env.REA_SUBURB_DELAY_MAX = '10000';
process.env.REA_BATCH_SIZE = '2'; // rotate Chrome after 2 suburbs to exercise rotation

const { runBulkREA } = require('./engine/scrapers/rea-bulk-runner');

const PROGRESS_PATH = path.join(__dirname, 'engine', 'data', 'rea-progress.json');

const SUBURBS = [
  { suburb: 'Tarneit',       state: 'VIC', postcode: '3029', lga: 'Wyndham', corridor: 'West' },
  { suburb: 'Murray Bridge',  state: 'SA',  postcode: '5253', lga: 'Rural City of Murray Bridge', corridor: '' },
  { suburb: 'Leppington',    state: 'NSW', postcode: '2179', lga: 'Camden', corridor: 'South West' },
];

async function main() {
  // ──────────── RUN 1: Fresh start ────────────
  console.log('='.repeat(70));
  console.log('RUN 1 — Fresh start (3 suburbs)');
  console.log('='.repeat(70));

  // Delete progress file for a clean slate
  try { fs.unlinkSync(PROGRESS_PATH); console.log('Deleted old rea-progress.json'); } catch (_) {}

  const t1 = Date.now();
  const lots1 = await runBulkREA(SUBURBS, { maxPages: 1 });
  const elapsed1 = ((Date.now() - t1) / 1000).toFixed(1);

  console.log('\n' + '-'.repeat(70));
  console.log(`RUN 1 RESULT: ${lots1.length} total lots in ${elapsed1}s`);
  console.log('-'.repeat(70));

  // Print progress file
  try {
    const progress = JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf-8'));
    console.log('\nrea-progress.json:');
    console.log(JSON.stringify(progress, null, 2));
  } catch (e) {
    console.error('Could not read progress file:', e.message);
  }

  // ──────────── RUN 2: Resume (should skip all) ────────────
  console.log('\n' + '='.repeat(70));
  console.log('RUN 2 — Resume (should skip all 3 suburbs instantly)');
  console.log('='.repeat(70));

  const t2 = Date.now();
  const lots2 = await runBulkREA(SUBURBS, { maxPages: 1 });
  const elapsed2 = ((Date.now() - t2) / 1000).toFixed(1);

  console.log('\n' + '-'.repeat(70));
  console.log(`RUN 2 RESULT: ${lots2.length} lots returned, took ${elapsed2}s (should be ~0s)`);
  console.log('-'.repeat(70));

  // Cleanup
  try { fs.unlinkSync(PROGRESS_PATH); console.log('\nCleaned up rea-progress.json'); } catch (_) {}
}

main().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
