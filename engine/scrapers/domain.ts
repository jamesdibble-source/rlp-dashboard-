// Domain.com.au API scraper
// Free developer tier: 500 calls/day
// Docs: https://developer.domain.com.au/docs/v1

import type { RawLot } from '../lib/types'

const DOMAIN_API_BASE = 'https://api.domain.com.au/v1'

interface DomainConfig {
  clientId: string
  clientSecret: string
  accessToken?: string
  tokenExpiry?: number
}

interface DomainListing {
  id: number
  listingType: string
  propertyTypes: string[]
  price?: {
    displayPrice?: string
    from?: number
    to?: number
  }
  landArea?: number
  landAreaSqm?: number
  addressParts?: {
    displayAddress?: string
    streetNumber?: string
    street?: string
    suburb?: string
    postcode?: string
    stateAbbreviation?: string
  }
  dateListed?: string
  dateSold?: string
  saleDetails?: {
    soldPrice?: number
    soldDate?: string
  }
  status?: string
  listingSlug?: string
}

// Authenticate with Domain API (OAuth2 client credentials)
async function authenticate(config: DomainConfig): Promise<string> {
  if (config.accessToken && config.tokenExpiry && Date.now() < config.tokenExpiry) {
    return config.accessToken
  }

  const resp = await fetch('https://auth.domain.com.au/v1/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: 'api_listings_read api_salesresults_read',
    }),
  })

  if (!resp.ok) throw new Error(`Domain auth failed: ${resp.status}`)
  const data = await resp.json()
  config.accessToken = data.access_token
  config.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
  return data.access_token
}

// Search residential land listings in a suburb
export async function searchListings(
  config: DomainConfig,
  suburb: string,
  state: string,
  postcode: string,
  pageSize = 100,
  page = 1,
): Promise<{ listings: RawLot[]; hasMore: boolean }> {
  const token = await authenticate(config)

  const body = {
    listingType: 'Sale',
    propertyTypes: ['VacantLand'],
    locations: [{
      state: state,
      suburb: suburb,
      postCode: postcode,
      includeSurroundingSuburbs: false,
    }],
    landSize: { minimum: 150, maximum: 2000 },
    pageSize,
    pageNumber: page,
    sort: { sortKey: 'DateListed', direction: 'Descending' },
  }

  const resp = await fetch(`${DOMAIN_API_BASE}/listings/residential/_search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    if (resp.status === 429) {
      console.warn(`Domain rate limited, waiting 60s...`)
      await new Promise(r => setTimeout(r, 60000))
      return searchListings(config, suburb, state, postcode, pageSize, page)
    }
    throw new Error(`Domain search failed: ${resp.status} ${await resp.text()}`)
  }

  const listings: DomainListing[] = await resp.json()

  const rawLots: RawLot[] = listings
    .filter(l => l.landAreaSqm || l.landArea)
    .map(l => {
      const lotSize = l.landAreaSqm || l.landArea || 0
      const soldPrice = l.saleDetails?.soldPrice || null
      const listPrice = extractPrice(l.price?.displayPrice, l.price?.from)
      const price = soldPrice || listPrice || 0
      const isSold = !!(l.dateSold || l.saleDetails?.soldPrice)

      return {
        address: l.addressParts?.displayAddress || `${l.addressParts?.streetNumber || ''} ${l.addressParts?.street || ''}`.trim(),
        suburb: l.addressParts?.suburb || suburb,
        lga: '', // Domain doesn't provide LGA — we'll map from suburb/postcode
        state: (l.addressParts?.stateAbbreviation || state) as RawLot['state'],
        corridor: null,
        lotSize,
        listPrice,
        soldPrice,
        price,
        status: isSold ? 'sold' as const : 'listing' as const,
        listDate: l.dateListed || null,
        soldDate: l.dateSold || l.saleDetails?.soldDate || null,
        pricePerSqm: lotSize > 0 ? Math.round((price / lotSize) * 100) / 100 : 0,
        source: 'domain' as const,
        sourceId: String(l.id),
        sourceUrl: l.listingSlug ? `https://www.domain.com.au/${l.listingSlug}` : null,
        isOutlier: false,
        dedupKey: '',
        scrapedAt: new Date().toISOString(),
        raw: l as unknown as Record<string, unknown>,
      }
    })

  return {
    listings: rawLots,
    hasMore: listings.length >= pageSize,
  }
}

// Search sold results (different endpoint)
export async function searchSoldResults(
  config: DomainConfig,
  suburb: string,
  state: string,
  postcode: string,
): Promise<RawLot[]> {
  const token = await authenticate(config)

  // Domain's sold results endpoint
  const resp = await fetch(`${DOMAIN_API_BASE}/salesResults/${state}/${suburb}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })

  if (!resp.ok) return [] // Sold results may not be available for all suburbs
  const data = await resp.json()
  // Parse sold results — structure varies
  return [] // TODO: parse sold results format
}

// Extract numeric price from display string
function extractPrice(display?: string, from?: number): number | null {
  if (from && from > 0) return from
  if (!display) return null
  const match = display.replace(/,/g, '').match(/\$?([\d]+(?:\.[\d]+)?)/)?.[1]
  return match ? Math.round(parseFloat(match)) : null
}

// Paginate through all listings for a suburb
export async function scrapeSuburb(
  config: DomainConfig,
  suburb: string,
  state: string,
  postcode: string,
): Promise<RawLot[]> {
  const allLots: RawLot[] = []
  let page = 1
  let hasMore = true

  while (hasMore && page <= 10) { // Max 10 pages = 1000 lots per suburb
    const result = await searchListings(config, suburb, state, postcode, 100, page)
    allLots.push(...result.listings)
    hasMore = result.hasMore
    page++

    // Rate limiting: 500/day = ~0.35/sec, be conservative
    await new Promise(r => setTimeout(r, 3000))
  }

  return allLots
}
