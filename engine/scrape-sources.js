#!/usr/bin/env node
// Multi-source suburb orchestrator
// Runs Domain + OpenLot + REA under one job contract with shared land filters.

const { getLandFilterConfig } = require('./lib/land-filter');
const { dedupLots } = require('./lib/dedup-js');
const domain = require('./scrapers/domain-public');
// const openlot = require('./scrapers/openlot-public'); // OpenLot removed from pipeline
const rea = require('./scrapers/rea-custom');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    out[arg.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return out;
}

function parseSources(value) {
  return String(value || 'domain,openlot,rea')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(s => s && s !== 'openlot'); // OpenLot removed from pipeline
}

function resolveMaxPages(mode = 'bulk', requestedMaxPages = null) {
  const explicit = Number(requestedMaxPages);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  if (mode === 'test') return 1;
  if (mode === 'delta') return 3;
  return 999;
}

async function runSource(source, target, filters, maxPages, options = {}) {
  if (source === 'domain') {
    const lots = await domain.scrapeSuburb(target.suburb, target.state, target.postcode, target.lga, target.corridor, { ...filters, maxPages });
    return { source, lots, status: 'ok' };
  }

  // OpenLot removed from pipeline
  // if (source === 'openlot') {
  //   const lots = await openlot.scrapeSuburb(
  //     target.suburb, target.state, target.postcode,
  //     target.lga, target.corridor,
  //     { ...filters, maxPages }
  //   );
  //   return { source, lots, status: 'ok' };
  // }

  if (source === 'rea') {
    const lots = await rea.scrapeSuburb(
      target.suburb, target.state, target.postcode,
      target.lga, target.corridor,
      { ...filters, maxPages }
    );
    return { source, lots, status: 'ok' };
  }

  return { source, lots: [], status: 'skipped', error: `Unknown source: ${source}` };
}

async function runJob(target, filters, sources, maxPages, options = {}) {
  const results = [];

  for (const source of sources) {
    try {
      const result = await runSource(source, target, filters, maxPages, options);
      results.push(result);
    } catch (error) {
      results.push({ source, lots: [], status: 'error', error: error.message });
    }
  }

  const combinedLots = dedupLots(results.flatMap(r => r.lots || []));
  return { results, combinedLots };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = {
    suburb: args.suburb || 'Tarneit',
    state: (args.state || 'VIC').toUpperCase(),
    postcode: String(args.postcode || '3029'),
    lga: args.lga || '',
    corridor: args.corridor || '',
  };

  const filters = getLandFilterConfig({
    minLandSize: args.minLandSize,
    maxLandSize: args.maxLandSize,
    minPrice: args.minPrice,
    maxPrice: args.maxPrice,
  });
  const mode = String(args.mode || 'bulk').toLowerCase();
  const maxPages = resolveMaxPages(mode, args.maxPages);
  const sources = parseSources(args.sources);

  const startedAt = new Date().toISOString();
  const { results, combinedLots } = await runJob(target, filters, sources, maxPages, {
    mode,
    reaMaxListings: args.reaMaxListings,
    reaDateRange: args.reaDateRange,
  });

  const summary = {
    target,
    filters,
    startedAt,
    finishedAt: new Date().toISOString(),
    mode,
    maxPages,
    totals: results.reduce((acc, r) => {
      acc[r.source] = { status: r.status, count: r.lots.length, error: r.error || null };
      return acc;
    }, {}),
    rea: {
      maxListings: args.reaMaxListings ? Number(args.reaMaxListings) : null,
      dateRange: args.reaDateRange || null,
    },
    combined: {
      count: combinedLots.length,
    },
  };

  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runSource, runJob, parseSources, resolveMaxPages };
