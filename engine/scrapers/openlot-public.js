// OpenLot (openlot.com.au) scraper — uses real Chrome via CDP
// Self-contained: no external CLI tools, no Apify, no openclaw
// Same CDP pattern as rea-custom.js

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { getLandFilterConfig, normalizeLot, matchesLandFilter } = require('../lib/land-filter');

// ──── Chrome discovery ────

const CHROME_CANDIDATES = process.platform === 'win32'
  ? [
    path.join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ]
  : process.platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
    : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium-browser', '/usr/bin/chromium'];

function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    try { if (fs.existsSync(p)) return p; } catch (e) {}
  }
  return null;
}

// ──── Helpers ────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function randomDelay(min = 2000, max = 5000) {
  return sleep(min + Math.random() * (max - min));
}

async function findFreePort() {
  const net = require('net');
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

// ──── URL builder ────
// Direct URL: /{suburb-slug}-{state-lower}-{postcode}/land-for-sale

function buildSearchUrl(suburb, state, postcode) {
  const slug = suburb.toLowerCase().replace(/\s+/g, '-');
  const stateSlug = state.toLowerCase();
  return `https://www.openlot.com.au/${slug}-${stateSlug}-${postcode}/land-for-sale`;
}

// ──── Parsers ────

function parsePrice(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/,/g, '').replace(/\s+/g, ' ').trim();
  const matches = [...cleaned.matchAll(/\$\s*([\d.]+)\s*(k|m)?/gi)];
  if (matches.length === 0) {
    const digits = cleaned.replace(/[^\d]/g, '');
    const n = Number(digits);
    return Number.isFinite(n) && n > 1000 ? n : null;
  }
  let val = parseFloat(matches[0][1]);
  const suffix = matches[0][2];
  if (suffix?.toLowerCase() === 'k') val *= 1000;
  if (suffix?.toLowerCase() === 'm') val *= 1000000;
  return val > 1000 ? Math.round(val) : null;
}

function parseSize(text) {
  if (!text) return null;
  const n = Number(String(text).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

// ──── Browser management via CDP ────

async function createBrowser() {
  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error('Chrome not found. Install Google Chrome or set CHROME_PATH env var.');
  }

  const { chromium } = require('playwright');
  const port = await findFreePort();
  const userDataDir = path.join(os.tmpdir(), `openlot-scrape-${Date.now()}`);
  fs.mkdirSync(userDataDir, { recursive: true });

  const chromeProcess = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-sync',
    '--disable-background-networking',
    '--window-size=1920,1080',
    'about:blank',
  ], { stdio: 'ignore', detached: false });

  await sleep(3000);

  let browser;
  try {
    browser = await chromium.connectOverCDP(`http://localhost:${port}`, { timeout: 15000 });
  } catch (e) {
    chromeProcess.kill();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
    throw new Error(`Failed to connect to Chrome CDP: ${e.message}`);
  }

  const context = browser.contexts()[0];

  return {
    browser,
    context,
    cleanup: () => {
      try { browser.close(); } catch (e) {}
      try { chromeProcess.kill(); } catch (e) {}
      setTimeout(() => {
        try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}
      }, 3000);
    },
  };
}

// ──── DOM extraction ────
// OpenLot listing cards on the results page have structured text:
//   VACANT LAND
//   [Estate Name] Stage X - Lot NNN Street
//   Available / Sold
//   Frontage: XXm   Depth: XXm   Land size: XXXm²
//   Suburb: Suburb STATE Postcode
//   Price: $XXX,XXX
// Each card contains anchor links with "section=land" in the href.

async function extractFromDOM(page) {
  return await page.evaluate(() => {
    const clean = value => String(value || '').replace(/\s+/g, ' ').trim();

    // Each lot card lives inside a div.stock-column container.
    // Fallback: any div whose class includes "stock" and "suburb".
    let cards = Array.from(document.querySelectorAll('.stock-column'));
    if (cards.length === 0) {
      cards = Array.from(document.querySelectorAll('div[class*="stock"][class*="suburb"]'));
    }

    const rows = [];

    for (const card of cards) {
      const cardText = clean(card.textContent || '');

      // Must have a price
      if (!/Price:\s*\$[\d,]+/i.test(cardText)) continue;

      const lotMatch = cardText.match(/\bLot\s+\d+[A-Za-z0-9/-]*/i);
      const priceMatch = cardText.match(/Price:\s*(\$[\d,]+)/i);
      const estateMatch = cardText.match(/\[([^\]]+)\]/);
      const titleMatch = cardText.match(/\[([^\]]+)\]\s+(.+?)(?=Available|Sold|Under Offer|Coming Soon|Registered)/i);
      const sizeMatch = cardText.match(/Land size\s*([\d,.]+)\s*m[²2]/i);
      const frontageMatch = cardText.match(/Frontage\s*([\d,.]+)\s*m/i);
      const depthMatch = cardText.match(/Depth\s*([\d,.]+)\s*m/i);
      const suburbMatch = cardText.match(/Suburb:\s*([A-Za-z' -]+\s+[A-Z]{2}\s+\d{4})/i);
      const statusMatch = cardText.match(/\b(Available|Sold|Under Offer|Coming Soon|Registered)\b/i);

      // Get the listing URL from the section=land anchor
      const anchor = card.querySelector('a[href*="section=land"]');
      const href = anchor?.href || '';

      rows.push({
        estate: estateMatch ? clean(estateMatch[1]) : null,
        title: titleMatch ? clean(titleMatch[2]) : (anchor ? clean(anchor.textContent) : ''),
        lotLabel: lotMatch ? clean(lotMatch[0]) : null,
        priceText: priceMatch ? clean(priceMatch[1]) : null,
        landSizeText: sizeMatch ? clean(sizeMatch[1] + 'm²') : null,
        frontageText: frontageMatch ? clean(frontageMatch[1] + 'm') : null,
        depthText: depthMatch ? clean(depthMatch[1] + 'm') : null,
        suburbText: suburbMatch ? clean(suburbMatch[1]) : null,
        status: statusMatch ? clean(statusMatch[1]) : 'Available',
        href,
      });
    }

    return rows;
  });
}

// ──── Navigate via direct URL or wizard fallback ────

async function navigateToResults(page, suburb, state, postcode) {
  // Try 1: direct URL
  const directUrl = buildSearchUrl(suburb, state, postcode);
  console.log(`    OpenLot trying direct URL: ${directUrl}`);
  await page.goto(directUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(5000);

  const isValid = await page.evaluate(() => {
    const body = document.body?.innerText || '';
    return !body.includes('could not be found') && !body.includes('Page not found')
      && document.title !== 'Page not found';
  });

  if (isValid) {
    console.log(`    Direct URL worked`);
    return true;
  }

  // Try 2: wizard flow
  console.log(`    Direct URL returned 404, falling back to wizard...`);
  await page.goto('https://www.openlot.com.au/search', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);

  try {
    // Step 1: Continue
    await page.click('button:has-text("Continue")', { timeout: 10000 });
    await sleep(1500);

    // Step 2: Land for Sale
    await page.click('button:has-text("Land for Sale")', { timeout: 10000 });
    await sleep(1500);

    // Step 3: Budget — skip (leave as Any)
    await page.click('button:has-text("Next")', { timeout: 10000 });
    await sleep(1500);

    // Step 4: Size — skip (leave as Any). Find the visible Next button.
    const btns = await page.$$('button');
    for (const btn of btns) {
      const text = await btn.evaluate(el => el.textContent?.trim());
      const visible = await btn.evaluate(el => el.offsetParent !== null);
      if (text === 'Next' && visible) { await btn.click(); break; }
    }
    await sleep(2000);

    // Step 5: Location — type suburb and select from autocomplete
    const input = await page.$('#wizard-suburb-search');
    if (!input) throw new Error('Location input not found');
    await input.click();
    await sleep(500);
    await page.keyboard.type(`${suburb}`, { delay: 80 });
    await sleep(3000);

    // Click the matching suburb from autocomplete dropdown
    const suburbUpper = suburb.toUpperCase();
    const stateUpper = state.toUpperCase();
    const selected = await page.evaluate((sub, st, pc) => {
      const items = document.querySelectorAll('.search-wizard-suburb-item');
      for (const item of items) {
        const text = (item.textContent || '').trim().toUpperCase();
        if (text.includes(sub) && text.includes(st) && text.includes(pc)) {
          item.click();
          return text;
        }
      }
      // Fallback: click first item
      if (items.length > 0) {
        items[0].click();
        return (items[0].textContent || '').trim();
      }
      return null;
    }, suburbUpper, stateUpper, String(postcode));

    if (!selected) throw new Error('No autocomplete match found');
    console.log(`    Wizard: selected "${selected}"`);
    await sleep(2000);

    // Click Search
    await page.click('button[data-action="search"]', { timeout: 10000 });
    console.log(`    Wizard: clicked Search`);
    await sleep(8000);

    return true;
  } catch (wizardErr) {
    console.warn(`    Wizard flow failed: ${wizardErr.message}`);
    return false;
  }
}

// ──── Public API ────

async function scrapeSuburb(suburb, state, postcode, lga, corridor, options = {}) {
  const filters = getLandFilterConfig(options);

  console.log(`  OpenLot scraping: ${suburb} ${state} ${postcode}`);

  let cleanup = null;
  let rawListings = [];

  try {
    const { context, cleanup: cleanupFn } = await createBrowser();
    cleanup = cleanupFn;
    const page = context.pages()[0] || await context.newPage();

    const hasResults = await navigateToResults(page, suburb, state, postcode);

    if (hasResults) {
      // Wait for listing cards to render
      try {
        await page.waitForSelector('a[href*="section=land"]', { timeout: 10000 });
      } catch (_) {
        // No section=land links — page may have no listings
      }
      await sleep(1500);

      rawListings = await extractFromDOM(page);
      console.log(`    Extracted ${rawListings.length} raw listings`);
    }
  } finally {
    if (cleanup) cleanup();
  }

  // Normalize and filter
  const lots = rawListings
    .map(raw => {
      const price = parsePrice(raw.priceText);
      const lotSize = parseSize(raw.landSizeText);
      const isSold = /sold/i.test(raw.status);
      const address = [raw.lotLabel, raw.title].filter(Boolean).join(' ') || '';

      return normalizeLot({
        address,
        suburb,
        lga: lga || '',
        state,
        postcode: String(postcode || ''),
        corridor: corridor || '',
        lot_size: lotSize,
        list_price: !isSold ? price : null,
        sold_price: isSold ? price : null,
        price: price || 0,
        status: isSold ? 'sold' : 'listing',
        list_date: !isSold ? new Date().toISOString().split('T')[0] : null,
        sold_date: isSold ? new Date().toISOString().split('T')[0] : null,
        property_type: 'land',
        source: 'openlot',
        source_id: raw.lotLabel || raw.href || '',
        source_url: raw.href || '',
        estate: raw.estate || null,
        is_outlier: false,
      }, filters);
    })
    .filter(lot => matchesLandFilter(lot, filters));

  console.log(`  OpenLot: ${lots.length} lots after filtering (${rawListings.length} raw)`);

  return lots;
}

module.exports = { scrapeSuburb, buildSearchUrl };
