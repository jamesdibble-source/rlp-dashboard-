#!/usr/bin/env node
// Run a real OpenLot live capture->ingest cycle first, then execute the shared
// combined-source suburb queue job using the generated OpenLot manifest.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildLivePaths } = require('./lib/openlot-live-paths');

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
  console.error('Usage: node engine/openlot-live-combined-suburb-job.js --suburb <name> --state <state> --postcode <postcode> [--sources <csv>] [--mode <mode>] [--queueName <name>] [--runStamp <stamp>] [--output <summary.json>]');
  process.exit(1);
}

function extractLastJson(stdout) {
  const text = String(stdout || '').trim();
  const start = text.lastIndexOf('\n{');
  const candidate = start >= 0 ? text.slice(start + 1) : text;
  return JSON.parse(candidate);
}

function runNode(script, args) {
  const stdout = execFileSync(process.execPath, [script, ...args], { encoding: 'utf8', cwd: process.cwd() });
  return extractLastJson(stdout);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.suburb || !args.state || !args.postcode) usage();

  const suburb = String(args.suburb).trim();
  const state = String(args.state).toUpperCase().trim();
  const postcode = String(args.postcode).trim();
  const mode = String(args.mode || 'test').toLowerCase();
  const livePaths = buildLivePaths({ suburb, state, postcode }, args);
  const openlotQueueName = args.openlotQueueName || `openlot-live-browser-run-${livePaths.slug}`;
  const combinedQueueName = args.queueName || `combined-live-${livePaths.slug}-${livePaths.runStamp}`;
  const combinedSources = String(args.sources || 'domain,openlot,rea');

  const live = runNode('engine/openlot-browser-live-to-ingest.js', [
    '--suburb', suburb,
    '--state', state,
    '--postcode', postcode,
    '--queueName', openlotQueueName,
    '--mode', mode,
    '--runStamp', livePaths.runStamp,
    '--liveRoot', livePaths.liveRoot,
    '--skipIngest',
  ]);

  const manifest = live?.manifest;
  if (!manifest || !fs.existsSync(manifest)) {
    throw new Error(`Generated OpenLot manifest not found: ${manifest || 'null'}`);
  }

  const combined = runNode('engine/queue-runner.js', [
    '--states', state,
    '--suburb', suburb,
    '--state', state,
    '--postcode', postcode,
    '--sources', combinedSources,
    '--mode', mode,
    '--maxJobs', '1',
    '--queueName', combinedQueueName,
    '--openlotBrowserResultsManifest', manifest,
  ]);

  const summary = {
    target: { suburb, state, postcode },
    mode,
    openlotQueueName,
    combinedQueueName,
    sources: combinedSources.split(',').map(s => s.trim()).filter(Boolean),
    live,
    runDir: livePaths.runDir,
    runStamp: livePaths.runStamp,
    combined,
  };

  if (args.output) {
    const output = path.resolve(args.output);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(summary, null, 2));
    summary.output = output;
  }

  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  main();
}
