#!/usr/bin/env node
// Batch-normalize raw OpenLot browser row files into canonical payloads,
// then build a manifest for queue ingestion.

const fs = require('fs');
const path = require('path');
const { normalizePayload } = require('./normalize-openlot-browser-result');
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
  console.error('Usage: node engine/prepare-openlot-payload-batch.js --inputDir <raw-dir> --outputDir <payload-dir> --manifest <manifest.json>');
  console.error('Raw JSON filenames must be <STATE>:<Suburb>:<Postcode>.json or provide suburb/state/postcode in the file body.');
  process.exit(1);
}

function parseTargetFromFilename(name) {
  const base = path.basename(name, '.json');
  const match = base.match(/^([A-Za-z]{2,3}):(.*?):(\d{4})$/);
  if (!match) return null;
  return {
    state: match[1].toUpperCase(),
    suburb: match[2],
    postcode: match[3],
  };
}

function resolveTarget(raw, name) {
  const fromFile = parseTargetFromFilename(name) || {};
  const fromBody = raw.target || {};
  const suburb = fromBody.suburb || raw.suburb || fromFile.suburb;
  const state = (fromBody.state || raw.state || fromFile.state || '').toUpperCase();
  const postcode = String(fromBody.postcode || raw.postcode || fromFile.postcode || '');
  if (!suburb || !state || !postcode) {
    throw new Error(`Could not resolve suburb/state/postcode for ${name}`);
  }
  return { suburb, state, postcode };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputDir = args.inputDir || args.inDir;
  const outputDir = args.outputDir || args.outDir || args.dir;
  const manifestPath = args.manifest || args.output;
  if (!inputDir || !outputDir || !manifestPath) usage();

  const resolvedInput = path.resolve(inputDir);
  const resolvedOutput = path.resolve(outputDir);
  const resolvedManifest = path.resolve(manifestPath);

  if (!fs.existsSync(resolvedInput)) {
    throw new Error(`Input directory not found: ${resolvedInput}`);
  }

  fs.mkdirSync(resolvedOutput, { recursive: true });

  const files = fs.readdirSync(resolvedInput)
    .filter(name => name.endsWith('.json'))
    .sort();

  const results = [];
  for (const name of files) {
    const fullPath = path.join(resolvedInput, name);
    const raw = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    const target = resolveTarget(raw, name);
    const payload = normalizePayload(raw);
    const saved = saveBrowserPayload(payload, target, resolvedOutput);
    results.push({ input: fullPath, ...saved, count: payload.count });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    inputDir: resolvedInput,
    dir: resolvedOutput,
    count: 0,
    payloads: listPayloads(resolvedOutput),
  };
  manifest.count = manifest.payloads.length;

  fs.mkdirSync(path.dirname(resolvedManifest), { recursive: true });
  fs.writeFileSync(resolvedManifest, JSON.stringify(manifest, null, 2));

  console.log(JSON.stringify({
    inputDir: resolvedInput,
    outputDir: resolvedOutput,
    manifest: resolvedManifest,
    processed: results.length,
    payloads: manifest.count,
    results,
  }, null, 2));
}

if (require.main === module) {
  main();
}
