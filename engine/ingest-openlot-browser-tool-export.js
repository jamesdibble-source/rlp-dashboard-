#!/usr/bin/env node
// One-command ingest path for a browser-tool extractor JSON export.
// This bridges browser-side extractor output straight through:
// save canonical raw export -> build canonical payload/manifest -> queue-runner ingest.

const { execFileSync } = require('child_process');
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

function usage() {
  console.error('Usage: node engine/ingest-openlot-browser-tool-export.js --input <browser-export.json> --suburb <name> --state <state> --postcode <postcode> [--rawDir <dir>] [--payloadDir <dir>] [--manifest <file>] [--queueName <name>] [--mode <mode>]');
  process.exit(1);
}

function extractLastJson(stdout) {
  const text = String(stdout || '').trim();
  const start = text.lastIndexOf('\n{');
  const candidate = start >= 0 ? text.slice(start + 1) : text;
  return JSON.parse(candidate);
}

function runNode(script, args) {
  const stdout = execFileSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  return extractLastJson(stdout);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.suburb || !args.state || !args.postcode) usage();

  const suburb = String(args.suburb).trim();
  const state = String(args.state).toUpperCase().trim();
  const postcode = String(args.postcode).trim();
  const rawDir = path.resolve(args.rawDir || './tmp/openlot-raw-batch-ingest');
  const payloadDir = path.resolve(args.payloadDir || './tmp/openlot-payloads-ingest');
  const manifest = path.resolve(args.manifest || path.join(payloadDir, 'manifest.json'));
  const queueName = args.queueName || `openlot-browser-tool-ingest-${state.toLowerCase()}-${suburb.toLowerCase().replace(/\s+/g, '-')}-${postcode}`;
  const mode = args.mode || 'test';

  const saved = runNode('engine/save-openlot-browser-tool-export.js', [
    '--input', path.resolve(args.input),
    '--rawDir', rawDir,
    '--suburb', suburb,
    '--state', state,
    '--postcode', postcode,
  ]);

  const exported = runNode('engine/openlot-browser-export-pipeline.js', [
    '--input', saved.rawFile,
    '--rawDir', rawDir,
    '--payloadDir', payloadDir,
    '--manifest', manifest,
    '--suburb', suburb,
    '--state', state,
    '--postcode', postcode,
  ]);

  const ingested = runNode('engine/queue-runner.js', [
    '--states', state,
    '--suburb', suburb,
    '--state', state,
    '--postcode', postcode,
    '--sources', 'openlot',
    '--mode', mode,
    '--maxJobs', '1',
    '--queueName', queueName,
    '--openlotBrowserResultsManifest', manifest,
  ]);

  console.log(JSON.stringify({ saved, exported, ingested }, null, 2));
}

if (require.main === module) {
  main();
}
