# REA Resilience Architecture

## Key Parameters — Quick Reference

| Parameter                  | Value        | Notes                                      |
| -------------------------- | ------------ | ------------------------------------------ |
| Chrome session lifetime    | 25 suburbs   | Kill and restart Chrome every 25 suburbs   |
| Delay between suburbs      | 30–60 s      | Random within range, configurable via env  |
| Delay between pages        | 2–5 s        | Already implemented in `randomDelay()`     |
| Delay between buy/sold     | 3–6 s        | Already implemented                        |
| Soft block pause           | 10 min       | After 2 consecutive zero-result suburbs    |
| Hard block pause           | 30 min       | After 3 consecutive zero-result suburbs    |
| Max retries per suburb     | 2            | After a block, retry the suburb once later |
| Progress file              | `engine/data/rea-progress.json` |                             |
| Proxy env var              | `PROXY_URL`  | Optional, no proxy by default              |

---

## 1. Session Rotation

### Current State

The scraper creates a **new Chrome instance for every single suburb** (`createBrowser()` is called inside `scrapeSuburb()`). Each instance gets a fresh temp profile directory. This is actually more aggressive than necessary — spinning up a new Chrome process 600–800 times is slow and wasteful.

### Recommended Approach

Share a single Chrome instance across a **batch of 25 suburbs**, then kill it and start a fresh one.

**Why 25?** Each suburb makes roughly 2–20 page requests (buy pages + sold pages). At 25 suburbs, a single session will have made somewhere between 50 and 500 requests. Kasada fingerprints sessions by observing request patterns, timing, and cumulative behavior. Staying under ~500 requests per session keeps us well below the threshold where long-lived sessions start attracting attention. Twenty-five is also small enough that if a session does get flagged, we lose at most one batch — not the entire run.

### How It Works

1. A new orchestrator function (e.g. `scrapeAllSuburbs`) owns the Chrome lifecycle.
2. It calls `createBrowser()` once at the start of each batch of 25.
3. It passes the browser context into `scrapeSuburb()` instead of having each suburb create its own.
4. After 25 suburbs (or if a hard block is detected — see section 4), it calls `cleanup()` and creates a fresh browser.
5. The batch size is configurable via environment variable `REA_BATCH_SIZE` (default: 25).

### What Changes in `scrapeSuburb()`

- Remove the internal `createBrowser()` / `cleanup()` calls.
- Accept a `page` or `context` parameter from the orchestrator.
- The function becomes a pure "scrape one suburb given an already-open browser" function.

---

## 2. Suburb-Level Delays

### Current State

- **Between pages within a suburb:** 2–5 s random delay (line 373 of `rea-custom.js`).
- **Between buy and sold within a suburb:** 3–6 s random delay (line 400).
- **Between suburbs:** Nothing. The caller moves immediately from one suburb to the next.

### What We Need

A configurable delay of **30–60 seconds** between suburbs, randomized within that range to avoid a detectable cadence.

### Implementation

Use the existing `sleep()` helper with a random value:

```
const suburbDelay = randomDelay(
  parseInt(process.env.REA_SUBURB_DELAY_MIN || '30000'),
  parseInt(process.env.REA_SUBURB_DELAY_MAX || '60000')
);
await suburbDelay;
```

This is a standard `setTimeout`-based promise. It does **not** block the Node.js event loop — other async work (logging, file I/O, progress saves) continues during the wait. No worker threads or child processes needed.

### Environment Variables

| Variable                | Default | Description                          |
| ----------------------- | ------- | ------------------------------------ |
| `REA_SUBURB_DELAY_MIN`  | 30000   | Minimum ms between suburbs           |
| `REA_SUBURB_DELAY_MAX`  | 60000   | Maximum ms between suburbs           |

---

## 3. Checkpoint / Resume

### File Location

`engine/data/rea-progress.json`

### Schema

```json
{
  "startedAt": "2026-04-04T02:30:00.000Z",
  "lastSuburb": "Craigieburn",
  "completedSuburbs": ["Sunbury", "Diggers Rest", "Craigieburn"],
  "failedSuburbs": [
    { "suburb": "Melton South", "reason": "hard_block", "failedAt": "2026-04-04T03:15:00.000Z" }
  ],
  "totalSuburbs": 650,
  "completedCount": 3
}
```

### Write Strategy

- The progress file is written **after each suburb completes** (success or failure).
- Use atomic writes: write to a `.tmp` file first, then rename over the real file. This prevents corruption if the process crashes mid-write.

```
fs.writeFileSync(progressPath + '.tmp', JSON.stringify(progress, null, 2));
fs.renameSync(progressPath + '.tmp', progressPath);
```

### Behaviour on Restart

1. **File exists and is valid JSON:** Read it. Build a `Set` from `completedSuburbs`. For each suburb in the input list, skip it if already completed. Resume from the suburb after `lastSuburb` in the original order. Log how many suburbs are being skipped and how many remain.

2. **File exists but is corrupt (invalid JSON):** Log a warning: `"Progress file corrupt, starting fresh"`. Rename the corrupt file to `rea-progress.json.corrupt.{timestamp}` for debugging. Start from the beginning.

3. **File does not exist:** This is a fresh run. Create the file with `completedSuburbs: []` and proceed from the first suburb.

### What Happens to Failed Suburbs

Failed suburbs are recorded in `failedSuburbs[]` with a reason and timestamp. They are **not** added to `completedSuburbs[]`. At the end of the full run, the orchestrator makes a single retry pass over all failed suburbs. If they fail again, they stay in `failedSuburbs` for manual investigation.

---

## 4. Ban Detection

### The Problem

Kasada does not return a clean HTTP 403 or a "you are blocked" page. Instead, it may:
- Serve the challenge JS but never resolve it (page stays blank).
- Return a page that looks like the real site but has no listings.
- Return a CAPTCHA or interstitial page.

We need to distinguish between "this suburb genuinely has no land for sale" and "Kasada is blocking us."

### Detection Signals

| Signal | Indicates |
| ------ | --------- |
| Page body length < 100 characters after 13 s wait | Challenge JS never resolved — likely blocked |
| `document.title` contains "Access Denied" or "Please verify" | Explicit block page |
| 3 consecutive suburbs return 0 buy listings AND 0 sold listings | Statistical anomaly — almost certainly a block |
| Page contains "pardon our interruption" or "verify you are human" | Kasada interstitial |

### Detection Logic

Track a rolling counter: `consecutiveEmptySuburbs`. Increment it when a suburb returns 0 total listings (buy + sold combined). Reset it to 0 whenever a suburb returns at least 1 listing.

- **Page-level check (within `scrapePages`):** After the content wait, inspect `document.title` and body text for block phrases. If detected, throw a typed error (e.g. `KasadaBlockError`) so the orchestrator can handle it.

- **Suburb-level check (in the orchestrator):** After each suburb, check `consecutiveEmptySuburbs`.

### Thresholds

- **2 consecutive empty suburbs → soft block.** It is plausible that one or two suburbs have zero land listings, but three in a row is extremely unlikely for a metro/regional area list.
- **3 consecutive empty suburbs → hard block.** Kasada is almost certainly intervening.

See section 6 (Escalation Ladder) for what happens at each level.

### Distinguishing Real Empty Results from Blocks

A suburb with **genuinely** no land for sale will still return a valid REA page with the "no exact results" or "0 results" message in the body text. The existing `getPageInfo()` function (line 248) already detects this. If `getPageInfo` returns `{ hasResults: false }`, that is a **real** empty suburb — do not count it toward the consecutive empty counter.

Only count it as suspicious when the page **claims to have results** (or loads normally) but we extract 0 listing cards from the DOM.

---

## 5. Proxy Fallback

### Environment Variable

`PROXY_URL` — optional. When not set, Chrome launches normally with a direct connection. No configuration needed.

### Format

Standard proxy URL: `http://user:pass@host:port` or `socks5://host:port`.

### How to Route Chrome Through the Proxy

Add the `--proxy-server` flag to the Chrome launch arguments in `createBrowser()`:

```
const args = [
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userDataDir}`,
  // ... existing flags ...
];

if (process.env.PROXY_URL) {
  args.push(`--proxy-server=${process.env.PROXY_URL}`);
}
```

This routes **all** Chrome traffic through the proxy at the browser level — no Playwright-specific proxy config needed since we are connecting via CDP to a real Chrome process.

### Authentication

If the proxy requires authentication (user:pass in the URL), Chrome does not natively handle proxy auth from the command line. In that case, use Playwright's CDP connection to intercept the auth challenge:

```
page.on('dialog', async dialog => { ... });
// Or use page.route() to add Proxy-Authorization headers
```

However, the simplest approach for authenticated proxies is to use a local proxy forwarder (e.g. a tiny Node HTTP proxy that adds the auth header) or to use a proxy provider that supports IP-based whitelisting instead of user/pass auth.

### Zero-Config Default

If `PROXY_URL` is not set, no proxy flags are added, and Chrome connects directly. The scraper works exactly as it does today. No code paths change.

---

## 6. Rate Limit Escalation Ladder

Three operating modes, escalating as blocks are detected:

### Level 0 — Normal Operation

| Parameter              | Value     |
| ---------------------- | --------- |
| Delay between suburbs  | 30–60 s   |
| Chrome rotation        | Every 25 suburbs |
| Page delay             | 2–5 s     |

This is the default. Used when no blocks have been detected recently.

### Level 1 — Soft Block (2 consecutive empty suburbs)

**Trigger:** `consecutiveEmptySuburbs >= 2`

**Actions:**
1. Log: `"Soft block detected after {suburb}. Pausing 10 minutes."`
2. Kill the current Chrome instance immediately.
3. Pause for **10 minutes**.
4. Create a new Chrome instance with a fresh user data directory (new fingerprint).
5. Reset `consecutiveEmptySuburbs` to 0.
6. Resume from the suburb that triggered the soft block (retry it).
7. Increase suburb delay to **45–90 seconds** for the next 10 suburbs, then return to normal.

### Level 2 — Hard Block (3 consecutive empty suburbs)

**Trigger:** `consecutiveEmptySuburbs >= 3`

**Actions:**
1. Log: `"HARD BLOCK detected after {suburb}. Pausing 30 minutes."`
2. Kill the current Chrome instance.
3. Record the last 3 suburbs in `failedSuburbs[]` in the progress file.
4. Pause for **30 minutes**.
5. Create a new Chrome instance.
6. Reset `consecutiveEmptySuburbs` to 0.
7. **Skip ahead** past the problem suburbs and continue with the rest of the list.
8. Increase suburb delay to **60–120 seconds** for the next 20 suburbs, then return to normal.
9. Failed suburbs are retried in the end-of-run retry pass (see section 3).

### De-escalation

After **10 consecutive successful suburbs** (at least 1 listing each), any elevated delays from a prior block event reset back to normal (Level 0) values. The orchestrator tracks a `successStreak` counter for this purpose.

### Logging

All escalation events are logged to both console and a file (`engine/data/rea-run.log`) with timestamps, so that after a large run you can see exactly when blocks occurred and how the scraper responded.

---

## Runtime Estimates

For context, here are rough timing estimates at normal operation (Level 0):

| Suburbs | Avg time per suburb | Suburb delay | Chrome restarts | Total estimate |
| ------- | ------------------- | ------------ | --------------- | -------------- |
| 100     | ~45 s scraping      | ~45 s delay  | 4               | ~2.5 hours     |
| 400     | ~45 s scraping      | ~45 s delay  | 16              | ~10 hours      |
| 800     | ~45 s scraping      | ~45 s delay  | 32              | ~20 hours      |

These assume no blocks. Blocks add 10–30 minute pauses each. For 800 suburbs, plan for an overnight run or split across two sessions using the checkpoint/resume system.
