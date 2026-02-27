'use client'

import { useEffect, useMemo, useState } from 'react'
import useFetch from '@/hooks/useApi'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader, AlertCircle } from 'lucide-react'
import { formatBytes, formatNumber } from '@/lib/formatting'
import { useSpendDisplay } from '@/hooks/useSpendDisplay'
import WidgetAIInsight from '@/components/ai/WidgetAIInsight'

const RECOMMENDATION_STATUS_OPTIONS = ['open', 'in_progress', 'accepted', 'done', 'snoozed', 'dismissed'] as const

export default function RecommendationsTab({ dateRange }: { dateRange: { start: Date; end: Date } }) {
  const start = dateRange.start.toISOString().split('T')[0]
  const end = dateRange.end.toISOString().split('T')[0]
  const {
    data,
    isLoading,
    error,
    refetch: refetchRecommendations,
  } = useFetch<any[]>(
    ['recommendations', start, end],
    `/api/recommendations?type=list&start=${start}&end=${end}`
  )

  const [category, setCategory] = useState('All')
  const [status, setStatus] = useState('All')
  const [minPriority, setMinPriority] = useState(0)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [updatedBy, setUpdatedBy] = useState('')
  const [note, setNote] = useState('')
  const [pendingStatus, setPendingStatus] = useState('open')
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const { creditUnitLabel, formatCreditValue } = useSpendDisplay()

  const filtered = useMemo(() => {
    const rows = [...(data || [])]
    return rows.filter((r) => {
      if (category !== 'All' && r.CATEGORY !== category) return false
      if (status !== 'All' && String(r.CURRENT_STATUS || r.STATUS || '').toLowerCase() !== status.toLowerCase()) return false
      if (Number(r.PRIORITY_SCORE || 0) < minPriority) return false
      return true
    })
  }, [data, category, status, minPriority])
  const categoryGroups: Array<[string, any[]]> = useMemo(
    () =>
      Array.from(
        filtered.reduce((acc, r) => {
          const key = String(r.CATEGORY || 'Unknown')
          if (!acc.has(key)) acc.set(key, [])
          acc.get(key)!.push(r)
          return acc
        }, new Map<string, any[]>())
      ),
    [filtered]
  )

  const categories = ['All', ...Array.from(new Set((data || []).map((r) => r.CATEGORY).filter(Boolean)))]
  const selected = filtered.find((r) => `${r.RUN_DATE}|${r.FINDING_ID}` === selectedKey) || filtered[0]
  const { data: evidence } = useFetch<any[]>(
    ['recommendation-evidence', selected?.RUN_DATE, selected?.FINDING_ID],
    selected ? `/api/recommendations?type=evidence&runDate=${selected.RUN_DATE}&findingId=${encodeURIComponent(selected.FINDING_ID)}` : '/api/recommendations?type=evidence',
    { enabled: !!selected }
  )

  const effectiveStatus = String(selected?.CURRENT_STATUS || selected?.STATUS || 'open').toLowerCase()

  useEffect(() => {
    if (selected) {
      setPendingStatus(RECOMMENDATION_STATUS_OPTIONS.includes(effectiveStatus as any) ? effectiveStatus : 'open')
      setNote('')
      setSaveMessage(null)
      setSaveError(null)
      if (!updatedBy) {
        setUpdatedBy('web-ui')
      }
    }
  }, [selectedKey, selected, effectiveStatus, updatedBy])

  async function saveFeedback(nextStatus: string) {
    if (!selected || saveBusy) return
    setSaveBusy(true)
    setSaveMessage(null)
    setSaveError(null)
    try {
      const response = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_feedback',
          runDate: selected.RUN_DATE,
          findingId: selected.FINDING_ID,
          statusOverride: nextStatus,
          note,
          updatedBy: updatedBy || 'web-ui',
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error?.message || payload?.error || 'Failed to save recommendation update')
      }
      setPendingStatus(nextStatus)
      setSaveMessage(`Saved status as ${nextStatus.replace('_', ' ')}`)
      await refetchRecommendations()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save recommendation update')
    } finally {
      setSaveBusy(false)
    }
  }

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader className="w-8 h-8 text-blue-400 animate-spin" /></div>
  if (error) return <div className="text-center py-12"><AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" /><p className="text-red-300">{error.message}</p></div>
  if (!data || data.length === 0) return <div className="text-center py-12 text-slate-400">No recommendations available for the selected window</div>

  const totalCredits = filtered.reduce((s, r) => s + Number(r.EST_CREDITS_SAVED_MONTHLY || 0), 0)
  const totalStorage = filtered.reduce((s, r) => s + Number(r.EST_STORAGE_BYTES_SAVED || 0), 0)
  const highPriorityCount = filtered.filter((r) => Number(r.PRIORITY_SCORE || 0) >= 80).length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-slate-900 border-slate-700"><CardContent className="pt-6"><p className="text-xs text-slate-400">Findings</p><p className="text-2xl font-semibold text-white">{formatNumber(filtered.length)}</p></CardContent></Card>
        <Card className="bg-slate-900 border-slate-700"><CardContent className="pt-6"><p className="text-xs text-slate-400">Est {creditUnitLabel} / mo</p><p className="text-2xl font-semibold text-blue-300">{formatCreditValue(totalCredits)}</p></CardContent></Card>
        <Card className="bg-slate-900 border-slate-700"><CardContent className="pt-6"><p className="text-xs text-slate-400">Est Storage Saved</p><p className="text-2xl font-semibold text-green-300">{formatBytes(totalStorage)}</p></CardContent></Card>
        <Card className="bg-slate-900 border-slate-700"><CardContent className="pt-6"><p className="text-xs text-slate-400">Avg Priority</p><p className="text-2xl font-semibold text-yellow-300">{filtered.length ? (filtered.reduce((s, r) => s + Number(r.PRIORITY_SCORE || 0), 0) / filtered.length).toFixed(1) : '0.0'}</p></CardContent></Card>
        <Card className="bg-slate-900 border-slate-700"><CardContent className="pt-6"><p className="text-xs text-slate-400">High Priority (&gt;=80)</p><p className="text-2xl font-semibold text-red-300">{formatNumber(highPriorityCount)}</p></CardContent></Card>
      </div>

      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Match Streamlit recommendation window and status/category filtering</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm">
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm">
              {['All', 'open', 'in_progress', 'accepted', 'done', 'snoozed', 'dismissed'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-300">Min priority</label>
              <input type="range" min={0} max={100} value={minPriority} onChange={(e) => setMinPriority(Number(e.target.value))} className="w-full" />
              <span className="text-xs text-slate-400 w-8">{minPriority}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-base">Top Recommendations</CardTitle>
            <CardDescription>{filtered.length} rows</CardDescription>
          </CardHeader>
          <CardContent>
              <div className="overflow-x-auto max-h-[520px]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-600 bg-slate-800/50">
                      <th className="text-left py-3 px-2 font-semibold text-slate-100 uppercase tracking-wide">Status</th>
                      <th className="text-left py-3 px-2 font-semibold text-slate-100 uppercase tracking-wide">Category</th>
                      <th className="text-left py-3 px-2 font-semibold text-slate-100 uppercase tracking-wide">Title</th>
                      <th className="text-right py-3 px-2 font-semibold text-slate-100 uppercase tracking-wide">Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => {
                      const key = `${r.RUN_DATE}|${r.FINDING_ID}`
                      const active = (selected ? `${selected.RUN_DATE}|${selected.FINDING_ID}` : selectedKey) === key
                      return (
                        <tr key={i} className={`border-b border-slate-800 cursor-pointer ${active ? 'bg-slate-800/70' : 'hover:bg-slate-800/40'}`} onClick={() => setSelectedKey(key)}>
                          <td className="py-2 px-2 text-slate-200">{String(r.CURRENT_STATUS || r.STATUS || 'open')}</td>
                          <td className="py-2 px-2 text-slate-300">{r.CATEGORY}</td>
                          <td className="py-2 px-2 text-slate-200">{String(r.TITLE || r.ENTITY_NAME || '').slice(0, 70)}</td>
                          <td className="py-2 px-2 text-right text-yellow-300 font-semibold">{Number(r.PRIORITY_SCORE || 0).toFixed(1)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-base">Recommendation Details</CardTitle>
            <CardDescription>{selected?.FINDING_ID || 'Select a row'}</CardDescription>
          </CardHeader>
          <CardContent>
            {selected ? (
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Title</p>
                  <p className="text-slate-100 font-semibold">{selected.TITLE}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-slate-400">Category / Type</p><p className="text-slate-200">{selected.CATEGORY} / {selected.SUBTYPE}</p></div>
                  <div><p className="text-xs text-slate-400">Target</p><p className="text-slate-200">{selected.ENTITY_NAME}</p></div>
                  <div><p className="text-xs text-slate-400">Priority</p><p className="text-yellow-300">{Number(selected.PRIORITY_SCORE || 0).toFixed(1)}</p></div>
                  <div><p className="text-xs text-slate-400">Confidence</p><p className="text-blue-300">{(Number(selected.CONFIDENCE_SCORE || 0) * 100).toFixed(0)}%</p></div>
                  <div><p className="text-xs text-slate-400">Est {creditUnitLabel} / mo</p><p className="text-green-300">{formatCreditValue(Number(selected.EST_CREDITS_SAVED_MONTHLY || 0))}</p></div>
                  <div><p className="text-xs text-slate-400">Est Storage Saved</p><p className="text-green-300">{formatBytes(Number(selected.EST_STORAGE_BYTES_SAVED || 0))}</p></div>
                </div>
                {selected.SUMMARY && (
                  <div>
                    <p className="text-xs text-slate-400">Summary</p>
                    <p className="text-slate-300">{selected.SUMMARY}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-400 mb-2">Evidence Rows</p>
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {(evidence || []).length === 0 ? (
                      <p className="text-slate-500">No evidence rows</p>
                    ) : (
                      (evidence || []).map((ev, i) => (
                        <details key={i} className="border border-slate-700 rounded p-2 bg-slate-800/40">
                          <summary className="cursor-pointer text-slate-200">{ev.EVIDENCE_KIND || 'evidence'} <span className="text-slate-500">({ev.CREATED_AT ? new Date(ev.CREATED_AT).toLocaleString() : ''})</span></summary>
                          <pre className="mt-2 text-xs text-slate-300 overflow-auto">{typeof ev.EVIDENCE_JSON === 'string' ? ev.EVIDENCE_JSON : JSON.stringify(ev.EVIDENCE_JSON, null, 2)}</pre>
                        </details>
                      ))
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-700 pt-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-400">Status & Notes</p>
                      <p className="text-xs text-slate-500">Equivalent to Streamlit feedback update (writes to `OPT_FINDING_FEEDBACK`)</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded border border-slate-700 bg-slate-800 text-slate-200">
                      Current: {String(selected.CURRENT_STATUS || selected.STATUS || 'open')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Updated by</label>
                      <input
                        value={updatedBy}
                        onChange={(e) => setUpdatedBy(e.target.value)}
                        className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                        placeholder="name or email"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Update status</label>
                      <select
                        value={pendingStatus}
                        onChange={(e) => setPendingStatus(e.target.value)}
                        className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                      >
                        {RECOMMENDATION_STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Status note / ticket handoff note</label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={4}
                      className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                      placeholder="Progress update, blockers, owner handoff, validation notes..."
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => saveFeedback(pendingStatus)}
                      disabled={saveBusy}
                      className="rounded-md border border-cyan-700/50 bg-cyan-950/30 px-3 py-1.5 text-xs text-cyan-200 disabled:opacity-50"
                    >
                      {saveBusy ? 'Saving...' : 'Save status'}
                    </button>
                    {['in_progress', 'done', 'dismissed'].map((quick) => (
                      <button
                        key={quick}
                        type="button"
                        onClick={() => saveFeedback(quick)}
                        disabled={saveBusy}
                        className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 disabled:opacity-50"
                      >
                        {quick.replace('_', ' ')}
                      </button>
                    ))}
                  </div>

                  {saveMessage && <p className="text-xs text-green-300">{saveMessage}</p>}
                  {saveError && <p className="text-xs text-red-300">{saveError}</p>}
                  {selected.FEEDBACK_NOTE && (
                    <p className="text-xs text-slate-500">
                      Latest saved note: {selected.FEEDBACK_NOTE}
                    </p>
                  )}
                </div>

                <div className="border-t border-slate-700 pt-4">
                  <p className="text-xs text-slate-400 mb-2">Suggested Ticket Summary</p>
                  <pre className="text-xs bg-slate-800/60 border border-slate-700 rounded p-3 overflow-auto text-slate-300 whitespace-pre-wrap">
{[
`Title: ${selected.TITLE || selected.ENTITY_NAME || '-'}`,
`Category/Type: ${selected.CATEGORY || '-'} / ${selected.SUBTYPE || '-'}`,
`Entity: ${selected.ENTITY_NAME || '-'}`,
`Estimated ${creditUnitLabel.toLowerCase()} saved/month: ${formatCreditValue(Number(selected.EST_CREDITS_SAVED_MONTHLY || 0))}`,
`Estimated storage saved: ${formatBytes(Number(selected.EST_STORAGE_BYTES_SAVED || 0))}`,
`Confidence: ${(Number(selected.CONFIDENCE_SCORE || 0) * 100).toFixed(0)}%`,
'Execution policy: Manual only',
                    ].join('\n')}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="text-slate-400">Select a recommendation row</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-base">Recommendations by Category</CardTitle>
          <CardDescription>Distribution of filtered recommendations across optimization areas</CardDescription>
        </CardHeader>
        <CardContent>
          {categoryGroups.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {categoryGroups.map(([groupCategory, items]) => (
                <div key={groupCategory} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-slate-100">{groupCategory}</h4>
                    <span className="bg-blue-900/50 text-blue-300 px-2 py-1 rounded text-xs font-medium">
                      {items.length}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-slate-400">
                    <p>
                      Avg Priority:{' '}
                      <span className="text-yellow-300 font-medium">
                        {(items.reduce((sum, i) => sum + Number(i.PRIORITY_SCORE || 0), 0) / items.length).toFixed(1)}
                      </span>
                    </p>
                    <p>
                      Est {creditUnitLabel}/mo:{' '}
                      <span className="text-green-300 font-medium">
                        {formatCreditValue(items.reduce((sum, i) => sum + Number(i.EST_CREDITS_SAVED_MONTHLY || 0), 0))}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-slate-400 py-8">No category breakdown available</div>
          )}
        </CardContent>
      </Card>

      <WidgetAIInsight
        title="Recommendations AI Analysis"
        widgetType="optimization_strategy"
        dateRange={dateRange}
        widgetId="recommendations_page"
        widgetKind="page"
        templateKey="ai_optimization_insights"
        dataSample={filtered.slice(0, 50)}
      />
    </div>
  )
}
