#!/usr/bin/env node
// Browser-assisted OpenLot capture prototype.
// Uses the saved driver plan shape to produce result-page artifacts for downstream parsing.

const { browser } = {};
const openlot = require('./openlot-public');
const driver = require('./openlot-driver');

function normalizeSizeValue(value) {
  if (value === null || value === undefined || value === 'Any') return 'Any';
  if (typeof value === 'number') {
    return value >= 1000 ? `${value.toLocaleString()} m²` : `${value} m²`;
  }
  return String(value);
}

function normalizePriceValue(value) {
  if (value === null || value === undefined) return 'Any';
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 'Any';
  if (n >= 1000000) {
    const millions = n / 1000000;
    return Number.isInteger(millions) ? `$${millions}M` : `$${millions.toFixed(2)}M`;
  }
  return `$${Math.round(n / 1000)}k`;
}

function buildCaptureInstructions(target = {}, options = {}) {
  const plan = openlot.getDriverPlan(target, options);
  return {
    plan,
    browserActions: [
      { step: 'open', url: plan.startUrl },
      { step: 'click', label: 'Continue' },
      { step: 'click', label: 'Land for Sale' },
      { step: 'select', label: 'Min Price', value: normalizePriceValue(plan.profile.minPrice) },
      { step: 'select', label: 'Max Price', value: normalizePriceValue(plan.profile.maxPrice) },
      { step: 'click', label: 'Next' },
      { step: 'select', label: 'Min Size', value: normalizeSizeValue(plan.profile.minSize) },
      { step: 'select', label: 'Max Size', value: normalizeSizeValue(plan.profile.maxSize) },
      { step: 'click', label: 'Next' },
      { step: 'capture', kind: 'html+url+title' },
    ],
  };
}

function buildArtifactSummary(artifact = {}) {
  return driver.summarizeResultArtifacts(artifact);
}

if (require.main === module) {
  const target = { suburb: process.argv[2] || 'Tarneit', state: process.argv[3] || 'VIC', postcode: process.argv[4] || '3029' };
  const instructions = buildCaptureInstructions(target, { minLandSize: 0, maxLandSize: 2000, minPrice: 20000, maxPrice: 5000000 });
  console.log(JSON.stringify(instructions, null, 2));
}

module.exports = {
  normalizeSizeValue,
  normalizePriceValue,
  buildCaptureInstructions,
  buildArtifactSummary,
};
