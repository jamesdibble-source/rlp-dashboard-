'use client'

import { cn } from '@/lib/utils'

interface SoldToggleProps {
  soldOnly: boolean
  onToggle: (v: boolean) => void
}

export function SoldToggle({ soldOnly, onToggle }: SoldToggleProps) {
  return (
    <div className="inline-flex items-center gap-3 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl px-4 py-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-dim)]">
        Price View
      </span>
      <div className="flex items-center gap-0.5 bg-black/30 rounded-lg p-0.5">
        <button
          onClick={() => onToggle(false)}
          className={cn(
            "px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all duration-200",
            !soldOnly
              ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)] shadow-sm"
              : "text-[var(--color-text-dim)] hover:text-[var(--color-text-secondary)]"
          )}
        >
          All Prices
        </button>
        <button
          onClick={() => onToggle(true)}
          className={cn(
            "px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all duration-200",
            soldOnly
              ? "bg-teal-500/15 text-teal-400 shadow-sm"
              : "text-[var(--color-text-dim)] hover:text-[var(--color-text-secondary)]"
          )}
        >
          Sold Only
        </button>
      </div>
      {soldOnly && (
        <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full animate-pulse">
          Current month listings excluded
        </span>
      )}
    </div>
  )
}
