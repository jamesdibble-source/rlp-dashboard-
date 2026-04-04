'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface ChartCardProps {
  title: string
  subtitle?: string
  children: ReactNode
  span?: 1 | 2
  className?: string
}

export function ChartCard({ title, subtitle, children, span = 1, className }: ChartCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className={cn(
        "bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-6 transition-all duration-300 hover:border-[var(--color-border-accent)]",
        span === 2 && "col-span-2",
        className
      )}
    >
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      {subtitle && (
        <p className="text-[11px] text-[var(--color-text-dim)] mt-0.5 mb-4">{subtitle}</p>
      )}
      {!subtitle && <div className="mb-4" />}
      {children}
    </motion.div>
  )
}
