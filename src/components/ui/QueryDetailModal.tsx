'use client'

import { X, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { useSpendDisplay } from '@/hooks/useSpendDisplay'

interface QueryDetailModalProps {
  isOpen: boolean
  onClose: () => void
  query: {
    QUERY_TEXT?: string
    QUERY_ID?: string
    USER_NAME?: string
    WAREHOUSE_NAME?: string
    EXECUTION_SECONDS?: number
    CREDITS_ATTRIBUTED_COMPUTE?: number
    START_TIME?: string
    END_TIME?: string
    [key: string]: unknown
  }
  title?: string
}

export default function QueryDetailModal({ isOpen, onClose, query, title = 'Query Details' }: QueryDetailModalProps) {
  const [copied, setCopied] = useState(false)
  const { formatCreditValue, creditUnitLabel } = useSpendDisplay()

  const handleCopy = () => {
    if (query.QUERY_TEXT) {
      navigator.clipboard.writeText(query.QUERY_TEXT)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-slate-800 border border-slate-700 rounded-lg shadow-2xl max-w-2xl max-h-96 w-full m-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-slate-400 hover:text-slate-200" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-auto flex-1 p-6 space-y-6">
          {/* Query Text */}
          {query.QUERY_TEXT && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-slate-200 uppercase tracking-wide">Query</label>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <pre className="bg-slate-900 border border-slate-700 rounded p-3 overflow-auto max-h-40 text-xs text-slate-100 font-mono leading-relaxed whitespace-pre-wrap break-words">
                {query.QUERY_TEXT}
              </pre>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            {query.QUERY_ID && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Query ID</p>
                <p className="text-sm text-slate-100 font-mono">{query.QUERY_ID}</p>
              </div>
            )}
            {query.USER_NAME && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">User</p>
                <p className="text-sm text-slate-100">{query.USER_NAME}</p>
              </div>
            )}
            {query.WAREHOUSE_NAME && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Warehouse</p>
                <p className="text-sm text-slate-100">{query.WAREHOUSE_NAME}</p>
              </div>
            )}
            {query.EXECUTION_SECONDS !== undefined && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Duration</p>
                <p className="text-sm text-slate-100">{query.EXECUTION_SECONDS.toFixed(2)}s</p>
              </div>
            )}
            {query.CREDITS_ATTRIBUTED_COMPUTE !== undefined && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{creditUnitLabel}</p>
                <p className="text-sm text-blue-300 font-semibold">{formatCreditValue(Number(query.CREDITS_ATTRIBUTED_COMPUTE || 0))}</p>
              </div>
            )}
            {query.START_TIME && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Started</p>
                <p className="text-sm text-slate-100">{new Date(query.START_TIME).toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700 bg-slate-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors font-medium text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
