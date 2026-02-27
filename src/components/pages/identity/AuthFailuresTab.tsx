'use client'

import useFetch from '@/hooks/useApi'
import { Loader, AlertCircle, AlertTriangle } from 'lucide-react'

interface AuthFailuresTabProps {
  dateRange: { start: Date; end: Date }
}

export default function AuthFailuresTab({ dateRange }: AuthFailuresTabProps) {
  const startDate = dateRange.start.toISOString().split('T')[0]
  const endDate = dateRange.end.toISOString().split('T')[0]

  const { data, isLoading, error } = useFetch<any[]>(
    ['auth-failures', startDate, endDate],
    `/api/identity?type=auth_failures&startDate=${startDate}&endDate=${endDate}&limit=100`
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
          <p className="font-semibold text-red-200">Error loading auth failures</p>
          <p className="text-sm text-red-300">{error.message}</p>
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">No authentication failures detected</p>
      </div>
    )
  }

  const totalFailures = data.reduce((sum, item) => sum + (item.FAILURE_COUNT || 0), 0)

  return (
    <div className="space-y-6">
      {totalFailures > 10 && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-200">{totalFailures} authentication failures detected</p>
            <p className="text-sm text-red-300 mt-1">Review failure patterns and investigate suspicious activity</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-body text-center">
            <p className="text-slate-400">Total Failures</p>
            <p className="text-3xl font-bold text-red-400 mt-2">{totalFailures}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center">
            <p className="text-slate-400">Unique Users</p>
            <p className="text-3xl font-bold text-orange-400 mt-2">{data.length}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-white">Authentication Failures</h3>
        </div>

        <div className="card-body space-y-2">
          {data.map((failure, idx) => (
            <div key={idx} className="bg-red-900/10 border border-red-700/30 rounded-lg p-4 hover:bg-red-900/20 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-slate-100">{failure.USER_NAME}</p>
                  <p className="text-xs text-slate-400">{failure.AUTHENTICATION_METHOD}</p>
                </div>
                <span className="bg-red-900/50 text-red-200 px-2 py-1 rounded text-xs font-semibold">
                  {failure.FAILURE_COUNT} attempts
                </span>
              </div>

              <div className="mt-3 pt-3 border-t border-red-700/30">
                <p className="text-xs text-slate-400 mb-1">Error:</p>
                <p className="text-xs text-red-300 font-mono">{failure.ERROR_MESSAGE}</p>
                <p className="text-xs text-slate-500 mt-2">
                  Latest: {new Date(failure.ATTEMPT_TIME).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
