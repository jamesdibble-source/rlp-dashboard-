#!/usr/bin/env node
// Build a machine-readable manifest for a canonical OpenLot payload directory.

const fs = require('fs');
const path = require('path');
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

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dir = args.dir || args.path;
  const output = args.output || args.out;
  if (!dir || !output) {
    console.error('Usage: node engine/build-openlot-payload-manifest.js --dir <payload-dir> --output <manifest.json>');
    process.exit(1);
  }

  const resolvedDir = path.resolve(dir);
  const manifest = {
    generatedAt: new Date().toISOString(),
    dir: resolvedDir,
    count: 0,
    payloads: [],
  };

  manifest.payloads = listPayloads(resolvedDir);
  manifest.count = manifest.payloads.length;

  const resolvedOutput = path.resolve(output);
  fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
  fs.writeFileSync(resolvedOutput, JSON.stringify(manifest, null, 2));

  console.log(JSON.stringify({ output: resolvedOutput, count: manifest.count }, null, 2));
}

if (require.main === module) {
  main();
}
