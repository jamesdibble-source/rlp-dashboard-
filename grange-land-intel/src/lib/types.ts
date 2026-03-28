export interface Lot {
  address: string
  suburb: string
  lga: string
  corridor: string
  lotSize: number
  listPrice: number | null
  soldPrice: number | null
  price: number
  status: 'Listing' | 'Sold'
  date: string | null
  pricePerSqm: number
  isOutlier: boolean
  source: string
}

export interface LGAStats {
  count: number
  listings: number
  sold: number
  medPrice: number
  medSize: number
  medPsm: number
  corridor: string
}

export interface CorridorData {
  name: string
  lgas: string[]
  lotCount: number
  medPrice: number
  medSize: number
  medPsm: number
  color: string
}

export interface MarketIndex {
  market: string
  score: number // 0-10, Oliver Hume style
  supply: number
  demand: number
  sentiment: number
  pricing: number
  trend: 'up' | 'down' | 'stable'
}
