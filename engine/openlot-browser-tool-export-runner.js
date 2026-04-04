#!/usr/bin/env node
// Build a browser-tool oriented OpenLot export handoff plan.
// This gives operators/automation one object containing:
// - the browser-side extractor JS
// - the canonical output paths/keys
// - the exact follow-up pipeline command to turn the export into queue-ready artifacts

const path = require('path');
const { buildBrowserResultExtractor } = require('./scrapers/openlot-driver');
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
  console.error('Usage: node engine/openlot-browser-tool-export-runner.js --suburb <name> --state <state> --postcode <postcode> [--rawDir <dir>] [--payloadDir <dir>] [--manifest <file>]');
  process.exit(1);
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.suburb || !args.state || !args.postcode) usage();

  const target = {
    suburb: String(args.suburb).trim(),
    state: String(args.state).toUpperCase().trim(),
    postcode: String(args.postcode).trim(),
  };

  const key = buildTargetKey(target);
  const rawDir = path.resolve(args.rawDir || './tmp/openlot-raw-batch-live');
  const payloadDir = path.resolve(args.payloadDir || './tmp/openlot-payloads-live');
  const manifestPath = path.resolve(args.manifest || path.join(payloadDir, 'manifest.json'));
  const rawFile = path.join(rawDir, `${key}.json`);

  const pipelineCommand = [
    'node engine/openlot-browser-export-pipeline.js',
    `--input ${shellQuote(rawFile)}`,
    `--rawDir ${shellQuote(rawDir)}`,
    `--payloadDir ${shellQuote(payloadDir)}`,
    `--manifest ${shellQuote(manifestPath)}`,
    `--suburb ${shellQuote(target.suburb)}`,
    `--state ${shellQuote(target.state)}`,
    `--postcode ${shellQuote(target.postcode)}`,
  ].join(' ');

  console.log(JSON.stringify({
    target,
    key,
    rawDir,
    rawFile,
    payloadDir,
    manifest: manifestPath,
    extractor: buildBrowserResultExtractor(),
    pipelineCommand,
  }, null, 2));
}

if (require.main === module) {
  main();
}
