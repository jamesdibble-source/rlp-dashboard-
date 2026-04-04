'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface DataPoint {
  month: string
  label: string
  medPrice: number
  medPsm: number
  volume: number
}

export function PriceTimeSeries({ data, dataKey = 'medPrice', color = '#4f9cf7', label = 'Median Price' }: { data: DataPoint[], dataKey?: string, color?: string, label?: string }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.2} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#4a5568' }}
          tickLine={false}
          axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#4a5568' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => dataKey === 'medPrice' ? `$${(v/1000).toFixed(0)}K` : `$${v}`}
          width={55}
        />
        <Tooltip
          contentStyle={{
            background: '#0f1729',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            fontSize: 12,
            color: '#e8ecf4',
          }}
          formatter={(v: any) => [dataKey === 'medPrice' ? `$${v.toLocaleString()}` : `$${v}/m²`, label]}
          labelStyle={{ color: '#8b95a8', fontSize: 11 }}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#grad-${dataKey})`}
          dot={false}
          activeDot={{ r: 4, stroke: color, fill: '#0f1729', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
