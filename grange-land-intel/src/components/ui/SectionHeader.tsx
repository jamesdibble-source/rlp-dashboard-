'use client'

import { motion } from 'framer-motion'

interface SectionHeaderProps {
  title: string
  subtitle?: string
  tag?: string
}

export function SectionHeader({ title, subtitle, tag }: SectionHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="mb-6"
    >
      <div className="flex items-center gap-3 mb-1">
        <h2 className="font-serif text-2xl md:text-3xl font-normal tracking-tight">
          {title}
        </h2>
        {tag && (
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-3 py-1 rounded-full">
            {tag}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="text-sm text-[var(--color-text-secondary)] max-w-2xl">
          {subtitle}
        </p>
      )}
    </motion.div>
  )
}
