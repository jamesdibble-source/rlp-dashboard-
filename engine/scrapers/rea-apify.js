#!/usr/bin/env node
// REA (realestate.com.au) scraper via Apify actor: abotapi/realestate-au-scraper
// Scrapes land listings and sold data, feeds into our SQLite DB

const fs = require('fs');
const path = require('path');

const APIFY_TOKEN = fs.readFileSync('/root/.openclaw-luna/credentials/apify-token.txt', 'utf8').trim();
const ACTOR_ID = 'abotapi~realestate-au-scraper';
const BASE_URL = 'https://api.apify.com/v2';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Run the actor for a batch of locations
async function runReaActor(locations, listingType = 'buy', maxListings = 500, maxPages = 20, dateRange = '12months') {
  const input = {
    mode: 'location',
    locations: locations,
    listingType: listingType,
    propertyTypes: ['land'],  // LAND ONLY
    maxListings: maxListings,
    maxPages: maxPages,
    includeSurrounding: false,  // Don't bleed into neighbouring suburbs
    outputFormat: ['json'],
    requestDelay: { min: 2000, max: 5000 },
    resumeFromCheckpoint: true,
  };
  
  // Add date range for sold listings
  if (listingType === 'sold') {
    input.dateRange = dateRange;
  }

  console.log(`Starting REA ${listingType} scrape for ${locations.length} locations...`);
  
  // Start the actor run
  const startRes = await fetch(`${BASE_URL}/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!startRes.ok) {
    const err = await startRes.text();
    throw new Error(`Failed to start actor: ${startRes.status} ${err}`);
  }

  const run = await startRes.json();
  const runId = run.data.id;
  console.log(`  Run started: ${runId}`);
  console.log(`  Console: https://console.apify.com/actors/${ACTOR_ID}/runs/${runId}`);

  // Poll for completion
  let status = 'RUNNING';
  let attempts = 0;
  while (status === 'RUNNING' || status === 'READY') {
    await sleep(10000); // Check every 10s
    attempts++;
    
    const statusRes = await fetch(`${BASE_URL}/actor-runs/${runId}?token=${APIFY_TOKEN}`);
    const statusData = await statusRes.json();
    status = statusData.data.status;
    
    if (attempts % 6 === 0) {
      console.log(`  Status: ${status} (${Math.round(attempts * 10 / 60)}min elapsed)`);
    }
  }

  if (status !== 'SUCCEEDED') {
    console.error(`  Run failed with status: ${status}`);
    return [];
  }

  // Fetch results from dataset
  const datasetId = run.data.defaultDatasetId;
  const dataRes = await fetch(`${BASE_URL}/datasets/${datasetId}/items?token=${APIFY_TOKEN}&format=json&limit=10000`);
  
  if (!dataRes.ok) {
    throw new Error(`Failed to fetch results: ${dataRes.status}`);
  }

  const items = await dataRes.json();
  console.log(`  Got ${items.length} raw listings`);

  return items;
}

// Transform REA listing to our lot format
function transformLot(item, listingType) {
  const addr = item.address || {};
  const features = item.features || {};
  const price = item.price || {};
  
  const lotSize = features.landSize || 0;
  const lotPrice = price.value || price.min || 0;
  
  // Sold-specific fields
  const soldPrice = item.soldPrice || item.price?.soldPrice || lotPrice;
  const soldDate = item.soldDate || null;
  
  const finalPrice = listingType === 'sold' ? (soldPrice || lotPrice) : lotPrice;
  
  return {
    address: addr.full || addr.street || '',
    suburb: (addr.suburb || '').toUpperCase(),
    state: (addr.state || '').toUpperCase(),
    postcode: addr.postcode || '',
    lga: '', // REA doesn't provide LGA — we'll map it later
    lot_size: lotSize,
    price: finalPrice,
    list_price: listingType === 'buy' ? finalPrice : null,
    sold_price: listingType === 'sold' ? finalPrice : null,
    price_per_sqm: (finalPrice && lotSize > 0) ? Math.round((finalPrice / lotSize) * 100) / 100 : 0,
    status: listingType === 'sold' ? 'sold' : 'listing',
    list_date: listingType === 'buy' ? new Date().toISOString().split('T')[0] : null,
    sold_date: soldDate ? new Date(soldDate).toISOString().split('T')[0] : null,
    source: 'rea',
    source_id: item.propertyId || item.id || '',
    source_url: item.url || '',
    corridor: '', // Mapped later
    is_outlier: false,
  };
}

// Filter lots to our criteria
function filterLot(lot) {
  if (!lot.price || lot.price < 50000 || lot.price > 5000000) return false;
  if (!lot.lot_size || lot.lot_size < 150 || lot.lot_size > 2000) return false;
  if (!lot.suburb) return false;
  return true;
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

module.exports = { runReaActor, transformLot, filterLot, batchLocations, APIFY_TOKEN };
