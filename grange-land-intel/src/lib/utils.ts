import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(n: number): string {
  return '$' + Math.round(n).toLocaleString()
}

export function formatCompact(n: number): string {
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return '$' + (n / 1000).toFixed(0) + 'K'
  return '$' + n.toFixed(0)
}

export function median(arr: number[]): number {
  if (!arr.length) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function percentChange(current: number, previous: number): string {
  if (!previous) return '—'
  const pct = ((current - previous) / previous) * 100
  return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%'
}
