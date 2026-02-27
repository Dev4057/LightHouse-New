'use client'

import useFetch from '@/hooks/useApi'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { Loader, AlertCircle } from 'lucide-react'

const COLORS = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function StorageSummaryTab() {
  const { data, isLoading, error } = useFetch<any[]>(['storage-summary'], '/api/storage?type=summary')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
        <div>
          <p className="font-semibold text-red-200">Error loading storage data</p>
          <p className="text-sm text-red-300">{error.message}</p>
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">No storage data available</p>
      </div>
    )
  }

  const totalBytes = data.reduce((sum, item) => sum + (item.TOTAL_BYTES || 0), 0)

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="space-y-6">
      <div className="chart-container">
        <h3 className="text-lg font-semibold text-white mb-4">Storage Distribution by Database</h3>
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ DATABASE_NAME, TOTAL_BYTES }) => `${DATABASE_NAME} (${formatBytes(TOTAL_BYTES)})`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="TOTAL_BYTES"
            >
              {data.map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatBytes(value as number)}
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #475569',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#f1f5f9' }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-white">Database Breakdown</h3>
          <p className="text-sm text-slate-400 mt-1">Total Storage: {formatBytes(totalBytes)}</p>
        </div>

        <div className="card-body space-y-2">
          {data.map((item, idx) => {
            const percentage = ((item.TOTAL_BYTES || 0) / totalBytes) * 100
            return (
              <div key={idx} className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-100">{item.DATABASE_NAME}</p>
                    <p className="text-sm text-slate-400">{percentage.toFixed(1)}%</p>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2 mt-1 overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: COLORS[idx % COLORS.length],
                      }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{formatBytes(item.TOTAL_BYTES || 0)}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
