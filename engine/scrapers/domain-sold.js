// Scrapes Domain.com.au sold listings — goes back 1-2 years
// URL: https://www.domain.com.au/sold-listings/SUBURB-STATE-POSTCODE/land/?sort=solddate-desc
// Same rate limiting as domain-public.js

const cheerio = require('cheerio');

const DELAY = 800; // ms between requests
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function scrapeSoldPage(suburb, state, postcode, page = 1) {
  const slug = suburb.toLowerCase().replace(/\s+/g, '-');
  const stateSlug = state.toLowerCase();
  const url = `https://www.domain.com.au/sold-listings/${slug}-${stateSlug}-${postcode}/land/?sort=solddate-desc&page=${page}`;
  
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-AU,en;q=0.9',
    }
  });

  if (res.status === 429) {
    console.log(`  429 on ${suburb} page ${page}, waiting 10s...`);
    await sleep(10000);
    return scrapeSoldPage(suburb, state, postcode, page);
  }

  if (!res.ok) return { lots: [], hasMore: false };

  const html = await res.text();
  const $ = cheerio.load(html);
  const lots = [];

  // Domain sold listings use similar card structure
  $('[data-testid="listing-card-wrapper-premiumplus"], [data-testid="listing-card-wrapper-premium"], [data-testid="listing-card-wrapper-standard"], .css-1qp9106').each((i, el) => {
    try {
      const card = $(el);
      const priceText = card.find('[data-testid="listing-card-price"]').text().trim() 
        || card.find('.css-mgq8yx').text().trim()
        || card.find('[class*="price"]').first().text().trim();
      
      const addressText = card.find('h2').text().trim()
        || card.find('[data-testid="address"]').text().trim()
        || card.find('[class*="address"]').first().text().trim();

      const featuresText = card.find('[data-testid="property-features"]').text().trim()
        || card.find('[class*="features"]').text().trim();
      
      // Extract sold date
      const soldDateText = card.find('[data-testid="listing-card-tag"]').text().trim()
        || card.find('.css-1b9t7yq').text().trim()
        || '';

      // Parse price
      let price = 0;
      const priceMatch = priceText.match(/\$[\d,]+/);
      if (priceMatch) {
        price = parseInt(priceMatch[0].replace(/[$,]/g, ''));
      }

      // Parse lot size from features
      let lotSize = 0;
      const sizeMatch = featuresText.match(/([\d,]+)\s*m[²2]/i) || addressText.match(/([\d,]+)\s*m[²2]/i);
      if (sizeMatch) {
        lotSize = parseInt(sizeMatch[1].replace(/,/g, ''));
      }

      // Parse sold date
      let soldDate = null;
      const dateMatch = soldDateText.match(/Sold\s+(\d{1,2}\s+\w+\s+\d{4})/i);
      if (dateMatch) {
        try { soldDate = new Date(dateMatch[1]).toISOString().split('T')[0]; } catch(e) {}
      }

      if (price > 50000 && price < 5000000) {
        lots.push({
          address: addressText,
          suburb: suburb,
          state: state.toUpperCase(),
          price,
          lot_size: lotSize,
          status: 'sold',
          sold_date: soldDate,
          source: 'domain-sold',
          scraped_at: new Date().toISOString()
        });
      }
    } catch(e) {}
  });

  // Check for next page
  const hasMore = $('a[rel="next"]').length > 0 || $('[data-testid="paginator-next-page"]').length > 0;

  return { lots, hasMore };
}

module.exports = { scrapeSoldPage, DELAY };
