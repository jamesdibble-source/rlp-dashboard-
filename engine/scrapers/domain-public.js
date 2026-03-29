// Domain.com.au public search scraper — v2 (uses __NEXT_DATA__ JSON + HTML fallback)
// No API key needed — scrapes public search results pages
// Rate limited to 1 request per 3 seconds to be respectful

const cheerio = require('cheerio');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-AU,en;q=0.9',
  'Referer': 'https://www.domain.com.au/',
};

const DELAY = 900; // ms between requests

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function buildSearchUrl(suburb, state, postcode, page = 1) {
  const slug = suburb.toLowerCase().replace(/\s+/g, '-');
  const stateSlug = state.toLowerCase();
  return `https://www.domain.com.au/sale/${slug}-${stateSlug}-${postcode}/?ptype=vacant-land&ssubs=0&page=${page}`;
}

function buildSoldUrl(suburb, state, postcode, page = 1) {
  const slug = suburb.toLowerCase().replace(/\s+/g, '-');
  const stateSlug = state.toLowerCase();
  return `https://www.domain.com.au/sold-listings/${slug}-${stateSlug}-${postcode}/?ptype=vacant-land&page=${page}`;
}

// ──── PRIMARY PARSER: __NEXT_DATA__ JSON ────
function parseNextData(html, suburb, state, type) {
  try {
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
    if (!match) return null;
    
    const data = JSON.parse(match[1]);
    const cp = data?.props?.pageProps?.componentProps;
    if (!cp) return null;
    
    const ids = cp.listingSearchResultIds || [];
    const map = cp.listingsMap || {};
    const totalPages = cp.totalPages || 1;
    const totalListings = cp.totalListings || 0;
    
    const lots = [];
    for (const id of ids) {
      const listing = map[id];
      if (!listing?.listingModel) continue;
      const m = listing.listingModel;
      
      const address = m.address?.street || '';
      const lotSuburb = m.address?.suburb || suburb;
      const lotState = m.address?.state || state;
      const postcode = m.address?.postcode || '';
      const lat = m.address?.lat;
      const lng = m.address?.lng;
      
      const price = parsePrice(m.price);
      const lotSize = m.features?.landSize || null;
      const propertyType = m.features?.propertyType || '';
      
      // Extract sold date from tags if available
      let soldDate = null;
      if (type === 'sold' && m.tags?.tagText) {
        const dateMatch = m.tags.tagText.match(/Sold\s+(\d{1,2}\s+\w+\s+\d{4})/i);
        if (dateMatch) {
          try { soldDate = new Date(dateMatch[1]).toISOString().split('T')[0]; } catch(e) {}
        }
      }
      
      const url = m.url ? `https://www.domain.com.au${m.url}` : '';
      const listingId = String(id);
      
      lots.push({
        address, suburb: lotSuburb, state: lotState, postcode,
        price, lotSize, lat, lng, propertyType,
        priceText: m.price || '',
        url, listingId, type, soldDate,
      });
    }
    
    // Also grab UPVSoldListings if present (sold comparables shown on buy pages)
    if (cp.UPVSoldListings?.length) {
      for (const listing of cp.UPVSoldListings) {
        const m = listing?.listingModel;
        if (!m) continue;
        const price = parsePrice(m.price);
        const lotSize = m.features?.landSize || null;
        if (!price && !lotSize) continue;
        
        let soldDate = null;
        if (m.tags?.tagText) {
          const dateMatch = m.tags.tagText.match(/Sold\s+([\d\s\w]+\d{4})/i);
          if (dateMatch) { try { soldDate = new Date(dateMatch[1]).toISOString().split('T')[0]; } catch(e) {} }
        }
        
        lots.push({
          address: m.address?.street || '',
          suburb: m.address?.suburb || suburb,
          state: m.address?.state || state,
          postcode: m.address?.postcode || '',
          price, lotSize, lat: m.address?.lat, lng: m.address?.lng,
          propertyType: m.features?.propertyType || '',
          priceText: m.price || '',
          url: m.url ? `https://www.domain.com.au${m.url}` : '',
          listingId: String(listing.id || ''),
          type: 'sold', soldDate,
        });
      }
    }
    
    return { lots, totalPages, totalListings };
  } catch (e) {
    return null;
  }
}

// ──── FALLBACK PARSER: HTML scraping ────
function parseListingCards(html, suburb, state, type) {
  const $ = cheerio.load(html);
  const lots = [];

  $('[data-testid="listing-card-wrapper-premiumplus"], [data-testid="listing-card-wrapper-premium"], [data-testid="listing-card-wrapper-standard"], .css-1qp9106, article[data-testid]').each((_, el) => {
    try {
      const $el = $(el);
      let priceText = $el.find('[data-testid="listing-card-price"]').text().trim()
        || $el.find('.css-mgq8yx').text().trim();
      let address = $el.find('[data-testid="address-line1"]').text().trim()
        || $el.find('h2').first().text().trim();
      let addressLine2 = $el.find('[data-testid="address-line2"]').text().trim();
      
      let sizeText = '';
      $el.find('[data-testid="property-features-text-container"] span, span').each((_, feat) => {
        const t = $(feat).text().trim();
        if ((t.includes('m²') || t.includes('sqm')) && !t.includes('/')) sizeText = t;
      });
      
      const link = $el.find('a[href*="/sale/"], a[href*="/sold/"], a[href*="domain.com.au"]').first().attr('href') || '';
      const listingId = link.match(/(\d{6,})/)?.[1] || '';
      const price = parsePrice(priceText);
      const lotSize = parseSize(sizeText);
      
      if (address && (price || lotSize)) {
        lots.push({
          address, suburb: addressLine2?.split(',')[0]?.trim() || suburb,
          state, price, lotSize, priceText, sizeText: sizeText,
          url: link.startsWith('http') ? link : `https://www.domain.com.au${link}`,
          listingId, type,
        });
      }
    } catch (e) {}
  });
  return lots;
}

function parsePrice(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/,/g, '').replace(/\s+/g, ' ');
  const match = cleaned.match(/\$?\s*([\d,]+(?:\.\d+)?)\s*(k|m)?/i);
  if (!match) return null;
  let val = parseFloat(match[1].replace(/,/g, ''));
  if (match[2]?.toLowerCase() === 'k') val *= 1000;
  if (match[2]?.toLowerCase() === 'm') val *= 1000000;
  return val > 1000 ? Math.round(val) : null; // Sanity check
}

function parseSize(text) {
  if (!text) return null;
  const match = String(text).replace(/,/g, '').match(/([\d.]+)\s*m[²2]?/i);
  return match ? Math.round(parseFloat(match[1])) : null;
}

async function scrapePage(url) {
  const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
  if (resp.status === 429) {
    console.warn('  Rate limited, waiting 30s...');
    await sleep(30000);
    return scrapePage(url);
  }
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return resp.text();
}

// ──── MAIN SCRAPERS ────

async function scrapeSuburbListings(suburb, state, postcode, maxPages = 10) {
  const allLots = [];
  let totalPages = 1;
  
  for (let page = 1; page <= Math.min(maxPages, totalPages); page++) {
    const url = buildSearchUrl(suburb, state, postcode, page);
    
    try {
      const html = await scrapePage(url);
      
      // Try __NEXT_DATA__ first (gets ALL listings, not just rendered ones)
      const nextData = parseNextData(html, suburb, state, 'listing');
      if (nextData && nextData.lots.length > 0) {
        if (page === 1) totalPages = Math.min(nextData.totalPages, maxPages);
        allLots.push(...nextData.lots);
        console.log(`    Page ${page}: ${nextData.lots.length} via JSON (total: ${nextData.totalListings})`);
        
        // If page 1 returned all listings (totalPages=1), we're done
        if (nextData.totalPages <= page) break;
      } else {
        // Fallback to HTML parsing
        const lots = parseListingCards(html, suburb, state, 'listing');
        if (lots.length === 0) break;
        allLots.push(...lots);
        console.log(`    Page ${page}: ${lots.length} via HTML`);
      }
      
      await sleep(DELAY);
    } catch (e) {
      console.error(`    Error page ${page}: ${e.message}`);
      break;
    }
  }
  
  return allLots;
}

async function scrapeSuburbSold(suburb, state, postcode, maxPages = 10) {
  const allLots = [];
  let totalPages = 1;
  
  for (let page = 1; page <= Math.min(maxPages, totalPages); page++) {
    const url = buildSoldUrl(suburb, state, postcode, page);
    
    try {
      const html = await scrapePage(url);
      
      const nextData = parseNextData(html, suburb, state, 'sold');
      if (nextData && nextData.lots.length > 0) {
        if (page === 1) totalPages = Math.min(nextData.totalPages, maxPages);
        allLots.push(...nextData.lots);
        console.log(`    Sold page ${page}: ${nextData.lots.length} via JSON (total: ${nextData.totalListings})`);
        if (nextData.totalPages <= page) break;
      } else {
        const lots = parseListingCards(html, suburb, state, 'sold');
        if (lots.length === 0) break;
        allLots.push(...lots);
        console.log(`    Sold page ${page}: ${lots.length} via HTML`);
      }
      
      await sleep(DELAY);
    } catch (e) {
      console.error(`    Sold error page ${page}: ${e.message}`);
      break;
    }
  }
  
  return allLots;
}

// Full suburb scrape — listings + sold
async function scrapeSuburb(suburb, state, postcode, lga, corridor) {
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
    status: l.type === 'sold' ? 'sold' : 'listing',
    list_date: l.type === 'listing' ? new Date().toISOString().split('T')[0] : null,
    sold_date: l.soldDate || (l.type === 'sold' ? new Date().toISOString().split('T')[0] : null),
    price_per_sqm: (l.price && l.lotSize) ? Math.round((l.price / l.lotSize) * 100) / 100 : 0,
    source: 'domain',
    source_id: l.listingId,
    source_url: l.url,
    is_outlier: false,
  })).filter(l => l.price > 0 && l.lot_size > 50 && l.lot_size < 10000);
  
  return all;
}

module.exports = { scrapeSuburb, scrapeSuburbListings, scrapeSuburbSold, buildSearchUrl, buildSoldUrl, DELAY };
