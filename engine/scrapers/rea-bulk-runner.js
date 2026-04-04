// engine/scrapers/rea-bulk-runner.js
// Bulk REA scraping orchestrator — session rotation, checkpointing,
// ban detection, and rate-limit escalation ladder.
// See REA-RESILIENCE.md for architecture details.

const path = require('path');
const fs = require('fs');
const { scrapeSuburb, createBrowser } = require('./rea-custom');

// ──── Paths ────

const DATA_DIR = path.join(__dirname, '..', 'data');
const PROGRESS_PATH = path.join(DATA_DIR, 'rea-progress.json');
const LOG_PATH = path.join(DATA_DIR, 'rea-run.log');

// ──── Config (env overrides) ────

const BATCH_SIZE = parseInt(process.env.REA_BATCH_SIZE || '25', 10);
const SUBURB_DELAY_MIN = parseInt(process.env.REA_SUBURB_DELAY_MIN || '30000', 10);
const SUBURB_DELAY_MAX = parseInt(process.env.REA_SUBURB_DELAY_MAX || '60000', 10);

// ──── Escalation thresholds ────

const SOFT_BLOCK_THRESHOLD = 3;
const HARD_BLOCK_THRESHOLD = 5;
const SOFT_BLOCK_PAUSE_MS = 10 * 60 * 1000;  // 10 minutes
const HARD_BLOCK_PAUSE_MS = 30 * 60 * 1000;  // 30 minutes
const DEESCALATION_STREAK = 10;

// Elevated delay values
const SOFT_DELAY_MIN = 45000;
const SOFT_DELAY_MAX = 90000;
const SOFT_DELAY_SUBURBS = 10;
const HARD_DELAY_MIN = 60000;
const HARD_DELAY_MAX = 120000;
const HARD_DELAY_SUBURBS = 20;

// ──── Helpers ────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_PATH, line + '\n'); } catch (_) {}
}

function suburbKey(s) {
  return `${s.suburb}|${s.state}|${s.postcode}`;
}

// ──── Progress file ────

function loadProgress() {
  try {
    if (!fs.existsSync(PROGRESS_PATH)) return null;
    return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf-8'));
  } catch (e) {
    log(`Progress file corrupt: ${e.message}. Starting fresh.`);
    try {
      fs.renameSync(PROGRESS_PATH, `${PROGRESS_PATH}.corrupt.${Date.now()}`);
    } catch (_) {}
    return null;
  }
}

function saveProgress(progress) {
  const tmp = PROGRESS_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(progress, null, 2));
  fs.renameSync(tmp, PROGRESS_PATH);
}

// ──── Orchestrator ────

async function runBulkREA(suburbs, options = {}) {
  const allLots = [];

  // Load or initialise progress
  let progress = loadProgress();
  const completedSet = new Set();

  if (progress && Array.isArray(progress.completedSuburbs)) {
    for (const key of progress.completedSuburbs) completedSet.add(key);
    log(`Resuming: ${completedSet.size} suburbs already completed`);
  } else {
    progress = {
      startedAt: new Date().toISOString(),
      lastSuburb: null,
      completedSuburbs: [],
      failedSuburbs: [],
      totalSuburbs: suburbs.length,
      completedCount: 0,
    };
  }

  progress.totalSuburbs = suburbs.length;

  const remaining = suburbs.filter(s => !completedSet.has(suburbKey(s)));
  if (remaining.length === 0) {
    log('All suburbs already completed.');
    return allLots;
  }

  log(`Bulk REA: ${remaining.length} suburbs to scrape (${suburbs.length} total, ${completedSet.size} done)`);

  // ── Escalation state ──
  let consecutiveEmpty = 0;
  let successStreak = 0;
  let escalatedSuburbsLeft = 0;
  let delayMin = SUBURB_DELAY_MIN;
  let delayMax = SUBURB_DELAY_MAX;
  let recentSuspicious = [];   // suburb keys since last success
  let retryingSuburb = false;

  // ── Browser state ──
  let page = null;
  let browserCleanup = null;
  let suburbsInBatch = 0;

  async function rotateBrowser() {
    if (browserCleanup) { try { browserCleanup(); } catch (_) {} }
    const result = await createBrowser();
    browserCleanup = result.cleanup;
    page = result.context.pages()[0] || await result.context.newPage();
    suburbsInBatch = 0;
    log('New Chrome session started');
  }

  async function killBrowser() {
    if (browserCleanup) {
      try { browserCleanup(); } catch (_) {}
      browserCleanup = null;
      page = null;
      suburbsInBatch = 0;
    }
  }

  function recordHardBlockFailures() {
    for (const k of recentSuspicious) {
      if (!progress.failedSuburbs.some(f => f.suburb === k)) {
        progress.failedSuburbs.push({
          suburb: k,
          reason: 'hard_block',
          failedAt: new Date().toISOString(),
        });
      }
    }
    recentSuspicious = [];
  }

  try {
    await rotateBrowser();

    // ────────────────── Main loop ──────────────────

    for (let i = 0; i < remaining.length; i++) {
      const sub = remaining[i];
      const key = suburbKey(sub);
      const isRetry = retryingSuburb;
      retryingSuburb = false;

      // Session rotation when batch is exhausted
      if (suburbsInBatch >= BATCH_SIZE) {
        log(`Batch limit (${BATCH_SIZE}) reached — rotating Chrome`);
        await killBrowser();
        await rotateBrowser();
      }

      log(`[${progress.completedCount + 1}/${suburbs.length}] ${sub.suburb} ${sub.state} ${sub.postcode}${isRetry ? ' (RETRY)' : ''}`);

      // ── Scrape the suburb ──
      let result;
      try {
        result = await scrapeSuburb(
          sub.suburb, sub.state, sub.postcode,
          sub.lga || '', sub.corridor || '',
          { ...options, page }
        );
      } catch (err) {
        // Scrape threw — treat as suspicious
        log(`ERROR scraping ${sub.suburb}: ${err.message}`);
        progress.failedSuburbs.push({
          suburb: key,
          reason: err.message,
          failedAt: new Date().toISOString(),
        });
        if (!isRetry) {
          consecutiveEmpty++;
          recentSuspicious.push(key);
        }
        successStreak = 0;
        saveProgress(progress);

        // Check escalation
        if (consecutiveEmpty >= HARD_BLOCK_THRESHOLD) {
          log(`HARD BLOCK after error on ${sub.suburb}. Pausing ${HARD_BLOCK_PAUSE_MS / 60000} min.`);
          await killBrowser();
          recordHardBlockFailures();
          saveProgress(progress);
          await sleep(HARD_BLOCK_PAUSE_MS);
          await rotateBrowser();
          consecutiveEmpty = 0;
          delayMin = HARD_DELAY_MIN;
          delayMax = HARD_DELAY_MAX;
          escalatedSuburbsLeft = HARD_DELAY_SUBURBS;
        } else if (consecutiveEmpty >= SOFT_BLOCK_THRESHOLD) {
          log(`Soft block after error on ${sub.suburb}. Pausing ${SOFT_BLOCK_PAUSE_MS / 60000} min.`);
          await killBrowser();
          await sleep(SOFT_BLOCK_PAUSE_MS);
          await rotateBrowser();
          delayMin = SOFT_DELAY_MIN;
          delayMax = SOFT_DELAY_MAX;
          escalatedSuburbsLeft = SOFT_DELAY_SUBURBS;
          retryingSuburb = true;
          i--; // re-process this suburb
        }
        continue;
      }

      const { lots, meta } = result;
      suburbsInBatch++;

      // ── Ban detection ──
      const totalRaw = meta.buyRawCount + meta.soldRawCount;
      const isSuspiciousEmpty = totalRaw === 0 && !meta.genuineEmpty;

      if (isSuspiciousEmpty) {
        if (!isRetry) {
          consecutiveEmpty++;
          recentSuspicious.push(key);
        }
        successStreak = 0;
        log(`Suspicious empty: ${sub.suburb} (${consecutiveEmpty} consecutive)`);

        // Hard block — check first (higher priority)
        if (consecutiveEmpty >= HARD_BLOCK_THRESHOLD) {
          log(`HARD BLOCK detected after ${sub.suburb}. Pausing ${HARD_BLOCK_PAUSE_MS / 60000} min.`);
          await killBrowser();
          recordHardBlockFailures();
          progress.lastSuburb = sub.suburb;
          saveProgress(progress);
          await sleep(HARD_BLOCK_PAUSE_MS);
          await rotateBrowser();
          consecutiveEmpty = 0;
          delayMin = HARD_DELAY_MIN;
          delayMax = HARD_DELAY_MAX;
          escalatedSuburbsLeft = HARD_DELAY_SUBURBS;
          continue; // skip ahead past problem suburbs
        }

        // Soft block
        if (consecutiveEmpty >= SOFT_BLOCK_THRESHOLD) {
          log(`Soft block detected after ${sub.suburb}. Pausing ${SOFT_BLOCK_PAUSE_MS / 60000} min.`);
          await killBrowser();
          await sleep(SOFT_BLOCK_PAUSE_MS);
          await rotateBrowser();
          delayMin = SOFT_DELAY_MIN;
          delayMax = SOFT_DELAY_MAX;
          escalatedSuburbsLeft = SOFT_DELAY_SUBURBS;
          retryingSuburb = true;
          i--; // retry this suburb after pause
          continue;
        }

        // Below threshold — suburb is suspicious but we continue
        progress.lastSuburb = sub.suburb;
        saveProgress(progress);

      } else {
        // ── Success or genuine empty ──
        if (totalRaw > 0) {
          consecutiveEmpty = 0;
          recentSuspicious = [];
          successStreak++;
        }
        // genuineEmpty with 0 raw: neutral — don't touch counters

        allLots.push(...lots);
        progress.completedSuburbs.push(key);
        progress.completedCount = progress.completedSuburbs.length;
        completedSet.add(key);
        progress.lastSuburb = sub.suburb;
        saveProgress(progress);
      }

      // ── De-escalation ──
      if (successStreak >= DEESCALATION_STREAK && escalatedSuburbsLeft > 0) {
        escalatedSuburbsLeft = 0;
        delayMin = SUBURB_DELAY_MIN;
        delayMax = SUBURB_DELAY_MAX;
        log(`De-escalated to normal delays after ${DEESCALATION_STREAK} successes`);
      }
      if (escalatedSuburbsLeft > 0) {
        escalatedSuburbsLeft--;
        if (escalatedSuburbsLeft === 0) {
          delayMin = SUBURB_DELAY_MIN;
          delayMax = SUBURB_DELAY_MAX;
          log('Escalated delays expired — returning to normal');
        }
      }

      // ── Suburb delay (skip for last suburb) ──
      if (i < remaining.length - 1) {
        const ms = delayMin + Math.random() * (delayMax - delayMin);
        log(`Waiting ${Math.round(ms / 1000)}s before next suburb`);
        await sleep(ms);
      }
    }

    // ────────────────── End-of-run retry pass ──────────────────

    const failedKeys = progress.failedSuburbs
      .map(f => f.suburb)
      .filter(k => !completedSet.has(k));
    const uniqueFailedKeys = [...new Set(failedKeys)];

    if (uniqueFailedKeys.length > 0) {
      log(`\nRetry pass: ${uniqueFailedKeys.length} failed suburbs`);
      await killBrowser();
      await rotateBrowser();
      let retryBatchCount = 0;

      for (const failedKey of uniqueFailedKeys) {
        const sub = suburbs.find(s => suburbKey(s) === failedKey);
        if (!sub || completedSet.has(failedKey)) continue;

        // Rotate within retry pass
        if (retryBatchCount >= BATCH_SIZE) {
          await killBrowser();
          await rotateBrowser();
          retryBatchCount = 0;
        }

        log(`Retrying: ${sub.suburb} ${sub.state} ${sub.postcode}`);
        try {
          const retryResult = await scrapeSuburb(
            sub.suburb, sub.state, sub.postcode,
            sub.lga || '', sub.corridor || '',
            { ...options, page }
          );
          const { lots } = retryResult;
          allLots.push(...lots);
          progress.completedSuburbs.push(failedKey);
          progress.completedCount = progress.completedSuburbs.length;
          completedSet.add(failedKey);
          progress.failedSuburbs = progress.failedSuburbs.filter(f => f.suburb !== failedKey);
          saveProgress(progress);
          log(`Retry OK: ${sub.suburb} — ${lots.length} lots`);
        } catch (e) {
          log(`Retry failed: ${sub.suburb} — ${e.message}`);
        }

        retryBatchCount++;

        // Delay between retries
        await sleep(SUBURB_DELAY_MIN + Math.random() * (SUBURB_DELAY_MAX - SUBURB_DELAY_MIN));
      }
    }

  } finally {
    await killBrowser();
  }

  // ── Summary ──
  log(`\nBulk REA complete: ${allLots.length} total lots, ${progress.completedCount}/${suburbs.length} suburbs`);
  if (progress.failedSuburbs.length > 0) {
    log(`${progress.failedSuburbs.length} suburbs still failed — see ${PROGRESS_PATH}`);
  }

  return allLots;
}

module.exports = { runBulkREA };
