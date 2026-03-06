'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle, TrendingUp, Zap } from 'lucide-react'
import type { AIInsight } from '@/lib/ai'

export interface AIInsightWidgetContext {
  widgetId?: string
  widgetKind?: string
  templateKey?: string
  sqlText?: string
  dataSample?: unknown
  selectedRow?: Record<string, unknown> | null
  selectedRowEvidence?: Record<string, unknown> | null
}

interface AIPanelProps {
  widgetType?: string
  title?: string
  startDate?: Date
  endDate?: Date
  widgetContext?: AIInsightWidgetContext
}

interface QueryOptimizationResult {
  originalQuery: string
  observedElapsedSeconds?: number
  agenticFlow: {
    stages: Array<{
      key: string
      label: string
      status: 'completed' | 'failed' | 'skipped'
      detail?: string
    }>
    plannerTrace: {
      original: string[]
      suggested: string[]
    }
  }
  originalExplainText: string
  originalExplainSummary?: string
  aiSuggestion: {
    estimated_runtime_change: string
    likely_issues: string[]
    suggested_query: string
    why: string
    validation_notes: string[]
  }
  suggestedExplainText: string
  reducedValidation: {
    attempted: boolean
    executedOnSnowflake?: boolean
    limit: number
    originalValidationSource?: string
    suggestedValidationSource?: string
    originalValidationQuery?: string
    suggestedValidationQuery?: string
    originalRowCount?: number
    suggestedRowCount?: number
    columnsMatch?: boolean
    exactSampleMatch?: boolean
    normalizedSetMatch?: boolean
    message: string
  }
}

export default function AIInsightsPanel({
  widgetType = 'query_performance',
  title = 'Performance Insights',
  startDate,
  endDate,
  widgetContext,
}: AIPanelProps) {
  const [insight, setInsight] = useState<AIInsight | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [followUp, setFollowUp] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [optLoading, setOptLoading] = useState(false)
  const [optError, setOptError] = useState<string | null>(null)
  const [optResult, setOptResult] = useState<QueryOptimizationResult | null>(null)
  const [optStartedAt, setOptStartedAt] = useState<number | null>(null)
  const [optLiveStages, setOptLiveStages] = useState<QueryOptimizationResult['agenticFlow']['stages']>([])
  const widgetContextKey = JSON.stringify(widgetContext ?? null)
  const selectedRow = widgetContext?.selectedRow ?? null
  const selectedQueryText =
    selectedRow && typeof selectedRow.QUERY_TEXT === 'string' ? selectedRow.QUERY_TEXT : ''
  const rowHasOptimizableQuery = Boolean(
    selectedQueryText &&
      (widgetContext?.widgetKind === 'table_row' ||
        ['expensive_queries', 'longest_queries', 'spill_queries', 'prune_queries'].includes(
          String(widgetContext?.templateKey || '')
        ))
  )

  useEffect(() => {
    async function fetchInsights() {
      try {
        setLoading(true)
        setError(null)

        const start = startDate?.toISOString().split('T')[0] || 
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        const end = endDate?.toISOString().split('T')[0] || 
          new Date().toISOString().split('T')[0]

        let response: Response
        if (widgetContext) {
          response = await fetch('/api/ai-insights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: widgetType,
              title,
              start_date: start,
              end_date: end,
              ...widgetContext,
            }),
          })
        } else {
          const params = new URLSearchParams({
            type: widgetType,
            title,
            start_date: start,
            end_date: end,
          })
          response = await fetch(`/api/ai-insights?${params}`)
        }

        const data = await readResponsePayload(response)
        if (!response.ok) {
          throw new Error(extractErrorMessage(data, 'Failed to fetch insights'))
        }
        if (data?._rawText) {
          throw new Error(`Unexpected non-JSON response: ${String(data._rawText).slice(0, 200)}`)
        }
        setInsight(data)
        setChatMessages([])
        setChatError(null)
        setOptError(null)
        setOptResult(null)
      } catch (err) {
        console.error('AI insights error:', err)
        setError(err instanceof Error ? err.message : 'Failed to load insights')
      } finally {
        setLoading(false)
      }
    }

    fetchInsights()
  }, [widgetType, title, startDate, endDate, widgetContext, widgetContextKey])

  async function sendFollowUp() {
    const question = followUp.trim()
    if (!question || !insight || chatLoading) return

    const nextUserMessage = { role: 'user' as const, content: question }
    const nextMessages = [...chatMessages, nextUserMessage]

    setChatMessages(nextMessages)
    setFollowUp('')
    setChatLoading(true)
    setChatError(null)

    try {
      const response = await fetch('/api/ai-insights/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          widgetType,
          title,
          insight,
          widgetContext,
          messages: nextMessages,
          question,
        }),
      })

      const payload = await readResponsePayload(response)
      if (!response.ok) {
        throw new Error(extractErrorMessage(payload, 'Failed to get AI follow-up response'))
      }
      if (payload?._rawText) {
        throw new Error(`Unexpected non-JSON response: ${String(payload._rawText).slice(0, 200)}`)
      }

      setChatMessages((prev) => [...prev, { role: 'assistant', content: String(payload.answer || '').trim() || 'No response returned.' }])
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Failed to get AI follow-up response')
    } finally {
      setChatLoading(false)
    }
  }

  async function runQueryOptimization() {
    if (!rowHasOptimizableQuery || !selectedQueryText || optLoading) return
    setOptLoading(true)
    setOptStartedAt(Date.now())
    setOptLiveStages([])
    setOptError(null)
    setOptResult(null)
    try {
      const observedElapsedSeconds =
        n(selectedRow?.ELAPSED_TIME_SEC) ||
        n(selectedRow?.EXECUTION_SECONDS) ||
        (n(selectedRow?.TOTAL_ELAPSED_TIME) > 0 ? n(selectedRow?.TOTAL_ELAPSED_TIME) / 1000 : undefined)

      const response = await fetch('/api/query-optimizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queryText: selectedQueryText,
          observedElapsedSeconds,
          queryId: selectedRow?.QUERY_ID,
          limit: 20,
          stream: true,
        }),
      })
      const contentType = response.headers.get('content-type') || ''

      if (response.body && contentType.includes('application/x-ndjson')) {
        await readNdjsonStream(response, {
          onStage: (stage) => {
            setOptLiveStages((prev) => {
              const idx = prev.findIndex((s) => s.key === stage.key)
              if (idx >= 0) {
                const next = [...prev]
                next[idx] = stage
                return next
              }
              return [...prev, stage]
            })
          },
          onResult: (result) => {
            setOptResult(result as QueryOptimizationResult)
            setOptLiveStages((result as QueryOptimizationResult)?.agenticFlow?.stages || [])
          },
          onError: (message) => {
            throw new Error(message || 'Failed to optimize query')
          },
        })
      } else {
        const payload = await readResponsePayload(response)
        if (!response.ok) throw new Error(extractErrorMessage(payload, 'Failed to optimize query'))
        if (payload?._rawText) {
          throw new Error(`Unexpected non-JSON response: ${String(payload._rawText).slice(0, 200)}`)
        }
        setOptResult(payload)
        setOptLiveStages(payload?.agenticFlow?.stages || [])
      }
    } catch (err) {
      setOptError(err instanceof Error ? err.message : 'Failed to optimize query')
    } finally {
      setOptLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/50 p-4 transition-colors">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <div className="w-4 h-4 bg-slate-300 dark:bg-slate-600 rounded-full animate-pulse" />
          <span className="text-sm font-medium">Generating insights...</span>
        </div>
      </div>
    )
  }

  if (error || !insight) {
    return (
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/50 p-4 transition-colors">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm">
          <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
          {error || 'No insights available'}
        </div>
      </div>
    )
  }

  const signalIcon = {
    high: <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400" />,
    medium: <TrendingUp className="w-4 h-4 text-amber-500 dark:text-yellow-400" />,
    low: <Zap className="w-4 h-4 text-blue-500 dark:text-blue-400" />,
  }

  const signalColor = {
    high: 'text-red-700 bg-red-100 dark:bg-transparent dark:text-red-400',
    medium: 'text-amber-700 bg-amber-100 dark:bg-transparent dark:text-yellow-400',
    low: 'text-blue-700 bg-blue-100 dark:bg-transparent dark:text-blue-400',
  }

  const decisionStyle = {
    action_required: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/30 text-red-800 dark:text-red-200',
    monitor: 'bg-amber-50 dark:bg-yellow-900/20 border-amber-200 dark:border-yellow-700/30 text-amber-800 dark:text-yellow-200',
    no_material_insight: 'bg-slate-100 dark:bg-slate-700/20 border-slate-200 dark:border-slate-600/30 text-slate-700 dark:text-slate-200',
  }

  const decisionText = {
    action_required: 'Action Required',
    monitor: 'Monitor',
    no_material_insight: 'No Action Needed',
  }

  function n(value: unknown) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const elapsedSec = optStartedAt ? Math.max(0, Math.floor((Date.now() - optStartedAt) / 1000)) : 0

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/50 p-5 shadow-sm transition-colors">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white mb-1.5">AI Insights</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{insight.summary}</p>
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-transparent dark:border-current/10 ${signalColor[insight.signal]}`}>
            {signalIcon[insight.signal]}
            <span className="text-xs font-bold uppercase tracking-wider">{insight.signal} Priority</span>
          </div>
        </div>

        {/* Decision */}
        <div className={`rounded-lg border p-3.5 mt-4 flex items-center gap-2.5 shadow-sm ${decisionStyle[insight.decision]}`}>
          <CheckCircle className="w-4.5 h-4.5" />
          <span className="text-sm font-bold tracking-wide uppercase">
            {decisionText[insight.decision]}
          </span>
        </div>
      </div>

      {/* Findings */}
      {insight.findings && insight.findings.length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/50 p-5 shadow-sm transition-colors">
          <h4 className="font-bold text-slate-900 dark:text-white mb-4 text-sm uppercase tracking-wider">Findings</h4>
          <div className="space-y-3">
            {insight.findings.map((finding, idx) => (
              <div key={idx} className="border border-slate-200 dark:border-slate-700/60 rounded-lg p-4 bg-white dark:bg-slate-900/50 shadow-sm transition-colors">
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <p className="font-semibold text-slate-900 dark:text-white text-sm">{finding.title}</p>
                  <div className="flex gap-2 text-[11px] font-bold uppercase tracking-wider">
                    <span className={`px-2 py-0.5 rounded border ${
                      finding.impact === 'high' ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800/50 dark:text-red-300' :
                      finding.impact === 'medium' ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-yellow-900/30 dark:border-yellow-800/50 dark:text-yellow-300' :
                      'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800/50 dark:text-blue-300'
                    }`}>
                      {finding.impact} impact
                    </span>
                    <span className="px-2 py-0.5 rounded border bg-slate-100 border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300">
                      {finding.confidence} confidence
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 mb-2 leading-relaxed">
                  <strong className="text-slate-900 dark:text-white">Pattern:</strong> {finding.pattern}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{finding.evidence}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {insight.recommendations && insight.recommendations.length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/50 p-5 shadow-sm transition-colors">
          <h4 className="font-bold text-slate-900 dark:text-white mb-4 text-sm uppercase tracking-wider">Recommendations</h4>
          <div className="space-y-3">
            {insight.recommendations.map((rec, idx) => (
              <div key={idx} className="border border-slate-200 dark:border-slate-700/60 rounded-lg p-4 bg-white dark:bg-slate-900/50 shadow-sm transition-colors">
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <p className="font-semibold text-slate-900 dark:text-white text-sm">{rec.action}</p>
                  <div className="flex gap-2 text-[11px] font-bold uppercase tracking-wider">
                    <span className={`px-2 py-0.5 rounded border ${
                      rec.priority === 'P1' ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800/50 dark:text-red-300' :
                      rec.priority === 'P2' ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-yellow-900/30 dark:border-yellow-800/50 dark:text-yellow-300' :
                      'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800/50 dark:text-blue-300'
                    }`}>
                      {rec.priority}
                    </span>
                    <span className="px-2 py-0.5 rounded border bg-slate-100 border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300">
                      {rec.confidence} confidence
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{rec.why}</p>
                {rec.whenNotToApply && (
                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-2 p-2 bg-slate-100 dark:bg-slate-800/50 rounded-md border border-slate-200 dark:border-slate-700/50">
                    <strong className="text-slate-700 dark:text-slate-300">Exception:</strong> {rec.whenNotToApply}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested SQL */}
      {insight.suggestedSQL && insight.suggestedSQL.length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/50 p-5 shadow-sm transition-colors">
          <h4 className="font-bold text-slate-900 dark:text-white mb-4 text-sm uppercase tracking-wider">Validation Queries</h4>
          <div className="space-y-3">
            {insight.suggestedSQL.map((sql, idx) => (
              <div key={idx} className="border border-slate-200 dark:border-slate-700/60 rounded-lg p-4 bg-white dark:bg-slate-900/50 shadow-sm transition-colors">
                <p className="text-xs font-semibold text-slate-800 dark:text-white mb-2">{sql.goal}</p>
                <pre className="text-xs bg-slate-100 dark:bg-black/50 border border-slate-200 dark:border-slate-800/80 p-3 rounded-md overflow-auto text-slate-800 dark:text-slate-300 shadow-inner">
                  {sql.sql}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {rowHasOptimizableQuery && (
        <div className="bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/50 p-5 shadow-sm transition-colors">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wider">Query Optimization Lab</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                EXPLAIN original query, Cortex rewrite suggestion, EXPLAIN rewritten query, and reduced-sample validation.
              </p>
            </div>
            <button
              type="button"
              onClick={runQueryOptimization}
              disabled={optLoading}
              className="inline-flex items-center rounded-lg border border-blue-300 dark:border-cyan-700/50 bg-blue-50 dark:bg-cyan-950/30 px-3.5 py-2 text-xs font-bold tracking-wide uppercase text-blue-700 dark:text-cyan-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-100 dark:hover:bg-cyan-900/40 transition-colors shadow-sm"
            >
              {optLoading ? 'Running...' : 'Run Explain + Rewrite'}
            </button>
          </div>

          <details className="mb-4 border border-slate-200 dark:border-slate-700/60 rounded-lg p-3 bg-white dark:bg-slate-900/40 shadow-sm transition-colors">
            <summary className="cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none">Selected Query Text</summary>
            <pre className="mt-3 text-xs bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-slate-800/80 p-3 rounded-md overflow-auto text-slate-800 dark:text-slate-300 max-h-48 shadow-inner">
              {selectedQueryText}
            </pre>
          </details>

          {optError && (
            <div className="text-xs text-red-700 dark:text-red-300 border border-red-300 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 rounded-lg px-3 py-2.5 mb-4 shadow-sm">
              {optError}
            </div>
          )}

          {optLoading && (
            <div className="mb-4 border border-blue-200 dark:border-cyan-900/40 rounded-lg p-4 bg-blue-50 dark:bg-cyan-950/10 shadow-sm transition-colors">
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-cyan-200">Agentic Flow In Progress</p>
                <span className="text-[11px] font-semibold text-blue-600/80 dark:text-cyan-300/80">{elapsedSec}s elapsed</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">
                Streaming actual backend stages from the query optimizer route.
              </p>
              {optLiveStages.length === 0 ? (
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-blue-400 dark:border-cyan-600 bg-blue-100 dark:bg-cyan-900/30 text-blue-700 dark:text-cyan-200 animate-pulse">
                    …
                  </span>
                  Waiting for first backend stage event...
                </div>
              ) : (
                <div className="space-y-3">
                  {optLiveStages.map((stage, idx) => {
                    const isLast = idx === optLiveStages.length - 1
                    const isFailed = stage.status === 'failed'
                    const isDone = stage.status === 'completed'
                    const isSkipped = stage.status === 'skipped'
                    return (
                      <div key={`${stage.key}-${idx}`} className="flex items-start gap-2.5 text-xs">
                        <span
                          className={`inline-flex mt-0.5 h-5 min-w-5 items-center justify-center rounded-full border shadow-sm ${
                            isDone
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300'
                              : isFailed
                                ? 'border-red-300 bg-red-50 text-red-600 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300'
                                : isSkipped
                                  ? 'border-slate-300 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400'
                                  : 'border-blue-300 bg-blue-50 text-blue-600 dark:border-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-200'
                          }`}
                        >
                          {isDone ? '✓' : isFailed ? '!' : isSkipped ? '-' : '…'}
                        </span>
                        <div className="min-w-0 pt-0.5">
                          <div className={`font-medium ${isDone ? 'text-emerald-700 dark:text-emerald-200' : isFailed ? 'text-red-700 dark:text-red-200' : 'text-blue-700 dark:text-cyan-100'}`}>
                            {stage.label}
                          </div>
                          {stage.detail && isLast && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">{stage.detail}</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {optResult && (
            <div className="space-y-4">
              {optResult.agenticFlow && (
                <details className="border border-slate-200 dark:border-slate-700/60 rounded-lg p-3 bg-white dark:bg-slate-900/40 shadow-sm transition-colors" open>
                  <summary className="cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none">
                    Agentic Execution Trace
                  </summary>
                  <div className="mt-3 space-y-3">
                    <div className="space-y-2.5">
                      {optResult.agenticFlow.stages.map((s, idx) => (
                        <div key={`${s.key}-${idx}`} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/30 p-3 shadow-sm transition-colors">
                          <div className="flex items-start gap-2.5">
                            <span
                              className={`mt-0.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full border text-[10px] font-bold ${
                                s.status === 'completed'
                                  ? 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-700/70 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  : s.status === 'failed'
                                    ? 'border-red-300 bg-red-100 text-red-700 dark:border-red-700/70 dark:bg-red-950/30 dark:text-red-300'
                                    : 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-400'
                              }`}
                            >
                              {s.status === 'completed' ? '✓' : s.status === 'failed' ? '!' : '-'}
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">{s.label}</div>
                              {s.detail && (
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 whitespace-pre-wrap leading-relaxed">
                                  {s.detail}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {(optResult.agenticFlow.plannerTrace?.original?.length ||
                      optResult.agenticFlow.plannerTrace?.suggested?.length) && (
                      <details className="border border-slate-200 dark:border-slate-700/60 rounded-md p-3 bg-slate-50 dark:bg-slate-900/30 shadow-sm transition-colors">
                        <summary className="cursor-pointer text-[11px] font-semibold text-slate-600 dark:text-slate-300 outline-none">
                          Planner Tool Trace (Source discovery / schema probes / compile-repair loop)
                        </summary>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
                          <div>
                            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Original Validation Planner</div>
                            <pre className="text-xs bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-slate-800/80 p-3 rounded-md overflow-auto text-slate-800 dark:text-slate-300 max-h-56 whitespace-pre-wrap shadow-inner">
                              {(optResult.agenticFlow.plannerTrace.original || []).join('\n') || '(no trace)'}
                            </pre>
                          </div>
                          <div>
                            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Suggested Validation Planner</div>
                            <pre className="text-xs bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-slate-800/80 p-3 rounded-md overflow-auto text-slate-800 dark:text-slate-300 max-h-56 whitespace-pre-wrap shadow-inner">
                              {(optResult.agenticFlow.plannerTrace.suggested || []).join('\n') || '(no trace)'}
                            </pre>
                          </div>
                        </div>
                      </details>
                    )}
                  </div>
                </details>
              )}

              <div className="border border-slate-200 dark:border-slate-700/60 rounded-lg p-4 bg-white dark:bg-slate-900/50 shadow-sm transition-colors">
                <p className="text-xs font-bold text-slate-900 dark:text-white mb-1.5 uppercase tracking-wider">Estimated Runtime Change</p>
                <p className="text-sm font-semibold text-blue-600 dark:text-cyan-300">{optResult.aiSuggestion.estimated_runtime_change}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2.5 leading-relaxed">{optResult.aiSuggestion.why}</p>
              </div>

              {optResult.originalExplainSummary && (
                <details className="border border-slate-200 dark:border-slate-700/60 rounded-lg p-3 bg-white dark:bg-slate-900/40 shadow-sm transition-colors">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none">
                    EXPLAIN Summary Used for Rewrite Prompt
                  </summary>
                  <pre className="mt-3 text-xs bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-slate-800/80 p-3 rounded-md overflow-auto text-slate-800 dark:text-slate-300 max-h-56 whitespace-pre-wrap shadow-inner">
                    {optResult.originalExplainSummary}
                  </pre>
                </details>
              )}

              {optResult.aiSuggestion.likely_issues?.length > 0 && (
                <div className="border border-red-200 dark:border-red-900/40 rounded-lg p-4 bg-red-50/50 dark:bg-red-950/10 shadow-sm transition-colors">
                  <p className="text-xs font-bold text-red-800 dark:text-red-300 mb-2.5 uppercase tracking-wider">Likely Issues</p>
                  <ul className="list-disc pl-5 text-xs text-red-700 dark:text-red-200/80 space-y-1.5 marker:text-red-400">
                    {optResult.aiSuggestion.likely_issues.map((issue, idx) => (
                      <li key={idx}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="border border-slate-200 dark:border-slate-700/60 rounded-lg p-4 bg-white dark:bg-slate-900/50 shadow-sm transition-colors">
                <p className="text-xs font-bold text-slate-900 dark:text-white mb-3 uppercase tracking-wider">Suggested Query</p>
                <pre className="text-xs bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-slate-800/80 p-3 rounded-md overflow-auto text-slate-800 dark:text-slate-300 max-h-64 shadow-inner">
                  {optResult.aiSuggestion.suggested_query}
                </pre>
              </div>

              <div className="border border-slate-200 dark:border-slate-700/60 rounded-lg p-4 bg-white dark:bg-slate-900/50 shadow-sm transition-colors">
                <p className="text-xs font-bold text-slate-900 dark:text-white mb-2 uppercase tracking-wider">Reduced Sample Validation</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">{optResult.reducedValidation.message}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2 bg-slate-50 dark:bg-slate-950/40 shadow-sm">
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-500">Limit</span>
                    <div className="text-slate-800 dark:text-slate-200 font-medium mt-0.5">{optResult.reducedValidation.limit}</div>
                  </div>
                  <div className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2 bg-slate-50 dark:bg-slate-950/40 shadow-sm">
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-500">Executed</span>
                    <div className="text-slate-800 dark:text-slate-200 font-medium mt-0.5">
                      {optResult.reducedValidation.executedOnSnowflake ? 'Yes (Snowflake)' : 'No'}
                    </div>
                  </div>
                  <div className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2 bg-slate-50 dark:bg-slate-950/40 shadow-sm">
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-500">Columns</span>
                    <div className="text-slate-800 dark:text-slate-200 font-medium mt-0.5">{flag(optResult.reducedValidation.columnsMatch)}</div>
                  </div>
                  <div className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2 bg-slate-50 dark:bg-slate-950/40 shadow-sm">
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-500">Exact</span>
                    <div className="text-slate-800 dark:text-slate-200 font-medium mt-0.5">{flag(optResult.reducedValidation.exactSampleMatch)}</div>
                  </div>
                </div>

                {(optResult.reducedValidation.originalValidationSource ||
                  optResult.reducedValidation.suggestedValidationSource) && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2.5 bg-slate-50 dark:bg-slate-950/40 shadow-sm">
                      <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-500 mb-1">Original Validation Derivation</div>
                      <div className="text-slate-800 dark:text-slate-300 font-mono text-[11px]">
                        {optResult.reducedValidation.originalValidationSource || '-'}
                      </div>
                    </div>
                    <div className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2.5 bg-slate-50 dark:bg-slate-950/40 shadow-sm">
                      <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-500 mb-1">Suggested Validation Derivation</div>
                      <div className="text-slate-800 dark:text-slate-300 font-mono text-[11px]">
                        {optResult.reducedValidation.suggestedValidationSource || '-'}
                      </div>
                    </div>
                  </div>
                )}

                {(optResult.reducedValidation.originalValidationQuery ||
                  optResult.reducedValidation.suggestedValidationQuery) && (
                  <details className="mt-4 border border-slate-200 dark:border-slate-700/60 rounded-md p-3 bg-slate-50 dark:bg-slate-900/40 transition-colors">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-600 dark:text-slate-300 outline-none">
                      Derived Validation Queries (Executed on Snowflake when available)
                    </summary>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Original Validation Query</div>
                        <pre className="text-xs bg-slate-200/50 dark:bg-black/40 border border-slate-300/50 dark:border-slate-800/80 p-3 rounded-md overflow-auto text-slate-800 dark:text-slate-300 max-h-56 shadow-inner">
                          {optResult.reducedValidation.originalValidationQuery || '(not derived)'}
                        </pre>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Suggested Validation Query</div>
                        <pre className="text-xs bg-slate-200/50 dark:bg-black/40 border border-slate-300/50 dark:border-slate-800/80 p-3 rounded-md overflow-auto text-slate-800 dark:text-slate-300 max-h-56 shadow-inner">
                          {optResult.reducedValidation.suggestedValidationQuery || '(not derived)'}
                        </pre>
                      </div>
                    </div>
                  </details>
                )}
              </div>

              <details className="border border-slate-200 dark:border-slate-700/60 rounded-lg p-3 bg-white dark:bg-slate-900/40 shadow-sm transition-colors">
                <summary className="cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none">EXPLAIN Plans (Original vs Suggested)</summary>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
                  <pre className="text-xs bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-slate-800/80 p-3 rounded-md overflow-auto text-slate-800 dark:text-slate-300 max-h-64 shadow-inner">
                    {optResult.originalExplainText}
                  </pre>
                  <pre className="text-xs bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-slate-800/80 p-3 rounded-md overflow-auto text-slate-800 dark:text-slate-300 max-h-64 shadow-inner">
                    {optResult.suggestedExplainText}
                  </pre>
                </div>
              </details>
            </div>
          )}
        </div>
      )}

      {/* Ask Follow-up Chat */}
      <div className="bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/50 p-5 shadow-sm transition-colors">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h4 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wider">Ask Follow-up</h4>
          {chatLoading && <span className="text-xs font-semibold text-blue-600 dark:text-cyan-400 animate-pulse">Cortex is thinking...</span>}
        </div>

        {chatMessages.length > 0 && (
          <div className="space-y-3 mb-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
            {chatMessages.map((m, idx) => (
              <div
                key={idx}
                className={`rounded-xl border p-3.5 text-xs shadow-sm transition-colors ${
                  m.role === 'user'
                    ? 'bg-blue-50 dark:bg-cyan-950/20 border-blue-200 dark:border-cyan-800/40 text-blue-900 dark:text-cyan-100 ml-6 rounded-tr-sm'
                    : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 mr-6 rounded-tl-sm'
                }`}
              >
                <div className="uppercase tracking-wider font-bold text-[10px] mb-1.5 opacity-60">{m.role}</div>
                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <textarea
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            placeholder="Ask a question about this widget, the evidence, or a recommendation..."
            className="w-full min-h-24 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-600 shadow-inner transition-all"
          />
          <div className="flex items-center justify-between gap-4">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Uses current widget data sample + current AI insight as context.
            </p>
            <button
              type="button"
              onClick={sendFollowUp}
              disabled={chatLoading || !followUp.trim() || !insight}
              className="inline-flex items-center rounded-lg border border-blue-300 dark:border-cyan-700/50 bg-blue-600 dark:bg-cyan-950/30 px-4 py-2 text-xs font-bold tracking-wide uppercase text-white dark:text-cyan-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 dark:hover:bg-cyan-900/40 shadow-md transition-colors"
            >
              Ask Cortex
            </button>
          </div>
          {chatError && (
            <div className="text-xs text-red-700 dark:text-red-300 border border-red-300 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 rounded-lg px-3 py-2.5 mt-2 shadow-sm">
              {chatError}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function flag(v: boolean | undefined): string {
  if (typeof v === 'undefined') return '-'
  return v ? 'Yes' : 'No'
}
// ✨ FIX: Custom lightweight Markdown parser for chat messages
function FormattedMessage({ text }: { text: string }) {
  // Split the text by bold (**text**) or inline code (`text`)
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-bold text-slate-900 dark:text-white">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={i} className="px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-black/30 font-mono text-[11px] text-blue-700 dark:text-cyan-300">
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

async function readNdjsonStream(
  response: Response,
  handlers: {
    onStage?: (stage: QueryOptimizationResult['agenticFlow']['stages'][number]) => void
    onResult?: (result: unknown) => void
    onError?: (message: string) => void
  }
): Promise<void> {
  if (!response.body) {
    throw new Error('Streaming response body is not available')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let sawResult = false

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let newlineIndex = buffer.indexOf('\n')
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim()
      buffer = buffer.slice(newlineIndex + 1)
      if (line) {
        let event: any
        try {
          event = JSON.parse(line)
        } catch {
          throw new Error(`Invalid stream event: ${line.slice(0, 200)}`)
        }

        if (event?.type === 'stage' && event.stage) {
          handlers.onStage?.(event.stage)
        } else if (event?.type === 'result') {
          sawResult = true
          handlers.onResult?.(event.result)
        } else if (event?.type === 'error') {
          handlers.onError?.(String(event.error || 'Failed to optimize query'))
          return
        }
      }
      newlineIndex = buffer.indexOf('\n')
    }
  }

  const tail = buffer.trim()
  if (tail) {
    try {
      const event = JSON.parse(tail)
      if (event?.type === 'stage' && event.stage) handlers.onStage?.(event.stage)
      else if (event?.type === 'result') {
        sawResult = true
        handlers.onResult?.(event.result)
      } else if (event?.type === 'error') {
        handlers.onError?.(String(event.error || 'Failed to optimize query'))
        return
      }
    } catch {
      throw new Error(`Invalid trailing stream event: ${tail.slice(0, 200)}`)
    }
  }

  if (!response.ok && !sawResult) {
    throw new Error('Failed to optimize query')
  }
}

async function readResponsePayload(response: Response): Promise<any> {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { _rawText: text }
  }
}

function extractErrorMessage(payload: any, fallback: string): string {
  if (!payload) return fallback
  if (typeof payload === 'string') return payload
  if (typeof payload?.error === 'string') return payload.error
  if (typeof payload?.error?.message === 'string') return payload.error.message
  if (typeof payload?._rawText === 'string') return payload._rawText
  return fallback
}