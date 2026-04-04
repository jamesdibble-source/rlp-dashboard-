#!/usr/bin/env node
// Convert a raw OpenLot browser-result export directly into:
// 1) canonical raw-batch file
// 2) canonical payload file(s)
// 3) manifest for queue-runner ingestion
// This is the first-class handoff between browser execution/export and queue ingestion prep.

const fs = require('fs');
const path = require('path');
const { buildTargetKey } = require('./scrapers/openlot-browser-runner');
const { normalizePayload, unwrapBrowserResult } = require('./normalize-openlot-browser-result');
const { saveBrowserPayload } = require('./scrapers/openlot-browser-runner');
const { listPayloads } = require('./list-openlot-payloads');

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
  console.error('Usage: node engine/openlot-browser-export-pipeline.js --input <raw.json> --rawDir <raw-batch-dir> --payloadDir <payload-dir> --manifest <manifest.json> --suburb <name> --state <state> --postcode <postcode>');
  process.exit(1);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.rawDir || !args.payloadDir || !args.manifest || !args.suburb || !args.state || !args.postcode) usage();

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
  if (!key) throw new Error('Could not derive target key');

  const rawDir = path.resolve(args.rawDir);
  const payloadDir = path.resolve(args.payloadDir);
  const manifestPath = path.resolve(args.manifest);

  fs.mkdirSync(rawDir, { recursive: true });
  fs.mkdirSync(payloadDir, { recursive: true });
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });

  const raw = JSON.parse(fs.readFileSync(input, 'utf8'));
  const browserResult = unwrapBrowserResult(raw);
  const rawSaved = {
    ...browserResult,
    target,
    savedAt: new Date().toISOString(),
    browserToolEnvelope: raw && typeof raw === 'object' && raw.result ? {
      ok: raw.ok,
      targetId: raw.targetId || null,
      url: raw.url || null,
    } : null,
  };
  const rawFilePath = path.join(rawDir, `${key}.json`);
  fs.writeFileSync(rawFilePath, JSON.stringify(rawSaved, null, 2));

  const payload = normalizePayload(rawSaved);
  const payloadSaved = saveBrowserPayload(payload, target, payloadDir);

  const manifest = {
    generatedAt: new Date().toISOString(),
    rawDir,
    dir: payloadDir,
    count: 0,
    payloads: listPayloads(payloadDir),
  };
  manifest.count = manifest.payloads.length;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(JSON.stringify({
    key,
    rawFilePath,
    rawRows: Array.isArray(browserResult.rows) ? browserResult.rows.length : 0,
    payloadFilePath: payloadSaved.filePath,
    payloadCount: payload.count,
    manifest: manifestPath,
    manifestCount: manifest.count,
  }, null, 2));
}

if (require.main === module) {
  main();
}
