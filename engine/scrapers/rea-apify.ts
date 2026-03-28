// REA (realestate.com.au) scraper via Apify
// REA has Kasada bot protection — direct scraping gets 429'd
// Apify handles the anti-bot layer for us
// Cost: ~$0.001-0.003 per listing, ~$49/mo starter plan

import type { RawLot } from '../lib/types'

const APIFY_API_BASE = 'https://api.apify.com/v2'

interface ApifyConfig {
  token: string
  actorId: string  // The REA scraper actor ID on Apify
}

interface REAListing {
  id?: string
  url?: string
  address?: string
  suburb?: string
  state?: string
  postcode?: string
  price?: string | number
  priceNumeric?: number
  landSize?: number
  landSizeUnit?: string
  propertyType?: string
  status?: string
  listedDate?: string
  soldDate?: string
  soldPrice?: number
  agent?: string
  description?: string
}

// Run Apify actor for a suburb search
export async function runApifyActor(
  config: ApifyConfig,
  suburb: string,
  state: string,
  postcode: string,
): Promise<RawLot[]> {
  // Start the actor run
  const startResp = await fetch(
    `${APIFY_API_BASE}/acts/${config.actorId}/runs?token=${config.token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls: [{
          url: `https://www.realestate.com.au/buy/property-land-in-${suburb.toLowerCase().replace(/\s+/g, '+')},+${state.toLowerCase()}+${postcode}/list-1?activeSort=list-date&landSize=150-2000`,
        }],
        maxItems: 500,
        proxy: { useApifyProxy: true },
      }),
    }
  )

  if (!startResp.ok) {
    throw new Error(`Apify start failed: ${startResp.status} ${await startResp.text()}`)
  }

  const run = await startResp.json()
  const runId = run.data?.id
  if (!runId) throw new Error('No run ID returned')

  console.log(`  Apify run started: ${runId}`)

  // Poll for completion (max 5 min)
  let status = 'RUNNING'
  let attempts = 0
  while (status === 'RUNNING' && attempts < 60) {
    await new Promise(r => setTimeout(r, 5000))
    const statusResp = await fetch(
      `${APIFY_API_BASE}/acts/${config.actorId}/runs/${runId}?token=${config.token}`
    )
    const statusData = await statusResp.json()
    status = statusData.data?.status || 'FAILED'
    attempts++
  }

  if (status !== 'SUCCEEDED') {
    throw new Error(`Apify run ${runId} ended with status: ${status}`)
  }

  // Fetch results from dataset
  const datasetId = run.data?.defaultDatasetId
  const dataResp = await fetch(
    `${APIFY_API_BASE}/datasets/${datasetId}/items?token=${config.token}&format=json`
  )
  const items: REAListing[] = await dataResp.json()

  console.log(`  Got ${items.length} listings from Apify`)

  return items
    .filter(item => {
      const size = item.landSize || 0
      return size >= 150 && size <= 2000
    })
    .map(item => {
      const lotSize = item.landSize || 0
      const soldPrice = item.soldPrice || null
      const listPrice = typeof item.price === 'number' ? item.price
        : item.priceNumeric || extractPrice(String(item.price || ''))
      const price = soldPrice || listPrice || 0
      const isSold = !!(item.soldDate || item.soldPrice || item.status?.toLowerCase().includes('sold'))

      return {
        address: item.address || '',
        suburb: item.suburb || suburb,
        lga: '', // REA doesn't provide LGA
        state: (item.state || state) as RawLot['state'],
        corridor: null,
        lotSize,
        listPrice,
        soldPrice,
        price,
        status: isSold ? 'sold' as const : 'listing' as const,
        listDate: item.listedDate || null,
        soldDate: item.soldDate || null,
        pricePerSqm: lotSize > 0 ? Math.round((price / lotSize) * 100) / 100 : 0,
        source: 'rea' as const,
        sourceId: item.id || item.url || '',
        sourceUrl: item.url || null,
        isOutlier: false,
        dedupKey: '',
        scrapedAt: new Date().toISOString(),
        raw: item as unknown as Record<string, unknown>,
      }
    })
}

function extractPrice(str: string): number | null {
  const match = str.replace(/,/g, '').match(/\$?([\d]+(?:\.[\d]+)?)/)?.[1]
  return match ? Math.round(parseFloat(match)) : null
}
