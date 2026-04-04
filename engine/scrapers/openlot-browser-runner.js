#!/usr/bin/env node
// OpenLot browser-runner harness.
// Converts the browser-capture instruction plan into executable browser-tool requests.

const fs = require('fs');
const path = require('path');
const capture = require('./openlot-browser-capture');

function buildTargetKey(target = {}) {
  const state = String(target.state || '').toUpperCase();
  const suburb = String(target.suburb || '').trim();
  const postcode = String(target.postcode || '').trim();
  return [state, suburb, postcode].filter(Boolean).join(':');
}

function sanitizeFileSegment(value = '') {
  return String(value || '')
    .trim()
    .replace(/[\\/]+/g, '-')
    .replace(/\s+/g, ' ');
}

function buildPayloadFilename(target = {}) {
  const key = buildTargetKey(target);
  return `${sanitizeFileSegment(key)}.json`;
}

function saveBrowserPayload(payload, target = {}, dirPath) {
  if (!dirPath) {
    throw new Error('dirPath is required to save an OpenLot browser payload');
  }
  const key = buildTargetKey(target);
  if (!key) {
    throw new Error('Target must include at least state/suburb/postcode to derive an OpenLot payload key');
  }

  fs.mkdirSync(dirPath, { recursive: true });
  const filePath = path.join(dirPath, buildPayloadFilename(target));
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  return { key, filePath };
}

function buildExecutionPlan(target = {}, options = {}) {
  const instructions = capture.buildCaptureInstructions(target, options);
  return instructions.browserActions.map((step, index) => {
    if (step.step === 'open') {
      return { order: index + 1, kind: 'open', url: step.url };
    }
    if (step.step === 'click') {
      return { order: index + 1, kind: 'clickByLabel', label: step.label };
    }
    if (step.step === 'select') {
      return { order: index + 1, kind: 'selectByLabel', label: step.label, value: step.value };
    }
    return { order: index + 1, kind: 'capture', mode: step.kind || 'html+url+title' };
  });
}

function buildBrowserToolSequence(target = {}, options = {}) {
  const executionPlan = buildExecutionPlan(target, options);
  return executionPlan.map(step => {
    if (step.kind === 'open') {
      return { action: 'open', target: 'host', url: step.url };
    }
    if (step.kind === 'clickByLabel') {
      return { action: 'snapshot', target: 'host', note: `Resolve ref for button: ${step.label}` };
    }
    if (step.kind === 'selectByLabel') {
      return { action: 'snapshot', target: 'host', note: `Resolve ref for select: ${step.label}, choose value: ${step.value}` };
    }
    return { action: 'snapshot', target: 'host', note: 'Capture final result-page state (html/url/title equivalent)' };
  });
}

if (require.main === module) {
  const target = { suburb: process.argv[2] || 'Tarneit', state: process.argv[3] || 'VIC', postcode: process.argv[4] || '3029' };
  const out = buildBrowserToolSequence(target, { minLandSize: 0, maxLandSize: 2000, minPrice: 20000, maxPrice: 5000000 });
  console.log(JSON.stringify(out, null, 2));
}

module.exports = {
  buildTargetKey,
  buildPayloadFilename,
  saveBrowserPayload,
  buildExecutionPlan,
  buildBrowserToolSequence,
};
