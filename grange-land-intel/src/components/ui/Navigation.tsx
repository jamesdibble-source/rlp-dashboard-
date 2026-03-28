'use client'

import { cn } from '@/lib/utils'
import { BarChart3, Map, TrendingUp, Zap, LineChart } from 'lucide-react'

interface NavigationProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

const tabs = [
  { id: 'overview', label: 'Overview', icon: Map },
  { id: 'corridors', label: 'Growth Corridors', icon: BarChart3 },
  { id: 'analysis', label: 'Price Analysis', icon: LineChart },
  { id: 'velocity', label: 'Sales Velocity', icon: Zap },
  { id: 'benchmarks', label: 'Market Benchmarks', icon: TrendingUp },
]

export function Navigation({ activeTab, onTabChange }: NavigationProps) {
  return (
    <nav className="sticky top-0 z-50 glass border-b border-[var(--color-border)]">
      <div className="max-w-[1440px] mx-auto px-6 flex items-center justify-between h-14">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <h1 className="font-serif text-lg tracking-tight">Grange</h1>
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--color-teal)] bg-[var(--color-teal)]/10 px-2.5 py-1 rounded-full">
            Land Intelligence
          </span>
        </div>
        
        {/* Tabs */}
        <div className="flex items-center gap-0.5">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg transition-all duration-200",
                  activeTab === tab.id
                    ? "text-[var(--color-accent)] bg-[var(--color-accent)]/8"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/3"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
