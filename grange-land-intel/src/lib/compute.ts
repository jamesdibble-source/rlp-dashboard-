// Compute all dashboard stats from raw slim lots, with optional soldOnly filter

export interface SlimLot {
  s: string   // suburb
  m: string   // market
  p: number   // price
  z: number   // lot size m²
  r: number   // $/m²
  t: number   // 1=sold, 0=listing
  d: string | null // YYYY-MM
}

export interface MarketStat {
  market: string
  total: number
  listings: number
  sold: number
  medPrice: number
  medSize: number
  medPsm: number
  avgPrice: number
}

export interface SuburbStat {
  suburb: string
  market: string
  total: number
  listings: number
  sold: number
  medPrice: number
  medSize: number
  medPsm: number
}

export interface TimePoint {
  month: string
  label: string
  listings: number
  sold: number
  volume: number
  medPrice: number
  medPsm: number
  medSize: number
}

export interface DistPoint {
  range: string
  count: number
  order: number
}

function med(arr: number[]): number {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

// Get current month as YYYY-MM
function currentMonth(): string {
  const now = new Date()
  return now.toISOString().substring(0, 7)
}

export function computeAll(rawLots: SlimLot[], soldOnly: boolean) {
  const cm = currentMonth()

  // Apply filter: if soldOnly, remove listings from current month
  // Historical months keep all data (listings that were listed and never sold are still market signal)
  // But current month listings haven't had time to transact — they inflate prices
  const lots = soldOnly
    ? rawLots.filter(l => !(l.d === cm && l.t === 0))
    : rawLots

  // Market stats
  const byMarket: Record<string, SlimLot[]> = {}
  lots.forEach(l => {
    if (!byMarket[l.m]) byMarket[l.m] = []
    byMarket[l.m].push(l)
  })

  const marketStats: MarketStat[] = Object.entries(byMarket).map(([market, ls]) => {
    const prices = ls.map(l => l.p)
    const sizes = ls.map(l => l.z)
    const psm = ls.map(l => l.r)
    return {
      market,
      total: ls.length,
      listings: ls.filter(l => l.t === 0).length,
      sold: ls.filter(l => l.t === 1).length,
      medPrice: Math.round(med(prices)),
      medSize: Math.round(med(sizes)),
      medPsm: Math.round(med(psm)),
      avgPrice: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    }
  })

  // Suburb stats
  const bySub: Record<string, { market: string; lots: SlimLot[] }> = {}
  lots.forEach(l => {
    if (!bySub[l.s]) bySub[l.s] = { market: l.m, lots: [] }
    bySub[l.s].lots.push(l)
  })

  const suburbStats: SuburbStat[] = Object.entries(bySub)
    .map(([suburb, d]) => {
      const ls = d.lots
      return {
        suburb,
        market: d.market,
        total: ls.length,
        listings: ls.filter(l => l.t === 0).length,
        sold: ls.filter(l => l.t === 1).length,
        medPrice: Math.round(med(ls.map(l => l.p))),
        medSize: Math.round(med(ls.map(l => l.z))),
        medPsm: Math.round(med(ls.map(l => l.r))),
      }
    })
    .sort((a, b) => b.total - a.total)

  // Time series
  const byMonth: Record<string, { listings: number; sold: number; prices: number[]; sizes: number[]; psm: number[] }> = {}
  lots.forEach(l => {
    if (!l.d) return
    if (!byMonth[l.d]) byMonth[l.d] = { listings: 0, sold: 0, prices: [], sizes: [], psm: [] }
    if (l.t === 0) byMonth[l.d].listings++
    else byMonth[l.d].sold++
    byMonth[l.d].prices.push(l.p)
    byMonth[l.d].sizes.push(l.z)
    byMonth[l.d].psm.push(l.r)
  })

  const timeSeries: TimePoint[] = Object.entries(byMonth)
    .sort()
    .map(([month, d]) => ({
      month,
      label: new Date(month + '-01').toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }),
      listings: d.listings,
      sold: d.sold,
      volume: d.listings + d.sold,
      medPrice: Math.round(med(d.prices)),
      medPsm: Math.round(med(d.psm)),
      medSize: Math.round(med(d.sizes)),
    }))

  // Price distribution (50K buckets)
  const priceBuckets: Record<string, DistPoint> = {}
  lots.forEach(l => {
    const bucket = Math.floor(l.p / 50000) * 50000
    const label = '$' + (bucket / 1000) + 'K'
    if (!priceBuckets[label]) priceBuckets[label] = { range: label, count: 0, order: bucket }
    priceBuckets[label].count++
  })
  const priceDistribution = Object.values(priceBuckets).sort((a, b) => a.order - b.order)

  // Size distribution (100m² buckets)
  const sizeBuckets: Record<string, DistPoint> = {}
  lots.forEach(l => {
    const bucket = Math.floor(l.z / 100) * 100
    const label = bucket + 'm²'
    if (!sizeBuckets[label]) sizeBuckets[label] = { range: label, count: 0, order: bucket }
    sizeBuckets[label].count++
  })
  const sizeDistribution = Object.values(sizeBuckets).sort((a, b) => a.order - b.order)

  return {
    marketStats,
    suburbStats,
    timeSeries: timeSeries.slice(-24),
    priceDistribution,
    sizeDistribution,
    totalClean: lots.length,
    currentMonth: cm,
  }
}
