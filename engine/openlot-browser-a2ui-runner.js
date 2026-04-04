#!/usr/bin/env node
// Execute or adapt an OpenLot browser A2UI/JSONL plan.
// Modes:
// - dry-run: validates and simulates execution order
// - openclaw-browser-bundle: emits a browser-tool request bundle that an external loop can execute directly
// - thin-executor: consumes a generated plan/bundle plus snapshot data, resolves labels -> refs, and emits a runnable transcript/bundle

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

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
  console.error('Usage: node engine/openlot-browser-a2ui-runner.js --input <plan.jsonl|bundle.json> [--adapter dry-run|openclaw-browser-bundle|thin-executor|openclaw-cli-executor] [--output <file>] [--target host|sandbox|node] [--profile user] [--tabId <id>] [--snapshotFile <file>] [--evaluateResultFile <file>] [--snapshotFormat ai|aria] [--snapshotOutDir <dir>]');
  process.exit(1);
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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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
  if (Array.isArray(json)) {
    return { format: 'bundle-array', records: json };
  }
  if (Array.isArray(json.bundle)) {
    return { format: 'bundle-object', records: json.bundle, meta: json };
  }
  if (Array.isArray(json.final?.bundle)) {
    return { format: 'runner-summary-bundle', records: json.final.bundle, meta: json };
  }
  if (Array.isArray(json.steps) && json.steps.every(step => step?.result?.tool === 'browser')) {
    return { format: 'runner-steps-bundle', records: json.steps.map(step => step.result), meta: json };
  }
  throw new Error(`Unsupported input format for ${filePath}`);
}

function createDryRunAdapter() {
  const transcript = [];
  return {
    name: 'dry-run',
    open(step) {
      transcript.push({ ok: true, action: 'open', url: step.url });
      return { status: 'opened', url: step.url };
    },
    snapshot(step) {
      transcript.push({ ok: true, action: 'snapshot', label: step.label || null });
      return { status: 'snapshotted', label: step.label || null };
    },
    click(step) {
      transcript.push({ ok: true, action: 'click', label: step.label });
      return { status: 'clicked', label: step.label };
    },
    select(step) {
      transcript.push({ ok: true, action: 'select', label: step.label, value: step.value });
      return { status: 'selected', label: step.label, value: step.value };
    },
    type(step) {
      transcript.push({ ok: true, action: 'type', label: step.label, value: step.value });
      return { status: 'typed', label: step.label, value: step.value };
    },
    clickSuggestion(step) {
      transcript.push({ ok: true, action: 'clickSuggestion', value: step.value, variants: step.variants || [] });
      return { status: 'clickedSuggestion', value: step.value, variants: step.variants || [] };
    },
    evaluate(step) {
      transcript.push({ ok: true, action: 'evaluate', outputFile: step.outputFile });
      return { status: 'evaluate-planned', outputFile: step.outputFile, extractorBytes: String(step.extractor || '').length };
    },
    finish() {
      return { transcript };
    },
  };
}

function createOpenClawBrowserBundleAdapter(options = {}) {
  const target = options.target || 'host';
  const profile = options.profile || undefined;
  const bundle = [];
  let targetId = options.tabId || undefined;

  function pushBrowser(toolAction, params = {}, meta = {}) {
    const entry = {
      tool: 'browser',
      action: toolAction,
      params: {
        target,
        ...(profile ? { profile } : {}),
        ...(targetId ? { targetId } : {}),
        ...params,
      },
      ...meta,
    };
    bundle.push(entry);
    return entry;
  }

  return {
    name: 'openclaw-browser-bundle',
    open(step) {
      return pushBrowser('open', { url: step.url });
    },
    snapshot(step) {
      return pushBrowser('snapshot', { refs: 'aria', snapshotFormat: 'aria' }, step.label ? { resolveLabel: step.label } : {});
    },
    click(step) {
      return pushBrowser('act', { kind: 'click' }, { resolveLabel: step.label, resolveStrategy: 'exact-or-contains' });
    },
    select(step) {
      return pushBrowser('act', { kind: 'select', values: [String(step.value)] }, { resolveLabel: step.label, resolveStrategy: 'exact-or-contains' });
    },
    type(step) {
      return pushBrowser('act', { kind: 'type', text: String(step.value), slowly: false }, { resolveLabel: step.label, resolveStrategy: 'exact-or-contains' });
    },
    clickSuggestion(step) {
      return pushBrowser('act', { kind: 'click' }, { resolveLabel: step.value, resolveStrategy: 'exact-or-contains', resolveRoleHint: 'option-or-link', resolveLabelVariants: step.variants || [] });
    },
    evaluate(step) {
      return pushBrowser('act', { kind: 'evaluate', fn: String(step.extractor || '') }, { outputFile: step.outputFile || null });
    },
    finish() {
      return {
        bundle,
        notes: [
          'Run entries sequentially.',
          'For entries with resolveLabel, use the immediately preceding snapshot to map label -> aria ref, then inject that ref into params.ref before calling browser.act.',
          'Persist browser.act evaluate output to outputFile when supplied.',
        ],
      };
    },
  };
}

function normalizeSpace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeMatch(value) {
  return normalizeSpace(value).toLowerCase();
}

function coerceRoleHint(value) {
  if (!value) return [];
  if (value === 'option-or-link') return ['option', 'link'];
  return String(value).split(/\s*\|\s*|\s*,\s*/).filter(Boolean);
}

function coerceLabelVariants(stepOrValue) {
  if (stepOrValue == null) return [];
  if (typeof stepOrValue === 'string') return [normalizeSpace(stepOrValue)];
  const variants = Array.isArray(stepOrValue.variants) ? stepOrValue.variants : [];
  return Array.from(new Set([
    stepOrValue.value,
    stepOrValue.label,
    ...variants,
  ].map(value => normalizeSpace(value)).filter(Boolean)));
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
    if (roleMatch) {
      label = withoutRef.slice(roleMatch.index + roleMatch[0].length);
    }
    label = normalizeSpace(label.replace(/^[:\-–—]+/, ''));
    candidates.push({
      ref,
      role: roleMatch ? roleMatch[1].toLowerCase() : null,
      label,
      raw: line,
    });
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

function collectSnapshotCandidatesFromCliSnapshot(payload) {
  const out = [];
  if (!payload || typeof payload !== 'object') return out;

  if (typeof payload.snapshot === 'string') {
    out.push(...parseAriaSnapshotText(payload.snapshot));
  }

  if (payload.refs && typeof payload.refs === 'object') {
    for (const [ref, meta] of Object.entries(payload.refs)) {
      out.push({
        ref,
        role: meta?.role ? String(meta.role).toLowerCase() : null,
        label: normalizeSpace(meta?.name || ''),
        raw: meta,
      });
    }
  }

  if (Array.isArray(payload.nodes)) {
    for (const node of payload.nodes) {
      out.push({
        ref: node?.ref ? String(node.ref) : null,
        role: node?.role ? String(node.role).toLowerCase() : null,
        label: normalizeSpace(node?.name || node?.label || ''),
        raw: node,
      });
    }
  }

  return dedupeCandidates(out.filter(candidate => candidate.ref));
}

function inspectCliSnapshot(payload) {
  const snapshotText = String(payload?.snapshot || '');
  const candidates = collectSnapshotCandidatesFromCliSnapshot(payload);
  const searchButton = candidates.find(candidate => normalizeMatch(candidate.label) === 'search');

  return {
    snapshotText,
    candidates,
    searchDisabled: /button\s+"Search"\s+\[disabled\]/i.test(snapshotText),
    searchRef: searchButton?.ref || null,
    suggestionLabels: candidates
      .map(candidate => candidate.label)
      .filter(Boolean)
      .filter(label => /\b\d{4}\b/.test(label)),
  };
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  const out = [];
  for (const candidate of candidates) {
    const key = JSON.stringify([candidate.ref, candidate.role || '', candidate.label || '']);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
  }
  return out;
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
  const labels = Array.from(new Set([
    ...coerceLabelVariants(label),
    ...coerceLabelVariants(options),
  ].filter(Boolean)));
  const roleHints = coerceRoleHint(options.roleHint);
  let best = null;

  for (const candidateLabel of labels) {
    const scored = dedupeCandidates(candidates)
      .map(candidate => ({ candidate, score: scoreCandidate(candidate, candidateLabel, roleHints), matchedLabel: candidateLabel }))
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score || String(a.candidate.label).length - String(b.candidate.label).length);

    if (!scored.length) continue;
    if (!best || scored[0].score > best.scored[0].score) best = { label: candidateLabel, scored };
    if (scored[0].score >= 100) break;
  }

  if (!best) {
    throw new Error(`Unable to resolve label "${labels[0] || label}" from snapshot`);
  }

  const winner = best.scored[0];
  return {
    ref: winner.candidate.ref,
    role: winner.candidate.role,
    label: winner.candidate.label,
    matchedLabel: best.label,
    score: winner.score,
    raw: winner.candidate.raw,
    candidatesConsidered: best.scored.slice(0, 5).map(entry => ({
      ref: entry.candidate.ref,
      role: entry.candidate.role,
      label: entry.candidate.label,
      matchedLabel: entry.matchedLabel,
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

function loadEvaluateResult(filePath) {
  if (!filePath) return null;
  const resolved = path.resolve(filePath);
  return {
    path: resolved,
    value: readJson(resolved),
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createThinExecutorAdapter(options = {}) {
  const bundle = [];
  const transcript = [];
  const resolvedActions = [];
  const snapshotFrames = loadSnapshotFrames(options.snapshotFile);
  const evaluateFixture = loadEvaluateResult(options.evaluateResultFile);
  let snapshotIndex = 0;
  let lastSnapshot = null;

  function captureSnapshot(step) {
    const frame = snapshotFrames[snapshotIndex++] || null;
    const candidates = dedupeCandidates(collectSnapshotCandidates(frame));
    lastSnapshot = {
      requestedLabel: step.label || null,
      index: snapshotIndex,
      source: frame,
      candidates,
    };
    transcript.push({
      ok: true,
      phase: 'snapshot',
      label: step.label || null,
      candidateCount: candidates.length,
    });
    return {
      status: 'snapshotted',
      label: step.label || null,
      candidateCount: candidates.length,
    };
  }

  function resolveCurrentLabel(label, meta = {}) {
    if (!lastSnapshot) {
      throw new Error(`Cannot resolve label "${label}" before a snapshot step has populated candidates`);
    }
    const resolved = resolveLabelFromCandidates(label, lastSnapshot.candidates, meta);
    return {
      snapshotIndex: lastSnapshot.index,
      ...resolved,
    };
  }

  function pushResolved(entry, resolution = null) {
    const cloned = clone(entry);
    if (resolution && cloned.params && !cloned.params.ref) {
      cloned.params.ref = resolution.ref;
    }
    bundle.push(cloned);
    resolvedActions.push({ entry: cloned, resolution });
    return cloned;
  }

  return {
    name: 'thin-executor',
    open(step) {
      const entry = { tool: 'browser', action: 'open', params: { target: options.target || 'host', url: step.url } };
      pushResolved(entry);
      transcript.push({ ok: true, phase: 'open', url: step.url });
      return { status: 'opened', url: step.url };
    },
    snapshot(step) {
      const entry = { tool: 'browser', action: 'snapshot', params: { target: options.target || 'host', refs: 'aria', snapshotFormat: 'aria' }, resolveLabel: step.label || null };
      pushResolved(entry);
      return captureSnapshot(step);
    },
    click(step) {
      const resolution = resolveCurrentLabel(step.label, { roleHint: null });
      const entry = { tool: 'browser', action: 'act', params: { target: options.target || 'host', kind: 'click' }, resolveLabel: step.label, resolveStrategy: 'exact-or-contains' };
      pushResolved(entry, resolution);
      transcript.push({ ok: true, phase: 'act', kind: 'click', label: step.label, ref: resolution.ref, snapshotIndex: resolution.snapshotIndex });
      return { status: 'resolved-click', label: step.label, ref: resolution.ref, snapshotIndex: resolution.snapshotIndex };
    },
    select(step) {
      const resolution = resolveCurrentLabel(step.label, { roleHint: null });
      const entry = { tool: 'browser', action: 'act', params: { target: options.target || 'host', kind: 'select', values: [String(step.value)] }, resolveLabel: step.label, resolveStrategy: 'exact-or-contains' };
      pushResolved(entry, resolution);
      transcript.push({ ok: true, phase: 'act', kind: 'select', label: step.label, value: step.value, ref: resolution.ref, snapshotIndex: resolution.snapshotIndex });
      return { status: 'resolved-select', label: step.label, value: step.value, ref: resolution.ref, snapshotIndex: resolution.snapshotIndex };
    },
    type(step) {
      const resolution = resolveCurrentLabel(step.label, { roleHint: null });
      const entry = { tool: 'browser', action: 'act', params: { target: options.target || 'host', kind: 'type', text: String(step.value), slowly: false }, resolveLabel: step.label, resolveStrategy: 'exact-or-contains' };
      pushResolved(entry, resolution);
      transcript.push({ ok: true, phase: 'act', kind: 'type', label: step.label, value: step.value, ref: resolution.ref, snapshotIndex: resolution.snapshotIndex });
      return { status: 'resolved-type', label: step.label, value: step.value, ref: resolution.ref, snapshotIndex: resolution.snapshotIndex };
    },
    clickSuggestion(step) {
      const resolution = resolveCurrentLabel(step.value, { roleHint: 'option-or-link', variants: step.variants || [] });
      const entry = { tool: 'browser', action: 'act', params: { target: options.target || 'host', kind: 'click' }, resolveLabel: step.value, resolveStrategy: 'exact-or-contains', resolveRoleHint: 'option-or-link', resolveLabelVariants: step.variants || [] };
      pushResolved(entry, resolution);
      transcript.push({ ok: true, phase: 'act', kind: 'click', label: step.value, matchedLabel: resolution.matchedLabel, ref: resolution.ref, snapshotIndex: resolution.snapshotIndex, role: resolution.role });
      return { status: 'resolved-clickSuggestion', label: step.value, matchedLabel: resolution.matchedLabel, ref: resolution.ref, snapshotIndex: resolution.snapshotIndex, role: resolution.role };
    },
    evaluate(step) {
      const entry = { tool: 'browser', action: 'act', params: { target: options.target || 'host', kind: 'evaluate', fn: String(step.extractor || '') }, outputFile: step.outputFile || null };
      pushResolved(entry);
      let saved = null;
      if (step.outputFile && evaluateFixture) {
        const outputPath = path.resolve(step.outputFile);
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, JSON.stringify(evaluateFixture.value, null, 2));
        saved = outputPath;
      }
      transcript.push({ ok: true, phase: 'act', kind: 'evaluate', outputFile: step.outputFile || null, savedFixture: saved, fixtureSource: evaluateFixture?.path || null });
      return {
        status: saved ? 'evaluate-result-saved' : 'evaluate-planned',
        outputFile: step.outputFile || null,
        fixtureSource: evaluateFixture?.path || null,
        saved,
      };
    },
    finish() {
      return {
        bundle,
        transcript,
        snapshotFramesConsumed: snapshotIndex,
        snapshotFramesAvailable: snapshotFrames.length,
        notes: [
          'This adapter resolves labels against supplied snapshot data and injects params.ref into browser.act entries.',
          'It does not call the OpenClaw browser tool directly from Node; it prepares the next executable bundle/transcript.',
          'If --evaluateResultFile is supplied, the fixture JSON is copied into the evaluate outputFile to simulate extractor persistence.',
        ],
      };
    },
  };
}

function createOpenClawCliExecutorAdapter(options = {}) {
  const transcript = [];
  const snapshotHistory = [];
  const cliBaseArgs = ['browser', '--json'];
  const snapshotFormat = options.snapshotFormat === 'aria' ? 'aria' : 'ai';
  let targetId = options.tabId || undefined;
  let lastOpenedUrl = null;
  let lastSnapshot = null;

  function runCli(args, meta = {}) {
    const run = (finalArgs) => spawnSync('openclaw', [...cliBaseArgs, ...finalArgs], {
      encoding: 'utf8',
      cwd: process.cwd(),
      maxBuffer: 25 * 1024 * 1024,
    });

    let finalArgs = [...args];
    let result = run(finalArgs);

    if (result.status !== 0) {
      const errorText = (result.stderr || result.stdout || '').trim();
      if (!meta.retried && errorText.includes('tab not found') && lastOpenedUrl) {
        const reopened = runCli(['open', lastOpenedUrl], { retried: true, reason: 'recover-tab-not-found' });
        targetId = reopened?.targetId || targetId;
        const retriedArgs = args.filter((arg, index) => !(arg === '--target-id' || args[index - 1] === '--target-id'));
        return runCli(withTarget(retriedArgs), { ...meta, retried: true, reason: 'recover-tab-not-found' });
      }

      if (!meta.retriedWithoutTarget && errorText.includes('tab not found')) {
        const strippedArgs = args.filter((arg, index) => !(arg === '--target-id' || args[index - 1] === '--target-id'));
        if (strippedArgs.length !== args.length) {
          finalArgs = strippedArgs;
          result = run(finalArgs);
          if (result.status === 0) {
            const text = String(result.stdout || '').trim();
            if (!text) return null;
            try {
              return JSON.parse(text);
            } catch (error) {
              throw new Error(`Failed to parse JSON from openclaw ${finalArgs.join(' ')}: ${error.message}\n${text}`);
            }
          }
        }
      }

      const finalErrorText = (result.stderr || result.stdout || '').trim();
      throw new Error(`openclaw ${finalArgs.join(' ')} failed: ${finalErrorText || `exit ${result.status}`}`);
    }

    const text = String(result.stdout || '').trim();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(`Failed to parse JSON from openclaw ${finalArgs.join(' ')}: ${error.message}\n${text}`);
    }
  }

  function withTarget(args = []) {
    return targetId ? [...args, '--target-id', targetId] : args;
  }

  function maybeWriteSnapshot(stepLabel, payload) {
    if (!options.snapshotOutDir) return null;
    const fileName = `${String(snapshotHistory.length + 1).padStart(2, '0')}-${String(stepLabel || 'snapshot').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'snapshot'}.json`;
    const outPath = path.resolve(options.snapshotOutDir, fileName);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
    return outPath;
  }

  function takeSnapshot(stepLabel, meta = {}) {
    const payload = runCli(withTarget(['snapshot', '--format', snapshotFormat]));
    const inspection = inspectCliSnapshot(payload);
    const savedTo = maybeWriteSnapshot(meta.fileLabel || stepLabel, payload);
    lastSnapshot = {
      index: snapshotHistory.length + 1,
      label: stepLabel || null,
      candidates: inspection.candidates,
      payload,
      inspection,
    };
    snapshotHistory.push(lastSnapshot);
    transcript.push({
      ok: true,
      phase: 'snapshot',
      label: stepLabel || null,
      candidateCount: inspection.candidates.length,
      targetId,
      savedTo,
      ...(meta.synthetic ? { synthetic: true, reason: meta.reason || null } : {}),
    });
    return { payload, inspection, savedTo, snapshot: lastSnapshot };
  }

  function evaluateDom(fnBody) {
    return runCli(withTarget(['evaluate', '--fn', fnBody]));
  }

  function refreshForAction(step, reason) {
    const label = step.action === 'clickSuggestion' ? step.value : step.label;
    return takeSnapshot(label, {
      synthetic: true,
      reason: reason || `refresh-${step.action}`,
      fileLabel: `refresh-${label}`,
    }).snapshot;
  }

  function recoverSuggestionSelection(step, resolution = null) {
    const variants = coerceLabelVariants(step);
    const wanted = String(step.value || '');
    const recovery = {
      attemptedRef: resolution?.ref || null,
      attemptedRole: resolution?.role || null,
      recoveries: [],
    };

    const domClickFn = `() => {
      const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
      const norm = value => clean(value).toLowerCase();
      const wantedList = ${JSON.stringify(variants)};
      const wanted = wantedList.map(norm).filter(Boolean);
      const selectors = ['[role="option"]', '.search-wizard-suburb-item', '.search-wizard [class*="suburb"]', 'li', 'button', 'a', 'div'];
      const nodes = Array.from(new Set(selectors.flatMap(selector => Array.from(document.querySelectorAll(selector)))));
      const exact = nodes.find(node => wanted.includes(norm(node.textContent)));
      const contains = nodes.find(node => {
        const text = norm(node.textContent);
        return text && wanted.some(label => text && (text.includes(label) || label.includes(text)));
      });
      const chosen = exact || contains;
      if (!chosen) return { clicked: false, reason: 'not-found', wanted, samples: nodes.slice(0, 10).map(node => clean(node.textContent)) };
      for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click']) {
        chosen.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
      }
      chosen.click();
      return { clicked: true, text: clean(chosen.textContent), tag: chosen.tagName, className: chosen.className || '' };
    }`;

    recovery.recoveries.push({ method: 'evaluate-dom-click', result: evaluateDom(domClickFn) });
    let verification = refreshForAction({ action: 'clickSuggestion', value: wanted, variants }, 'verify-suggestion-dom-click').inspection;

    if (verification.searchDisabled) {
      runCli(withTarget(['press', 'ArrowDown']));
      runCli(withTarget(['press', 'Enter']));
      recovery.recoveries.push({ method: 'press-arrowdown-enter', result: { ok: true } });
      verification = refreshForAction({ action: 'clickSuggestion', value: wanted, variants }, 'verify-suggestion-keyboard').inspection;
    }

    if (verification.searchDisabled) {
      const inputEventFn = `() => {
        const wanted = ${JSON.stringify(wanted)};
        const input = document.querySelector('input[placeholder*="suburb"], input[placeholder*="postcode"], input[type="text"]');
        if (!input) return { ok: false, reason: 'input-not-found' };
        input.focus();
        input.value = wanted;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return { ok: true, value: input.value };
      }`;
      recovery.recoveries.push({ method: 'force-input-events', result: evaluateDom(inputEventFn) });
      verification = refreshForAction({ action: 'clickSuggestion', value: wanted, variants }, 'verify-suggestion-force-input').inspection;
    }

    recovery.variants = variants;
    recovery.searchDisabledAfterRecovery = verification.searchDisabled;
    recovery.searchRef = verification.searchRef;
    recovery.suggestionLabels = verification.suggestionLabels;
    return recovery;
  }

  function resolveCurrentLabel(label, meta = {}) {
    if (!lastSnapshot) {
      throw new Error(`Cannot resolve label "${label}" before a snapshot step has populated candidates`);
    }
    const resolved = resolveLabelFromCandidates(label, lastSnapshot.candidates, meta);
    return {
      snapshotIndex: lastSnapshot.index,
      ...resolved,
    };
  }

  return {
    name: 'openclaw-cli-executor',
    open(step) {
      lastOpenedUrl = step.url;
      const opened = runCli(['open', step.url]);
      targetId = opened?.targetId || targetId;
      transcript.push({ ok: true, phase: 'open', url: step.url, targetId });
      return { status: 'opened', url: step.url, targetId };
    },
    snapshot(step) {
      const fresh = takeSnapshot(step.label);
      return { status: 'snapshotted', label: step.label || null, candidateCount: fresh.inspection.candidates.length, targetId, savedTo: fresh.savedTo };
    },
    click(step) {
      if (normalizeMatch(step.label) === 'search' && lastSnapshot?.inspection?.searchDisabled) {
        const refreshed = refreshForAction(step, 'pre-search-click-refresh');
        if (refreshed.inspection.searchDisabled) {
          throw new Error(`Search button is still disabled before click for label "${step.label}"`);
        }
      }
      const resolution = resolveCurrentLabel(step.label, { roleHint: null });
      runCli(withTarget(['click', resolution.ref]));
      transcript.push({ ok: true, phase: 'act', kind: 'click', label: step.label, ref: resolution.ref, snapshotIndex: resolution.snapshotIndex, targetId });
      return { status: 'clicked', label: step.label, ref: resolution.ref, snapshotIndex: resolution.snapshotIndex, targetId };
    },
    select(step) {
      const resolution = resolveCurrentLabel(step.label, { roleHint: null });
      runCli(withTarget(['select', resolution.ref, String(step.value)]));
      transcript.push({ ok: true, phase: 'act', kind: 'select', label: step.label, value: step.value, ref: resolution.ref, snapshotIndex: resolution.snapshotIndex, targetId });
      return { status: 'selected', label: step.label, value: step.value, ref: resolution.ref, snapshotIndex: resolution.snapshotIndex, targetId };
    },
    type(step) {
      const resolution = resolveCurrentLabel(step.label, { roleHint: null });
      runCli(withTarget(['type', resolution.ref, String(step.value)]));
      transcript.push({ ok: true, phase: 'act', kind: 'type', label: step.label, value: step.value, ref: resolution.ref, snapshotIndex: resolution.snapshotIndex, targetId });
      return { status: 'typed', label: step.label, value: step.value, ref: resolution.ref, snapshotIndex: resolution.snapshotIndex, targetId };
    },
    clickSuggestion(step) {
      refreshForAction(step, 'pre-clickSuggestion-refresh');
      let resolution = null;
      let method = 'click';
      let fallback = null;

      try {
        resolution = resolveCurrentLabel(step.value, { roleHint: 'option-or-link', variants: step.variants || [] });
        if (resolution.role === 'textbox') {
          fallback = {
            attemptedRef: resolution.ref,
            attemptedRole: resolution.role,
            reason: 'resolved-textbox-instead-of-suggestion',
          };
        } else {
          runCli(withTarget(['click', resolution.ref]));
          const verifySnapshot = refreshForAction({ action: 'clickSuggestion', value: step.value, variants: step.variants || [] }, 'post-clickSuggestion-verify');
          const suggestionStillVisible = verifySnapshot.inspection.suggestionLabels.some(label => coerceLabelVariants(step).some(variant => normalizeMatch(label) === normalizeMatch(variant)));
          if (suggestionStillVisible || verifySnapshot.inspection.searchDisabled) {
            fallback = {
              attemptedRef: resolution.ref,
              attemptedRole: resolution.role,
              reason: verifySnapshot.inspection.searchDisabled ? 'search-still-disabled-after-click' : 'suggestion-still-visible-after-click',
            };
          }
        }
      } catch (error) {
        fallback = {
          attemptedRef: resolution?.ref || null,
          attemptedRole: resolution?.role || null,
          error: error.message,
        };
      }

      if (fallback) {
        const recovery = recoverSuggestionSelection(step, resolution);
        method = recovery.searchDisabledAfterRecovery
          ? 'evaluate-dom-click-plus-keyboard-recovery'
          : 'evaluate-dom-click-recovery';
        fallback = { ...fallback, ...recovery };
      }

      transcript.push({ ok: true, phase: 'act', kind: 'clickSuggestion', label: step.value, variants: step.variants || [], matchedLabel: resolution?.matchedLabel || null, ref: resolution?.ref || null, snapshotIndex: resolution?.snapshotIndex || null, role: resolution?.role || null, method, fallback, targetId });
      return { status: 'clickedSuggestion', label: step.value, variants: step.variants || [], matchedLabel: resolution?.matchedLabel || null, ref: resolution?.ref || null, snapshotIndex: resolution?.snapshotIndex || null, role: resolution?.role || null, method, fallback, targetId };
    },
    evaluate(step) {
      const payload = runCli(withTarget(['evaluate', '--fn', String(step.extractor || '')]));
      let saved = null;
      if (step.outputFile) {
        const outputPath = path.resolve(step.outputFile);
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
        saved = outputPath;
      }
      transcript.push({ ok: true, phase: 'act', kind: 'evaluate', outputFile: step.outputFile || null, saved, targetId });
      return { status: 'evaluated', outputFile: step.outputFile || null, saved, targetId };
    },
    finish() {
      return {
        targetId,
        snapshotFormat,
        snapshotCount: snapshotHistory.length,
        transcript,
        notes: [
          'This adapter executes the plan against the local OpenClaw browser CLI in real time.',
          'Each interactive action resolves refs from the immediately preceding CLI snapshot before calling click/select/type/evaluate.',
          'Use --snapshotOutDir to persist raw snapshot responses for audit/debugging.',
        ],
      };
    },
  };
}

function buildAdapter(name, options) {
  if (!name || name === 'dry-run') return createDryRunAdapter();
  if (name === 'openclaw-browser-bundle') return createOpenClawBrowserBundleAdapter(options);
  if (name === 'thin-executor') return createThinExecutorAdapter(options);
  if (name === 'openclaw-cli-executor') return createOpenClawCliExecutorAdapter(options);
  throw new Error(`Unsupported adapter: ${name}`);
}

function executePlan(records, adapter) {
  const stepResults = [];
  for (const [index, step] of records.entries()) {
    const action = step.action;
    if (!action || typeof adapter[action] !== 'function') {
      throw new Error(`Unsupported plan action at step ${index + 1}: ${action || 'undefined'}`);
    }
    stepResults.push({ step: index + 1, action, result: adapter[action](step) });
  }
  return {
    adapter: adapter.name,
    steps: stepResults,
    final: typeof adapter.finish === 'function' ? adapter.finish() : null,
  };
}

function convertBundleEntriesToPlanRecords(entries) {
  const records = [];
  for (const entry of entries) {
    if (entry.tool !== 'browser') continue;
    if (entry.action === 'open') {
      records.push({ action: 'open', url: entry.params?.url });
      continue;
    }
    if (entry.action === 'snapshot') {
      records.push({ action: 'snapshot', label: entry.resolveLabel || null });
      continue;
    }
    if (entry.action === 'act' && entry.params?.kind === 'click' && entry.resolveRoleHint === 'option-or-link') {
      records.push({ action: 'clickSuggestion', value: entry.resolveLabel, variants: entry.resolveLabelVariants || undefined });
      continue;
    }
    if (entry.action === 'act' && entry.params?.kind === 'click') {
      records.push({ action: 'click', label: entry.resolveLabel });
      continue;
    }
    if (entry.action === 'act' && entry.params?.kind === 'select') {
      records.push({ action: 'select', label: entry.resolveLabel, value: entry.params?.values?.[0] });
      continue;
    }
    if (entry.action === 'act' && entry.params?.kind === 'type') {
      records.push({ action: 'type', label: entry.resolveLabel, value: entry.params?.text });
      continue;
    }
    if (entry.action === 'act' && entry.params?.kind === 'evaluate') {
      records.push({ action: 'evaluate', outputFile: entry.outputFile || null, extractor: entry.params?.fn || '' });
      continue;
    }
    records.push({ action: 'unknown', original: entry });
  }
  return records;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) usage();

  const input = path.resolve(args.input);
  if (!fs.existsSync(input)) throw new Error(`Input file not found: ${input}`);

  const loaded = loadInputRecords(input);
  const records = loaded.format.startsWith('jsonl') ? loaded.records : convertBundleEntriesToPlanRecords(loaded.records);
  const summary = executePlan(records, buildAdapter(args.adapter || 'dry-run', args));
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
