#!/usr/bin/env node
// REA (realestate.com.au) scraper via Apify actor: abotapi/realestate-au-scraper
// Scrapes land listings and sold data, feeds into our SQLite DB

const fs = require('fs');
const path = require('path');
const { getLandFilterConfig, normalizeLot, matchesLandFilter } = require('../lib/land-filter');

function resolveApifyToken() {
  const candidates = [
    process.env.APIFY_TOKEN,
    process.env.RLP_APIFY_TOKEN,
  ].filter(Boolean);

  const fileCandidates = [
    process.env.APIFY_TOKEN_FILE,
    path.join(__dirname, '..', '..', 'credentials', 'apify-token.txt'),
    '/root/.openclaw-luna/credentials/apify-token.txt',
  ].filter(Boolean);

  for (const value of candidates) {
    if (String(value).trim()) return String(value).trim();
  }

  for (const file of fileCandidates) {
    try {
      if (fs.existsSync(file)) {
        const token = fs.readFileSync(file, 'utf8').trim();
        if (token) return token;
      }
    } catch (_) {}
  }

  return null;
}

const DEFAULT_ACTOR_ID = 'abotapi~realestate-au-scraper';
const BASE_URL = 'https://api.apify.com/v2';

function resolveActorIds() {
  const raw = [
    process.env.REA_APIFY_ACTOR_IDS,
    process.env.APIFY_ACTOR_IDS,
    process.env.REA_APIFY_ACTOR_ID,
    process.env.APIFY_ACTOR_ID,
  ].filter(Boolean);

  const actorIds = raw
    .flatMap(value => String(value).split(','))
    .map(value => value.trim())
    .filter(Boolean);

  if (actorIds.length === 0) return [DEFAULT_ACTOR_ID];
  return [...new Set(actorIds)];
}

function getApifyToken() {
  return resolveApifyToken();
}

function hasApifyToken() {
  return Boolean(getApifyToken());
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function getReaRetryConfig() {
  const attempts = Number(process.env.REA_APIFY_MAX_ATTEMPTS || process.env.REA_MAX_ATTEMPTS || 2);
  const backoffMs = Number(process.env.REA_APIFY_RETRY_BACKOFF_MS || process.env.REA_RETRY_BACKOFF_MS || 15000);
  return {
    attempts: Number.isFinite(attempts) && attempts > 0 ? attempts : 2,
    backoffMs: Number.isFinite(backoffMs) && backoffMs >= 0 ? backoffMs : 15000,
  };
}

function getReaRuntimeConfig() {
  const runTimeoutMs = Number(process.env.REA_APIFY_RUN_TIMEOUT_MS || process.env.REA_RUN_TIMEOUT_MS || 20 * 60 * 1000);
  const datasetPageSize = Number(process.env.REA_APIFY_DATASET_PAGE_SIZE || process.env.REA_DATASET_PAGE_SIZE || 1000);
  const datasetReadCap = Number(process.env.REA_APIFY_DATASET_READ_CAP || process.env.REA_DATASET_READ_CAP || 10000);
  return {
    runTimeoutMs: Number.isFinite(runTimeoutMs) && runTimeoutMs > 0 ? runTimeoutMs : 20 * 60 * 1000,
    datasetPageSize: Number.isFinite(datasetPageSize) && datasetPageSize > 0 ? Math.min(datasetPageSize, 1000) : 1000,
    datasetReadCap: Number.isFinite(datasetReadCap) && datasetReadCap > 0 ? datasetReadCap : 10000,
  };
}

function attachReaMeta(items, meta) {
  if (!Array.isArray(items)) return items;
  Object.defineProperty(items, 'reaMeta', {
    value: meta,
    enumerable: false,
    configurable: true,
    writable: true,
  });
  return items;
}

async function abortActorRun(runId, apifyToken) {
  try {
    await fetch(`${BASE_URL}/actor-runs/${runId}/abort?token=${apifyToken}`, { method: 'POST' });
  } catch (_) {}
}

async function fetchDatasetItems(datasetId, apifyToken, maxListings = 10000) {
  const runtimeConfig = getReaRuntimeConfig();
  const pageSize = Math.max(1, Math.min(runtimeConfig.datasetPageSize, maxListings || runtimeConfig.datasetPageSize));
  const hardCap = Math.max(pageSize, Math.min(runtimeConfig.datasetReadCap, maxListings || runtimeConfig.datasetReadCap));
  const items = [];
  let offset = 0;
  let pagesFetched = 0;

  while (offset < hardCap) {
    const limit = Math.min(pageSize, hardCap - offset);
    const dataRes = await fetch(`${BASE_URL}/datasets/${datasetId}/items?token=${apifyToken}&format=json&offset=${offset}&limit=${limit}`);

    if (!dataRes.ok) {
      throw new Error(`Failed to fetch results for dataset ${datasetId}: ${dataRes.status}`);
    }

    const pageItems = await dataRes.json();
    pagesFetched++;

    if (!Array.isArray(pageItems) || pageItems.length === 0) break;

    items.push(...pageItems);
    offset += pageItems.length;

    if (pageItems.length < limit) break;
  }

  return {
    items,
    pagesFetched,
    truncated: items.length >= hardCap,
    readCap: hardCap,
    pageSize,
  };
}

function resolveReaLimits(mode = 'bulk', overrides = {}) {
  const explicitListings = Number(overrides.maxListings);
  const explicitPages = Number(overrides.maxPages);
  const explicitDateRange = overrides.dateRange;

  return {
    maxListings: Number.isFinite(explicitListings) && explicitListings > 0
      ? explicitListings
      : mode === 'test' ? 100
      : mode === 'delta' ? 300
      : 2000,
    maxPages: Number.isFinite(explicitPages) && explicitPages > 0
      ? explicitPages
      : mode === 'test' ? 1
      : mode === 'delta' ? 3
      : 20,
    dateRange: explicitDateRange || (mode === 'delta' ? '3months' : '12months'),
  };
}

async function runActorOnce(actorId, apifyToken, locations, listingType = 'buy', maxListings = 500, maxPages = 20, dateRange = '12months') {
  const runtimeConfig = getReaRuntimeConfig();
  const input = {
    mode: 'location',
    locations,
    listingType,
    propertyTypes: ['land'],
    maxListings,
    maxPages,
    includeSurrounding: false,
    outputFormat: ['json'],
    requestDelay: { min: 2000, max: 5000 },
    resumeFromCheckpoint: true,
  };

  if (listingType === 'sold') {
    input.dateRange = dateRange;
  }

  console.log(`Starting REA ${listingType} scrape for ${locations.length} locations via actor ${actorId}...`);

  const startRes = await fetch(`${BASE_URL}/acts/${actorId}/runs?token=${apifyToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!startRes.ok) {
    const err = await startRes.text();
    throw new Error(`Failed to start actor ${actorId}: ${startRes.status} ${err}`);
  }

  const run = await startRes.json();
  const runId = run.data.id;
  console.log(`  Run started: ${runId}`);
  console.log(`  Console: https://console.apify.com/actors/${actorId}/runs/${runId}`);

  let status = 'RUNNING';
  let attempts = 0;
  const startedAt = Date.now();
  while (status === 'RUNNING' || status === 'READY') {
    await sleep(10000);
    attempts++;

    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs > runtimeConfig.runTimeoutMs) {
      await abortActorRun(runId, apifyToken);
      const timeoutError = new Error(`Actor ${actorId} run ${runId} exceeded timeout after ${Math.round(elapsedMs / 1000)}s`);
      timeoutError.code = 'ETIMEDOUT';
      timeoutError.reaMeta = {
        actorId,
        runId,
        status,
        timedOut: true,
        timeoutMs: runtimeConfig.runTimeoutMs,
        elapsedMs,
      };
      throw timeoutError;
    }

    const statusRes = await fetch(`${BASE_URL}/actor-runs/${runId}?token=${apifyToken}`);
    const statusData = await statusRes.json();
    status = statusData.data.status;

    if (attempts % 6 === 0) {
      console.log(`  Status: ${status} (${Math.round(attempts * 10 / 60)}min elapsed)`);
    }
  }

  if (status !== 'SUCCEEDED') {
    const statusError = new Error(`Actor ${actorId} run ${runId} failed with status: ${status}`);
    statusError.reaMeta = { actorId, runId, status, timedOut: false };
    throw statusError;
  }

  const datasetId = run.data.defaultDatasetId;
  const dataset = await fetchDatasetItems(datasetId, apifyToken, maxListings);
  const items = attachReaMeta(dataset.items, {
    actorId,
    runId,
    datasetId,
    status,
    timedOut: false,
    truncated: dataset.truncated || dataset.items.length >= maxListings,
    maxListingsRequested: maxListings,
    maxPagesRequested: maxPages,
    pagesFetched: dataset.pagesFetched,
    datasetPageSize: dataset.pageSize,
    datasetReadCap: dataset.readCap,
    elapsedMs: Date.now() - startedAt,
  });

  console.log(`  Got ${items.length} raw listings via actor ${actorId}${items.reaMeta.truncated ? ' (truncated)' : ''}`);
  return items;
}

// Run the actor for a batch of locations with actor failover + retries.
async function runReaActor(locations, listingType = 'buy', maxListings = 500, maxPages = 20, dateRange = '12months') {
  const apifyToken = getApifyToken();
  if (!apifyToken) {
    throw new Error('APIFY token not configured. Set APIFY_TOKEN, RLP_APIFY_TOKEN, APIFY_TOKEN_FILE, or credentials/apify-token.txt');
  }

  const actorIds = resolveActorIds();
  const retryConfig = getReaRetryConfig();
  const errors = [];
  let lastError = null;

  for (const actorId of actorIds) {
    for (let attempt = 1; attempt <= retryConfig.attempts; attempt++) {
      try {
        return await runActorOnce(actorId, apifyToken, locations, listingType, maxListings, maxPages, dateRange);
      } catch (error) {
        lastError = error;
        const metaSuffix = error?.reaMeta
          ? ` ${JSON.stringify({ timedOut: Boolean(error.reaMeta.timedOut), status: error.reaMeta.status || null, runId: error.reaMeta.runId || null })}`
          : '';
        const message = `[REA] actor=${actorId} attempt=${attempt}/${retryConfig.attempts} failed: ${error.message}${metaSuffix}`;
        errors.push(message);
        console.error(message);
        const isLastAttempt = attempt === retryConfig.attempts;
        if (!isLastAttempt) {
          await sleep(retryConfig.backoffMs * attempt);
        }
      }
    }
  }

  const finalMessage = `REA actor failed after ${actorIds.length} actor option(s): ${errors.join(' | ')}`;
  if (lastError) {
    lastError.message = finalMessage;
    throw lastError;
  }
  throw new Error(finalMessage);
}

// Transform REA listing to our lot format
function transformLot(item, listingType, options = {}) {
  const filters = getLandFilterConfig(options);
  const addr = item.address || {};
  const features = item.features || {};
  const price = item.price || {};

  const lotSize = Number(features.landSize || item.landSize || 0);
  const lotPrice = Number(price.value || price.min || item.priceNumeric || 0);

  // Sold-specific fields
  const soldPrice = Number(item.soldPrice || item.price?.soldPrice || lotPrice || 0);
  const soldDate = item.soldDate || null;
  const listedDate = item.listedDate || item.dateListed || null;

  const finalPrice = listingType === 'sold' ? (soldPrice || lotPrice) : lotPrice;
  const pricePerSqm = lotSize > 0 && finalPrice > 0
    ? Math.round((finalPrice / lotSize) * 100) / 100
    : 0;

  return normalizeLot({
    address: addr.full || addr.street || item.addressText || '',
    suburb: (addr.suburb || item.suburb || '').toUpperCase(),
    state: (addr.state || item.state || '').toUpperCase(),
    postcode: addr.postcode || item.postcode || '',
    lga: '', // REA doesn't provide LGA — we'll map it later
    lot_size: lotSize,
    price: finalPrice,
    list_price: listingType === 'buy' ? finalPrice : null,
    sold_price: listingType === 'sold' ? finalPrice : null,
    status: listingType === 'sold' ? 'sold' : 'listing',
    list_date: listingType === 'buy'
      ? (listedDate ? new Date(listedDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])
      : null,
    sold_date: soldDate ? new Date(soldDate).toISOString().split('T')[0] : null,
    price_per_sqm: pricePerSqm,
    property_type: item.propertyType || item.propertyTypes?.[0] || filters.propertyType,
    source: 'rea',
    source_id: item.propertyId || item.id || '',
    source_url: item.url || '',
    corridor: '', // Mapped later
    is_outlier: false,
    raw_json: JSON.stringify(item),
  }, filters);
}

// Filter lots to our criteria
function filterLot(lot, options = {}) {
  return matchesLandFilter(lot, getLandFilterConfig(options));
}

// Batch locations into groups (to avoid hitting actor limits)
function batchLocations(suburbs, batchSize = 25) {
  const batches = [];
  for (let i = 0; i < suburbs.length; i += batchSize) {
    batches.push(suburbs.slice(i, i + batchSize).map(s => ({
      suburb: s.suburb,
      state: s.state || 'VIC',
      postcode: s.postcode ? String(s.postcode) : undefined,
    })));
  }
  return batches;
}

module.exports = { runReaActor, resolveReaLimits, transformLot, filterLot, batchLocations, getApifyToken, hasApifyToken };
