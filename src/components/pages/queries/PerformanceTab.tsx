'use client'

import useFetch from '@/hooks/useApi'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Loader, AlertCircle } from 'lucide-react'
import { useSpendDisplay } from '@/hooks/useSpendDisplay'

interface PerformanceTabProps {
  dateRange: { start: Date; end: Date }
}

export default function PerformanceTab({ dateRange }: PerformanceTabProps) {
  const startDate = dateRange.start.toISOString().split('T')[0]
  const endDate = dateRange.end.toISOString().split('T')[0]

  const { data, isLoading, error } = useFetch<any[]>(
    ['query-trend', startDate, endDate],
    `/api/queries?type=trend&startDate=${startDate}&endDate=${endDate}`
  )
  const { creditUnitLabel, convertCredits, formatCreditValue } = useSpendDisplay()

  if (isLoading) {
    return (
      <div className="card flex items-center justify-center py-12">
        <Loader className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="card">
        <div className="card-body bg-red-900/20 border border-red-700/50 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-200">Error loading trend data</p>
            <p className="text-sm text-red-300">{error.message}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-slate-400">No trend data available</p>
      </div>
    )
  }

  return (
    <div className="chart-container">
      <h3 className="text-lg font-semibold text-white mb-4">Query Performance Trends</h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data.map((row) => ({ ...row, TOTAL_SPEND_DISPLAY: convertCredits(row.TOTAL_CREDITS) }))}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="DATE" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#f1f5f9' }}
            formatter={(value, name) =>
              name === `Total ${creditUnitLabel}` ? [formatCreditValue(Number(value)), name] : [value as any, name]
            }
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="QUERY_COUNT"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 4 }}
            name="Query Count"
          />
          <Line
            type="monotone"
            dataKey="TOTAL_SPEND_DISPLAY"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ fill: '#f59e0b', r: 4 }}
            name={`Total ${creditUnitLabel}`}
            yAxisId="right"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
