#!/usr/bin/env node
// Runs discovery for remaining states sequentially after NSW
// Each state saves progress every 50 suburbs

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const states = ['QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];
const dir = path.join(__dirname, 'data');

for (const state of states) {
  const progressFile = path.join(dir, `discover-progress-${state.toLowerCase()}.json`);
  const activeFile = path.join(dir, `active-suburbs-${state.toLowerCase()}.json`);
  
  // Skip if already completed
  if (fs.existsSync(activeFile)) {
    console.log(`[${state}] Already completed, skipping`);
    continue;
  }
  
  console.log(`[${state}] Starting discovery...`);
  const start = Date.now();
  try {
    execSync(`node ${path.join(__dirname, 'discover-fast.js')} ${state}`, {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      timeout: 30 * 60 * 1000 // 30 min per state max
    });
    const elapsed = ((Date.now() - start) / 1000).toFixed(0);
    if (fs.existsSync(activeFile)) {
      const results = JSON.parse(fs.readFileSync(activeFile, 'utf8'));
      console.log(`[${state}] Complete: ${results.length} active suburbs in ${elapsed}s`);
    }
  } catch (e) {
    console.error(`[${state}] Error:`, e.message);
  }
}
console.log('All state discoveries complete');
