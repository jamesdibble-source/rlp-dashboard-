#!/usr/bin/env node
// OpenLot browser-driver contract and parser helpers.
// This module does not evade access controls; it defines the steps/results shape
// needed for a browser-assisted collection path and provides HTML/JSON extraction hooks.

function buildWizardPlan(target = {}, profile = {}, wizard = {}) {
  const safeWizard = wizard.steps ? wizard : { steps: {} };
  return {
    startUrl: target.startUrl || '',
    profile,
    steps: [
      { action: 'click', kind: 'button', label: 'Continue' },
      { action: 'click', kind: 'button', label: safeWizard.steps.intent?.landButtonLabel || 'Land for Sale' },
      {
        action: 'select-range',
        kind: 'budget',
        minLabel: safeWizard.steps.budget?.minLabel || 'Min Price',
        maxLabel: safeWizard.steps.budget?.maxLabel || 'Max Price',
        minValue: profile.minPrice,
        maxValue: profile.maxPrice,
      },
      { action: 'click', kind: 'button', label: 'Next' },
      {
        action: 'select-range',
        kind: 'size',
        minLabel: safeWizard.steps.size?.minLabel || 'Min Size',
        maxLabel: safeWizard.steps.size?.maxLabel || 'Max Size',
        minValue: profile.minSize,
        maxValue: profile.maxSize,
      },
      { action: 'click', kind: 'button', label: 'Next' },
      {
        action: 'capture-results',
        kind: 'results',
        notes: 'Capture rendered result DOM and/or embedded JSON for listing extraction.',
      },
    ],
  };
}

function extractEmbeddedJson(html) {
  const matches = [...String(html || '').matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  const out = [];
  for (const match of matches) {
    try {
      out.push(JSON.parse(match[1]));
    } catch (_) {}
  }
  return out;
}

function extractResultCards(html) {
  const text = String(html || '');
  const urls = [...text.matchAll(/https:\/\/www\.openlot\.com\.au\/[^"'\s<)]+/g)].map(m => m[0]);
  return [...new Set(urls)].map(url => ({ url }));
}

function summarizeResultArtifacts({ html = '', title = '', url = '' } = {}) {
  return {
    title,
    url,
    embeddedJsonBlocks: extractEmbeddedJson(html).length,
    discoveredUrls: extractResultCards(html).length,
  };
}

function buildBrowserResultExtractor() {
  return String.raw`() => {
    const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
    const anchors = Array.from(document.querySelectorAll('a[href*="section=land"]'));
    const rows = [];

    for (const anchor of anchors) {
      const block = anchor.closest('div[class]') || anchor.parentElement;
      const cardText = clean(block?.textContent || anchor.textContent || '');
      if (!/Price:\s*\$[\d,]+/i.test(cardText) || !/Suburb:/i.test(cardText)) continue;

      const titleMatch = cardText.match(/\[([^\]]+)\]\s+(.+?)\s+(Available|Sold|Under Offer|Coming Soon)/i);
      const lotMatch = cardText.match(/\bLot\s+\d+[A-Za-z0-9-]*\b/i);
      const estateMatch = cardText.match(/\[([^\]]+)\]/);
      const priceMatch = cardText.match(/Price:\s*(\$[\d,]+)/i);
      const sizeMatch = cardText.match(/Land size\s*([\d,.]+)m²/i);
      const frontageMatch = cardText.match(/Frontage\s*([\d,.]+m)/i);
      const depthMatch = cardText.match(/Depth\s*([\d,.]+m)/i);
      const suburbMatch = cardText.match(/Suburb:\s*([A-Za-z' -]+\s+[A-Z]{2}\s+\d{4})/i);
      const statusMatch = cardText.match(/\b(Available|Sold|Under Offer|Coming Soon)\b/i);

      rows.push({
        estate: estateMatch ? clean(estateMatch[1]) : null,
        title: titleMatch ? clean(titleMatch[2]) : clean(anchor.textContent),
        lotLabel: lotMatch ? clean(lotMatch[0]) : null,
        priceText: priceMatch ? clean(priceMatch[1]) : null,
        landSizeText: sizeMatch ? clean(sizeMatch[1] + 'm²') : null,
        frontageText: frontageMatch ? clean(frontageMatch[1]) : null,
        depthText: depthMatch ? clean(depthMatch[1]) : null,
        suburbText: suburbMatch ? clean(suburbMatch[1]) : null,
        status: statusMatch ? clean(statusMatch[1]) : 'Available',
        href: anchor.href,
        cardText,
      });
    }

    const deduped = Array.from(new Map(rows.map(row => [JSON.stringify([row.href, row.lotLabel, row.priceText, row.landSizeText]), row])).values());

    return {
      title: document.title,
      url: location.href,
      heading: clean(document.querySelector('h1')?.textContent || ''),
      count: deduped.length,
      rows: deduped,
    };
  }`;
}

function parseMoney(value) {
  const digits = String(value || '').replace(/[^\d]/g, '');
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseAreaM2(value) {
  const n = Number(String(value || '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeBrowserRows(result = {}, context = {}) {
  const rows = Array.isArray(result.rows) ? result.rows : [];
  return rows.map((row, index) => ({
    id: [row.href || 'openlot', row.lotLabel || row.title || index, row.priceText || 'na', row.landSizeText || 'na'].join('|'),
    address: [row.lotLabel, row.title].filter(Boolean).join(' '),
    suburb: context.suburb || row.suburbText || '',
    state: context.state || '',
    postcode: context.postcode ? String(context.postcode) : '',
    lotSize: parseAreaM2(row.landSizeText),
    price: parseMoney(row.priceText),
    listPrice: parseMoney(row.priceText),
    status: String(row.status || 'listing').toLowerCase(),
    propertyType: 'land',
    estate: row.estate || null,
    frontage: row.frontageText || null,
    depth: row.depthText || null,
    title: row.title || null,
    lotLabel: row.lotLabel || null,
    url: row.href || null,
    raw: row,
  })).filter(row => row.url && (row.price || row.lotSize || row.address));
}

module.exports = {
  buildWizardPlan,
  extractEmbeddedJson,
  extractResultCards,
  summarizeResultArtifacts,
  buildBrowserResultExtractor,
  normalizeBrowserRows,
  parseMoney,
  parseAreaM2,
};
