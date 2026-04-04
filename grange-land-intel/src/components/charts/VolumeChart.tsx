'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface DataPoint {
  month: string
  label: string
  listings: number
  sold: number
  volume: number
}

export function VolumeChart({ data }: { data: DataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
          labelStyle={{ color: '#8b95a8', fontSize: 11 }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: '#8b95a8' }}
          iconType="circle"
          iconSize={8}
        />
        <Bar dataKey="sold" name="Sold" fill="#2dd4a8" radius={[3, 3, 0, 0]} />
        <Bar dataKey="listings" name="Listed" fill="#4f9cf7" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
