// Domain.com.au public search scraper
// No API key needed — scrapes public search results pages
// Rate limited to 1 request per 3 seconds to be respectful

const cheerio = require('cheerio');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-AU,en;q=0.9',
  'Referer': 'https://www.domain.com.au/',
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Build search URL for vacant land in a suburb
function buildSearchUrl(suburb, state, postcode, page = 1) {
  const slug = suburb.toLowerCase().replace(/\s+/g, '-');
  const stateSlug = state.toLowerCase();
  // Domain URL format: /sale/suburb-state-postcode/?property-type=vacant-land&page=N
  return `https://www.domain.com.au/sale/${slug}-${stateSlug}-${postcode}/?ptype=vacant-land&ssubs=0&page=${page}`;
}

// Build sold results URL
function buildSoldUrl(suburb, state, postcode, page = 1) {
  const slug = suburb.toLowerCase().replace(/\s+/g, '-');
  const stateSlug = state.toLowerCase();
  return `https://www.domain.com.au/sold-listings/${slug}-${stateSlug}-${postcode}/?ptype=vacant-land&page=${page}`;
}

// Parse a listing card from Domain search results HTML
function parseListingCards(html, suburb, state, type) {
  const $ = cheerio.load(html);
  const lots = [];

  // Domain uses data attributes and structured listing cards
  $('[data-testid="listing-card-wrapper-premiumplus"], [data-testid="listing-card-wrapper-premium"], [data-testid="listing-card-wrapper-standard"], .css-1qp9106, article[data-testid]').each((_, el) => {
    try {
      const $el = $(el);
      
      // Extract price
      let priceText = $el.find('[data-testid="listing-card-price"]').text().trim()
        || $el.find('.css-mgq8yx').text().trim()
        || $el.find('p[data-testid="listing-card-price"]').text().trim();
      
      // Extract address
      let address = $el.find('[data-testid="address-line1"]').text().trim()
        || $el.find('h2').first().text().trim()
        || $el.find('span[data-testid="address-line1"]').text().trim();
      
      let addressLine2 = $el.find('[data-testid="address-line2"]').text().trim();
      
      // Extract lot size from features
      let sizeText = '';
      $el.find('[data-testid="property-features-text-container"] span, .css-lvv8is span').each((_, feat) => {
        const t = $(feat).text().trim();
        if (t.includes('m²') || t.includes('sqm')) sizeText = t;
      });
      // Also check feature icons area
      if (!sizeText) {
        $el.find('span').each((_, s) => {
          const t = $(s).text().trim();
          if ((t.includes('m²') || t.includes('sqm')) && !t.includes('/')) sizeText = t;
        });
      }
      
      // Extract link
      const link = $el.find('a[href*="/sale/"], a[href*="/sold/"], a[href*="domain.com.au"]').first().attr('href') || '';
      const listingId = link.match(/(\d{6,})/)?.[1] || '';
      
      // Parse price
      const price = parsePrice(priceText);
      const lotSize = parseSize(sizeText);
      
      if (address && (price || lotSize)) {
        lots.push({
          address: address,
          suburb: addressLine2?.split(',')[0]?.trim() || suburb,
          state: state,
          price: price,
          lotSize: lotSize,
          priceText: priceText,
          sizeText: sizeText,
          url: link.startsWith('http') ? link : `https://www.domain.com.au${link}`,
          listingId: listingId,
          type: type, // 'listing' or 'sold'
        });
      }
    } catch (e) {
      // Skip unparseable cards
    }
  });

  return lots;
}

function parsePrice(text) {
  if (!text) return null;
  const cleaned = text.replace(/,/g, '').replace(/\s+/g, ' ');
  // Match patterns: $XXX,XXX or $XXXk or $X.Xm
  const match = cleaned.match(/\$\s*([\d,]+(?:\.\d+)?)\s*(k|m)?/i);
  if (!match) return null;
  let val = parseFloat(match[1].replace(/,/g, ''));
  if (match[2]?.toLowerCase() === 'k') val *= 1000;
  if (match[2]?.toLowerCase() === 'm') val *= 1000000;
  return Math.round(val);
}

function parseSize(text) {
  if (!text) return null;
  const match = text.replace(/,/g, '').match(/([\d.]+)\s*m[²2]?/i);
  return match ? Math.round(parseFloat(match[1])) : null;
}

// Scrape a single page
async function scrapePage(url) {
  const resp = await fetch(url, { headers: HEADERS });
  if (resp.status === 429) {
    console.warn('  Rate limited, waiting 30s...');
    await sleep(30000);
    return scrapePage(url);
  }
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} for ${url}`);
  }
  return resp.text();
}

// Scrape all listings for a suburb
async function scrapeSuburbListings(suburb, state, postcode, maxPages = 5) {
  const allLots = [];
  
  for (let page = 1; page <= maxPages; page++) {
    const url = buildSearchUrl(suburb, state, postcode, page);
    console.log(`  Listings page ${page}: ${url.substring(0, 80)}...`);
    
    try {
      const html = await scrapePage(url);
      const lots = parseListingCards(html, suburb, state, 'listing');
      console.log(`    Found ${lots.length} listings`);
      
      if (lots.length === 0) break; // No more results
      allLots.push(...lots);
      
      await sleep(3000); // Rate limit
    } catch (e) {
      console.error(`    Error: ${e.message}`);
      break;
    }
  }
  
  return allLots;
}

// Scrape sold results for a suburb
async function scrapeSuburbSold(suburb, state, postcode, maxPages = 5) {
  const allLots = [];
  
  for (let page = 1; page <= maxPages; page++) {
    const url = buildSoldUrl(suburb, state, postcode, page);
    console.log(`  Sold page ${page}: ${url.substring(0, 80)}...`);
    
    try {
      const html = await scrapePage(url);
      const lots = parseListingCards(html, suburb, state, 'sold');
      console.log(`    Found ${lots.length} sold`);
      
      if (lots.length === 0) break;
      allLots.push(...lots);
      
      await sleep(3000);
    } catch (e) {
      console.error(`    Error: ${e.message}`);
      break;
    }
  }
  
  return allLots;
}

// Full suburb scrape — listings + sold
async function scrapeSuburb(suburb, state, postcode, lga, corridor) {
  console.log(`\nScraping: ${suburb}, ${state} ${postcode} (${lga})`);
  
  const listings = await scrapeSuburbListings(suburb, state, postcode);
  const sold = await scrapeSuburbSold(suburb, state, postcode);
  
  const all = [...listings, ...sold].map(l => ({
    address: l.address,
    suburb: l.suburb || suburb,
    lga: lga,
    state: state,
    corridor: corridor,
    lot_size: l.lotSize,
    list_price: l.type === 'listing' ? l.price : null,
    sold_price: l.type === 'sold' ? l.price : null,
    price: l.price || 0,
    status: l.type,
    list_date: l.type === 'listing' ? new Date().toISOString().split('T')[0] : null,
    sold_date: l.type === 'sold' ? new Date().toISOString().split('T')[0] : null,
    price_per_sqm: (l.price && l.lotSize) ? Math.round((l.price / l.lotSize) * 100) / 100 : 0,
    source: 'domain',
    source_id: l.listingId,
    source_url: l.url,
    is_outlier: false,
  })).filter(l => l.price > 0 && l.lot_size > 100 && l.lot_size < 2000);
  
  console.log(`  Total valid: ${all.length} (${listings.length} listings, ${sold.length} sold)`);
  return all;
}

module.exports = { scrapeSuburb, scrapeSuburbListings, scrapeSuburbSold, buildSearchUrl, buildSoldUrl };
