#!/usr/bin/env node
// List canonical OpenLot payload files in a directory for operator auditing / targeted queue runs.

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    out[arg.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return out;
}

function listPayloads(dir) {
  if (!fs.existsSync(dir)) {
    throw new Error(`Payload directory not found: ${dir}`);
  }

  return fs.readdirSync(dir)
    .filter(name => name.endsWith('.json'))
    .map(name => {
      const filePath = path.join(dir, name);
      const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return {
        key: path.basename(name, '.json'),
        file: filePath,
        count: Number(payload.count || (Array.isArray(payload.rows) ? payload.rows.length : 0)),
        heading: payload.heading || null,
        url: payload.url || null,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dir = args.dir || args.path;
  if (!dir) {
    console.error('Usage: node engine/list-openlot-payloads.js --dir <payload-dir>');
    process.exit(1);
  }

  const payloads = listPayloads(path.resolve(dir));
  console.log(JSON.stringify({ dir: path.resolve(dir), count: payloads.length, payloads }, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = { listPayloads };
