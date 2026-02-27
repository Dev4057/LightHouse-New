'use client'

import { useState } from 'react'
import useFetch from '@/hooks/useApi'
import { Loader, AlertCircle } from 'lucide-react'
import { useSpendDisplay } from '@/hooks/useSpendDisplay'
import type { Query } from '@/types'

interface QueriesTabProps {
  type: 'expensive' | 'longest' | 'failed'
  dateRange: { start: Date; end: Date }
}

export default function QueriesTab({ type, dateRange }: QueriesTabProps) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const { formatCreditValue, creditUnitLabel } = useSpendDisplay()

  const startDate = dateRange.start.toISOString().split('T')[0]
  const endDate = dateRange.end.toISOString().split('T')[0]

  const { data, isLoading, error } = useFetch<Query[]>(
    [`queries-${type}`, startDate, endDate],
    `/api/queries?type=${type}&startDate=${startDate}&endDate=${endDate}&limit=50`
  )

  const getTypeLabel = () => {
    switch (type) {
      case 'expensive':
        return 'Most Expensive Queries'
      case 'longest':
        return 'Longest Running Queries'
      case 'failed':
        return 'Failed Queries'
      default:
        return 'Queries'
    }
  }

  const formatTime = (ms: number) => {
    if (ms < 1000) return Math.round(ms) + ' ms'
    return (ms / 1000).toFixed(2) + ' s'
  }

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
          <p className="font-semibold text-red-200">Error loading queries</p>
          <p className="text-sm text-red-300">{error.message}</p>
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">No queries found for the selected period</p>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold text-white">{getTypeLabel()}</h3>
        <p className="text-sm text-slate-400 mt-1">{data.length} queries</p>
      </div>

      <div className="card-body space-y-2">
        {data.map((query, idx) => {
          const isExp = expanded === query.QUERY_ID
          return (
            <div key={query.QUERY_ID} className="border border-slate-700 rounded-lg hover:bg-slate-700/50 transition-colors">
              <button
                onClick={() => setExpanded(isExp ? null : query.QUERY_ID)}
                className="w-full px-4 py-3 text-left flex items-start justify-between"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono bg-slate-700 px-2 py-1 rounded text-slate-300">
                      {idx + 1}
                    </span>
                    <span className="text-sm text-slate-400">{query.USER_NAME}</span>
                    <span className="text-xs text-slate-500">@ {query.WAREHOUSE_NAME}</span>
                  </div>
                  <p className="text-sm text-slate-200 truncate font-mono">
                    {query.QUERY_TEXT?.substring(0, 100)}...
                  </p>
                </div>
                <div className="ml-4 text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-blue-400">{formatCreditValue(query.CREDITS_USED || 0)}</p>
                  <p className="text-[10px] text-slate-500 uppercase">{creditUnitLabel}</p>
                  <p className="text-xs text-slate-400">{formatTime(query.TOTAL_ELAPSED_TIME || 0)}</p>
                </div>
              </button>

              {isExp && (
                <div className="px-4 pb-4 border-t border-slate-700 bg-slate-700/30 mt-2">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-400">Execution Time</p>
                      <p className="font-semibold text-slate-100">{formatTime(query.EXECUTION_TIME || 0)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Compilation Time</p>
                      <p className="font-semibold text-slate-100">{formatTime(query.COMPILATION_TIME || 0)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Rows Scanned</p>
                      <p className="font-semibold text-slate-100">{(query.ROWS_SCANNED || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Rows Produced</p>
                      <p className="font-semibold text-slate-100">{(query.ROWS_PRODUCED || 0).toLocaleString()}</p>
                    </div>
                    {query.ERROR_MESSAGE && (
                      <div className="col-span-2">
                        <p className="text-slate-400">Error</p>
                        <p className="font-mono text-xs text-red-300 mt-1">{query.ERROR_MESSAGE}</p>
                      </div>
                    )}
                  </div>
                  <div className="mt-4">
                    <p className="text-xs text-slate-400 mb-2">SQL Query:</p>
                    <pre className="bg-slate-800 p-2 rounded text-xs overflow-auto text-slate-300 max-h-48">
                      {query.QUERY_TEXT}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
