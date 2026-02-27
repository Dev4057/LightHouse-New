'use client'

import useFetch from '@/hooks/useApi'
import { Loader, AlertCircle, AlertTriangle } from 'lucide-react'
import type { StorageInfo } from '@/types'

export default function UnusedTablesTab() {
  const { data, isLoading, error } = useFetch<StorageInfo[]>(
    ['unused-tables'],
    '/api/storage?type=unused&daysUnused=30&limit=50'
  )

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
          <p className="font-semibold text-red-200">Error loading data</p>
          <p className="text-sm text-red-300">{error.message}</p>
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">No unused tables detected</p>
      </div>
    )
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const totalUnused = data.reduce((sum, item) => sum + (item.BYTES || 0), 0)
  const potentialSavings = (totalUnused * 0.023) / 1024 / 1024 / 1024 // Approximate monthly cost per GB

  return (
    <div className="space-y-6">
      <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-6 flex items-start gap-4">
        <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1" />
        <div>
          <h3 className="font-semibold text-yellow-200">Potential Cost Savings</h3>
          <p className="text-sm text-yellow-100 mt-1">
            {data.length} unused tables totaling {formatBytes(totalUnused)} could be cleaned up.
          </p>
          <p className="text-yellow-400 font-semibold mt-2">
            ~${potentialSavings.toFixed(2)}/month in potential savings
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-white">Unused Tables (30+ days)</h3>
        </div>

        <div className="card-body space-y-2">
          {data.map((table, idx) => (
            <div key={idx} className="bg-yellow-900/10 border border-yellow-700/50 rounded-lg p-4 hover:bg-yellow-900/20 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-slate-100">{table.TABLE_NAME}</p>
                  <p className="text-xs text-slate-400">
                    {table.DATABASE_NAME}.{table.SCHEMA_NAME}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-yellow-400">{formatBytes(table.BYTES || 0)}</p>
                  <p className="text-xs text-slate-400">Size</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm mt-3 pt-3 border-t border-yellow-700/50">
                <div>
                  <p className="text-slate-400">Last Modified</p>
                  <p className="font-semibold text-slate-100">{new Date(table.LAST_MODIFIED).toLocaleDateString()}</p>
                </div>
                <button className="px-3 py-1 bg-red-900/50 hover:bg-red-900 text-red-200 rounded text-xs font-semibold transition-colors">
                  Consider Removal
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
