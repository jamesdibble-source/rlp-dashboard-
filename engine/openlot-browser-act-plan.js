#!/usr/bin/env node
// Emit a browser-act friendly execution plan for the OpenLot live-run sequence.
// This is the closest artifact to a true executable runner without embedding OpenClaw tools in Node.

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
  console.error('Usage: node engine/openlot-browser-act-plan.js --input <live-runner.json> [--output <plan.json>]');
  process.exit(1);
}

function convertStep(step) {
  if (step.action === 'open') {
    return { kind: 'open', url: step.url };
  }
  if (step.action === 'click') {
    return { kind: 'snapshot-ref', label: step.label, then: { kind: 'click', label: step.label } };
  }
  if (step.action === 'select') {
    return { kind: 'snapshot-ref', label: step.label, then: { kind: 'select', label: step.label, value: step.value } };
  }
  if (step.action === 'type') {
    return { kind: 'snapshot-ref', label: step.label, then: { kind: 'type', label: step.label, value: step.value } };
  }
  if (step.action === 'chooseSuggestion') {
    return {
      kind: 'snapshot-ref',
      label: step.value,
      then: { kind: 'clickSuggestion', value: step.value, variants: Array.isArray(step.variants) ? step.variants : undefined },
    };
  }
  if (step.action === 'evaluate') {
    return { kind: 'evaluate', outputFile: step.outputFile, extractor: step.extractor };
  }
  return { kind: 'unknown', original: step };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) usage();

  const input = path.resolve(args.input);
  if (!fs.existsSync(input)) throw new Error(`Input file not found: ${input}`);
  const plan = JSON.parse(fs.readFileSync(input, 'utf8'));

  const out = {
    target: plan.target,
    key: plan.key,
    startUrl: plan.startUrl,
    browserExportFile: plan.browserExportFile,
    queueName: plan.queueName,
    saveCommand: plan.saveCommand,
    ingestCommand: plan.ingestCommand,
    actPlan: (plan.browserSequence || []).map(convertStep),
  };

  if (args.output) {
    const output = path.resolve(args.output);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(out, null, 2));
  }

  console.log(JSON.stringify(out, null, 2));
}

if (require.main === module) {
  main();
}
