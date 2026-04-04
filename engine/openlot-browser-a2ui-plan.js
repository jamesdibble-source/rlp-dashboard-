#!/usr/bin/env node
// Convert the browser-act plan into a JSONL-style action bundle suitable for an external browser executor.
// This is the final non-tooling artifact before a true automated loop consumes the plan.

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

function usage() {
  console.error('Usage: node engine/openlot-browser-a2ui-plan.js --input <act-plan.json> [--output <plan.jsonl>]');
  process.exit(1);
}

function toJsonlRecords(plan) {
  const out = [];
  for (const step of plan.actPlan || []) {
    if (step.kind === 'open') {
      out.push({ action: 'open', url: step.url });
      continue;
    }
    if (step.kind === 'snapshot-ref') {
      out.push({ action: 'snapshot', label: step.label });
      if (step.then?.kind === 'click') {
        out.push({ action: 'click', label: step.then.label });
      } else if (step.then?.kind === 'select') {
        out.push({ action: 'select', label: step.then.label, value: step.then.value });
      } else if (step.then?.kind === 'type') {
        out.push({ action: 'type', label: step.then.label, value: step.then.value });
      } else if (step.then?.kind === 'clickSuggestion') {
        out.push({ action: 'clickSuggestion', value: step.then.value, variants: Array.isArray(step.then.variants) ? step.then.variants : undefined });
      }
      continue;
    }
    if (step.kind === 'evaluate') {
      out.push({ action: 'evaluate', outputFile: step.outputFile, extractor: step.extractor });
      continue;
    }
    out.push({ action: 'unknown', original: step });
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) usage();

  const input = path.resolve(args.input);
  if (!fs.existsSync(input)) throw new Error(`Input file not found: ${input}`);
  const plan = JSON.parse(fs.readFileSync(input, 'utf8'));
  const records = toJsonlRecords(plan);
  const jsonl = records.map(r => JSON.stringify(r)).join('\n') + '\n';

  if (args.output) {
    const output = path.resolve(args.output);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, jsonl);
  }

  console.log(JSON.stringify({
    key: plan.key,
    queueName: plan.queueName,
    records: records.length,
    output: args.output ? path.resolve(args.output) : null,
    saveCommand: plan.saveCommand,
    ingestCommand: plan.ingestCommand,
  }, null, 2));
}

if (require.main === module) {
  main();
}
