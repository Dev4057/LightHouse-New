'use client'

import useFetch from '@/hooks/useApi'
import { Loader, AlertCircle, AlertTriangle } from 'lucide-react'

export default function MFAStatusTab() {
  const { data, isLoading, error } = useFetch<any[]>(['mfa-status'], '/api/identity?type=mfa_status')

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
          <p className="font-semibold text-red-200">Error loading MFA status</p>
          <p className="text-sm text-red-300">{error.message}</p>
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">No MFA data available</p>
      </div>
    )
  }

  const withMFA = data.filter((u) => u.HAS_MFA).length
  const withoutMFA = data.length - withMFA
  const mfaPercentage = ((withMFA / data.length) * 100).toFixed(1)

  return (
    <div className="space-y-6">
      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-6">
        <h3 className="font-semibold text-blue-200 mb-4">MFA Coverage</h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-slate-100">Users with MFA</span>
              <span className="font-bold text-blue-400">{mfaPercentage}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400" style={{ width: `${mfaPercentage}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-center mt-4">
            <div>
              <p className="text-green-400 text-2xl font-bold">{withMFA}</p>
              <p className="text-sm text-slate-400">With MFA</p>
            </div>
            <div>
              <p className="text-red-400 text-2xl font-bold">{withoutMFA}</p>
              <p className="text-sm text-slate-400">Without MFA</p>
            </div>
          </div>
        </div>
      </div>

      {withoutMFA > 0 && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-200">{withoutMFA} users without MFA enabled</p>
            <p className="text-sm text-red-300 mt-1">Consider enforcing MFA for enhanced security</p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-white">User MFA Status</h3>
        </div>

        <div className="card-body space-y-2">
          {data.map((user, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                user.HAS_MFA ? 'bg-green-900/10 border-green-700/30' : 'bg-red-900/10 border-red-700/30'
              }`}
            >
              <div>
                <p className={`font-semibold ${user.HAS_MFA ? 'text-green-200' : 'text-red-200'}`}>
                  {user.USER_NAME}
                </p>
                <p className="text-xs text-slate-400">{user.AUTH_METHOD}</p>
              </div>
              <div>
                <span
                  className={`px-3 py-1 rounded text-xs font-semibold ${
                    user.HAS_MFA ? 'bg-green-900/50 text-green-200' : 'bg-red-900/50 text-red-200'
                  }`}
                >
                  {user.HAS_MFA ? '✓ Enabled' : '✗ Disabled'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
