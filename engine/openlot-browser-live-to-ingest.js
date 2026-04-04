#!/usr/bin/env node
// Run the live OpenLot browser executor and feed its exported rows straight into
// the one-command ingest helper with minimal/no manual handoff.
//
// Default flow:
// 1) build live runner plan
// 2) convert to act plan
// 3) convert to JSONL/A2UI plan
// 4) execute against local OpenClaw browser CLI
// 5) ingest the saved browser export into queue-runner
//
// Verification/support mode:
// --skipBrowser reuses an existing browserExportFile and runs only the ingest half.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildTargetKey } = require('./scrapers/openlot-browser-runner');
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
  console.error('Usage: node engine/openlot-browser-live-to-ingest.js --suburb <name> --state <state> --postcode <postcode> [--browserExportFile <file>] [--rawDir <dir>] [--payloadDir <dir>] [--manifest <file>] [--queueName <name>] [--mode <mode>] [--snapshotFormat ai|aria] [--snapshotOutDir <dir>] [--output <summary.json>] [--skipBrowser] [--skipIngest]');
  process.exit(1);
}

function resolveTarget(args) {
  return {
    suburb: String(args.suburb).trim(),
    state: String(args.state).toUpperCase().trim(),
    postcode: String(args.postcode).trim(),
  };
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

function ensureFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

function buildPaths(target, args) {
  const key = buildTargetKey(target);
  const livePaths = buildLivePaths(target, args);
  const queueName = args.queueName || `openlot-live-browser-run-${livePaths.slug}`;
  const mode = args.mode || 'test';
  const snapshotFormat = args.snapshotFormat === 'aria' ? 'aria' : 'ai';
  const liveRunner = path.join(livePaths.workDir, 'live-runner.json');
  const actPlan = path.join(livePaths.workDir, 'act-plan.json');
  const a2uiPlan = path.join(livePaths.workDir, 'a2ui-plan.jsonl');
  const execution = path.join(livePaths.workDir, 'cli-execution.json');
  return {
    key,
    queueName,
    mode,
    snapshotFormat,
    liveRunner,
    actPlan,
    a2uiPlan,
    execution,
    ...livePaths,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.suburb || !args.state || !args.postcode) usage();

  const target = resolveTarget(args);
  const paths = buildPaths(target, args);
  fs.mkdirSync(paths.workDir, { recursive: true });

  let livePlan = null;
  let actPlan = null;
  let a2uiPlan = null;
  let browserExecution = null;

  if (!args.skipBrowser) {
    livePlan = runNode('engine/openlot-browser-tool-live-runner.js', [
      '--suburb', target.suburb,
      '--state', target.state,
      '--postcode', target.postcode,
      '--browserExportFile', paths.browserExportFile,
      '--rawDir', paths.rawDir,
      '--payloadDir', paths.payloadDir,
      '--manifest', paths.manifest,
      '--queueName', paths.queueName,
    ]);
    fs.writeFileSync(paths.liveRunner, JSON.stringify(livePlan, null, 2));

    actPlan = runNode('engine/openlot-browser-act-plan.js', [
      '--input', paths.liveRunner,
      '--output', paths.actPlan,
    ]);

    a2uiPlan = runNode('engine/openlot-browser-a2ui-plan.js', [
      '--input', paths.actPlan,
      '--output', paths.a2uiPlan,
    ]);

    browserExecution = runNode('engine/openlot-browser-a2ui-runner.js', [
      '--input', paths.a2uiPlan,
      '--adapter', 'openclaw-cli-executor',
      '--snapshotFormat', paths.snapshotFormat,
      '--snapshotOutDir', paths.snapshotOutDir,
      '--output', paths.execution,
    ]);

    ensureFileExists(paths.browserExportFile, 'Browser export file');
  } else {
    ensureFileExists(paths.browserExportFile, 'Existing browser export file');
  }

  const exported = runNode('engine/openlot-browser-export-pipeline.js', [
    '--input', paths.browserExportFile,
    '--rawDir', paths.rawDir,
    '--payloadDir', paths.payloadDir,
    '--manifest', paths.manifest,
    '--suburb', target.suburb,
    '--state', target.state,
    '--postcode', target.postcode,
  ]);

  let ingest = null;
  if (!args.skipIngest) {
    ingest = runNode('engine/queue-runner.js', [
      '--states', target.state,
      '--suburb', target.suburb,
      '--state', target.state,
      '--postcode', target.postcode,
      '--sources', 'openlot',
      '--mode', paths.mode,
      '--maxJobs', '1',
      '--queueName', paths.queueName,
      '--openlotBrowserResultsManifest', paths.manifest,
    ]);
  }

  const summary = {
    target,
    key: paths.key,
    mode: paths.mode,
    skipBrowser: Boolean(args.skipBrowser),
    skipIngest: Boolean(args.skipIngest),
    browserExportFile: paths.browserExportFile,
    rawDir: paths.rawDir,
    payloadDir: paths.payloadDir,
    manifest: paths.manifest,
    queueName: paths.queueName,
    snapshotFormat: paths.snapshotFormat,
    runDir: paths.runDir,
    runStamp: paths.runStamp,
    snapshotOutDir: args.skipBrowser ? null : paths.snapshotOutDir,
    artifacts: {
      liveRunner: args.skipBrowser ? null : paths.liveRunner,
      actPlan: args.skipBrowser ? null : paths.actPlan,
      a2uiPlan: args.skipBrowser ? null : paths.a2uiPlan,
      execution: args.skipBrowser ? null : paths.execution,
    },
    browserExecution,
    exported,
    ingest,
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
