#!/usr/bin/env node
// Save the JSON returned by a browser-tool extractor run directly into the canonical raw export path.
// This bridges browser-tool evaluate output into the filesystem handoff used by the OpenLot export pipeline.

const fs = require('fs');
const path = require('path');
const { buildTargetKey } = require('./scrapers/openlot-browser-runner');
const { unwrapBrowserResult } = require('./normalize-openlot-browser-result');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    out[arg.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return out;
}

function usage() {
  console.error('Usage: node engine/save-openlot-browser-tool-export.js --input <browser-export.json> --rawDir <dir> --suburb <name> --state <state> --postcode <postcode>');
  process.exit(1);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.rawDir || !args.suburb || !args.state || !args.postcode) usage();

  const input = path.resolve(args.input);
  if (!fs.existsSync(input)) {
    throw new Error(`Input file not found: ${input}`);
  }

  const target = {
    suburb: String(args.suburb).trim(),
    state: String(args.state).toUpperCase().trim(),
    postcode: String(args.postcode).trim(),
  };
  const key = buildTargetKey(target);
  const rawDir = path.resolve(args.rawDir);
  const rawFile = path.join(rawDir, `${key}.json`);

  const exportJson = JSON.parse(fs.readFileSync(input, 'utf8'));
  const browserResult = unwrapBrowserResult(exportJson);
  const payload = {
    ...browserResult,
    target,
    savedAt: new Date().toISOString(),
    source: 'browser-tool-export',
    browserToolEnvelope: exportJson && typeof exportJson === 'object' && exportJson.result ? {
      ok: exportJson.ok,
      targetId: exportJson.targetId || null,
      url: exportJson.url || null,
    } : null,
  };

  fs.mkdirSync(rawDir, { recursive: true });
  fs.writeFileSync(rawFile, JSON.stringify(payload, null, 2));

  console.log(JSON.stringify({
    key,
    rawFile,
    rows: Array.isArray(browserResult.rows) ? browserResult.rows.length : 0,
    heading: browserResult.heading || null,
    url: browserResult.url || exportJson.url || null,
  }, null, 2));
}

if (require.main === module) {
  main();
}
