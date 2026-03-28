'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronUp, ChevronDown } from 'lucide-react'

interface SuburbStat {
  suburb: string
  market: string
  total: number
  listings: number
  sold: number
  medPrice: number
  medSize: number
  medPsm: number
}

type SortKey = 'suburb' | 'total' | 'medPrice' | 'medSize' | 'medPsm' | 'sold'

const marketColors: Record<string, string> = {
  'Ballarat': 'bg-blue-500/10 text-blue-400',
  'Wangaratta': 'bg-teal-500/10 text-teal-400',
  'Murray Bridge': 'bg-amber-500/10 text-amber-400',
}

export function SuburbTable({ data }: { data: SuburbStat[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('total')
  const [sortDesc, setSortDesc] = useState(true)

  const sorted = [...data].sort((a, b) => {
    const av = a[sortKey] ?? ''
    const bv = b[sortKey] ?? ''
    if (typeof av === 'string') return sortDesc ? bv.toString().localeCompare(av.toString()) : av.toString().localeCompare(bv.toString())
    return sortDesc ? (bv as number) - (av as number) : (av as number) - (bv as number)
  })

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc)
    else { setSortKey(key); setSortDesc(true) }
  }

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return null
    return sortDesc ? <ChevronDown className="w-3 h-3 inline" /> : <ChevronUp className="w-3 h-3 inline" />
  }

  const headers: { key: SortKey, label: string, align?: string }[] = [
    { key: 'suburb', label: 'Suburb' },
    { key: 'total', label: 'Total', align: 'right' },
    { key: 'sold', label: 'Sold', align: 'right' },
    { key: 'medPrice', label: 'Med. Price', align: 'right' },
    { key: 'medSize', label: 'Med. Size', align: 'right' },
    { key: 'medPsm', label: '$/m²', align: 'right' },
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            {headers.map(h => (
              <th
                key={h.key}
                onClick={() => handleSort(h.key)}
                className={`px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-dim)] cursor-pointer hover:text-[var(--color-text-secondary)] transition-colors ${h.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {h.label} <SortIcon k={h.key} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <motion.tr
              key={row.suburb}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(i * 0.02, 0.5) }}
              className="border-b border-[var(--color-border)] hover:bg-[var(--color-accent)]/[0.02] transition-colors cursor-pointer"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold">{row.suburb}</span>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${marketColors[row.market] || 'bg-white/5 text-white/60'}`}>
                    {row.market}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-right text-[13px] font-medium">{row.total.toLocaleString()}</td>
              <td className="px-4 py-3 text-right text-[13px] text-teal-400">{row.sold.toLocaleString()}</td>
              <td className="px-4 py-3 text-right text-[13px] font-semibold">${row.medPrice.toLocaleString()}</td>
              <td className="px-4 py-3 text-right text-[13px] text-[var(--color-text-secondary)]">{row.medSize}m²</td>
              <td className="px-4 py-3 text-right text-[13px] font-semibold">${row.medPsm}</td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
