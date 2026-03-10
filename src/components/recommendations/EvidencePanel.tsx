'use client'

import { useEffect, useState } from 'react'
import { X, Terminal, CheckCircle2, Ban, Loader, Database, AlertCircle } from 'lucide-react'

export default function EvidencePanel({ finding, onClose, onRefresh }: any) {
  const [evidence, setEvidence] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(false)

  // Fetch the evidence when the panel opens
// Fetch the evidence when the panel opens
  useEffect(() => {
    if (!finding) return

    const fetchEvidence = async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/recommendations?type=evidence&runDate=${finding.RUN_DATE?.split('T')[0]}&findingId=${finding.FINDING_ID}`
        )
        const json = await res.json()
        
        // ✨ FIX: Parse the stringified JSON so it looks beautiful in the UI
        const parsedEvidence = (json.data || []).map((item: any) => {
          let cleanJson = item.EVIDENCE_JSON;
          try {
            // Snowflake stores this column as a stringified object, so we parse it back
            cleanJson = JSON.parse(item.EVIDENCE_JSON);
          } catch (e) {
            // If it fails, just keep the original string
          }
          return {
            ...item,
            EVIDENCE_JSON: cleanJson
          }
        })

        setEvidence(parsedEvidence)
      } catch (err) {
        console.error('Failed to load evidence', err)
      } finally {
        setLoading(false)
      }
    }

    fetchEvidence()
  }, [finding])

  // Handle Dismiss or Resolve actions
  const handleUpdateStatus = async (status: string) => {
    setUpdating(true)
    try {
      await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_feedback',
          runDate: finding.RUN_DATE?.split('T')[0],
          findingId: finding.FINDING_ID,
          statusOverride: status,
          note: `Marked as ${status} from UI`
        })
      })
      onRefresh() // Tell the parent page to refresh the list
      onClose()   // Close the drawer
    } catch (err) {
      console.error('Failed to update status', err)
    } finally {
      setUpdating(false)
    }
  }

  if (!finding) return null

  // Extract the SQL string if it exists in the raw JSON
  const suggestedSQL = finding.RECOMMENDATION_SQL || '-- Auto-generated SQL not available for this finding type.'

  return (
    <>
      {/* Dark Overlay */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Slide-out Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded border ${
              finding.PRIORITY_SCORE > 80 ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400' :
              finding.PRIORITY_SCORE > 50 ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400' :
              'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400'
            }`}>
              {finding.PRIORITY_SCORE > 80 ? 'High' : finding.PRIORITY_SCORE > 50 ? 'Medium' : 'Low'} Priority
            </span>
            <span className="text-xs text-slate-400 font-mono">ID: {finding.FINDING_ID?.split('-')[0]}</span>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Title & Description */}
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              {finding.TITLE || finding.FINDING_TYPE}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {finding.DESCRIPTION}
            </p>
          </div>

          {/* Metric Impact */}
          {Number(finding.EST_CREDITS_SAVED_MONTHLY) > 0 && (
            <div className="flex items-center gap-4 p-4 rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/10">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-800 rounded-lg">
                <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Est. Monthly Impact</p>
                <p className="text-xl font-black text-slate-900 dark:text-white">
                  -{Number(finding.EST_CREDITS_SAVED_MONTHLY).toFixed(1)} Credits
                </p>
              </div>
            </div>
          )}

          {/* Technical Evidence */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-slate-400" /> Supporting Evidence
            </h3>
            
            {loading ? (
              <div className="p-8 flex flex-col items-center justify-center text-slate-400 border border-slate-200 dark:border-slate-800 border-dashed rounded-xl">
                <Loader className="w-6 h-6 animate-spin mb-2" />
                <span className="text-xs font-medium">Fetching telemetry...</span>
              </div>
            ) : evidence.length > 0 ? (
              <div className="bg-slate-950 rounded-xl p-4 overflow-x-auto shadow-inner border border-slate-800">
                <pre className="text-[11px] text-lime-400 font-mono">
                  {JSON.stringify(evidence, null, 2)}
                </pre>
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                No raw JSON evidence attached to this specific finding.
              </p>
            )}
          </div>

          {/* Actionable SQL */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-blue-500" /> Remediation Script
            </h3>
            <div className="relative">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 overflow-x-auto">
                <code className="text-xs text-blue-300 font-mono whitespace-pre-wrap">
                  {suggestedSQL}
                </code>
              </div>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center">
          <button 
            onClick={() => handleUpdateStatus('dismissed')}
            disabled={updating}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-colors flex items-center gap-2"
          >
            <Ban className="w-4 h-4" /> Dismiss Finding
          </button>
          
          <button 
            onClick={() => handleUpdateStatus('done')}
            disabled={updating}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {updating ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Mark as Resolved
          </button>
        </div>
      </div>
    </>
  )
}