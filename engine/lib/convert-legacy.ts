// Convert legacy scraped data (lots.json from data-loader.js) into new Lot format
// This preserves our existing 5,052 lots while migrating to the new schema

import type { Lot } from './types'

interface LegacyLot {
  address: string
  suburb: string
  market: string
  lotSize: number
  listPrice: number | null
  soldPrice: number | null
  price: number
  status: 'Listing' | 'Sold'
  date: string | null
  pricePerSqm: number
  source: string
  listingId: string
  url: string
  isOutlier: boolean
}

// Market → State mapping
const MARKET_STATE: Record<string, string> = {
  'Ballarat': 'VIC',
  'Wangaratta': 'VIC',
  'Murray Bridge': 'SA',
}

// Market → LGA mapping (for our existing data)
const MARKET_LGA: Record<string, string> = {
  'Ballarat': 'Ballarat',
  'Wangaratta': 'Wangaratta',
  'Murray Bridge': 'Rural City of Murray Bridge',
}

// Market → Corridor
const MARKET_CORRIDOR: Record<string, string> = {
  'Ballarat': 'Ballarat',
  'Wangaratta': 'North East',
  'Murray Bridge': 'Murray Bridge',
}

export function convertLegacyLots(legacy: LegacyLot[]): Lot[] {
  return legacy
    .filter(l => l.price > 0 && l.price < 5000000 && l.lotSize > 100 && l.lotSize < 5000 && l.pricePerSqm > 50 && l.pricePerSqm < 5000)
    .map((l, i) => ({
      id: `legacy-${i}-${l.listingId || l.address.substring(0, 20)}`,
      address: l.address,
      suburb: l.suburb,
      lga: MARKET_LGA[l.market] || l.market,
      state: MARKET_STATE[l.market] || 'VIC',
      corridor: MARKET_CORRIDOR[l.market] || null,
      lotSize: l.lotSize,
      listPrice: l.listPrice,
      soldPrice: l.soldPrice,
      price: l.price,
      status: l.status === 'Sold' ? 'sold' as const : 'listing' as const,
      listDate: l.status === 'Listing' ? l.date : null,
      soldDate: l.status === 'Sold' ? l.date : null,
      pricePerSqm: l.pricePerSqm,
      sources: [l.source?.toLowerCase() || 'rea'],
      isOutlier: l.isOutlier,
      firstSeen: l.date || new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    }))
}
