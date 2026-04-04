#!/usr/bin/env node
// National queue generator + runner for bulk ingest / daily drips.
// Uses discovered active suburbs as the seed set and the shared suburb orchestrator as the execution unit.

const fs = require('fs');
const path = require('path');
const { runSource, runJob, parseSources, resolveMaxPages } = require('./scrape-sources');
const { getLandFilterConfig } = require('./lib/land-filter');
const { initDb, getDb, upsertLot, insertScrapeRun } = require('./db');
// REA custom scraper — no token needed (direct browser scraping)

const DATA_DIR = path.join(__dirname, 'data');
const PROGRESS_DIR = path.join(DATA_DIR, 'queue-progress');
fs.mkdirSync(PROGRESS_DIR, { recursive: true });

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    out[arg.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return out;
}

function loadActiveSuburbs(states, filters = {}) {
  const rows = [];
  for (const state of states) {
    const file = path.join(DATA_DIR, `active-suburbs-${state.toLowerCase()}.json`);
    if (!fs.existsSync(file)) continue;
    const list = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const row of list) {
      rows.push({
        suburb: row.suburb,
        postcode: String(row.postcode || ''),
        state: row.state || state,
        listings: Number(row.listings || 0),
        lga: row.lga || '',
        corridor: row.corridor || '',
      });
    }
  }

  return rows.filter(row => {
    if (filters.suburb && String(row.suburb).toLowerCase() !== String(filters.suburb).toLowerCase()) return false;
    if (filters.state && String(row.state).toUpperCase() !== String(filters.state).toUpperCase()) return false;
    if (filters.postcode && String(row.postcode) !== String(filters.postcode)) return false;
    return true;
  });
}

function buildQueue(rows, options = {}) {
  const mode = options.mode || 'bulk';
  const sorted = [...rows].sort((a, b) => {
    if (mode === 'bulk') return (b.listings || 0) - (a.listings || 0);
    return a.suburb.localeCompare(b.suburb);
  });
  const queueLimit = Number(options.queueLimit || 0);
  const seeded = Number.isFinite(queueLimit) && queueLimit > 0
    ? sorted.slice(0, queueLimit)
    : sorted;

  return seeded.map((row, idx) => ({
    id: `${row.state}:${row.suburb}:${row.postcode}`,
    priority: idx + 1,
    mode,
    target: row,
    status: 'pending',
    attempts: 0,
    lastRunAt: null,
    sourceResults: {},
    reaMaxListings: options.reaMaxListings || null,
    reaDateRange: options.reaDateRange || null,
  }));
}

function progressPath(name) {
  return path.join(PROGRESS_DIR, `${name}.json`);
}

function saveProgress(name, queue, meta = {}) {
  fs.writeFileSync(progressPath(name), JSON.stringify({
    meta: { updatedAt: new Date().toISOString(), ...meta },
    queue,
  }, null, 2));
}

function loadProgress(name) {
  const file = progressPath(name);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function buildOpenlotPayloadKeys(job) {
  return [
    `${job.target.state}:${job.target.suburb}:${job.target.postcode}`,
    `${job.target.suburb}|${job.target.state}|${job.target.postcode}`,
    `${job.target.suburb}|${job.target.state}`,
    job.id,
  ];
}

function loadOpenlotBrowserResults(args = {}) {
  const file = args.openlotBrowserResultsFile || args.openlotBrowserResultFile || null;
  const dir = args.openlotBrowserResultsDir || null;
  const manifestFile = args.openlotBrowserResultsManifest || null;
  if (!file && !dir && !manifestFile) return null;

  if (manifestFile) {
    if (!fs.existsSync(manifestFile)) {
      throw new Error(`OpenLot browser results manifest not found: ${manifestFile}`);
    }
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    const out = {};
    for (const entry of manifest.payloads || []) {
      if (!entry.key || !entry.file) continue;
      if (!fs.existsSync(entry.file)) continue;
      const payload = JSON.parse(fs.readFileSync(entry.file, 'utf8'));
      out[entry.key] = payload;
    }
    return out;
  }

  if (dir) {
    if (!fs.existsSync(dir)) {
      throw new Error(`OpenLot browser results directory not found: ${dir}`);
    }
    const out = {};
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.json')) continue;
      const fullPath = path.join(dir, name);
      const payload = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      if (Array.isArray(payload.rows)) {
        const base = path.basename(name, '.json');
        out[base] = payload;
      } else if (payload && typeof payload === 'object') {
        Object.assign(out, payload);
      }
    }
    return out;
  }

  if (!fs.existsSync(file)) {
    throw new Error(`OpenLot browser results file not found: ${file}`);
  }

  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (Array.isArray(payload.rows)) {
    const key = args.openlotBrowserResultKey || null;
    if (!key) {
      throw new Error('Single OpenLot browser payload file requires --openlotBrowserResultKey');
    }
    return { [key]: payload };
  }

  return payload;
}

function resolveOpenlotBrowserResult(job, sources, options = {}) {
  if (!sources.includes('openlot')) return null;
  if (options.openlotBrowserResult) return options.openlotBrowserResult;
  const map = options.openlotBrowserResults || null;
  if (!map) return null;

  const normalizedMap = new Map(Object.entries(map).map(([key, value]) => [String(key).toLowerCase(), value]));
  const candidates = buildOpenlotPayloadKeys(job);
  for (const key of candidates) {
    const match = normalizedMap.get(String(key).toLowerCase());
    if (match) return match;
  }
  return null;
}

async function processJob(job, sources, filters, maxPages, db = null, options = {}) {
  job.attempts += 1;
  job.lastRunAt = new Date().toISOString();
  job.status = 'running';
  const startedAt = new Date().toISOString();

  try {
    const { results, combinedLots } = await runJob(job.target, filters, sources, maxPages, {
      mode: job.mode || 'bulk',
      reaMaxListings: job.reaMaxListings,
      reaDateRange: job.reaDateRange,
      openlotBrowserResult: resolveOpenlotBrowserResult(job, sources, options),
      openlotLive: options.openlotLive,
      runStamp: options.runStamp,
      liveRoot: options.liveRoot,
    });

    for (const result of results) {
      const inserted = 0;
      const updated = 0;
      job.sourceResults[result.source] = {
        status: result.status,
        count: result.lots.length,
        inserted,
        updated,
        error: result.error || null,
        finishedAt: new Date().toISOString(),
      };
    }

    let combinedInserted = 0;
    let combinedUpdated = 0;
    if (db) {
      const tx = db.transaction((lots) => {
        for (const lot of lots) {
          const r = upsertLot(db, lot);
          if (r.action === 'inserted') combinedInserted++;
          else combinedUpdated++;
        }
      });
      tx(combinedLots);

      insertScrapeRun(db, {
        source: `queue-${sources.join('+')}`,
        suburb: job.target.suburb,
        state: job.target.state,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        lots_found: combinedLots.length,
        lots_new: combinedInserted,
        lots_updated: combinedUpdated,
        status: results.some(r => r.status === 'error') ? 'partial' : 'ok',
        error: results.filter(r => r.status === 'error').map(r => `${r.source}: ${r.error}`).join('; ') || null,
      });
    }

    job.combinedResult = {
      count: combinedLots.length,
      inserted: combinedInserted,
      updated: combinedUpdated,
      finishedAt: new Date().toISOString(),
    };

    const hasError = results.some(r => r.status === 'error');
    job.status = hasError ? 'partial' : 'done';
    return job;
  } catch (error) {
    if (db) {
      insertScrapeRun(db, {
        source: `queue-${sources.join('+')}`,
        suburb: job.target.suburb,
        state: job.target.state,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        lots_found: 0,
        lots_new: 0,
        lots_updated: 0,
        status: 'error',
        error: error.message,
      });
    }
    job.status = 'partial';
    job.error = error.message;
    return job;
  }
}

function filterUnavailableSources(sources) {
  // All sources are always available now (REA uses direct browser scraping)
  return sources.filter(Boolean);
}

function resolveWorkerConcurrency(args = {}, sources = []) {
  const requestedRaw = args.concurrency ?? args.workers ?? args.workerConcurrency ?? null;
  const requested = Number(requestedRaw);
  const requestedConcurrency = Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : null;
  const hasRea = sources.includes('rea');
  const allowParallelRea = String(args.allowParallelRea || '').toLowerCase() === 'true';

  if (hasRea && !allowParallelRea) {
    if (requestedConcurrency && requestedConcurrency > 1) {
      console.warn(`[queue-runner] REA source detected; forcing concurrency=1 (requested ${requestedConcurrency}). Pass --allowParallelRea true to override.`);
    }
    return 1;
  }

  if (requestedConcurrency) return requestedConcurrency;
  return 1;
}

async function runPendingJobs(jobs, handler, options = {}) {
  const requestedConcurrency = Number(options.concurrency);
  const concurrency = Number.isFinite(requestedConcurrency) && requestedConcurrency > 0
    ? Math.max(1, Math.floor(requestedConcurrency))
    : 1;

  if (!Array.isArray(jobs) || jobs.length === 0) return [];

  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
    while (true) {
      const idx = cursor;
      cursor += 1;
      if (idx >= jobs.length) return;
      await handler(jobs[idx], idx);
    }
  });

  await Promise.all(workers);
  return jobs;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const states = String(args.states || 'VIC,NSW,QLD,WA,SA,TAS,NT,ACT')
    .split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  const requestedSources = parseSources(args.sources || 'domain');
  const sources = filterUnavailableSources(requestedSources);
  if (sources.length === 0) {
    throw new Error(`No runnable sources available from requested set: ${requestedSources.join(',')}`);
  }

  const filters = getLandFilterConfig({
    minLandSize: args.minLandSize,
    maxLandSize: args.maxLandSize,
    minPrice: args.minPrice,
    maxPrice: args.maxPrice,
  });
  const openlotBrowserResults = loadOpenlotBrowserResults(args);
  const mode = args.mode || 'bulk';
  const maxJobs = Number(args.maxJobs || 10);
  const maxPages = resolveMaxPages(mode, args.maxPages);
  const queueLimit = Number(args.queueLimit || args.maxQueueJobs || 0) || (mode === 'test' ? maxJobs : 0);
  const queueName = args.queueName || `national-${mode}-${states.join('-').toLowerCase()}`;
  const workerConcurrency = resolveWorkerConcurrency(args, sources);

  initDb();
  const db = getDb();

  let state = loadProgress(queueName);
  if (!state) {
    const rows = loadActiveSuburbs(states, {
      suburb: args.suburb || null,
      state: args.suburb ? (args.state || null) : null,
      postcode: args.postcode || null,
    });
    const queue = buildQueue(rows, {
      mode,
      queueLimit,
      reaMaxListings: args.reaMaxListings,
      reaDateRange: args.reaDateRange,
    });
    state = { meta: { createdAt: new Date().toISOString(), mode, states, sources, filters, maxPages, queueLimit }, queue };
    saveProgress(queueName, queue, state.meta);
  }

  const pending = state.queue.filter(job => job.status === 'pending' || job.status === 'partial').slice(0, maxJobs);
  await runPendingJobs(pending, async (job) => {
    await processJob(job, sources, filters, maxPages, db, {
      openlotBrowserResults,
      openlotLive: String(args.openlotLive || '').toLowerCase() === 'true',
      runStamp: args.runStamp || null,
      liveRoot: args.liveRoot || null,
    });
    saveProgress(queueName, state.queue, state.meta);
  }, { concurrency: workerConcurrency });

  const summary = {
    queueName,
    mode,
    states,
    sources,
    filters,
    maxPages,
    workerConcurrency,
    totalJobs: state.queue.length,
    processedThisRun: pending.length,
    done: state.queue.filter(j => j.status === 'done').length,
    partial: state.queue.filter(j => j.status === 'partial').length,
    pending: state.queue.filter(j => j.status === 'pending').length,
    topJobsThisRun: pending.map(j => ({ id: j.id, status: j.status, sourceResults: j.sourceResults, combinedResult: j.combinedResult || null })),
  };

  db.close();
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { loadActiveSuburbs, buildQueue, processJob, resolveOpenlotBrowserResult, filterUnavailableSources, loadOpenlotBrowserResults, buildOpenlotPayloadKeys, resolveWorkerConcurrency, runPendingJobs };
