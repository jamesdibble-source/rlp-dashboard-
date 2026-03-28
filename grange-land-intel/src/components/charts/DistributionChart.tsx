'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface DataPoint {
  range: string
  count: number
}

export function DistributionChart({ data, color = '#a78bfa', label = 'Lots' }: { data: DataPoint[], color?: string, label?: string }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis
          dataKey="range"
          tick={{ fontSize: 9, fill: '#4a5568' }}
          tickLine={false}
          axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
          angle={-45}
          textAnchor="end"
          height={55}
          interval={0}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#4a5568' }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={{
            background: '#0f1729',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            fontSize: 12,
            color: '#e8ecf4',
          }}
          formatter={(v) => [String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ","), label]}
          labelStyle={{ color: '#8b95a8', fontSize: 11 }}
        />
        <Bar dataKey="count" fill={color} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
