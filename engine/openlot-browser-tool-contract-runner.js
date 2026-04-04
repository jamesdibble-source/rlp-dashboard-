#!/usr/bin/env node
// Compile or simulate an OpenLot browser plan/bundle into exact browser-tool contract calls.
// This sits one layer past openlot-browser-a2ui-runner.js:
// - compile: emit browser-tool shaped calls with refs resolved when possible
// - simulate: replay the contract deterministically against fixture snapshots/evaluate payloads

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
  console.error('Usage: node engine/openlot-browser-tool-contract-runner.js --input <plan.jsonl|bundle.json|runner-summary.json> [--mode compile|simulate] [--output <file>] [--target host|sandbox|node] [--profile user] [--targetId <id>] [--snapshotFile <file>] [--evaluateResultFile <file>]');
  process.exit(1);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseJsonl(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSONL at line ${index + 1}: ${error.message}`);
      }
    });
}

function loadInputRecords(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jsonl') {
    return {
      format: 'jsonl-plan',
      records: parseJsonl(filePath),
    };
  }

  const json = readJson(filePath);
  if (Array.isArray(json)) return { format: 'bundle-array', records: json };
  if (Array.isArray(json.bundle)) return { format: 'bundle-object', records: json.bundle, meta: json };
  if (Array.isArray(json.final?.bundle)) return { format: 'runner-summary-bundle', records: json.final.bundle, meta: json };
  if (Array.isArray(json.steps) && json.steps.every(step => step?.result?.tool === 'browser')) {
    return { format: 'runner-steps-bundle', records: json.steps.map(step => step.result), meta: json };
  }
  if (Array.isArray(json.toolCalls)) return { format: 'contract-tool-calls', records: json.toolCalls.map(entry => entry.call || entry), meta: json };

  throw new Error(`Unsupported input format for ${filePath}`);
}

function normalizeSpace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeMatch(value) {
  return normalizeSpace(value).toLowerCase();
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  const out = [];
  for (const candidate of candidates) {
    if (!candidate?.ref) continue;
    const key = JSON.stringify([candidate.ref, candidate.role || '', candidate.label || '']);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
  }
  return out;
}

function parseAriaSnapshotText(raw) {
  const text = String(raw || '');
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const candidates = [];

  for (const line of lines) {
    const refMatch = line.match(/\[ref=(e[^\]\s]+)\]/i) || line.match(/\b(e\d+)\b/);
    if (!refMatch) continue;
    const ref = refMatch[1];
    const refToken = refMatch[0];
    const withoutRef = line.replace(refToken, ' ').replace(/[\[\]]/g, ' ');
    const roleMatch = withoutRef.match(/\b(button|link|option|textbox|combobox|checkbox|radio|menuitem|listbox|dialog|heading|tab|cell|row|article|input|select)\b/i);
    let label = withoutRef;
    if (roleMatch) label = withoutRef.slice(roleMatch.index + roleMatch[0].length);
    label = normalizeSpace(label.replace(/^[:\-–—]+/, ''));
    candidates.push({ ref, role: roleMatch ? roleMatch[1].toLowerCase() : null, label, raw: line });
  }

  return candidates.filter(candidate => candidate.label || candidate.ref);
}

function collectSnapshotCandidates(node, out = []) {
  if (node == null) return out;

  if (typeof node === 'string') {
    out.push(...parseAriaSnapshotText(node));
    return out;
  }

  if (Array.isArray(node)) {
    for (const item of node) collectSnapshotCandidates(item, out);
    return out;
  }

  if (typeof node === 'object') {
    const directRef = node.ref || node.ariaRef || node.id || node.elementId || null;
    const directRole = node.role || node.kind || null;
    const directLabel = node.label || node.name || node.text || node.title || node.placeholder || null;

    if (directRef && directLabel) {
      out.push({
        ref: String(directRef),
        role: directRole ? String(directRole).toLowerCase() : null,
        label: normalizeSpace(directLabel),
        raw: node,
      });
    }

    for (const key of ['snapshot', 'ariaSnapshot', 'text', 'content', 'items', 'children', 'nodes', 'elements', 'entries', 'refs']) {
      if (key in node) collectSnapshotCandidates(node[key], out);
    }
  }

  return out;
}

function coerceRoleHint(value) {
  if (!value) return [];
  if (value === 'option-or-link') return ['option', 'link'];
  return String(value).split(/\s*\|\s*|\s*,\s*/).filter(Boolean);
}

function scoreCandidate(candidate, targetLabel, roleHints = []) {
  const candidateLabel = normalizeMatch(candidate.label);
  const target = normalizeMatch(targetLabel);
  const roleBonus = roleHints.length && candidate.role && roleHints.includes(candidate.role) ? 25 : 0;
  if (!candidateLabel) return roleBonus;
  if (candidateLabel === target) return 100 + roleBonus;
  if (candidateLabel.includes(target)) return 80 + roleBonus;
  if (target.includes(candidateLabel)) return 65 + roleBonus;
  const targetTokens = target.split(' ').filter(Boolean);
  const overlap = targetTokens.filter(token => candidateLabel.includes(token)).length;
  return overlap ? 30 + overlap * 5 + roleBonus : roleBonus;
}

function resolveLabelFromCandidates(label, candidates, options = {}) {
  const roleHints = coerceRoleHint(options.roleHint);
  const scored = dedupeCandidates(candidates)
    .map(candidate => ({ candidate, score: scoreCandidate(candidate, label, roleHints) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || String(a.candidate.label).length - String(b.candidate.label).length);

  if (!scored.length) {
    throw new Error(`Unable to resolve label "${label}" from snapshot fixture`);
  }

  const winner = scored[0];
  return {
    ref: winner.candidate.ref,
    role: winner.candidate.role,
    label: winner.candidate.label,
    score: winner.score,
    candidatesConsidered: scored.slice(0, 5).map(entry => ({
      ref: entry.candidate.ref,
      role: entry.candidate.role,
      label: entry.candidate.label,
      score: entry.score,
    })),
  };
}

function loadSnapshotFrames(filePath) {
  if (!filePath) return [];
  const value = readJson(path.resolve(filePath));
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.frames)) return value.frames;
  if (Array.isArray(value.snapshots)) return value.snapshots;
  return [value];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function convertBundleEntriesToPlanRecords(entries) {
  const records = [];
  for (const entry of entries) {
    if (entry.tool !== 'browser') continue;
    if (entry.action === 'open') {
      records.push({ action: 'open', url: entry.params?.url, _bundleEntry: entry });
      continue;
    }
    if (entry.action === 'snapshot') {
      records.push({ action: 'snapshot', label: entry.resolveLabel || null, _bundleEntry: entry });
      continue;
    }
    if (entry.action === 'act' && entry.params?.kind === 'click' && entry.resolveRoleHint === 'option-or-link') {
      records.push({ action: 'clickSuggestion', value: entry.resolveLabel, _bundleEntry: entry });
      continue;
    }
    if (entry.action === 'act' && entry.params?.kind === 'click') {
      records.push({ action: 'click', label: entry.resolveLabel, _bundleEntry: entry });
      continue;
    }
    if (entry.action === 'act' && entry.params?.kind === 'select') {
      records.push({ action: 'select', label: entry.resolveLabel, value: entry.params?.values?.[0], _bundleEntry: entry });
      continue;
    }
    if (entry.action === 'act' && entry.params?.kind === 'type') {
      records.push({ action: 'type', label: entry.resolveLabel, value: entry.params?.text, _bundleEntry: entry });
      continue;
    }
    if (entry.action === 'act' && entry.params?.kind === 'evaluate') {
      records.push({ action: 'evaluate', outputFile: entry.outputFile || null, extractor: entry.params?.fn || '', _bundleEntry: entry });
      continue;
    }
  }
  return records;
}

function toPlanRecords(loaded) {
  return loaded.format === 'jsonl-plan' ? loaded.records : convertBundleEntriesToPlanRecords(loaded.records);
}

function compileToolCalls(records, options = {}) {
  const toolCalls = [];
  const transcript = [];
  const snapshotFrames = loadSnapshotFrames(options.snapshotFile);
  const evaluateResult = options.evaluateResultFile ? readJson(path.resolve(options.evaluateResultFile)) : null;
  const target = options.target || 'host';
  const profile = options.profile || undefined;
  let targetId = options.targetId || undefined;
  let snapshotIndex = 0;
  let lastSnapshot = null;

  function buildBaseCall(action, extra = {}) {
    return {
      action,
      target,
      ...(profile ? { profile } : {}),
      ...(targetId ? { targetId } : {}),
      ...extra,
    };
  }

  function pushCall(step, call, meta = {}) {
    toolCalls.push({
      step,
      call,
      meta,
    });
  }

  function pushTranscript(entry) {
    transcript.push({ order: transcript.length + 1, ...entry });
  }

  for (let index = 0; index < records.length; index++) {
    const step = records[index];
    const stepNumber = index + 1;

    if (step.action === 'open') {
      pushCall(stepNumber, buildBaseCall('open', { url: step.url }), { from: 'plan' });
      pushTranscript({ phase: 'compile', action: 'open', url: step.url });
      continue;
    }

    if (step.action === 'snapshot') {
      const frame = snapshotFrames[snapshotIndex++] || null;
      const candidates = dedupeCandidates(collectSnapshotCandidates(frame));
      lastSnapshot = {
        index: snapshotIndex,
        label: step.label || null,
        candidates,
      };
      pushCall(stepNumber, buildBaseCall('snapshot', { refs: 'aria', snapshotFormat: 'aria' }), {
        from: 'plan',
        resolveLabel: step.label || null,
        candidateCount: candidates.length,
      });
      pushTranscript({ phase: 'compile', action: 'snapshot', label: step.label || null, candidateCount: candidates.length });
      continue;
    }

    if (step.action === 'evaluate') {
      const call = buildBaseCall('act', {
        request: {
          kind: 'evaluate',
          targetId,
          fn: String(step.extractor || ''),
        },
      });
      pushCall(stepNumber, call, {
        from: 'plan',
        outputFile: step.outputFile || null,
        fixtureAvailable: Boolean(evaluateResult),
      });
      pushTranscript({ phase: 'compile', action: 'evaluate', outputFile: step.outputFile || null, fixtureAvailable: Boolean(evaluateResult) });
      continue;
    }

    const label = step.action === 'clickSuggestion' ? step.value : step.label;
    if (!lastSnapshot) {
      throw new Error(`Step ${stepNumber} (${step.action}) requires a preceding snapshot step`);
    }

    const resolution = resolveLabelFromCandidates(label, lastSnapshot.candidates, {
      roleHint: step.action === 'clickSuggestion' ? 'option-or-link' : null,
    });

    let request;
    if (step.action === 'click' || step.action === 'clickSuggestion') {
      request = { kind: 'click', targetId, ref: resolution.ref };
    } else if (step.action === 'select') {
      request = { kind: 'select', targetId, ref: resolution.ref, values: [String(step.value)] };
    } else if (step.action === 'type') {
      request = { kind: 'type', targetId, ref: resolution.ref, text: String(step.value), slowly: false };
    } else {
      throw new Error(`Unsupported plan action at step ${stepNumber}: ${step.action}`);
    }

    pushCall(stepNumber, buildBaseCall('act', { request }), {
      from: 'plan',
      resolveLabel: label,
      resolvedRef: resolution.ref,
      resolvedRole: resolution.role,
      snapshotIndex: lastSnapshot.index,
      candidatesConsidered: resolution.candidatesConsidered,
    });
    pushTranscript({ phase: 'compile', action: step.action, label, ref: resolution.ref, snapshotIndex: lastSnapshot.index });
  }

  return {
    mode: options.mode || 'compile',
    target,
    profile,
    targetId,
    snapshotFramesAvailable: snapshotFrames.length,
    snapshotFramesConsumed: snapshotIndex,
    toolCalls,
    transcript,
  };
}

function simulateContract(summary, options = {}) {
  const evaluateResult = options.evaluateResultFile ? readJson(path.resolve(options.evaluateResultFile)) : null;
  const execution = [];

  for (const entry of summary.toolCalls || []) {
    const call = entry.call || {};
    if (call.action === 'open') {
      execution.push({ ok: true, step: entry.step, action: 'open', url: call.url, simulated: 'browser.open' });
      continue;
    }
    if (call.action === 'snapshot') {
      execution.push({ ok: true, step: entry.step, action: 'snapshot', refs: call.refs || 'aria', simulated: 'browser.snapshot' });
      continue;
    }
    if (call.action === 'act' && call.request?.kind === 'evaluate') {
      let saved = null;
      const outputFile = entry.meta?.outputFile || null;
      if (outputFile && evaluateResult) {
        saved = path.resolve(outputFile);
        fs.mkdirSync(path.dirname(saved), { recursive: true });
        fs.writeFileSync(saved, JSON.stringify(evaluateResult, null, 2));
      }
      execution.push({ ok: true, step: entry.step, action: 'evaluate', outputFile, saved, simulated: 'browser.act/evaluate' });
      continue;
    }
    if (call.action === 'act') {
      execution.push({
        ok: true,
        step: entry.step,
        action: call.request?.kind,
        ref: call.request?.ref || null,
        values: call.request?.values || null,
        text: call.request?.text || null,
        simulated: `browser.act/${call.request?.kind || 'unknown'}`,
      });
      continue;
    }
    execution.push({ ok: false, step: entry.step, action: call.action || 'unknown', error: 'Unsupported contract entry during simulation' });
  }

  return {
    ...summary,
    mode: 'simulate',
    simulation: execution,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) usage();

  const input = path.resolve(args.input);
  if (!fs.existsSync(input)) throw new Error(`Input file not found: ${input}`);

  const loaded = loadInputRecords(input);
  const records = toPlanRecords(loaded);
  const compiled = compileToolCalls(records, args);
  const summary = (args.mode || 'compile') === 'simulate'
    ? simulateContract(compiled, args)
    : compiled;

  summary.input = input;
  summary.inputFormat = loaded.format;
  summary.recordCount = records.length;

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

module.exports = {
  loadInputRecords,
  convertBundleEntriesToPlanRecords,
  toPlanRecords,
  compileToolCalls,
  simulateContract,
};
