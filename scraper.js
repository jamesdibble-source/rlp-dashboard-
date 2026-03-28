/**
 * Grange RLP Scraper — Victoria
 * Scrapes REA + Domain for residential land listings (buy + sold)
 * Covers all VIC LGAs at suburb level, 2yr historical lookback
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'scrape-state.json');
const LOTS_FILE = path.join(DATA_DIR, 'all-lots.json');
const MIN_SIZE = 150, MAX_SIZE = 2000;

// VIC growth corridor LGAs + key regional LGAs for greenfield land
const VIC_LGAS = {
  // Metro Growth Corridors
  'Western': ['Melton', 'Wyndham', 'Moorabool', 'Brimbank'],
  'Northern': ['Hume', 'Whittlesea', 'Mitchell'],
  'South Eastern': ['Casey', 'Cardinia'],
  'Geelong': ['Greater Geelong', 'Surf Coast', 'Golden Plains'],
  // Regional
  'Ballarat': ['Ballarat'],
  'Bendigo': ['Greater Bendigo'],
  'Gippsland': ['Latrobe', 'Baw Baw'],
  'North East': ['Wangaratta', 'Greater Shepparton', 'Benalla', 'Moira'],
  'Macedon & Sunbury': ['Macedon Ranges', 'Sunbury'],
  'Other Regional': ['Warrnambool', 'Mildura', 'Wodonga', 'Campaspe']
};

// REA API - residential land search
function reaSearch(suburb, state, page = 1, channel = 'buy') {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      channel: channel,
      searchLocation: suburb + ', VIC',
      propertyTypes: 'land',
      pageSize: '100',
      page: String(page),
      sortType: 'new-desc'
    });
    
    const options = {
      hostname: 'api.realestate.com.au',
      path: `/buy/in-${encodeURIComponent(suburb.toLowerCase().replace(/\s+/g, '+'))},+vic/list-1?channel=${channel}&propertyTypes=land&pageSize=100&page=${page}`,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    };

    // Use the REA residential-listings API
    const apiPath = `/residential-listings/search?query=${encodeURIComponent(suburb)}&state=VIC&channel=${channel}&propertyTypes=VACANT_LAND&pageSize=100&page=${page}`;
    
    https.get({
      hostname: 'lexa.realestate.com.au',
      path: `/graphql?query=${encodeURIComponent(`{searchByQuery(query:"${suburb} VIC",channel:${channel.toUpperCase()},filters:{propertyTypes:["VACANT_LAND"]},pageSize:100,page:${page}){results{exact{items{listingId,price{display},propertyDetails{address{suburb,state,streetAddress},features{landSize{value,unit}}},channel,dateSold{display}}},totalResultsCount}}}`)}&caller_id=rlp-grange`,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve({ error: 'parse_error', raw: data.substring(0, 500) }); }
      });
    }).on('error', e => resolve({ error: e.message }));
  });
}

// Domain API - residential land search
function domainSearch(suburb, page = 1, listingType = 'Sale') {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      listingType: listingType,
      propertyTypes: ['VacantLand'],
      locations: [{ state: 'VIC', suburb: suburb }],
      pageSize: 100,
      page: page,
      sort: { sortKey: 'DateUpdated', direction: 'Descending' }
    });

    const req = https.request({
      hostname: 'www.domain.com.au',
      path: '/phoenix/api/listings?listingType=' + listingType.toLowerCase() + '&propertyTypes=vacant-land&suburb=' + encodeURIComponent(suburb) + '&state=vic&page=' + page + '&pagesize=100&sort=dateupdated-desc',
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve({ error: 'parse_error', raw: data.substring(0, 500) }); }
      });
    });
    req.on('error', e => resolve({ error: e.message }));
    req.end();
  });
}

// REA web scraping fallback - parse search results HTML
function reaWebScrape(query, channel = 'buy', page = 1) {
  return new Promise((resolve, reject) => {
    const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const urlPath = channel === 'sold' 
      ? `/sold/in-${slug}/list-${page}?propertyType=land&includeSurrounding=false`
      : `/buy/in-${slug}/list-${page}?propertyType=land&includeSurrounding=false`;
    
    https.get({
      hostname: 'www.realestate.com.au',
      path: urlPath,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-AU,en;q=0.9'
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ html: data, statusCode: res.statusCode, url: `https://www.realestate.com.au${urlPath}` }));
    }).on('error', e => resolve({ error: e.message }));
  });
}

// Parse REA HTML for listing data
function parseReaHtml(html, channel) {
  const lots = [];
  
  // REA embeds JSON-LD and also has data in script tags
  const jsonLdMatches = html.match(/<script type="application\/json" id="__NEXT_DATA__">(.*?)<\/script>/s);
  if (jsonLdMatches) {
    try {
      const nextData = JSON.parse(jsonLdMatches[1]);
      const results = nextData?.props?.pageProps?.searchResults?.results?.exact?.items
        || nextData?.props?.pageProps?.searchResults?.results?.items
        || nextData?.props?.pageProps?.results?.exact?.items
        || [];
      
      for (const item of results) {
        const pd = item.propertyDetails || item.listing?.propertyDetails || {};
        const addr = pd.address || {};
        const features = pd.features || {};
        const landSize = features.landSize?.value || features.landArea?.value || 0;
        
        let price = null;
        const priceStr = item.price?.display || item.listing?.price?.display || '';
        const priceMatch = priceStr.replace(/,/g, '').match(/\$?([\d,]+(?:\.\d+)?)/);
        if (priceMatch) price = parseFloat(priceMatch[1].replace(/,/g, ''));
        
        let soldPrice = null;
        if (channel === 'sold') {
          soldPrice = price;
          price = null;
        }
        
        let date = item.dateSold?.display || item.listing?.dateSold?.display || item.dateAvailable?.display || null;
        
        if (landSize > 0 || price || soldPrice) {
          lots.push({
            address: addr.streetAddress || addr.display || '',
            suburb: addr.suburb || '',
            lotSize: landSize,
            listPrice: channel === 'buy' ? price : null,
            soldPrice: channel === 'sold' ? (soldPrice || price) : null,
            price: soldPrice || price,
            status: channel === 'sold' ? 'Sold' : 'Listing',
            date: date,
            source: 'REA',
            listingId: String(item.listingId || item.id || ''),
            url: item.listingUrl || item._links?.canonical?.href || ''
          });
        }
      }
      
      const totalCount = nextData?.props?.pageProps?.searchResults?.results?.totalResultsCount
        || nextData?.props?.pageProps?.searchResults?.totalResultsCount || 0;
      
      return { lots, totalCount, parsed: true };
    } catch (e) {
      // Fall through to regex parsing
    }
  }
  
  // Fallback: regex parsing for key data points
  const cardPattern = /data-testid="listing-card"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g;
  let match;
  while ((match = cardPattern.exec(html)) !== null) {
    const card = match[0];
    const addrMatch = card.match(/class="[^"]*address[^"]*"[^>]*>([^<]+)/);
    const priceMatch = card.match(/\$[\d,]+/);
    const sizeMatch = card.match(/([\d,]+)\s*m²/);
    
    if (addrMatch) {
      const price = priceMatch ? parseFloat(priceMatch[0].replace(/[$,]/g, '')) : null;
      const size = sizeMatch ? parseFloat(sizeMatch[1].replace(/,/g, '')) : null;
      
      lots.push({
        address: addrMatch[1].trim(),
        suburb: '',
        lotSize: size || 0,
        listPrice: channel === 'buy' ? price : null,
        soldPrice: channel === 'sold' ? price : null,
        price: price,
        status: channel === 'sold' ? 'Sold' : 'Listing',
        date: null,
        source: 'REA',
        listingId: '',
        url: ''
      });
    }
  }
  
  return { lots, totalCount: lots.length, parsed: lots.length > 0 };
}

// Domain web scraping
function domainWebScrape(suburb, type = 'sale', page = 1) {
  return new Promise((resolve, reject) => {
    const slug = suburb.toLowerCase().replace(/\s+/g, '-');
    const urlPath = type === 'sold'
      ? `/sold-listings/${slug}-vic/?ptype=vacant-land&page=${page}&sort=solddate-desc`
      : `/sale/${slug}-vic/?ptype=vacant-land&page=${page}&sort=dateupdated-desc`;
    
    https.get({
      hostname: 'www.domain.com.au',
      path: urlPath,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-AU,en;q=0.9'
      }
    }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        resolve({ html: '', statusCode: res.statusCode, redirect: res.headers.location });
        return;
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ html: data, statusCode: res.statusCode }));
    }).on('error', e => resolve({ error: e.message }));
  });
}

// Parse Domain HTML
function parseDomainHtml(html, type) {
  const lots = [];
  
  // Domain also uses __NEXT_DATA__
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      const listings = nextData?.props?.pageProps?.listingsMap
        || nextData?.props?.pageProps?.listings
        || {};
      
      const items = Array.isArray(listings) ? listings : Object.values(listings);
      
      for (const item of items) {
        const listing = item.listing || item;
        const addr = listing.address || listing.propertyDetails?.address || {};
        const landSize = listing.landAreaSqm || listing.propertyDetails?.landArea || listing.features?.landSize || 0;
        
        let price = listing.price || listing.priceDetails?.price || listing.priceDetails?.displayPrice || '';
        let numPrice = null;
        if (typeof price === 'string') {
          const m = price.replace(/,/g, '').match(/(\d{5,})/);
          if (m) numPrice = parseInt(m[1]);
        } else if (typeof price === 'number') {
          numPrice = price;
        }
        
        let date = listing.dateSold || listing.soldDate || listing.dateUpdated || null;
        
        lots.push({
          address: [addr.street, addr.streetAddress].filter(Boolean)[0] || '',
          suburb: addr.suburb || '',
          lotSize: landSize,
          listPrice: type === 'sale' ? numPrice : null,
          soldPrice: type === 'sold' ? numPrice : null,
          price: numPrice,
          status: type === 'sold' ? 'Sold' : 'Listing',
          date: date,
          source: 'Domain',
          listingId: String(listing.id || listing.listingId || ''),
          url: listing.listingSlug ? `https://www.domain.com.au/${listing.listingSlug}` : ''
        });
      }
      
      return { lots, parsed: true };
    } catch (e) {
      // fall through
    }
  }
  
  return { lots, parsed: false };
}

// Suburb lists per LGA (key growth suburbs)
const LGA_SUBURBS = {
  'Melton': ['Rockbank', 'Aintree', 'Brookfield', 'Cobblebank', 'Deanside', 'Bonnie Brook', 'Thornhill Park', 'Fraser Rise', 'Plumpton', 'Melton South', 'Melton', 'Kurunjang', 'Eynesbury'],
  'Wyndham': ['Werribee', 'Tarneit', 'Truganina', 'Williams Landing', 'Point Cook', 'Manor Lakes', 'Wyndham Vale', 'Lollypop Creek'],
  'Moorabool': ['Bacchus Marsh', 'Maddingley', 'Darley'],
  'Brimbank': ['Deer Park', 'Sunshine', 'St Albans'],
  'Hume': ['Craigieburn', 'Mickleham', 'Kalkallo', 'Donnybrook', 'Sunbury', 'Diggers Rest', 'Greenvale', 'Beveridge', 'Merrifield'],
  'Whittlesea': ['Mernda', 'Doreen', 'Wollert', 'Epping', 'South Morang'],
  'Mitchell': ['Wallan', 'Kilmore', 'Beveridge', 'Broadford'],
  'Casey': ['Clyde', 'Clyde North', 'Officer', 'Pakenham', 'Berwick', 'Cranbourne', 'Cranbourne East', 'Cranbourne South', 'Cranbourne West', 'Botanic Ridge'],
  'Cardinia': ['Officer', 'Pakenham', 'Beaconsfield', 'Officer South', 'Tynong'],
  'Greater Geelong': ['Armstrong Creek', 'Lara', 'Leopold', 'Lovely Banks', 'Mount Duneed', 'Charlemont', 'Corio', 'Norlane', 'Bell Park', 'Grovedale', 'Waurn Ponds'],
  'Surf Coast': ['Torquay', 'Jan Juc'],
  'Golden Plains': ['Bannockburn', 'Batesford', 'Smythes Creek'],
  'Ballarat': ['Alfredton', 'Bonshaw', 'Lucas', 'Winter Valley', 'Sebastopol', 'Delacombe', 'Miners Rest', 'Mount Helen', 'Brown Hill', 'Invermay Park', 'Ballarat East', 'Ballarat North', 'Canadian', 'Mount Clear', 'Wendouree'],
  'Greater Bendigo': ['Huntly', 'Strathfieldsaye', 'Epsom', 'Kangaroo Flat', 'Golden Square', 'Maiden Gully', 'Eaglehawk', 'Bendigo', 'Marong', 'Spring Gully'],
  'Latrobe': ['Traralgon', 'Morwell', 'Churchill', 'Moe', 'Newborough'],
  'Baw Baw': ['Warragul', 'Drouin', 'Yarragon', 'Longwarry', 'Trafalgar'],
  'Wangaratta': ['Wangaratta', 'Waldara', 'Wangaratta South'],
  'Greater Shepparton': ['Shepparton', 'Shepparton North', 'Kialla', 'Mooroopna'],
  'Benalla': ['Benalla'],
  'Moira': ['Yarrawonga', 'Cobram', 'Numurkah'],
  'Macedon Ranges': ['Gisborne', 'Romsey', 'Riddells Creek', 'Kyneton', 'Woodend', 'Lancefield'],
  'Warrnambool': ['Warrnambool', 'Dennington'],
  'Mildura': ['Mildura', 'Irymple', 'Mildura South'],
  'Wodonga': ['Wodonga', 'West Wodonga', 'Baranduda'],
  'Campaspe': ['Echuca', 'Moama', 'Rochester'],
};

// Rate limiting
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Main scrape function for a single suburb
async function scrapeSuburb(suburb, lga) {
  const lots = [];
  
  // REA Buy
  console.log(`  REA Buy: ${suburb}...`);
  const reaBuy = await reaWebScrape(suburb + ', VIC', 'buy');
  if (reaBuy.html && reaBuy.statusCode === 200) {
    const parsed = parseReaHtml(reaBuy.html, 'buy');
    parsed.lots.forEach(l => { l.suburb = l.suburb || suburb; l.lga = lga; });
    lots.push(...parsed.lots);
    console.log(`    → ${parsed.lots.length} buy listings`);
  }
  await sleep(2000); // Rate limit
  
  // REA Sold
  console.log(`  REA Sold: ${suburb}...`);
  const reaSold = await reaWebScrape(suburb + ', VIC', 'sold');
  if (reaSold.html && reaSold.statusCode === 200) {
    const parsed = parseReaHtml(reaSold.html, 'sold');
    parsed.lots.forEach(l => { l.suburb = l.suburb || suburb; l.lga = lga; });
    lots.push(...parsed.lots);
    console.log(`    → ${parsed.lots.length} sold listings`);
  }
  await sleep(2000);
  
  // Domain Buy
  console.log(`  Domain Buy: ${suburb}...`);
  const domBuy = await domainWebScrape(suburb, 'sale');
  if (domBuy.html && domBuy.statusCode === 200) {
    const parsed = parseDomainHtml(domBuy.html, 'sale');
    parsed.lots.forEach(l => { l.suburb = l.suburb || suburb; l.lga = lga; });
    lots.push(...parsed.lots);
    console.log(`    → ${parsed.lots.length} buy listings`);
  }
  await sleep(2000);
  
  // Domain Sold
  console.log(`  Domain Sold: ${suburb}...`);
  const domSold = await domainWebScrape(suburb, 'sold');
  if (domSold.html && domSold.statusCode === 200) {
    const parsed = parseDomainHtml(domSold.html, 'sold');
    parsed.lots.forEach(l => { l.suburb = l.suburb || suburb; l.lga = lga; });
    lots.push(...parsed.lots);
    console.log(`    → ${parsed.lots.length} sold listings`);
  }
  await sleep(1000);
  
  return lots;
}

// Process and clean lots
function processLots(lots) {
  return lots.filter(l => {
    if (!l.lotSize || l.lotSize < MIN_SIZE || l.lotSize > MAX_SIZE) return false;
    if (!l.price || l.price < 10000) return false;
    l.pricePerSqm = Math.round((l.price / l.lotSize) * 100) / 100;
    // Basic outlier check — $/m² between $50 and $5000
    if (l.pricePerSqm < 50 || l.pricePerSqm > 5000) return false;
    return true;
  });
}

// Dedup across sources
function dedup(lots) {
  const seen = new Map();
  return lots.filter(l => {
    // Normalize address for matching
    const normAddr = (l.address || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const key = `${normAddr}|${l.suburb?.toLowerCase()}|${l.lotSize}`;
    if (seen.has(key)) {
      // Prefer sold over listing, prefer newer
      const existing = seen.get(key);
      if (l.status === 'Sold' && existing.status !== 'Sold') {
        seen.set(key, l);
        return true;
      }
      return false;
    }
    seen.set(key, l);
    return true;
  });
}

// Calculate outlier stats per LGA
function addOutlierFlags(lots) {
  const byLga = {};
  lots.forEach(l => {
    if (!byLga[l.lga]) byLga[l.lga] = [];
    byLga[l.lga].push(l);
  });
  
  for (const [lga, lgaLots] of Object.entries(byLga)) {
    const psm = lgaLots.map(l => l.pricePerSqm).sort((a, b) => a - b);
    if (psm.length < 4) continue;
    const q1 = psm[Math.floor(psm.length * 0.25)];
    const q3 = psm[Math.floor(psm.length * 0.75)];
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    lgaLots.forEach(l => {
      l.isOutlier = l.pricePerSqm < lower || l.pricePerSqm > upper;
    });
  }
  return lots;
}

async function main() {
  const mode = process.argv[2] || 'test'; // test | full
  const targetLga = process.argv[3]; // optional specific LGA
  
  console.log(`\n🏘️  Grange RLP Scraper — Victoria`);
  console.log(`Mode: ${mode}, Target: ${targetLga || 'all'}\n`);
  
  let allLots = [];
  
  // Load existing data
  if (fs.existsSync(LOTS_FILE)) {
    const existing = JSON.parse(fs.readFileSync(LOTS_FILE, 'utf8'));
    console.log(`Loaded ${existing.length} existing lots\n`);
    allLots = existing;
  }
  
  const lgasToScrape = targetLga 
    ? { [targetLga]: LGA_SUBURBS[targetLga] || [] }
    : LGA_SUBURBS;
  
  if (mode === 'test') {
    // Test with first 2 suburbs of first LGA
    const firstLga = Object.keys(lgasToScrape)[0];
    const testSuburbs = (lgasToScrape[firstLga] || []).slice(0, 2);
    console.log(`Testing with: ${firstLga} → ${testSuburbs.join(', ')}\n`);
    
    for (const suburb of testSuburbs) {
      const lots = await scrapeSuburb(suburb, firstLga);
      allLots.push(...lots);
    }
  } else {
    // Full scrape
    for (const [lga, suburbs] of Object.entries(lgasToScrape)) {
      console.log(`\n📍 ${lga} (${suburbs.length} suburbs)`);
      for (const suburb of suburbs) {
        try {
          const lots = await scrapeSuburb(suburb, lga);
          allLots.push(...lots);
        } catch (e) {
          console.log(`  ❌ Error scraping ${suburb}: ${e.message}`);
        }
      }
    }
  }
  
  // Process
  console.log(`\nRaw lots: ${allLots.length}`);
  allLots = processLots(allLots);
  console.log(`After filtering (size/price): ${allLots.length}`);
  allLots = dedup(allLots);
  console.log(`After dedup: ${allLots.length}`);
  allLots = addOutlierFlags(allLots);
  
  // Stats
  const lgas = [...new Set(allLots.map(l => l.lga))];
  console.log(`\nMarkets: ${lgas.length}`);
  for (const lga of lgas) {
    const ml = allLots.filter(l => l.lga === lga);
    const med = ml.map(l => l.price).sort((a,b) => a-b)[Math.floor(ml.length/2)] || 0;
    console.log(`  ${lga}: ${ml.length} lots, median $${med.toLocaleString()}`);
  }
  
  // Save
  fs.writeFileSync(LOTS_FILE, JSON.stringify(allLots));
  console.log(`\nSaved ${allLots.length} lots to ${LOTS_FILE} (${(fs.statSync(LOTS_FILE).size/1024).toFixed(0)} KB)`);
  
  // Save state
  const state = { lastScrape: new Date().toISOString(), lotCount: allLots.length, lgas: lgas.length };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

main().catch(console.error);
