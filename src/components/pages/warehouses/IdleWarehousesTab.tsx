'use client'

import useFetch from '@/hooks/useApi'
import { Loader, AlertCircle, AlertTriangle } from 'lucide-react'
import { useSpendDisplay } from '@/hooks/useSpendDisplay'

interface IdleWarehousesTabProps {
  dateRange: { start: Date; end: Date }
}

export default function IdleWarehousesTab({ dateRange }: IdleWarehousesTabProps) {
  const startDate = dateRange.start.toISOString().split('T')[0]
  const endDate = dateRange.end.toISOString().split('T')[0]

  const { data, isLoading, error } = useFetch<any[]>(
    ['dormant-warehouses', startDate, endDate],
    `/api/warehouses?type=dormant&startDate=${startDate}&endDate=${endDate}`
  )
  const { creditUnitLabel, formatCreditValue } = useSpendDisplay()

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
        <p className="text-slate-400">No dormant warehouses detected</p>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-header flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-yellow-400" />
        <h3 className="text-lg font-semibold text-white">Dormant Warehouses (&lt; 1 {creditUnitLabel.toLowerCase()})</h3>
      </div>

      <div className="card-body space-y-3">
        {data.map((wh, idx) => (
          <div key={idx} className="bg-yellow-900/10 border border-yellow-700/50 rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="font-semibold text-yellow-200">{wh.WAREHOUSE_NAME}</h4>
                <p className="text-sm text-slate-400 mt-1">
                  Last active: {wh.last_active ? new Date(wh.last_active).toLocaleDateString() : 'Unknown'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-yellow-400">{formatCreditValue(Number(wh.total_credit || 0))}</p>
                <p className="text-xs text-slate-400">{creditUnitLabel} in window</p>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-yellow-700/50 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-400">Days Since Active</p>
                <p className="font-semibold text-slate-100">{wh.days_since_active ?? '-'}</p>
              </div>
              <div>
                <p className="text-slate-400">Recommendation</p>
                <p className="font-semibold text-slate-100">{wh.recommendation || 'Review usage'}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
