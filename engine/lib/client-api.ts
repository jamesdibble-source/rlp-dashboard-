// Client-side API for the dashboard
// All data loaded once, all computations done client-side
// No API calls on filter changes — instant interaction

import type { Lot, FilterState, SuburbStats, LGAStats, StateStats, TimeSeriesPoint } from './types'
import {
  applyFilters,
  computeSuburbStats,
  computeLGAStats,
  computeStateStats,
  computeTimeSeries,
  computePriceDistribution,
  computeSizeDistribution,
  detectOutliers,
  normalizePrice,
} from './compute'

export class LandIntelligence {
  private allLots: Lot[] = []
  private filters: FilterState = {
    state: null,
    lga: null,
    suburb: null,
    corridor: null,
    soldOnly: false,
    dateRange: null,
    priceRange: null,
    sizeRange: null,
  }

  constructor(lots: Lot[]) {
    this.allLots = detectOutliers(lots)
  }

  // Update filters and return fresh computed data
  setFilters(partial: Partial<FilterState>) {
    this.filters = { ...this.filters, ...partial }
    return this.compute()
  }

  getFilters(): FilterState {
    return { ...this.filters }
  }

  // Core computation — called after every filter change
  compute() {
    const filtered = applyFilters(this.allLots, this.filters)
    const nonOutliers = filtered.filter(l => !l.isOutlier)

    return {
      // Raw counts
      total: filtered.length,
      totalExOutliers: nonOutliers.length,
      totalSold: filtered.filter(l => l.status === 'sold').length,
      totalListings: filtered.filter(l => l.status === 'listing').length,

      // Aggregate metrics
      medPrice: this.median(nonOutliers.map(l => l.price)),
      medSize: this.median(nonOutliers.map(l => l.lotSize)),
      medPsm: this.median(nonOutliers.map(l => l.pricePerSqm)),
      avgPrice: this.avg(nonOutliers.map(l => l.price)),

      // Breakdowns
      stateStats: computeStateStats(nonOutliers),
      lgaStats: computeLGAStats(nonOutliers),
      suburbStats: computeSuburbStats(nonOutliers),
      timeSeries: computeTimeSeries(nonOutliers),
      priceDistribution: computePriceDistribution(nonOutliers),
      sizeDistribution: computeSizeDistribution(nonOutliers),

      // Available filter options
      states: [...new Set(this.allLots.map(l => l.state))].sort(),
      lgas: [...new Set(filtered.map(l => l.lga))].sort(),
      suburbs: [...new Set(filtered.map(l => l.suburb))].sort(),
      corridors: [...new Set(filtered.map(l => l.corridor).filter(Boolean))].sort() as string[],

      // Normalized prices (using RLP adjustment)
      normalizedMedian350: this.median(
        nonOutliers.map(l => normalizePrice(l.price, l.lotSize, 350))
      ),
      normalizedMedian467: this.median(
        nonOutliers.map(l => normalizePrice(l.price, l.lotSize, 467))
      ),

      // Active filters
      filters: { ...this.filters },
    }
  }

  // Get raw lots (for table display)
  getLots(limit = 100, offset = 0) {
    const filtered = applyFilters(this.allLots, this.filters)
    return {
      lots: filtered.slice(offset, offset + limit),
      total: filtered.length,
    }
  }

  // Get all available states
  getStates(): string[] {
    return [...new Set(this.allLots.map(l => l.state))].sort()
  }

  private median(arr: number[]): number {
    const valid = arr.filter(v => v > 0)
    if (!valid.length) return 0
    const sorted = valid.sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)]
  }

  private avg(arr: number[]): number {
    const valid = arr.filter(v => v > 0)
    if (!valid.length) return 0
    return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
  }
}
