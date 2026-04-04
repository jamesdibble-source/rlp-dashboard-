'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface MetricCardProps {
  value: string
  label: string
  sublabel?: string
  trend?: 'up' | 'down' | 'stable'
  trendValue?: string
  accent?: 'teal' | 'accent' | 'coral' | 'amber' | 'purple' | 'default'
  size?: 'sm' | 'md' | 'lg'
  delay?: number
}

const accentColors = {
  teal: 'text-teal-400',
  accent: 'text-blue-400',
  coral: 'text-red-400',
  amber: 'text-amber-400',
  purple: 'text-purple-400',
  default: 'text-white',
}

const gradientBorders = {
  teal: 'from-teal-500/20 to-teal-500/0',
  accent: 'from-blue-500/20 to-blue-500/0',
  coral: 'from-red-500/20 to-red-500/0',
  amber: 'from-amber-500/20 to-amber-500/0',
  purple: 'from-purple-500/20 to-purple-500/0',
  default: 'from-white/10 to-white/0',
}

export function MetricCard({ value, label, sublabel, trend, trendValue, accent = 'default', size = 'md', delay = 0 }: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={cn(
        "relative group bg-[var(--color-card)] rounded-2xl p-5 card-hover overflow-hidden",
      )}
    >
      {/* Top gradient line */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300",
        gradientBorders[accent]
      )} />
      
      <div className={cn(
        "stat-number font-extrabold leading-none",
        accentColors[accent],
        size === 'lg' ? 'text-4xl' : size === 'md' ? 'text-3xl' : 'text-2xl'
      )}>
        {value}
      </div>
      
      <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-dim)]">
        {label}
      </div>
      
      {sublabel && (
        <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
          {sublabel}
        </div>
      )}
      
      {trend && trendValue && (
        <div className={cn(
          "mt-3 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg",
          trend === 'up' ? 'bg-teal-500/10 text-teal-400' :
          trend === 'down' ? 'bg-red-500/10 text-red-400' :
          'bg-white/5 text-[var(--color-text-secondary)]'
        )}>
          {trend === 'up' ? <TrendingUp className="w-3 h-3" /> :
           trend === 'down' ? <TrendingDown className="w-3 h-3" /> :
           <Minus className="w-3 h-3" />}
          {trendValue}
        </div>
      )}
    </motion.div>
  )
}
