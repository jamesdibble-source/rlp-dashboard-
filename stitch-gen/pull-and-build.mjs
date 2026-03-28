#!/usr/bin/env node
// Pull latest Stitch screens and build into deployable app with real data
// Run: STITCH_API_KEY=... node pull-and-build.mjs [projectId]

import { stitch } from '@google/stitch-sdk';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const PROJECT_ID = process.argv[2] || '10537046229701610865';

async function main() {
  console.log(`Pulling screens from Stitch project: ${PROJECT_ID}\n`);
  
  const project = stitch.project(PROJECT_ID);
  const screens = await project.screens();
  console.log(`Found ${screens.length} screens\n`);

  mkdirSync('output', { recursive: true });

  const htmlFiles = {};
  for (const screen of screens) {
    console.log(`Screen: ${screen.screenId}`);
    try {
      const htmlUrl = await screen.getHtml();
      const resp = await fetch(htmlUrl);
      const html = await resp.text();
      const filename = `screen-${screen.screenId.substring(0, 8)}.html`;
      writeFileSync(`output/${filename}`, html);
      htmlFiles[screen.screenId] = html;
      console.log(`  Saved ${filename} (${(html.length/1024).toFixed(0)}KB)`);
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }

  // Load real data
  const lotsRaw = JSON.parse(readFileSync('../data/lots.json', 'utf8'));
  const clean = lotsRaw.filter(l => 
    l.price > 0 && l.price < 5000000 && 
    l.lotSize > 100 && l.lotSize < 5000 && 
    l.pricePerSqm > 50 && l.pricePerSqm < 5000
  );
  
  const MKT_STATE = { 'Ballarat': 'VIC', 'Wangaratta': 'VIC', 'Murray Bridge': 'SA' };
  const MKT_LGA = { 'Ballarat': 'Ballarat', 'Wangaratta': 'Wangaratta', 'Murray Bridge': 'Rural City of Murray Bridge' };
  const MKT_CORRIDOR = { 'Ballarat': 'Ballarat', 'Wangaratta': 'North East', 'Murray Bridge': 'Murray Bridge' };

  const slimLots = clean.map(l => ({
    s: l.suburb, m: l.market,
    g: MKT_LGA[l.market] || l.market,
    st: MKT_STATE[l.market] || 'VIC',
    c: MKT_CORRIDOR[l.market] || null,
    p: l.price, z: l.lotSize,
    r: Math.round(l.pricePerSqm * 100) / 100,
    t: l.status === 'Sold' ? 1 : 0,
    d: l.date ? l.date.substring(0, 7) : null,
  }));

  console.log(`\nData: ${slimLots.length} lots ready for injection`);
  console.log(`\nScreens pulled. Ready to combine with data.`);
  console.log(`Run your preferred build process to combine Stitch HTML with the data engine.`);
}

main().catch(e => console.error('Error:', e.message));
