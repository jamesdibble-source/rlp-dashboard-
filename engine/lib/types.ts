// Core data types for the Grange Land Intelligence platform

export interface RawLot {
  address: string
  suburb: string
  lga: string
  state: 'VIC' | 'NSW' | 'QLD' | 'SA' | 'WA' | 'TAS' | 'NT' | 'ACT'
  corridor: string | null
  lotSize: number          // m²
  listPrice: number | null
  soldPrice: number | null
  status: 'listing' | 'sold' | 'under_contract' | 'withdrawn'
  listDate: string | null  // ISO date
  soldDate: string | null  // ISO date
  pricePerSqm: number
  source: 'rea' | 'domain' | 'openlot' | 'corelogic' | 'manual'
  sourceId: string         // listing ID on source platform
  sourceUrl: string | null
  isOutlier: boolean
  dedupKey: string         // for cross-source dedup
  scrapedAt: string        // ISO timestamp
  raw: Record<string, unknown> // original scraped data
}

export interface Lot {
  id: string               // UUID
  address: string
  suburb: string
  lga: string
  state: string
  corridor: string | null
  lotSize: number
  listPrice: number | null
  soldPrice: number | null
  price: number            // best price (sold > list)
  status: 'listing' | 'sold' | 'under_contract' | 'withdrawn'
  listDate: string | null
  soldDate: string | null
  pricePerSqm: number
  sources: string[]        // deduped across sources
  isOutlier: boolean
  firstSeen: string
  lastUpdated: string
}

// Aggregation types
export interface SuburbStats {
  suburb: string
  lga: string
  state: string
  corridor: string | null
  total: number
  listings: number
  sold: number
  medPrice: number
  avgPrice: number
  medSize: number
  medPsm: number
  minPrice: number
  maxPrice: number
  monthsOfSupply: number
}

export interface LGAStats {
  lga: string
  state: string
  corridor: string | null
  suburbs: number
  total: number
  listings: number
  sold: number
  medPrice: number
  medSize: number
  medPsm: number
  monthsOfSupply: number
  qoqPriceChange: number | null
  yoyPriceChange: number | null
}

export interface StateStats {
  state: string
  lgas: number
  suburbs: number
  total: number
  listings: number
  sold: number
  medPrice: number
  medSize: number
  medPsm: number
  corridors: CorridorStats[]
}

export interface CorridorStats {
  corridor: string
  state: string
  lgas: string[]
  total: number
  listings: number
  sold: number
  medPrice: number
  medSize: number
  medPsm: number
}

export interface TimeSeriesPoint {
  month: string           // YYYY-MM
  label: string           // "Mar 26"
  listings: number
  sold: number
  volume: number
  medPrice: number
  medPsm: number
  medSize: number
}

export interface MarketIndex {
  market: string
  score: number           // 0-10
  supply: number
  demand: number
  sentiment: number
  pricing: number
  trend: 'up' | 'down' | 'stable'
  qoqChange: number | null
}

// Filter state
export interface FilterState {
  state: string | null     // null = national
  lga: string | null
  suburb: string | null
  corridor: string | null
  soldOnly: boolean
  dateRange: [string, string] | null  // [from, to] YYYY-MM
  priceRange: [number, number] | null
  sizeRange: [number, number] | null
}

// Scraper config
export interface ScraperConfig {
  source: string
  apiKey?: string
  rateLimit: number        // requests per second
  batchSize: number
  suburbs: SuburbTarget[]
}

export interface SuburbTarget {
  suburb: string
  state: string
  lga: string
  postcode: string
  corridor: string | null
}
