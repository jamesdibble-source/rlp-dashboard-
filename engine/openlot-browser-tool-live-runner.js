#!/usr/bin/env node
// Build a concrete browser-tool live-run plan for OpenLot.
// This does not execute the browser itself; it emits the exact sequence needed for a live run:
// - open the wizard
// - progress through the filters
// - extract rows on the results page
// - save browser export to canonical path
// - ingest through the one-command pipeline

const path = require('path');
const openlot = require('./scrapers/openlot-public');
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
  console.error('Usage: node engine/openlot-browser-tool-live-runner.js --suburb <name> --state <state> --postcode <postcode> [--browserExportFile <file>] [--rawDir <dir>] [--payloadDir <dir>] [--manifest <file>] [--queueName <name>]');
  process.exit(1);
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function buildSuggestionVariants(target) {
  const suburb = String(target.suburb || '').trim();
  const state = String(target.state || '').trim().toUpperCase();
  const postcode = String(target.postcode || '').trim();
  return Array.from(new Set([
    [suburb, state, postcode].filter(Boolean).join(' '),
    [suburb, postcode].filter(Boolean).join(' '),
    [suburb, state].filter(Boolean).join(' '),
    suburb,
  ].map(value => String(value || '').replace(/\s+/g, ' ').trim()).filter(Boolean)));
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
  const plan = openlot.getDriverPlan(target, {
    minLandSize: 0,
    maxLandSize: 2000,
    minPrice: 20000,
    maxPrice: 5000000,
  });

  const browserExportFile = path.resolve(args.browserExportFile || './tmp/openlot-browser-export-live.json');
  const rawDir = path.resolve(args.rawDir || './tmp/openlot-raw-batch-live');
  const payloadDir = path.resolve(args.payloadDir || './tmp/openlot-payloads-live');
  const manifest = path.resolve(args.manifest || path.join(payloadDir, 'manifest.json'));
  const queueName = args.queueName || `openlot-live-browser-run-${target.state.toLowerCase()}-${target.suburb.toLowerCase().replace(/\s+/g, '-')}-${target.postcode}`;

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

  const suggestionVariants = buildSuggestionVariants(target);

  const browserSequence = [
    { step: 1, action: 'open', url: plan.startUrl },
    { step: 2, action: 'click', label: 'Continue' },
    { step: 3, action: 'click', label: 'Land for Sale' },
    { step: 4, action: 'select', label: 'Min Price', value: '$50k' },
    { step: 5, action: 'select', label: 'Max Price', value: '$5M' },
    { step: 6, action: 'click', label: 'Next' },
    { step: 7, action: 'select', label: 'Max Size', value: '2,000 m²' },
    { step: 8, action: 'click', label: 'Next' },
    { step: 9, action: 'type', label: 'Search suburb, postcode or council...', value: `${target.suburb} ${target.state} ${target.postcode}` },
    { step: 10, action: 'chooseSuggestion', value: suggestionVariants[0], variants: suggestionVariants },
    { step: 11, action: 'click', label: 'Search' },
    { step: 12, action: 'evaluate', outputFile: browserExportFile, extractor: buildBrowserResultExtractor() },
  ];

  console.log(JSON.stringify({
    target,
    key,
    startUrl: plan.startUrl,
    browserExportFile,
    rawDir,
    payloadDir,
    manifest,
    queueName,
    browserSequence,
    saveCommand,
    ingestCommand,
  }, null, 2));
}

if (require.main === module) {
  main();
}
