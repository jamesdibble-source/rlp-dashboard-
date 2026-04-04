#!/usr/bin/env node
// Controlled multi-suburb batch/drip wrapper for the real OpenLot live path.
// Runs the stamped live OpenLot capture->ingest flow suburb-by-suburb, then immediately
// runs the shared combined queue job for each target using the generated manifest.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { loadActiveSuburbs } = require('./queue-runner');

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
  console.error('Usage: node engine/openlot-live-combined-batch.js --states <csv> [--mode test|delta|bulk] [--maxSuburbs <n>] [--suburb <name>] [--state <state>] [--postcode <code>] [--sources <csv>] [--runStampPrefix <prefix>] [--queuePrefix <prefix>] [--output <summary.json>]');
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

function resolveTargets(args) {
  if (args.suburb && args.state && args.postcode) {
    return [{ suburb: String(args.suburb).trim(), state: String(args.state).toUpperCase().trim(), postcode: String(args.postcode).trim() }];
  }

  const states = String(args.states || 'VIC,NSW,QLD,WA,SA,TAS,NT,ACT')
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);

  const rows = loadActiveSuburbs(states, {
    suburb: args.suburb || null,
    state: args.state || null,
    postcode: args.postcode || null,
  });

  const maxSuburbs = Math.max(1, Number(args.maxSuburbs || 1));
  return rows.slice(0, maxSuburbs).map(row => ({
    suburb: String(row.suburb || '').trim(),
    state: String(row.state || '').toUpperCase().trim(),
    postcode: String(row.postcode || '').trim(),
  }));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const targets = resolveTargets(args);
  if (!targets.length) usage();

  const mode = String(args.mode || 'test').toLowerCase();
  const sources = String(args.sources || 'domain,openlot,rea');
  const runStampPrefix = String(args.runStampPrefix || 'batch');
  const queuePrefix = String(args.queuePrefix || 'combined-live-batch');
  const results = [];

  targets.forEach((target, index) => {
    const targetSlug = `${target.state.toLowerCase()}-${target.suburb.toLowerCase().replace(/\s+/g, '-')}-${target.postcode}`;
    const runStamp = `${runStampPrefix}-${index + 1}-${targetSlug}`;
    const outputPath = path.resolve(`./tmp/openlot-live-combined-batch-${index + 1}.json`);
    const queueName = `${queuePrefix}-${mode}-${index + 1}-${targetSlug}`;

    const result = runNode('engine/openlot-live-combined-suburb-job.js', [
      '--suburb', target.suburb,
      '--state', target.state,
      '--postcode', target.postcode,
      '--sources', sources,
      '--mode', mode,
      '--runStamp', runStamp,
      '--queueName', queueName,
      '--output', outputPath,
    ]);

    results.push({
      target,
      runStamp,
      queueName,
      output: outputPath,
      combinedQueueName: result.combinedQueueName,
      combined: result.combined,
      live: {
        runDir: result.runDir,
        browserExportFile: result.live?.browserExportFile || null,
        manifest: result.live?.manifest || null,
      },
    });
  });

  const summary = {
    mode,
    queuePrefix,
    sources: sources.split(',').map(s => s.trim()).filter(Boolean),
    targetCount: results.length,
    results,
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
