#!/usr/bin/env node
// Produce a single operator/automation bundle for live OpenLot browser capture.
// The bundle includes:
// - target identity and canonical file paths
// - browser-side extractor JS
// - the exact save-browser-tool-export command
// - the exact one-command ingest command
// This is the final planning layer before fully automated browser execution.

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
  console.error('Usage: node engine/openlot-live-browser-capture-bundle.js --suburb <name> --state <state> --postcode <postcode> [--browserExportFile <file>] [--rawDir <dir>] [--payloadDir <dir>] [--manifest <file>] [--queueName <name>]');
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
  const browserExportFile = path.resolve(args.browserExportFile || './tmp/openlot-browser-export-live.json');
  const rawDir = path.resolve(args.rawDir || './tmp/openlot-raw-batch-live');
  const payloadDir = path.resolve(args.payloadDir || './tmp/openlot-payloads-live');
  const manifest = path.resolve(args.manifest || path.join(payloadDir, 'manifest.json'));
  const queueName = args.queueName || `openlot-live-browser-capture-${target.state.toLowerCase()}-${target.suburb.toLowerCase().replace(/\s+/g, '-')}-${target.postcode}`;

  const saveCommand = [
    'node engine/save-openlot-browser-tool-export.js',
    `--input ${shellQuote(browserExportFile)}`,
    `--rawDir ${shellQuote(rawDir)}`,
    `--suburb ${shellQuote(target.suburb)}`,
    `--state ${shellQuote(target.state)}`,
    `--postcode ${shellQuote(target.postcode)}`,
  ].join(' ');

  const ingestCommand = [
    'node engine/ingest-openlot-browser-tool-export.js',
    `--input ${shellQuote(browserExportFile)}`,
    `--suburb ${shellQuote(target.suburb)}`,
    `--state ${shellQuote(target.state)}`,
    `--postcode ${shellQuote(target.postcode)}`,
    `--rawDir ${shellQuote(rawDir)}`,
    `--payloadDir ${shellQuote(payloadDir)}`,
    `--manifest ${shellQuote(manifest)}`,
    `--queueName ${shellQuote(queueName)}`,
  ].join(' ');

  console.log(JSON.stringify({
    target,
    key,
    browserExportFile,
    rawDir,
    payloadDir,
    manifest,
    queueName,
    extractor: buildBrowserResultExtractor(),
    saveCommand,
    ingestCommand,
  }, null, 2));
}

if (require.main === module) {
  main();
}
