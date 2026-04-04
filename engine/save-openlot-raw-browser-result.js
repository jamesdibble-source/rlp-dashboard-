#!/usr/bin/env node
// Save a raw OpenLot browser-result JSON object into the canonical batch-prep input directory.
// This is the handoff point between browser automation output and prepare-openlot-payload-batch.js.

const fs = require('fs');
const path = require('path');
const { buildTargetKey } = require('./scrapers/openlot-browser-runner');

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
  console.error('Usage: node engine/save-openlot-raw-browser-result.js --input <raw.json> --dir <raw-batch-dir> --suburb <name> --state <state> --postcode <postcode>');
  process.exit(1);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.dir || !args.suburb || !args.state || !args.postcode) usage();

  const input = path.resolve(args.input);
  const dir = path.resolve(args.dir);
  if (!fs.existsSync(input)) {
    throw new Error(`Input file not found: ${input}`);
  }

  const raw = JSON.parse(fs.readFileSync(input, 'utf8'));
  const target = {
    suburb: String(args.suburb).trim(),
    state: String(args.state).toUpperCase().trim(),
    postcode: String(args.postcode).trim(),
  };
  const key = buildTargetKey(target);
  if (!key) {
    throw new Error('Could not derive key from target');
  }

  const payload = {
    ...raw,
    target,
    savedAt: new Date().toISOString(),
  };

  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${key}.json`);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));

  console.log(JSON.stringify({ key, filePath, rows: Array.isArray(raw.rows) ? raw.rows.length : 0 }, null, 2));
}

if (require.main === module) {
  main();
}
