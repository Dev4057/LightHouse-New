'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import useFetch from '@/hooks/useApi'
import DashboardLayout from '@/components/layout/DashboardLayout'
import DateRangeSelector from '@/components/dashboard/DateRangeSelector'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Loader, AlertCircle, Lightbulb, Server, Database, ShieldAlert, 
  Zap, TrendingDown, CheckCircle2, ChevronRight, Filter, FileText, 
  Settings2, Activity, PlaySquare
} from 'lucide-react'
import { formatBytes, formatNumber, shortenText } from '@/lib/formatting'
import { useSpendDisplay } from '@/hooks/useSpendDisplay'
import WidgetAIInsight from '@/components/ai/WidgetAIInsight'
import InfoTooltip from '@/components/ui/InfoTooltip'
import { useTheme } from 'next-themes'

const RECOMMENDATION_STATUS_OPTIONS = ['open', 'in_progress', 'accepted', 'done', 'snoozed', 'dismissed'] as const

// ── GLASSMORPHISM TAILWIND CLASSES ───────────────────────────────────────────
const glassCard = "bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl min-w-0 transition-all duration-300 relative z-10"
const glassHeader = "px-6 py-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-slate-50/40 dark:bg-slate-800/40 backdrop-blur-md relative z-50"
const glassFooter = "px-6 py-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md"

export default function RecommendationsPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => setMounted(true), [])
  const isDark = mounted ? resolvedTheme === 'dark' : true

  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date(),
  })

  const start = dateRange.start.toISOString().split('T')[0]
  const end = dateRange.end.toISOString().split('T')[0]

  const { data, isLoading, error, refetch: refetchRecommendations } = useFetch<any[]>(
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
        setUpdatedBy(session?.user?.name || 'web-ui')
      }
    }
  }, [selectedKey, selected, effectiveStatus, updatedBy, session])

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
          updatedBy: updatedBy || session?.user?.name || 'web-ui',
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

  const getCategoryIcon = (cat: string) => {
    const c = cat?.toUpperCase() || ''
    if (c.includes('WAREHOUSE') || c.includes('COMPUTE')) return <Server className="w-4 h-4 text-purple-500" />
    if (c.includes('STORAGE') || c.includes('DATA')) return <Database className="w-4 h-4 text-blue-500" />
    if (c.includes('SECURITY') || c.includes('ACCESS')) return <ShieldAlert className="w-4 h-4 text-red-500" />
    return <Lightbulb className="w-4 h-4 text-amber-500" />
  }

  if (sessionStatus === 'loading' || isLoading || !mounted) {
    return (
      <DashboardLayout>
        <div className="h-[70vh] flex flex-col items-center justify-center space-y-4">
          <Loader className="w-10 h-10 text-blue-500 animate-spin" />
          <p className="text-sm text-slate-500 font-medium animate-pulse">Analyzing Optimization Engine...</p>
        </div>
      </DashboardLayout>
    )
  }
  
  if (error) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-24 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800/50">
          <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
          <h3 className="text-lg font-bold text-red-700 dark:text-red-400">Failed to load recommendations</h3>
          <p className="text-sm text-red-600/80 dark:text-red-300 mt-2">{error.message}</p>
        </div>
      </DashboardLayout>
    )
  }

  const totalCredits = filtered.reduce((s, r) => s + Number(r.EST_CREDITS_SAVED_MONTHLY || 0), 0)
  const totalStorage = filtered.reduce((s, r) => s + Number(r.EST_STORAGE_BYTES_SAVED || 0), 0)
  const highPriorityCount = filtered.filter((r) => Number(r.PRIORITY_SCORE || 0) >= 80).length
  const avgPriority = filtered.length ? (filtered.reduce((s, r) => s + Number(r.PRIORITY_SCORE || 0), 0) / filtered.length).toFixed(1) : '0.0'

  return (
    <DashboardLayout>
      <div className="space-y-6 w-full min-w-0">
        
        {/* ── HEADER SECTION ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Recommendations</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
              Automated insights to optimize Snowflake costs, performance, and security. Review and apply configurations.
            </p>
          </div>
          <DateRangeSelector value={dateRange} onChange={setDateRange} />
        </div>
        
        {/* ── KPI GRID ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Active Findings', val: formatNumber(filtered.length), icon: Activity, color: 'text-blue-500' },
            { label: `Est ${creditUnitLabel} / mo`, val: formatCreditValue(totalCredits), icon: Zap, color: 'text-emerald-500' },
            { label: 'Est Storage Saved', val: formatBytes(totalStorage), icon: Database, color: 'text-teal-500' },
            { label: 'Avg Priority', val: avgPriority, icon: TrendingDown, color: 'text-amber-500' },
            { label: 'High Priority (80+)', val: formatNumber(highPriorityCount), icon: ShieldAlert, color: 'text-red-500' },
          ].map((item, i) => (
            <Card key={i} className={`${glassCard} p-5 hover:-translate-y-1 flex flex-col justify-center`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg bg-slate-500/10 border border-slate-500/20 backdrop-blur-sm`}>
                  <item.icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">{item.label}</p>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white truncate">{item.val}</p>
            </Card>
          ))}
        </div>

        {/* ── FILTER BAR ── */}
        <Card className={glassCard}>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col md:flex-row md:items-end gap-4">
              <div className="flex-1 space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Category</label>
                <div className="relative">
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full appearance-none bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-sm rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all">
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              
              <div className="flex-1 space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</label>
                <div className="relative">
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full appearance-none bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-sm rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all">
                    {['All', 'open', 'in_progress', 'accepted', 'done', 'snoozed', 'dismissed'].map((s) => <option key={s} value={s}>{s.replace('_', ' ').toUpperCase()}</option>)}
                  </select>
                  <Settings2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="flex-1 space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Min Priority</label>
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">{minPriority}</span>
                </div>
                <div className="h-[42px] flex items-center bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg px-4">
                  <input type="range" min={0} max={100} value={minPriority} onChange={(e) => setMinPriority(Number(e.target.value))} className="w-full accent-blue-500" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── TRIAGE INBOX (MASTER-DETAIL) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
          
          {/* LEFT PANE: The Inbox List */}
          <Card className={`${glassCard} lg:col-span-5 flex flex-col`}>
            <CardHeader className={glassHeader}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 border-l-2 border-blue-500 pl-3">
                  <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    Action Inbox
                  </CardTitle>
                  <InfoTooltip text="Your prioritized to-do list. The AI scanner automatically ranks these tasks so you can focus on the fixes that will save you the most money or block the biggest security holes first." />
                </div>
                <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold px-2.5 py-1 rounded-full">
                  {filtered.length} Items
                </span>
              </div>
            </CardHeader>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1 bg-slate-50/30 dark:bg-slate-900/10 h-[500px]">
              {filtered.length > 0 ? (
                filtered.map((r, i) => {
                  const key = `${r.RUN_DATE}|${r.FINDING_ID}`
                  const active = (selected ? `${selected.RUN_DATE}|${selected.FINDING_ID}` : selectedKey) === key
                  const priority = Number(r.PRIORITY_SCORE || 0)
                  
                  return (
                    <div 
                      key={i} 
                      onClick={() => setSelectedKey(key)}
                      className={`
                        p-4 rounded-xl border cursor-pointer transition-all duration-200 flex flex-col gap-3
                        ${active 
                          ? 'bg-white dark:bg-slate-800 border-blue-300 dark:border-blue-600 shadow-[0_4px_20px_rgba(59,130,246,0.15)]' 
                          : 'bg-white/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-blue-300/50 dark:hover:border-blue-500/50 hover:bg-white dark:hover:bg-slate-800/80'}
                      `}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg border bg-slate-50 dark:bg-slate-900 ${active ? 'border-blue-200 dark:border-blue-800/50' : 'border-slate-200 dark:border-slate-700'}`}>
                          {getCategoryIcon(r.CATEGORY)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                              String(r.CURRENT_STATUS || r.STATUS) === 'open' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400' :
                              String(r.CURRENT_STATUS || r.STATUS) === 'done' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400' :
                              'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                            }`}>
                              {String(r.CURRENT_STATUS || r.STATUS || 'open').replace('_', ' ')}
                            </span>
                            <span className={`text-xs font-black ${priority >= 80 ? 'text-red-500' : priority >= 50 ? 'text-amber-500' : 'text-blue-500'}`}>
                              P{priority.toFixed(0)}
                            </span>
                          </div>
                          <h4 className={`text-sm font-semibold truncate ${active ? 'text-blue-700 dark:text-blue-400' : 'text-slate-900 dark:text-slate-200'}`}>
                            {r.TITLE || r.ENTITY_NAME || 'Optimization Opportunity'}
                          </h4>
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-4 opacity-50" />
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Inbox Zero</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">No recommendations match your current filters.</p>
                </div>
              )}
            </div>
          </Card>

          {/* RIGHT PANE: The Action Panel */}
          <Card className={`${glassCard} lg:col-span-7 flex flex-col`}>
            {selected ? (
              <>
                {/* Detail Header */}
                <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/50 bg-white/40 dark:bg-slate-800/40 relative z-50">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-mono font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">
                      ID: {selected.FINDING_ID?.split('-')[0] || 'OPT'}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-2 py-1">
                      {selected.CATEGORY} / {selected.SUBTYPE}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{selected.TITLE}</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                    {selected.SUMMARY || selected.DESCRIPTION || 'Review this asset for potential configuration improvements.'}
                  </p>
                </div>

                {/* Detail Content (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white/20 dark:bg-transparent h-[300px]">
                  
                  {/* Quick Stats Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 shadow-sm">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Target Entity</p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate" title={selected.ENTITY_NAME}>{selected.ENTITY_NAME || '-'}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 shadow-sm">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Confidence</p>
                      <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">{(Number(selected.CONFIDENCE_SCORE || 0) * 100).toFixed(0)}%</p>
                    </div>
                    <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 shadow-sm">
                      <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider mb-1">Est. Savings</p>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{formatCreditValue(Number(selected.EST_CREDITS_SAVED_MONTHLY || 0))} /mo</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 shadow-sm">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Storage Impact</p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-300">{formatBytes(Number(selected.EST_STORAGE_BYTES_SAVED || 0))}</p>
                    </div>
                  </div>

                  {/* Evidence Accordions */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400" /> Supporting Evidence
                    </h3>
                    <div className="space-y-3">
                      {(evidence || []).length === 0 ? (
                        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-sm text-slate-500">
                          No detailed execution logs attached to this finding.
                        </div>
                      ) : (
                        (evidence || []).map((ev, i) => (
                          <details key={i} className="group border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900/50 overflow-hidden [&_summary::-webkit-details-marker]:hidden">
                            <summary className="flex items-center justify-between cursor-pointer p-4 select-none">
                              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                <PlaySquare className="w-4 h-4 text-blue-500" />
                                {ev.EVIDENCE_KIND || 'System Log'} 
                                <span className="text-xs font-normal text-slate-400">({ev.CREATED_AT ? new Date(ev.CREATED_AT).toLocaleDateString() : 'Recent'})</span>
                              </span>
                              <ChevronRight className="w-4 h-4 text-slate-400 group-open:rotate-90 transition-transform duration-200" />
                            </summary>
                            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-black/50">
                              <pre className="text-xs text-slate-600 dark:text-slate-400 font-mono whitespace-pre-wrap break-words">
                                {typeof ev.EVIDENCE_JSON === 'string' ? ev.EVIDENCE_JSON : JSON.stringify(ev.EVIDENCE_JSON, null, 2)}
                              </pre>
                            </div>
                          </details>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Detail Footer (Action Controls) */}
                <div className={glassFooter}>
                  <div className="flex flex-col sm:flex-row gap-4 items-end">
                    
                    <div className="flex-1 w-full space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Assigned To</label>
                          <input
                            value={updatedBy}
                            onChange={(e) => setUpdatedBy(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-sm rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                            placeholder="e.g. John Doe"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status Override</label>
                          <select
                            value={pendingStatus}
                            onChange={(e) => setPendingStatus(e.target.value)}
                            className="w-full appearance-none bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-sm rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                          >
                            {RECOMMENDATION_STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>{s.replace('_', ' ').toUpperCase()}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Resolution Notes</label>
                        <input
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-sm rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                          placeholder="Add ticket number or remediation context..."
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => saveFeedback(pendingStatus)}
                        disabled={saveBusy}
                        className="w-full sm:w-32 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-md shadow-md transition-all disabled:opacity-50"
                      >
                        {saveBusy ? 'Saving...' : 'Apply Status'}
                      </button>
                      <div className="flex gap-2">
                        <button onClick={() => saveFeedback('accepted')} disabled={saveBusy} className="flex-1 py-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 text-xs font-bold rounded transition-colors">
                          Accept
                        </button>
                        <button onClick={() => saveFeedback('dismissed')} disabled={saveBusy} className="flex-1 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 text-xs font-bold rounded transition-colors">
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Feedback Messages */}
                  {(saveMessage || saveError || selected.FEEDBACK_NOTE) && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
                      {saveMessage && <p className="text-emerald-600 dark:text-emerald-400 font-medium mb-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {saveMessage}</p>}
                      {saveError && <p className="text-red-600 dark:text-red-400 font-medium mb-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {saveError}</p>}
                      {selected.FEEDBACK_NOTE && <p className="text-slate-500 dark:text-slate-400 italic">Latest Note: {selected.FEEDBACK_NOTE}</p>}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <FileText className="w-16 h-16 text-slate-300 dark:text-slate-700 mb-4" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-200">Select a Finding</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-sm">Click on any recommendation in the inbox to view detailed evidence and execution plans.</p>
              </div>
            )}
          </Card>
        </div>

        {/* ── CATEGORY BREAKDOWN ── */}
        <Card className={glassCard}>
          <CardHeader className={glassHeader}>
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Recommendations by Category
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Distribution of filtered recommendations across optimization areas
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {categoryGroups.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {categoryGroups.map(([groupCategory, items]) => (
                  <div key={groupCategory} className="bg-white/50 dark:bg-slate-900/50 rounded-xl p-5 border border-slate-200 dark:border-slate-700/50 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                        {getCategoryIcon(groupCategory)}
                        {groupCategory}
                      </h4>
                      <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2.5 py-0.5 rounded text-xs font-black">
                        {items.length}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                        <span>Avg Priority</span>
                        <span className="text-amber-600 dark:text-amber-400 font-bold">
                          {(items.reduce((sum, i) => sum + Number(i.PRIORITY_SCORE || 0), 0) / items.length).toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                        <span>Est {creditUnitLabel}/mo</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          {formatCreditValue(items.reduce((sum, i) => sum + Number(i.EST_CREDITS_SAVED_MONTHLY || 0), 0))}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-slate-400 py-8 text-sm">No category breakdown available</div>
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
    </DashboardLayout>
  )
}