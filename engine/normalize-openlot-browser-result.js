#!/usr/bin/env node
// Normalize raw browser-extracted OpenLot result rows into the canonical payload shape,
// then save them into the canonical queue-ingest directory structure.

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
  console.error('Usage: node engine/normalize-openlot-browser-result.js --input <raw.json> --dir <output-dir> --suburb <name> --state <state> --postcode <postcode>');
  process.exit(1);
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function unwrapBrowserResult(raw = {}) {
  if (raw && typeof raw === 'object' && raw.result && typeof raw.result === 'object') {
    return raw.result;
  }
  return raw;
}

function normalizePayload(raw = {}) {
  const source = unwrapBrowserResult(raw);
  const rows = Array.isArray(source.rows) ? source.rows : Array.isArray(source) ? source : [];
  const deduped = Array.from(new Map(rows.map((row, index) => {
    const normalized = {
      estate: row.estate || null,
      title: clean(row.title || ''),
      lotLabel: clean(row.lotLabel || '' ) || null,
      priceText: clean(row.priceText || '' ) || null,
      landSizeText: clean(row.landSizeText || '' ) || null,
      frontageText: clean(row.frontageText || '' ) || null,
      depthText: clean(row.depthText || '' ) || null,
      suburbText: clean(row.suburbText || '' ) || null,
      status: clean(row.status || 'Available') || 'Available',
      href: row.href || row.url || null,
    };
    const key = JSON.stringify([normalized.href, normalized.lotLabel, normalized.priceText, normalized.landSizeText, index]);
    return [key, normalized];
  })).values());

  return {
    title: source.title || raw.title || null,
    url: source.url || raw.url || null,
    heading: source.heading || raw.heading || null,
    count: deduped.length,
    rows: deduped.filter(row => row.href),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.dir || !args.suburb || !args.state || !args.postcode) usage();
  if (!fs.existsSync(args.input)) {
    throw new Error(`Input raw browser result file not found: ${args.input}`);
  }

  const raw = JSON.parse(fs.readFileSync(args.input, 'utf8'));
  const payload = normalizePayload(raw);
  const result = saveBrowserPayload(payload, {
    suburb: args.suburb,
    state: args.state,
    postcode: String(args.postcode),
  }, path.resolve(args.dir));

  console.log(JSON.stringify({ ...result, count: payload.count }, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = { normalizePayload, unwrapBrowserResult };
