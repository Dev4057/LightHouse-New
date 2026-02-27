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
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex items-center gap-2 text-slate-400">
          <div className="w-4 h-4 bg-slate-700 rounded-full animate-pulse" />
          <span className="text-sm">Generating insights...</span>
        </div>
      </div>
    )
  }

  if (error || !insight) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error || 'No insights available'}
        </div>
      </div>
    )
  }

  const signalIcon = {
    high: <AlertCircle className="w-4 h-4 text-red-400" />,
    medium: <TrendingUp className="w-4 h-4 text-yellow-400" />,
    low: <Zap className="w-4 h-4 text-blue-400" />,
  }

  const signalColor = {
    high: 'text-red-400',
    medium: 'text-yellow-400',
    low: 'text-blue-400',
  }

  const decisionBg = {
    action_required: 'bg-red-900/20 border-red-700/30',
    monitor: 'bg-yellow-900/20 border-yellow-700/30',
    no_material_insight: 'bg-slate-700/20 border-slate-600/30',
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
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h3 className="font-semibold text-white mb-1">AI Insights</h3>
            <p className="text-sm text-slate-400">{insight.summary}</p>
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded ${signalColor[insight.signal]}`}>
            {signalIcon[insight.signal]}
            <span className="text-xs font-medium capitalize">{insight.signal} Priority</span>
          </div>
        </div>

        {/* Decision */}
        <div className={`rounded border p-3 mt-3 ${decisionBg[insight.decision]}`}>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium text-slate-200">
              {decisionText[insight.decision]}
            </span>
          </div>
        </div>
      </div>

      {/* Findings */}
      {insight.findings && insight.findings.length > 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <h4 className="font-semibold text-white mb-3 text-sm">Findings</h4>
          <div className="space-y-3">
            {insight.findings.map((finding, idx) => (
              <div key={idx} className="border border-slate-700 rounded-lg p-3 bg-slate-900/50">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="font-medium text-white text-sm">{finding.title}</p>
                  <div className="flex gap-2 text-xs">
                    <span className={`px-2 py-1 rounded ${
                      finding.impact === 'high' ? 'bg-red-900/30 text-red-300' :
                      finding.impact === 'medium' ? 'bg-yellow-900/30 text-yellow-300' :
                      'bg-blue-900/30 text-blue-300'
                    }`}>
                      {finding.impact} impact
                    </span>
                    <span className="px-2 py-1 rounded bg-slate-700 text-slate-200">
                      {finding.confidence} confidence
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-300 mb-2">
                  <strong>Pattern:</strong> {finding.pattern}
                </p>
                <p className="text-xs text-slate-400">{finding.evidence}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {insight.recommendations && insight.recommendations.length > 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <h4 className="font-semibold text-white mb-3 text-sm">Recommendations</h4>
          <div className="space-y-3">
            {insight.recommendations.map((rec, idx) => (
              <div key={idx} className="border border-slate-700 rounded-lg p-3 bg-slate-900/50">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="font-medium text-white text-sm">{rec.action}</p>
                  <div className="flex gap-2 text-xs">
                    <span className={`px-2 py-1 rounded ${
                      rec.priority === 'P1' ? 'bg-red-900/30 text-red-300' :
                      rec.priority === 'P2' ? 'bg-yellow-900/30 text-yellow-300' :
                      'bg-blue-900/30 text-blue-300'
                    }`}>
                      {rec.priority}
                    </span>
                    <span className="px-2 py-1 rounded bg-slate-700 text-slate-200">
                      {rec.confidence} confidence
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-400">{rec.why}</p>
                {rec.whenNotToApply && (
                  <p className="text-xs text-slate-500 mt-2">
                    <strong>Exception:</strong> {rec.whenNotToApply}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested SQL */}
      {insight.suggestedSQL && insight.suggestedSQL.length > 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <h4 className="font-semibold text-white mb-3 text-sm">Validation Queries</h4>
          <div className="space-y-3">
            {insight.suggestedSQL.map((sql, idx) => (
              <div key={idx} className="border border-slate-700 rounded-lg p-3 bg-slate-900/50">
                <p className="text-xs font-medium text-white mb-2">{sql.goal}</p>
                <pre className="text-xs bg-black/50 p-2 rounded overflow-auto text-slate-300">
                  {sql.sql}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {rowHasOptimizableQuery && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h4 className="font-semibold text-white text-sm">Query Optimization Lab</h4>
              <p className="text-xs text-slate-400">
                EXPLAIN original query, Cortex rewrite suggestion, EXPLAIN rewritten query, and reduced-sample validation.
              </p>
            </div>
            <button
              type="button"
              onClick={runQueryOptimization}
              disabled={optLoading}
              className="inline-flex items-center rounded-md border border-cyan-700/50 bg-cyan-950/30 px-3 py-1.5 text-xs font-medium text-cyan-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-cyan-900/40"
            >
              {optLoading ? 'Running...' : 'Run Explain + Rewrite'}
            </button>
          </div>

          <details className="mb-3 border border-slate-700 rounded p-2 bg-slate-900/40">
            <summary className="cursor-pointer text-xs text-slate-300">Selected Query Text</summary>
            <pre className="mt-2 text-xs bg-black/40 p-2 rounded overflow-auto text-slate-300 max-h-48">
              {selectedQueryText}
            </pre>
          </details>

          {optError && (
            <div className="text-xs text-red-300 border border-red-900/40 bg-red-950/20 rounded-md px-2 py-1.5 mb-3">
              {optError}
            </div>
          )}

          {optLoading && (
            <div className="mb-3 border border-cyan-900/40 rounded-lg p-3 bg-cyan-950/10">
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-xs font-medium text-cyan-200">Agentic Flow In Progress</p>
                <span className="text-[11px] text-cyan-300/80">{elapsedSec}s elapsed</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-3">
                Streaming actual backend stages from the query optimizer route.
              </p>
              {optLiveStages.length === 0 ? (
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-cyan-600 bg-cyan-900/30 text-cyan-200 animate-pulse">
                    …
                  </span>
                  Waiting for first backend stage event...
                </div>
              ) : (
                <div className="space-y-2">
                  {optLiveStages.map((stage, idx) => {
                    const isLast = idx === optLiveStages.length - 1
                    const isFailed = stage.status === 'failed'
                    const isDone = stage.status === 'completed'
                    const isSkipped = stage.status === 'skipped'
                    return (
                      <div key={`${stage.key}-${idx}`} className="flex items-start gap-2 text-xs">
                        <span
                          className={`inline-flex mt-0.5 h-4 min-w-4 items-center justify-center rounded-full border ${
                            isDone
                              ? 'border-emerald-600 bg-emerald-900/30 text-emerald-300'
                              : isFailed
                                ? 'border-red-700 bg-red-900/20 text-red-300'
                                : isSkipped
                                  ? 'border-slate-700 bg-slate-900/40 text-slate-400'
                                  : 'border-cyan-600 bg-cyan-900/30 text-cyan-200'
                          }`}
                        >
                          {isDone ? '✓' : isFailed ? '!' : isSkipped ? '-' : '…'}
                        </span>
                        <div className="min-w-0">
                          <div className={isDone ? 'text-emerald-200' : isFailed ? 'text-red-200' : 'text-cyan-100'}>
                            {stage.label}
                          </div>
                          {stage.detail && isLast && (
                            <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{stage.detail}</div>
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
            <div className="space-y-3">
              {optResult.agenticFlow && (
                <details className="border border-slate-700 rounded p-2 bg-slate-900/40" open>
                  <summary className="cursor-pointer text-xs text-slate-300">
                    Agentic Execution Trace
                  </summary>
                  <div className="mt-2 space-y-3">
                    <div className="space-y-2">
                      {optResult.agenticFlow.stages.map((s, idx) => (
                        <div key={`${s.key}-${idx}`} className="rounded border border-slate-700 bg-slate-950/30 p-2">
                          <div className="flex items-start gap-2">
                            <span
                              className={`mt-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full border text-[10px] ${
                                s.status === 'completed'
                                  ? 'border-emerald-700/70 bg-emerald-950/40 text-emerald-300'
                                  : s.status === 'failed'
                                    ? 'border-red-700/70 bg-red-950/30 text-red-300'
                                    : 'border-slate-700 bg-slate-900/30 text-slate-400'
                              }`}
                            >
                              {s.status === 'completed' ? '✓' : s.status === 'failed' ? '!' : '-'}
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs text-slate-100">{s.label}</div>
                              {s.detail && (
                                <div className="text-[11px] text-slate-400 mt-1 whitespace-pre-wrap">
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
                      <details className="border border-slate-700 rounded p-2 bg-slate-900/30">
                        <summary className="cursor-pointer text-[11px] text-slate-300">
                          Planner Tool Trace (Source discovery / schema probes / compile-repair loop)
                        </summary>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-2">
                          <div>
                            <div className="text-[11px] text-slate-400 mb-1">Original Validation Planner</div>
                            <pre className="text-xs bg-black/40 p-2 rounded overflow-auto text-slate-300 max-h-56 whitespace-pre-wrap">
                              {(optResult.agenticFlow.plannerTrace.original || []).join('\n') || '(no trace)'}
                            </pre>
                          </div>
                          <div>
                            <div className="text-[11px] text-slate-400 mb-1">Suggested Validation Planner</div>
                            <pre className="text-xs bg-black/40 p-2 rounded overflow-auto text-slate-300 max-h-56 whitespace-pre-wrap">
                              {(optResult.agenticFlow.plannerTrace.suggested || []).join('\n') || '(no trace)'}
                            </pre>
                          </div>
                        </div>
                      </details>
                    )}
                  </div>
                </details>
              )}

              <div className="border border-slate-700 rounded-lg p-3 bg-slate-900/50">
                <p className="text-xs font-medium text-white mb-1">Estimated Runtime Change</p>
                <p className="text-xs text-slate-300">{optResult.aiSuggestion.estimated_runtime_change}</p>
                <p className="text-xs text-slate-400 mt-2">{optResult.aiSuggestion.why}</p>
              </div>

              {optResult.originalExplainSummary && (
                <details className="border border-slate-700 rounded p-2 bg-slate-900/40">
                  <summary className="cursor-pointer text-xs text-slate-300">
                    EXPLAIN Summary Used for Rewrite Prompt
                  </summary>
                  <pre className="mt-2 text-xs bg-black/40 p-2 rounded overflow-auto text-slate-300 max-h-56 whitespace-pre-wrap">
                    {optResult.originalExplainSummary}
                  </pre>
                </details>
              )}

              {optResult.aiSuggestion.likely_issues?.length > 0 && (
                <div className="border border-slate-700 rounded-lg p-3 bg-slate-900/50">
                  <p className="text-xs font-medium text-white mb-2">Likely Issues</p>
                  <ul className="list-disc pl-4 text-xs text-slate-300 space-y-1">
                    {optResult.aiSuggestion.likely_issues.map((issue, idx) => (
                      <li key={idx}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="border border-slate-700 rounded-lg p-3 bg-slate-900/50">
                <p className="text-xs font-medium text-white mb-2">Suggested Query</p>
                <pre className="text-xs bg-black/40 p-2 rounded overflow-auto text-slate-300 max-h-64">
                  {optResult.aiSuggestion.suggested_query}
                </pre>
              </div>

              <div className="border border-slate-700 rounded-lg p-3 bg-slate-900/50">
                <p className="text-xs font-medium text-white mb-2">Reduced Sample Validation</p>
                <p className="text-xs text-slate-300 mb-2">{optResult.reducedValidation.message}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="rounded border border-slate-700 px-2 py-1 bg-slate-950/40">
                    <span className="text-slate-500">Limit</span>
                    <div className="text-slate-200">{optResult.reducedValidation.limit}</div>
                  </div>
                  <div className="rounded border border-slate-700 px-2 py-1 bg-slate-950/40">
                    <span className="text-slate-500">Executed</span>
                    <div className="text-slate-200">
                      {optResult.reducedValidation.executedOnSnowflake ? 'Yes (Snowflake)' : 'No'}
                    </div>
                  </div>
                  <div className="rounded border border-slate-700 px-2 py-1 bg-slate-950/40">
                    <span className="text-slate-500">Columns</span>
                    <div className="text-slate-200">{flag(optResult.reducedValidation.columnsMatch)}</div>
                  </div>
                  <div className="rounded border border-slate-700 px-2 py-1 bg-slate-950/40">
                    <span className="text-slate-500">Exact</span>
                    <div className="text-slate-200">{flag(optResult.reducedValidation.exactSampleMatch)}</div>
                  </div>
                  <div className="rounded border border-slate-700 px-2 py-1 bg-slate-950/40">
                    <span className="text-slate-500">Normalized</span>
                    <div className="text-slate-200">{flag(optResult.reducedValidation.normalizedSetMatch)}</div>
                  </div>
                </div>

                {(optResult.reducedValidation.originalValidationSource ||
                  optResult.reducedValidation.suggestedValidationSource) && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <div className="rounded border border-slate-700 px-2 py-2 bg-slate-950/40">
                      <div className="text-slate-500 mb-1">Original Validation Derivation</div>
                      <div className="text-slate-300">
                        {optResult.reducedValidation.originalValidationSource || '-'}
                      </div>
                    </div>
                    <div className="rounded border border-slate-700 px-2 py-2 bg-slate-950/40">
                      <div className="text-slate-500 mb-1">Suggested Validation Derivation</div>
                      <div className="text-slate-300">
                        {optResult.reducedValidation.suggestedValidationSource || '-'}
                      </div>
                    </div>
                  </div>
                )}

                {(optResult.reducedValidation.originalValidationQuery ||
                  optResult.reducedValidation.suggestedValidationQuery) && (
                  <details className="mt-3 border border-slate-700 rounded p-2 bg-slate-900/40">
                    <summary className="cursor-pointer text-xs text-slate-300">
                      Derived Validation Queries (Executed on Snowflake when available)
                    </summary>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-2">
                      <div>
                        <div className="text-[11px] text-slate-400 mb-1">Original Validation Query</div>
                        <pre className="text-xs bg-black/40 p-2 rounded overflow-auto text-slate-300 max-h-56">
                          {optResult.reducedValidation.originalValidationQuery || '(not derived)'}
                        </pre>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-400 mb-1">Suggested Validation Query</div>
                        <pre className="text-xs bg-black/40 p-2 rounded overflow-auto text-slate-300 max-h-56">
                          {optResult.reducedValidation.suggestedValidationQuery || '(not derived)'}
                        </pre>
                      </div>
                    </div>
                  </details>
                )}
              </div>

              <details className="border border-slate-700 rounded p-2 bg-slate-900/40">
                <summary className="cursor-pointer text-xs text-slate-300">EXPLAIN Plans (Original vs Suggested)</summary>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-2">
                  <pre className="text-xs bg-black/40 p-2 rounded overflow-auto text-slate-300 max-h-64">
                    {optResult.originalExplainText}
                  </pre>
                  <pre className="text-xs bg-black/40 p-2 rounded overflow-auto text-slate-300 max-h-64">
                    {optResult.suggestedExplainText}
                  </pre>
                </div>
              </details>
            </div>
          )}
        </div>
      )}

      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h4 className="font-semibold text-white text-sm">Ask Follow-up</h4>
          {chatLoading && <span className="text-xs text-slate-400">Cortex is thinking...</span>}
        </div>

        {chatMessages.length > 0 && (
          <div className="space-y-2 mb-3 max-h-56 overflow-y-auto pr-1">
            {chatMessages.map((m, idx) => (
              <div
                key={idx}
                className={`rounded-lg border p-2 text-xs ${
                  m.role === 'user'
                    ? 'bg-cyan-950/20 border-cyan-800/40 text-cyan-100'
                    : 'bg-slate-900/60 border-slate-700 text-slate-200'
                }`}
              >
                <div className="uppercase tracking-wide text-[10px] mb-1 opacity-70">{m.role}</div>
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <textarea
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            placeholder="Ask a question about this widget, the evidence, or a recommendation..."
            className="w-full min-h-20 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-600"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500">
              Uses current widget data sample + current AI insight as context.
            </p>
            <button
              type="button"
              onClick={sendFollowUp}
              disabled={chatLoading || !followUp.trim() || !insight}
              className="inline-flex items-center rounded-md border border-cyan-700/50 bg-cyan-950/30 px-3 py-1.5 text-xs font-medium text-cyan-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-cyan-900/40"
            >
              Ask Cortex
            </button>
          </div>
          {chatError && (
            <div className="text-xs text-red-300 border border-red-900/40 bg-red-950/20 rounded-md px-2 py-1.5">
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
