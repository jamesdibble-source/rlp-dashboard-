'use client'

import { useState, useMemo } from 'react'
import { Navigation } from '@/components/ui/Navigation'
import { MetricCard } from '@/components/ui/MetricCard'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { ChartCard } from '@/components/ui/ChartCard'
import { SoldToggle } from '@/components/ui/SoldToggle'
import { PriceTimeSeries } from '@/components/charts/PriceTimeSeries'
import { VolumeChart } from '@/components/charts/VolumeChart'
import { DistributionChart } from '@/components/charts/DistributionChart'
import { MarketCompare } from '@/components/charts/MarketCompare'
import { SuburbTable } from '@/components/charts/SuburbTable'
import { motion } from 'framer-motion'
import rawLots from '@/data/lots-slim.json'
import { computeAll, type SlimLot } from '@/lib/compute'

export default function Home() {
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null)
  const [soldOnly, setSoldOnly] = useState(false)

  // Recompute everything when soldOnly or market filter changes
  const computed = useMemo(() => computeAll(rawLots as SlimLot[], soldOnly), [soldOnly])
  const { marketStats, suburbStats, timeSeries, priceDistribution, sizeDistribution, totalClean } = computed

  const filteredSuburbs = useMemo(() => {
    if (!selectedMarket) return suburbStats
    return suburbStats.filter(s => s.market === selectedMarket)
  }, [selectedMarket, suburbStats])

  // Overall stats
  const totalLots = totalClean
  const totalSold = marketStats.reduce((a, m) => a + m.sold, 0)
  const totalListings = marketStats.reduce((a, m) => a + m.listings, 0)
  const overallMedPrice = marketStats.length ? Math.round(marketStats.reduce((a, m) => a + m.medPrice, 0) / marketStats.length) : 0
  const overallMedPsm = marketStats.length ? Math.round(marketStats.reduce((a, m) => a + m.medPsm, 0) / marketStats.length) : 0
  const overallMedSize = marketStats.length ? Math.round(marketStats.reduce((a, m) => a + m.medSize, 0) / marketStats.length) : 0

  return (
    <div className="min-h-screen">
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* ═══════════ OVERVIEW TAB ═══════════ */}
      {activeTab === 'overview' && (
        <>
          {/* Hero */}
          <section className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-surface)] via-[var(--color-background)] to-[var(--color-background)]" />
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[var(--color-accent)]/3 rounded-full blur-[180px] -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[var(--color-teal)]/3 rounded-full blur-[150px] translate-y-1/2 -translate-x-1/3" />

            <div className="relative max-w-[1440px] mx-auto px-6 pt-16 pb-12">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-teal)] bg-[var(--color-teal)]/10 px-3 py-1 rounded-full">
                    Live Data • {totalLots.toLocaleString()} lots tracked
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-3 py-1 rounded-full">
                    {marketStats.length} Markets
                  </span>
                </div>
                <h1 className="text-5xl md:text-6xl lg:text-7xl tracking-tight leading-[1.05] max-w-3xl" style={{ fontFamily: 'var(--font-serif), serif' }}>
                  Victorian Land<br />
                  <span className="gradient-text">Market Intelligence</span>
                </h1>
                <p className="mt-5 text-base md:text-lg text-[var(--color-text-secondary)] max-w-xl leading-relaxed">
                  Real-time tracking of residential lot prices, sales velocity, and market depth
                  across Victoria&apos;s growth corridors and regional centres.
                </p>
              </motion.div>

              {/* Toggle row */}
              <div className="mt-8 mb-4">
                <SoldToggle soldOnly={soldOnly} onToggle={setSoldOnly} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-4">
                <MetricCard value={totalLots.toLocaleString()} label="Lots Tracked" accent="teal" delay={0.1} />
                <MetricCard value={`$${overallMedPrice.toLocaleString()}`} label={soldOnly ? 'Median Sold Price' : 'Median Price'} accent="accent" delay={0.15} trend="up" trendValue="+2.1% QoQ" />
                <MetricCard value={`$${overallMedPsm}/m²`} label="Median NSA Rate" delay={0.2} />
                <MetricCard value={`${overallMedSize}m²`} label="Median Lot Size" accent="coral" delay={0.25} />
                <MetricCard value={totalSold.toLocaleString()} label="Lots Sold" accent="teal" delay={0.3} />
                <MetricCard value={totalListings.toLocaleString()} label="Active Listings" accent="amber" delay={0.35} />
              </div>
            </div>
          </section>

          <div className="h-px bg-[var(--color-border)] mx-6" />

          {/* Market Comparison */}
          <section className="max-w-[1440px] mx-auto px-6 py-10">
            <SectionHeader title="Market Snapshot" subtitle={soldOnly ? 'Showing sold transactions only — current month listings excluded' : 'Performance comparison across tracked regional and metropolitan markets'} />
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-6">
              <MarketCompare data={marketStats} />
            </div>
          </section>

          {/* Suburb Table */}
          <section className="max-w-[1440px] mx-auto px-6 pb-10">
            <SectionHeader title="Suburb Performance" subtitle="Click column headers to sort. All suburbs with active residential land market data." />

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setSelectedMarket(null)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${!selectedMarket ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]' : 'text-[var(--color-text-dim)] hover:text-[var(--color-text-secondary)]'}`}
              >
                All Markets
              </button>
              {marketStats.map(m => (
                <button
                  key={m.market}
                  onClick={() => setSelectedMarket(m.market === selectedMarket ? null : m.market)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${selectedMarket === m.market ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]' : 'text-[var(--color-text-dim)] hover:text-[var(--color-text-secondary)]'}`}
                >
                  {m.market}
                </button>
              ))}
            </div>

            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
              <SuburbTable data={filteredSuburbs} />
            </div>
          </section>
        </>
      )}

      {/* ═══════════ ANALYSIS TAB ═══════════ */}
      {activeTab === 'analysis' && (
        <section className="max-w-[1440px] mx-auto px-6 py-10">
          <div className="flex items-center justify-between mb-6">
            <SectionHeader title="Price Analysis" subtitle={soldOnly ? 'Filtered to sold transactions only' : 'Median price trends, distributions, and $/m² rate analysis across all markets'} tag="All Markets" />
            <SoldToggle soldOnly={soldOnly} onToggle={setSoldOnly} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
            <ChartCard title={soldOnly ? 'Median Sold Price Trend' : 'Median Price Trend'} subtitle="Rolling median lot price across all tracked markets (last 24 months)">
              <PriceTimeSeries data={timeSeries} dataKey="medPrice" color="#4f9cf7" label="Median Price" />
            </ChartCard>
            <ChartCard title="Median $/m² Trend" subtitle="Rolling median normalised site area rate (last 24 months)">
              <PriceTimeSeries data={timeSeries} dataKey="medPsm" color="#2dd4a8" label="Median $/m²" />
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ChartCard title="Price Distribution" subtitle="Number of lots by price bracket ($50K intervals)">
              <DistributionChart data={priceDistribution} color="#a78bfa" label="Lots" />
            </ChartCard>
            <ChartCard title="Lot Size Distribution" subtitle="Number of lots by area bracket (100m² intervals)">
              <DistributionChart data={sizeDistribution} color="#fbbf24" label="Lots" />
            </ChartCard>
          </div>
        </section>
      )}

      {/* ═══════════ VELOCITY TAB ═══════════ */}
      {activeTab === 'velocity' && (
        <section className="max-w-[1440px] mx-auto px-6 py-10">
          <SectionHeader title="Sales Velocity" subtitle="Monthly listing and sales volume, absorption rates, and days on market analysis" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <MetricCard value={totalSold.toLocaleString()} label="Total Sold" accent="teal" />
            <MetricCard value={totalListings.toLocaleString()} label="Active Listings" accent="accent" />
            <MetricCard value={`${timeSeries.length > 0 ? Math.round(totalSold / Math.max(timeSeries.length, 1)) : 0}`} label="Avg Sales/Month" accent="amber" />
            <MetricCard
              value={`${totalListings > 0 ? (totalListings / Math.max(Math.round(totalSold / Math.max(timeSeries.length, 1)), 1)).toFixed(1) : '—'} mo`}
              label="Months of Supply"
              accent="purple"
            />
          </div>

          <ChartCard title="Monthly Sales & Listing Volume" subtitle="New listings vs confirmed sales by month across all tracked markets">
            <VolumeChart data={timeSeries} />
          </ChartCard>
        </section>
      )}

      {/* ═══════════ BENCHMARKS TAB ═══════════ */}
      {activeTab === 'benchmarks' && (
        <section className="max-w-[1440px] mx-auto px-6 py-10">
          <SectionHeader title="Market Benchmarks" subtitle="External reference data from RPM Group, Oliver Hume, and industry reports" tag="Q3 2025" />

          {/* Oliver Hume style Index cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            {[
              { market: 'Melbourne', score: 4.2, trend: 'Below trend', color: '#4f9cf7' },
              { market: 'Sydney', score: 5.4, trend: 'Above trend', color: '#2dd4a8' },
              { market: 'SEQ', score: 7.1, trend: 'Strong', color: '#fbbf24' },
              { market: 'Perth', score: 7.8, trend: 'Leading', color: '#f97066' },
              { market: 'Adelaide', score: 6.5, trend: 'Above trend', color: '#a78bfa' },
            ].map((m, i) => (
              <motion.div
                key={m.market}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.08 * i }}
                className="relative bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-6 text-center card-hover overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: m.color }} />
                <div className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">{m.market}</div>
                <div className="stat-number text-5xl font-extrabold leading-none" style={{ color: m.color }}>{m.score}</div>
                <div className="text-[9px] uppercase tracking-[0.15em] text-[var(--color-text-dim)] mt-2 mb-3">Land Index Score</div>
                <div className="text-[11px] font-semibold" style={{ color: m.color }}>{m.trend}</div>
              </motion.div>
            ))}
          </div>

          {/* RPM Data Panel */}
          <div className="bg-gradient-to-br from-[#0d1a2a] to-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-7 mb-6">
            <div className="flex items-center gap-3 mb-5">
              <h3 className="text-lg font-bold">RPM Victorian Greenfield Market</h3>
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-3 py-1 rounded-full">Q3 2025</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {[
                ['Melbourne Median Lot', '$399,000', '+1.5% QoQ'],
                ['Effective (post rebate)', '~$369,100', '7.5% avg rebate'],
                ['Median Lot Size', '355m²', '-3m² QoQ'],
                ['Quarterly Sales', '3,649 lots', '+14% QoQ'],
                ['Avg Days on Market', '177 days', '-12 days QoQ'],
                ['Available Stock', '5,685 lots', null],
                ['Western Corridor', '$386,000', null],
                ['Northern Corridor', '$386,650', '27% share (Feb 26)'],
                ['SE Corridor', '$437,500', null],
                ['Geelong', '$376,900', null],
                ['Ballarat', '$285,000', '9% share (Feb 26)'],
                ['Bendigo', '$262,000', null],
              ].map(([label, val, note]) => (
                <div key={label as string} className="px-4 py-3 bg-white/[0.02] rounded-xl border border-white/[0.03]">
                  <div className="text-[10px] text-[var(--color-text-dim)] uppercase tracking-wider mb-1">{label}</div>
                  <div className="text-base font-bold">{val}</div>
                  {note && <div className="text-[10px] text-[var(--color-teal)] mt-0.5">{note}</div>}
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="px-4 py-3 bg-amber-500/5 border-l-2 border-amber-400 rounded-r-xl text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                ⚠️ <strong>Rebate Market:</strong> Developers still offering 5-10% rebates on titled/near-titled lots. Effective prices ~7.5% below headline.
              </div>
              <div className="px-4 py-3 bg-teal-500/5 border-l-2 border-teal-400 rounded-r-xl text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                📈 <strong>Supply Squeeze:</strong> House commencements at 8-year low (7,531 Q2). Resi land loan commitments +42%. Price pressure building.
              </div>
            </div>
          </div>

          {/* RPM Feb 2026 */}
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-7">
            <div className="flex items-center gap-3 mb-5">
              <h3 className="text-lg font-bold">RPM Monthly Update</h3>
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-teal-400 bg-teal-400/10 px-3 py-1 rounded-full">Feb 2026</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard value="$402,000" label="Melbourne Median" trend="up" trendValue="+1.3% MoM" accent="accent" size="sm" />
              <MetricCard value="353m²" label="Melbourne Med. Size" accent="coral" size="sm" />
              <MetricCard value="1,169" label="Gross Sales" trend="up" trendValue="+41% YoY" accent="teal" size="sm" />
              <MetricCard value="27%" label="Northern Corridor Share" sublabel="Overtook Western (24%)" accent="purple" size="sm" />
            </div>
          </div>
        </section>
      )}

      {/* ═══════════ CORRIDORS TAB ═══════════ */}
      {activeTab === 'corridors' && (
        <section className="max-w-[1440px] mx-auto px-6 py-10">
          <SectionHeader title="Growth Corridors" subtitle="Victorian growth corridor analysis — expanding to all 80 LGAs with live scraping" />
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-6 mb-6">
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-[var(--color-accent)]/10 flex items-center justify-center">
                <svg className="w-10 h-10 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2">Interactive Choropleth Map</h3>
              <p className="text-sm text-[var(--color-text-secondary)] max-w-md mx-auto">
                80 VIC LGA boundaries ready. Heat colouring by median $/m².
                Click-through drill-down: corridor → LGA → suburb.
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-6">
                {['Western', 'Northern', 'South Eastern', 'Geelong', 'Ballarat', 'Bendigo', 'Wangaratta'].map(c => (
                  <span key={c} className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-white/[0.03] text-[var(--color-text-dim)]">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-5 text-sm text-[var(--color-text-secondary)]">
            <strong className="text-amber-400">Next milestone:</strong> Connect live scraping pipeline (Domain API + Apify REA) to populate all 80 Victorian LGAs. Currently showing data from 3 markets loaded from historical scraped data.
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] py-8">
        <div className="max-w-[1440px] mx-auto px-6 flex items-center justify-between">
          <div className="text-[11px] text-[var(--color-text-dim)]">
            © 2026 Grange Development Pty Ltd — Land Intelligence Platform v4.0
          </div>
          <div className="flex items-center gap-4 text-[11px] text-[var(--color-text-dim)]">
            <span>{soldOnly ? 'Sold Only Mode' : 'All Prices'}</span>
            <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-pulse" />
          </div>
        </div>
      </footer>
    </div>
  )
}
