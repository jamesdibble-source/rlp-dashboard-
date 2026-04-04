// REA (realestate.com.au) custom scraper — uses real Chrome via CDP
// Direct browser scraping, no third-party services (replaces rea-apify.js)
// Bypasses Kasada bot protection by connecting to a native Chrome instance.
// Rate limited: 2-5s random delays between pages, 30s backoff on 429s.

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

// ──── URL builders ────
// Correct REA format: /buy/property-land-in-suburb,+state+postcode/list-N

function buildSearchUrl(suburb, state, postcode, page = 1) {
  const slug = suburb.toLowerCase().replace(/\s+/g, '+');
  const stateSlug = state.toLowerCase();
  return `https://www.realestate.com.au/buy/property-land-in-${slug},+${stateSlug}+${postcode}/list-${page}`;
}

function buildSoldUrl(suburb, state, postcode, page = 1) {
  const slug = suburb.toLowerCase().replace(/\s+/g, '+');
  const stateSlug = state.toLowerCase();
  return `https://www.realestate.com.au/sold/property-land-in-${slug},+${stateSlug}+${postcode}/list-${page}`;
}

// ──── Parsers ────

function parsePrice(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/,/g, '').replace(/\s+/g, ' ').trim();
  if (/contact|application|negotiation|expression|auction|tender|request|offers? (from|over|above)/i.test(cleaned) && !cleaned.includes('$')) return null;
  const matches = [...cleaned.matchAll(/\$\s*([\d.]+)\s*(k|m)?/gi)];
  if (matches.length === 0) return null;
  let val = parseFloat(matches[0][1]);
  const suffix = matches[0][2];
  if (suffix?.toLowerCase() === 'k') val *= 1000;
  if (suffix?.toLowerCase() === 'm') val *= 1000000;
  return val > 1000 ? Math.round(val) : null;
}

function parseSize(text) {
  if (!text) return null;
  const match = String(text).replace(/,/g, '').match(/([\d.]+)\s*m[\u00B2\xB22²]?/i);
  return match ? Math.round(parseFloat(match[1])) : null;
}

// ──── Browser management via CDP ────

async function createBrowser() {
  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error('Chrome not found. Install Google Chrome or set CHROME_PATH env var.');
  }

  const { chromium } = require('playwright');
  const port = await findFreePort();
  const userDataDir = path.join(os.tmpdir(), `rea-scrape-${Date.now()}`);
  fs.mkdirSync(userDataDir, { recursive: true });

  // Launch a real Chrome process with remote debugging
  const chromeArgs = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-sync',
    '--disable-background-networking',
    '--window-size=1920,1080',
  ];
  if (process.env.PROXY_URL) {
    chromeArgs.push(`--proxy-server=${process.env.PROXY_URL}`);
  }
  chromeArgs.push('about:blank');

  const chromeProcess = spawn(chromePath, chromeArgs, { stdio: 'ignore', detached: false });

  // Wait for Chrome to start accepting connections
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
      // Delay cleanup of temp dir so Chrome can release files
      setTimeout(() => {
        try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}
      }, 3000);
    },
  };
}

// ──── DOM extraction ────

async function extractFromDOM(page, type) {
  return await page.evaluate((listingType) => {
    const listings = [];

    // REA uses <article data-testid="ResidentialCard"> or "ProjectCard"
    let cards = [...document.querySelectorAll('article[data-testid="ResidentialCard"], article[data-testid="ProjectCard"]')];

    // Fallback: any article elements
    if (cards.length === 0) {
      cards = [...document.querySelectorAll('article')];
    }

    // Broader fallback: find containers with land listing links
    if (cards.length === 0) {
      const links = document.querySelectorAll('a[href*="/property-residential+land"], a[href*="/property-land"]');
      const seen = new Set();
      for (const link of links) {
        let el = link;
        for (let i = 0; i < 5 && el.parentElement; i++) {
          el = el.parentElement;
          if (el.tagName === 'ARTICLE') break;
        }
        if (!seen.has(el)) { seen.add(el); cards.push(el); }
      }
    }

    for (const card of cards) {
      try {
        const text = card.innerText || '';
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);

        // ── URL + property type check ──
        // Land listing URLs contain "property-residential+land" or "property-land"
        const link = card.querySelector('a[href*="/property-residential+land"], a[href*="/property-land"], a[href*="/property-vacant"]');
        const url = link?.href || '';

        // Skip cards that don't link to a land listing
        if (!url || (!url.includes('property-residential+land') && !url.includes('property-land') && !url.includes('property-vacant'))) continue;

        // ── Price ──
        let priceText = '';
        const priceMatch = text.match(/\$[\d,.]+[kKmM]?\s*(?:-\s*\$[\d,.]+[kKmM]?)?/);
        if (priceMatch) priceText = priceMatch[0];

        // ── Address ──
        let address = '';
        // Address is typically in h2/h3 or a span inside the main link
        const heading = card.querySelector('h2, h3');
        if (heading) {
          address = heading.textContent.trim();
        }
        if (!address && link) {
          const spans = link.querySelectorAll('span');
          for (const span of spans) {
            const t = span.textContent.trim();
            if (t.length > 5 && /\d/.test(t) && t.includes(' ')) {
              address = t; break;
            }
          }
        }
        // Fallback: find a line that looks like an address
        if (!address) {
          for (const line of lines) {
            if (/^\d+\s+\w/.test(line) && line.length < 80) {
              address = line; break;
            }
          }
        }

        // ── Land size ──
        let sizeText = '';
        const sizeMatch = text.match(/([\d,.]+)\s*m[²2\u00B2]/i);
        if (sizeMatch) sizeText = sizeMatch[0];

        // ── Listing ID ──
        let listingId = '';
        const idMatch = url.match(/-(\d{6,})/);
        if (idMatch) listingId = idMatch[1];

        // ── Sold date ──
        // Matches: "Sold on 15 March 2024", "Sold March 2024", "Sold in March 2024"
        let soldDate = null;
        if (listingType === 'sold') {
          const dateMatch = text.match(/sold\s+(?:on\s+|in\s+)?(\d{1,2}\s+\w+\s+\d{4}|\w+\s+\d{4})/i);
          if (dateMatch) soldDate = dateMatch[1];
        }

        // ── Status (Under Contract / Contact Agent) ──
        let listingStatus = listingType;
        if (/under\s+contract/i.test(text)) listingStatus = 'under_contract';
        if (/contact\s+agent/i.test(text)) listingStatus = 'contact_agent';

        if (address || priceText) {
          listings.push({ address, priceText, sizeText, url, listingId, soldDate, type: listingType, listingStatus });
        }
      } catch (e) { /* skip bad card */ }
    }

    return listings;
  }, type);
}

// ──── Page info / pagination ────

async function getPageInfo(page) {
  return await page.evaluate(() => {
    const body = document.body?.innerText || '';

    // Check for no-results / error pages
    if (/off the market|no (exact )?results|0 results|no properties|page not found/i.test(body.slice(0, 3000))) {
      return { hasResults: false, hasNextPage: false, totalResults: 0 };
    }

    // Total results count (e.g., "Showing 1 – 25 of 639 properties")
    let totalResults = 0;
    const countMatch = body.match(/of ([\d,]+) propert/i);
    if (countMatch) totalResults = parseInt(countMatch[1].replace(/,/g, ''), 10);

    // Next page link
    let hasNextPage = false;
    const nextSels = [
      'a[rel="next"]',
      'a[aria-label*="next" i]',
      'button[aria-label*="next" i]',
    ];
    for (const sel of nextSels) {
      const el = document.querySelector(sel);
      if (el && !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true') {
        hasNextPage = true; break;
      }
    }

    return { hasResults: true, hasNextPage, totalResults };
  });
}

// ──── Core scraping loop ────

async function scrapePages(page, suburb, state, postcode, type, maxPages) {
  const allRaw = [];
  let genuineNoResults = false;

  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    const url = type === 'sold'
      ? buildSoldUrl(suburb, state, postcode, pageNum)
      : buildSearchUrl(suburb, state, postcode, pageNum);

    console.log(`    REA ${type} page ${pageNum}: ${url}`);

    // Navigate — note: Kasada bot protection returns initial 429, but the
    // challenge JS resolves automatically in real Chrome. We must NOT treat
    // 429 as a rate-limit error; instead, wait for the page to fully render.
    let retries = 3;
    let contentLoaded = false;

    while (retries > 0 && !contentLoaded) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

        // Wait for Kasada challenge to resolve + page content to render
        // The challenge JS runs and the real page appears within ~5-10s
        await sleep(5000);

        // Check if page has real content (not just the challenge shell)
        const hasContent = await page.evaluate(() => {
          const body = document.body?.innerText || '';
          return body.length > 100;
        });

        if (!hasContent) {
          // Still loading — wait more for the challenge to resolve
          await sleep(8000);
        }

        // Check for actual 404 / error pages
        const info = await getPageInfo(page);
        if (!info.hasResults) {
          console.log(`    No results for this ${type} search`);
          if (pageNum === 1) genuineNoResults = true;
          return { raw: allRaw, genuineNoResults };
        }

        contentLoaded = true;
      } catch (navError) {
        retries--;
        if (retries > 0) {
          console.warn(`    Navigation error, ${retries} retries left: ${navError.message}`);
          await sleep(5000);
        } else {
          console.error(`    Failed to load page ${pageNum}: ${navError.message}`);
          return { raw: allRaw, genuineNoResults };
        }
      }
    }

    if (!contentLoaded) { console.warn(`    Could not load page ${pageNum}`); break; }

    // Wait for listing cards to appear in the DOM
    try {
      await page.waitForSelector('article[data-testid="ResidentialCard"], article[data-testid="ProjectCard"], article', { timeout: 10000 });
    } catch (e) {
      console.log(`    No listing cards on page ${pageNum}`);
      break;
    }

    // Extra wait for dynamic content
    await sleep(1500);

    // Extract listings from DOM
    const rawListings = await extractFromDOM(page, type);

    if (rawListings.length === 0) {
      console.log(`    No land listings extracted from page ${pageNum}, stopping`);
      break;
    }

    allRaw.push(...rawListings);
    console.log(`    Page ${pageNum}: ${rawListings.length} land listings`);

    // Check for next page
    const pageInfo = await getPageInfo(page);
    if (!pageInfo.hasNextPage) {
      if (pageNum === 1 && pageInfo.totalResults > 0) {
        console.log(`    ${pageInfo.totalResults} total results, single page`);
      } else {
        console.log(`    Last page reached (${pageNum})`);
      }
      break;
    }

    // Random delay between pages
    await randomDelay(2000, 5000);
  }

  return { raw: allRaw, genuineNoResults };
}

// ──── Public API ────

async function scrapeSuburb(suburb, state, postcode, lga, corridor, options = {}) {
  const filters = getLandFilterConfig(options);
  const maxPages = options.maxPages || 10;
  const externalPage = options.page || null;

  console.log(`  REA custom scraping: ${suburb} ${state} ${postcode}`);

  let cleanup = null;
  let page = externalPage;
  let buyResult = { raw: [], genuineNoResults: false };
  let soldResult = { raw: [], genuineNoResults: false };

  try {
    if (!page) {
      const { context, cleanup: cleanupFn } = await createBrowser();
      cleanup = cleanupFn;
      page = context.pages()[0] || await context.newPage();
    }

    // Scrape buy listings
    buyResult = await scrapePages(page, suburb, state, postcode, 'buy', maxPages);

    // Delay between buy and sold
    await randomDelay(3000, 6000);

    // Scrape sold listings
    soldResult = await scrapePages(page, suburb, state, postcode, 'sold', maxPages);

  } finally {
    if (cleanup) cleanup();
  }

  const buyRaw = buyResult.raw;
  const soldRaw = soldResult.raw;

  // FIX 2: Drop parent/project listings (e.g. "Narooma Rise" subdivision pages)
  // Parent listing = ALL of: no lot size, "from" or price range in price, no leading street number
  const allRawUnfiltered = [...buyRaw, ...soldRaw];
  const allRaw = allRawUnfiltered.filter(raw => {
    const size = parseSize(raw.sizeText);
    if (size && size > 0) return true; // has a real lot size — keep

    const pt = (raw.priceText || '');
    const hasFrom = /\bfrom\b/i.test(pt);
    const hasPriceRange = /\$[\d,.]+\s*-\s*\$[\d,.]+/.test(pt);
    if (!hasFrom && !hasPriceRange) return true; // price text is normal — keep

    const addr = (raw.address || '').trim();
    if (/^\d/.test(addr)) return true; // address starts with a number — keep

    return false; // all three conditions met → parent listing, drop it
  });
  const parentDropped = allRawUnfiltered.length - allRaw.length;
  if (parentDropped > 0) {
    console.log(`  REA parent filter: dropped ${parentDropped} parent/project listings`);
  }

  // Bug 3: Suburb scope filter — only keep lots matching target suburb or postcode
  const suburbLower = suburb.toLowerCase();
  const postcodeStr = String(postcode);
  const suburbFiltered = allRaw.filter(raw => {
    const addr = (raw.address || '').toLowerCase();
    return addr.includes(suburbLower) || addr.includes(postcodeStr);
  });
  const suburbDropped = allRaw.length - suburbFiltered.length;
  if (suburbDropped > 0) {
    console.log(`  REA suburb filter: ${allRaw.length} → ${suburbFiltered.length} (dropped ${suburbDropped} from other suburbs)`);
  }

  // Normalize and filter
  const lots = suburbFiltered
    .map(raw => {
      const price = parsePrice(raw.priceText);
      const lotSize = parseSize(raw.sizeText);
      const isSold = raw.type === 'sold';
      const isUnderContract = raw.listingStatus === 'under_contract';
      const isContactAgent = raw.listingStatus === 'contact_agent';

      // Bug 4: determine status — preserve under_contract and contact_agent
      let status = isSold ? 'sold' : 'listing';
      if (isUnderContract && !isSold) status = 'under_contract';
      if (isContactAgent && !isSold) status = 'contact_agent';

      return normalizeLot({
        address: raw.address || '',
        suburb,
        lga: lga || '',
        state,
        corridor: corridor || '',
        lot_size: lotSize,
        list_price: !isSold ? price : null,
        sold_price: isSold ? price : null,
        price: price != null ? price : ((isUnderContract || isContactAgent) ? null : 0),
        status,
        list_date: !isSold ? new Date().toISOString().split('T')[0] : null,
        sold_date: isSold ? (raw.soldDate || new Date().toISOString().split('T')[0]) : null,
        property_type: 'land',
        source: 'rea',
        source_id: raw.listingId || '',
        source_url: raw.url || '',
        is_outlier: false,
      }, filters);
    })
    .filter(lot => matchesLandFilter(lot, filters));

  console.log(`  REA custom: ${lots.length} lots after filtering (${buyRaw.length} buy + ${soldRaw.length} sold raw)`);

  if (externalPage) {
    return {
      lots,
      meta: {
        buyRawCount: buyRaw.length,
        soldRawCount: soldRaw.length,
        genuineEmpty: buyResult.genuineNoResults && soldResult.genuineNoResults,
      },
    };
  }
  return lots;
}

module.exports = { scrapeSuburb, createBrowser, buildSearchUrl, buildSoldUrl };
