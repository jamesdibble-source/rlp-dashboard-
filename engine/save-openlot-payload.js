#!/usr/bin/env node
// Save a captured OpenLot browser payload into the canonical queue-ingest directory structure.

const fs = require('fs');
const path = require('path');
const { saveBrowserPayload } = require('./scrapers/openlot-browser-runner');

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
  console.error('Usage: node engine/save-openlot-payload.js --input <payload.json> --dir <output-dir> --suburb <name> --state <state> --postcode <postcode>');
  process.exit(1);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.dir || !args.suburb || !args.state || !args.postcode) usage();
  if (!fs.existsSync(args.input)) {
    throw new Error(`Input payload file not found: ${args.input}`);
  }

  const payload = JSON.parse(fs.readFileSync(args.input, 'utf8'));
  if (!payload || !Array.isArray(payload.rows)) {
    throw new Error('Input payload must be a single OpenLot browser result object containing a rows array');
  }

  const result = saveBrowserPayload(payload, {
    suburb: args.suburb,
    state: args.state,
    postcode: String(args.postcode),
  }, path.resolve(args.dir));

  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main();
}
