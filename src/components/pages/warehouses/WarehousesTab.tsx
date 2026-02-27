'use client'

import useFetch from '@/hooks/useApi'
import { Loader, AlertCircle, Activity } from 'lucide-react'
import { useSpendDisplay } from '@/hooks/useSpendDisplay'
import type { Warehouse } from '@/types'

export default function WarehousesTab() {
  const { data, isLoading, error } = useFetch<Warehouse[]>(['warehouses'], '/api/warehouses?type=list')
  const { formatCreditValue, creditUnitLabel } = useSpendDisplay()

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
          <p className="font-semibold text-red-200">Error loading warehouses</p>
          <p className="text-sm text-red-300">{error.message}</p>
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">No warehouses found</p>
      </div>
    )
  }

  const stateColors = {
    RUNNING: 'bg-green-900/20 border-green-700 text-green-200',
    SUSPENDED: 'bg-yellow-900/20 border-yellow-700 text-yellow-200',
    RESIZING: 'bg-blue-900/20 border-blue-700 text-blue-200',
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.map((wh) => {
        const stateColor = stateColors[wh.STATE as keyof typeof stateColors] || stateColors.SUSPENDED
        return (
          <div key={wh.WAREHOUSE_ID} className="card">
            <div className="card-header flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">{wh.WAREHOUSE_NAME}</h3>
                <p className="text-xs text-slate-400 mt-1">{wh.WAREHOUSE_SIZE} - {wh.WAREHOUSE_TYPE}</p>
              </div>
              <div className={`px-2 py-1 rounded text-xs font-semibold border ${stateColor}`}>
                {wh.STATE}
              </div>
            </div>

            <div className="card-body space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-400">{creditUnitLabel} Used</p>
                  <p className="text-lg font-bold text-blue-400">{formatCreditValue(wh.CREDITS_USED || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Queries</p>
                  <p className="text-lg font-bold text-green-400">{wh.QUERIES_EXECUTED || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Avg Duration</p>
                  <p className="text-sm font-semibold text-slate-200">
                    {((wh.AVERAGE_QUERY_TIME || 0) / 1000).toFixed(2)}s
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Auto-suspend</p>
                  <p className="text-sm font-semibold text-slate-200">{wh.AUTO_SUSPEND || 'N/A'} min</p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-700">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Activity className="w-3 h-3" />
                  <span>Created: {new Date(wh.CREATED_ON).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
