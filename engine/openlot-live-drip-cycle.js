#!/usr/bin/env node
// Small controlled production-style drip wrapper on top of the live combined batch flow.
// Intended to keep suburb count intentionally low while making cadence/queue naming explicit.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

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
  console.error('Usage: node engine/openlot-live-drip-cycle.js --states <csv> [--cycleName <name>] [--maxSuburbs <n>] [--mode delta|test] [--sources <csv>] [--output <summary.json>]');
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
  const states = String(args.states || 'VIC,NSW,QLD,WA,SA,TAS,NT,ACT');
  const cycleName = String(args.cycleName || 'midday');
  const mode = String(args.mode || 'delta').toLowerCase();
  const maxSuburbs = Math.max(1, Number(args.maxSuburbs || 1));
  const sources = String(args.sources || 'domain,openlot,rea');
  const stamp = `${cycleName}-${new Date().toISOString().slice(0,10)}`;
  const queuePrefix = `drip-${cycleName}`;

  const batch = runNode('engine/openlot-live-combined-batch.js', [
    '--states', states,
    '--maxSuburbs', String(maxSuburbs),
    '--sources', sources,
    '--mode', mode,
    '--runStampPrefix', stamp,
    '--queuePrefix', queuePrefix,
    '--output', path.resolve(`./tmp/openlot-live-drip-cycle-${cycleName}.json`),
  ]);

  const summary = {
    cycleName,
    mode,
    states: states.split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
    maxSuburbs,
    queuePrefix,
    runStampPrefix: stamp,
    sources: sources.split(',').map(s => s.trim()).filter(Boolean),
    batch,
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
