'use client'

import { motion } from 'framer-motion'

interface MarketStat {
  market: string
  total: number
  listings: number
  sold: number
  medPrice: number
  medSize: number
  medPsm: number
  avgPrice: number
}

const marketColors: Record<string, string> = {
  'Ballarat': '#4f9cf7',
  'Wangaratta': '#2dd4a8',
  'Murray Bridge': '#fbbf24',
}

export function MarketCompare({ data }: { data: MarketStat[] }) {
  const maxTotal = Math.max(...data.map(d => d.total))
  
  return (
    <div className="space-y-4">
      {data.map((m, i) => (
        <motion.div
          key={m.market}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 * i }}
          className="relative"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ background: marketColors[m.market] || '#4f9cf7' }} />
              <span className="text-sm font-semibold">{m.market}</span>
              <span className="text-[10px] text-[var(--color-text-dim)] font-medium">
                {m.total.toLocaleString()} lots
              </span>
            </div>
            <div className="flex items-center gap-5 text-xs">
              <span className="text-[var(--color-text-secondary)]">
                Med: <span className="text-white font-bold">${m.medPrice.toLocaleString()}</span>
              </span>
              <span className="text-[var(--color-text-secondary)]">
                NSA: <span className="text-white font-bold">${m.medPsm}/m²</span>
              </span>
              <span className="text-[var(--color-text-secondary)]">
                Size: <span className="text-white font-bold">{m.medSize}m²</span>
              </span>
            </div>
          </div>
          <div className="h-2 bg-white/[0.03] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(m.total / maxTotal) * 100}%` }}
              transition={{ duration: 0.8, delay: 0.1 * i }}
              className="h-full rounded-full"
              style={{ background: marketColors[m.market] || '#4f9cf7' }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-teal-400">{m.sold.toLocaleString()} sold</span>
            <span className="text-[10px] text-blue-400">{m.listings.toLocaleString()} listed</span>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
