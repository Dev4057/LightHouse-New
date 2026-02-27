'use client'

import useFetch from '@/hooks/useApi'
import { Loader, AlertCircle } from 'lucide-react'
import type { StorageInfo } from '@/types'

export default function LargestTablesTab() {
  const { data, isLoading, error } = useFetch<StorageInfo[]>(['largest-tables'], '/api/storage?type=largest&limit=50')

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
        <p className="text-slate-400">No tables found</p>
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

  const totalBytes = data.reduce((sum, item) => sum + (item.BYTES || 0), 0)

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold text-white">Largest Tables</h3>
        <p className="text-sm text-slate-400 mt-1">Total: {formatBytes(totalBytes)}</p>
      </div>

      <div className="card-body overflow-x-auto">
        <table className="table">
          <thead className="table-header">
            <tr>
              <th className="table-cell">Table Name</th>
              <th className="table-cell text-right">Size</th>
              <th className="table-cell text-right">% of Total</th>
              <th className="table-cell">Last Modified</th>
            </tr>
          </thead>
          <tbody>
            {data.map((table, idx) => {
              const percentage = ((table.BYTES || 0) / totalBytes) * 100
              return (
                <tr key={idx} className="table-row">
                  <td className="table-cell">
                    <div>
                      <p className="font-semibold text-slate-100">{table.TABLE_NAME}</p>
                      <p className="text-xs text-slate-400">
                        {table.DATABASE_NAME}.{table.SCHEMA_NAME}
                      </p>
                    </div>
                  </td>
                  <td className="table-cell text-right font-semibold text-blue-400">
                    {formatBytes(table.BYTES || 0)}
                  </td>
                  <td className="table-cell text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-12 bg-slate-700 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400">{percentage.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="table-cell text-slate-400 text-sm">
                    {new Date(table.LAST_MODIFIED).toLocaleDateString()}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
