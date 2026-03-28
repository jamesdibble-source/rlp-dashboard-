// Core computation engine — all stats computed from raw lot arrays
// Designed to run both server-side (Node) and client-side (browser)

import type { Lot, SuburbStats, LGAStats, StateStats, CorridorStats, TimeSeriesPoint, FilterState } from './types'

function med(arr: number[]): number {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

function avg(arr: number[]): number {
  if (!arr.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function currentMonth(): string {
  return new Date().toISOString().substring(0, 7)
}

// Apply filters to lot array
export function applyFilters(lots: Lot[], filters: FilterState): Lot[] {
  const cm = currentMonth()
  let filtered = lots

  if (filters.state) {
    filtered = filtered.filter(l => l.state === filters.state)
  }
  if (filters.lga) {
    filtered = filtered.filter(l => l.lga === filters.lga)
  }
  if (filters.suburb) {
    filtered = filtered.filter(l => l.suburb === filters.suburb)
  }
  if (filters.corridor) {
    filtered = filtered.filter(l => l.corridor === filters.corridor)
  }
  if (filters.soldOnly) {
    // Remove current month listings — they inflate prices in soft markets
    filtered = filtered.filter(l => {
      const lotMonth = (l.soldDate || l.listDate || '')?.substring(0, 7)
      return !(lotMonth === cm && l.status === 'listing')
    })
  }
  if (filters.priceRange) {
    const [min, max] = filters.priceRange
    filtered = filtered.filter(l => l.price >= min && l.price <= max)
  }
  if (filters.sizeRange) {
    const [min, max] = filters.sizeRange
    filtered = filtered.filter(l => l.lotSize >= min && l.lotSize <= max)
  }
  if (filters.dateRange) {
    const [from, to] = filters.dateRange
    filtered = filtered.filter(l => {
      const d = l.soldDate || l.listDate || ''
      return d >= from && d <= to
    })
  }

  return filtered
}

// Compute suburb-level stats
export function computeSuburbStats(lots: Lot[]): SuburbStats[] {
  const groups: Record<string, Lot[]> = {}
  lots.forEach(l => {
    const key = `${l.state}|${l.lga}|${l.suburb}`
    if (!groups[key]) groups[key] = []
    groups[key].push(l)
  })

  return Object.entries(groups).map(([key, ls]) => {
    const [state, lga, suburb] = key.split('|')
    const prices = ls.map(l => l.price).filter(p => p > 0)
    const sizes = ls.map(l => l.lotSize).filter(s => s > 0)
    const psm = ls.map(l => l.pricePerSqm).filter(p => p > 0)
    const sold = ls.filter(l => l.status === 'sold')
    const listings = ls.filter(l => l.status === 'listing')
    const months = new Set(ls.filter(l => l.soldDate).map(l => l.soldDate!.substring(0, 7))).size || 1
    const avgSalesPerMonth = sold.length / months

    return {
      suburb, lga, state,
      corridor: ls[0]?.corridor || null,
      total: ls.length,
      listings: listings.length,
      sold: sold.length,
      medPrice: Math.round(med(prices)),
      avgPrice: Math.round(avg(prices)),
      medSize: Math.round(med(sizes)),
      medPsm: Math.round(med(psm)),
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      monthsOfSupply: avgSalesPerMonth > 0 ? Math.round((listings.length / avgSalesPerMonth) * 10) / 10 : 0,
    }
  }).sort((a, b) => b.total - a.total)
}

// Compute LGA-level stats
export function computeLGAStats(lots: Lot[]): LGAStats[] {
  const groups: Record<string, Lot[]> = {}
  lots.forEach(l => {
    const key = `${l.state}|${l.lga}`
    if (!groups[key]) groups[key] = []
    groups[key].push(l)
  })

  return Object.entries(groups).map(([key, ls]) => {
    const [state, lga] = key.split('|')
    const prices = ls.map(l => l.price).filter(p => p > 0)
    const sizes = ls.map(l => l.lotSize).filter(s => s > 0)
    const psm = ls.map(l => l.pricePerSqm).filter(p => p > 0)
    const sold = ls.filter(l => l.status === 'sold')
    const listings = ls.filter(l => l.status === 'listing')
    const suburbs = new Set(ls.map(l => l.suburb)).size
    const months = new Set(ls.filter(l => l.soldDate).map(l => l.soldDate!.substring(0, 7))).size || 1
    const avgSalesPerMonth = sold.length / months

    // QoQ and YoY changes
    const now = new Date()
    const thisQ = ls.filter(l => {
      const d = l.soldDate || l.listDate || ''
      const diff = (now.getTime() - new Date(d).getTime()) / (86400000 * 30)
      return diff <= 3
    }).map(l => l.price).filter(p => p > 0)
    const lastQ = ls.filter(l => {
      const d = l.soldDate || l.listDate || ''
      const diff = (now.getTime() - new Date(d).getTime()) / (86400000 * 30)
      return diff > 3 && diff <= 6
    }).map(l => l.price).filter(p => p > 0)
    const lastY = ls.filter(l => {
      const d = l.soldDate || l.listDate || ''
      const diff = (now.getTime() - new Date(d).getTime()) / (86400000 * 30)
      return diff > 9 && diff <= 15
    }).map(l => l.price).filter(p => p > 0)

    const qoq = (thisQ.length >= 5 && lastQ.length >= 5)
      ? Math.round(((med(thisQ) - med(lastQ)) / med(lastQ)) * 1000) / 10
      : null
    const yoy = (thisQ.length >= 5 && lastY.length >= 5)
      ? Math.round(((med(thisQ) - med(lastY)) / med(lastY)) * 1000) / 10
      : null

    return {
      lga, state,
      corridor: ls[0]?.corridor || null,
      suburbs,
      total: ls.length,
      listings: listings.length,
      sold: sold.length,
      medPrice: Math.round(med(prices)),
      medSize: Math.round(med(sizes)),
      medPsm: Math.round(med(psm)),
      monthsOfSupply: avgSalesPerMonth > 0 ? Math.round((listings.length / avgSalesPerMonth) * 10) / 10 : 0,
      qoqPriceChange: qoq,
      yoyPriceChange: yoy,
    }
  }).sort((a, b) => b.total - a.total)
}

// Compute state-level stats
export function computeStateStats(lots: Lot[]): StateStats[] {
  const groups: Record<string, Lot[]> = {}
  lots.forEach(l => {
    if (!groups[l.state]) groups[l.state] = []
    groups[l.state].push(l)
  })

  return Object.entries(groups).map(([state, ls]) => {
    const prices = ls.map(l => l.price).filter(p => p > 0)
    const sizes = ls.map(l => l.lotSize).filter(s => s > 0)
    const psm = ls.map(l => l.pricePerSqm).filter(p => p > 0)

    // Corridor breakdown
    const corridorGroups: Record<string, Lot[]> = {}
    ls.forEach(l => {
      const c = l.corridor || 'Other'
      if (!corridorGroups[c]) corridorGroups[c] = []
      corridorGroups[c].push(l)
    })
    const corridors: CorridorStats[] = Object.entries(corridorGroups).map(([corridor, cls]) => ({
      corridor, state,
      lgas: [...new Set(cls.map(l => l.lga))],
      total: cls.length,
      listings: cls.filter(l => l.status === 'listing').length,
      sold: cls.filter(l => l.status === 'sold').length,
      medPrice: Math.round(med(cls.map(l => l.price).filter(p => p > 0))),
      medSize: Math.round(med(cls.map(l => l.lotSize).filter(s => s > 0))),
      medPsm: Math.round(med(cls.map(l => l.pricePerSqm).filter(p => p > 0))),
    })).sort((a, b) => b.total - a.total)

    return {
      state,
      lgas: new Set(ls.map(l => l.lga)).size,
      suburbs: new Set(ls.map(l => l.suburb)).size,
      total: ls.length,
      listings: ls.filter(l => l.status === 'listing').length,
      sold: ls.filter(l => l.status === 'sold').length,
      medPrice: Math.round(med(prices)),
      medSize: Math.round(med(sizes)),
      medPsm: Math.round(med(psm)),
      corridors,
    }
  }).sort((a, b) => b.total - a.total)
}

// Compute monthly time series
export function computeTimeSeries(lots: Lot[], months = 24): TimeSeriesPoint[] {
  const byMonth: Record<string, { listings: number; sold: number; prices: number[]; sizes: number[]; psm: number[] }> = {}
  
  lots.forEach(l => {
    const d = l.soldDate || l.listDate
    if (!d) return
    const month = d.substring(0, 7)
    if (!byMonth[month]) byMonth[month] = { listings: 0, sold: 0, prices: [], sizes: [], psm: [] }
    if (l.status === 'listing') byMonth[month].listings++
    else byMonth[month].sold++
    if (l.price > 0) byMonth[month].prices.push(l.price)
    if (l.lotSize > 0) byMonth[month].sizes.push(l.lotSize)
    if (l.pricePerSqm > 0) byMonth[month].psm.push(l.pricePerSqm)
  })

  return Object.entries(byMonth)
    .sort()
    .slice(-months)
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
}

// Price distribution (histogram)
export function computePriceDistribution(lots: Lot[], bucketSize = 50000): { range: string; count: number; order: number }[] {
  const buckets: Record<string, { count: number; order: number }> = {}
  lots.forEach(l => {
    if (l.price <= 0) return
    const bucket = Math.floor(l.price / bucketSize) * bucketSize
    const label = `$${(bucket / 1000).toFixed(0)}K`
    if (!buckets[label]) buckets[label] = { count: 0, order: bucket }
    buckets[label].count++
  })
  return Object.entries(buckets)
    .map(([range, { count, order }]) => ({ range, count, order }))
    .sort((a, b) => a.order - b.order)
}

// Size distribution
export function computeSizeDistribution(lots: Lot[], bucketSize = 100): { range: string; count: number; order: number }[] {
  const buckets: Record<string, { count: number; order: number }> = {}
  lots.forEach(l => {
    if (l.lotSize <= 0) return
    const bucket = Math.floor(l.lotSize / bucketSize) * bucketSize
    const label = `${bucket}m²`
    if (!buckets[label]) buckets[label] = { count: 0, order: bucket }
    buckets[label].count++
  })
  return Object.entries(buckets)
    .map(([range, { count, order }]) => ({ range, count, order }))
    .sort((a, b) => a.order - b.order)
}

// Outlier detection using IQR method
export function detectOutliers(lots: Lot[], field: 'price' | 'pricePerSqm' = 'pricePerSqm'): Lot[] {
  const values = lots.map(l => l[field]).filter(v => v > 0).sort((a, b) => a - b)
  if (values.length < 10) return lots
  
  const q1 = values[Math.floor(values.length * 0.25)]
  const q3 = values[Math.floor(values.length * 0.75)]
  const iqr = q3 - q1
  const lower = q1 - 1.5 * iqr
  const upper = q3 + 1.5 * iqr

  return lots.map(l => ({
    ...l,
    isOutlier: l[field] > 0 && (l[field] < lower || l[field] > upper),
  }))
}

// RLP size adjustment table (from Carl/Dwayne training)
const SIZE_ADJUSTMENTS = [
  { minPct: 0, maxPct: 10, adj: 0 },
  { minPct: 10, maxPct: 20, adj: 0.0224 },
  { minPct: 20, maxPct: 30, adj: 0.054 },
  { minPct: 30, maxPct: 40, adj: 0.1261 },
  { minPct: 40, maxPct: 50, adj: 0.1737 },
  { minPct: 50, maxPct: 60, adj: 0.2439 },
  { minPct: 60, maxPct: 70, adj: 0.3866 },
]

// Normalize a lot price to desired lot size using RLP adjustment table
export function normalizePrice(price: number, actualSize: number, desiredSize: number): number {
  if (actualSize <= 0 || desiredSize <= 0) return price
  const sizeDiffPct = Math.abs((actualSize - desiredSize) / desiredSize) * 100
  const adj = SIZE_ADJUSTMENTS.find(a => sizeDiffPct >= a.minPct && sizeDiffPct < a.maxPct)
  if (!adj) return price // >70% difference — too far to normalize
  const direction = actualSize > desiredSize ? -1 : 1
  return Math.round(price * (1 + direction * adj.adj))
}
