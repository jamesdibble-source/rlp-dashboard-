// Cross-source deduplication engine
// Same lot on REA + Domain + OpenLot = one record with multiple sources

import type { RawLot, Lot } from './types'
import { v4 as uuid } from 'uuid'

// Generate a dedup key from lot properties
// Strategy: normalize address + suburb + approximate size
export function dedupKey(lot: RawLot): string {
  const addr = lot.address
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/lot\s*\d+[\s,]*/i, '')  // strip "Lot 48,"
    .replace(/[^\w\s]/g, '')           // strip punctuation
    .trim()
  
  const suburb = lot.suburb.toLowerCase().trim()
  
  // Round size to nearest 5m² to handle slight measurement differences
  const size = Math.round(lot.lotSize / 5) * 5
  
  return `${addr}|${suburb}|${size}`
}

// Merge multiple raw lots with the same dedup key into a single Lot
function mergeLots(key: string, raws: RawLot[]): Lot {
  // Prefer sold data over listing data
  const sold = raws.find(r => r.status === 'sold')
  const primary = sold || raws[0]
  
  // Best price: sold > list, higher specificity
  const soldPrice = raws.map(r => r.soldPrice).find(p => p && p > 0) || null
  const listPrice = raws.map(r => r.listPrice).find(p => p && p > 0) || null
  const price = soldPrice || listPrice || primary.price
  
  // Status: if any source says sold, it's sold
  const status = raws.some(r => r.status === 'sold') ? 'sold' as const
    : raws.some(r => r.status === 'under_contract') ? 'under_contract' as const
    : raws.some(r => r.status === 'withdrawn') ? 'withdrawn' as const
    : 'listing' as const
  
  // Dates: earliest list date, latest sold date
  const listDates = raws.map(r => r.listDate).filter(Boolean).sort()
  const soldDates = raws.map(r => r.soldDate).filter(Boolean).sort()
  
  // Size: prefer larger (more likely includes all registered area)
  const lotSize = Math.max(...raws.map(r => r.lotSize).filter(s => s > 0))
  const pricePerSqm = lotSize > 0 ? Math.round((price / lotSize) * 100) / 100 : 0

  return {
    id: uuid(),
    address: primary.address,
    suburb: primary.suburb,
    lga: primary.lga,
    state: primary.state,
    corridor: primary.corridor,
    lotSize,
    listPrice,
    soldPrice,
    price,
    status,
    listDate: listDates[0] || null,
    soldDate: soldDates[soldDates.length - 1] || null,
    pricePerSqm,
    sources: [...new Set(raws.map(r => r.source))],
    isOutlier: false,
    firstSeen: raws.map(r => r.scrapedAt).sort()[0],
    lastUpdated: raws.map(r => r.scrapedAt).sort().pop()!,
  }
}

// Main dedup pipeline: raw lots in, clean lots out
export function dedup(rawLots: RawLot[]): Lot[] {
  // Group by dedup key
  const groups: Record<string, RawLot[]> = {}
  rawLots.forEach(l => {
    const key = l.dedupKey || dedupKey(l)
    if (!groups[key]) groups[key] = []
    groups[key].push(l)
  })

  // Merge each group
  return Object.entries(groups).map(([key, raws]) => mergeLots(key, raws))
}

// Detect listing→sold transitions between two scrape cycles
export function detectTransitions(previous: Lot[], current: Lot[]): {
  newListings: Lot[]
  newSales: Lot[]
  priceChanges: { lot: Lot; oldPrice: number; newPrice: number }[]
  withdrawn: Lot[]
} {
  const prevById = new Map(previous.map(l => [l.id, l]))
  const currById = new Map(current.map(l => [l.id, l]))
  
  // Also match by dedup-like key for cross-cycle matching
  const prevByAddr = new Map(previous.map(l => [`${l.address}|${l.suburb}`, l]))
  
  const newListings: Lot[] = []
  const newSales: Lot[] = []
  const priceChanges: { lot: Lot; oldPrice: number; newPrice: number }[] = []
  const withdrawn: Lot[] = []

  for (const curr of current) {
    const key = `${curr.address}|${curr.suburb}`
    const prev = prevByAddr.get(key)
    
    if (!prev) {
      // Brand new listing
      if (curr.status === 'listing') newListings.push(curr)
      else if (curr.status === 'sold') newSales.push(curr)
    } else {
      // Existing lot — check for transitions
      if (prev.status === 'listing' && curr.status === 'sold') {
        newSales.push(curr)
      }
      if (prev.price !== curr.price && curr.price > 0) {
        priceChanges.push({ lot: curr, oldPrice: prev.price, newPrice: curr.price })
      }
    }
  }

  // Check for withdrawn (was in previous, not in current)
  for (const prev of previous) {
    const key = `${prev.address}|${prev.suburb}`
    const still = current.find(c => `${c.address}|${c.suburb}` === key)
    if (!still && prev.status === 'listing') {
      withdrawn.push({ ...prev, status: 'withdrawn' })
    }
  }

  return { newListings, newSales, priceChanges, withdrawn }
}
