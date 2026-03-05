'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { DualAxisChart, HeatmapChart } from '@/components/ui/AdvancedCharts'
import useFetch from '@/hooks/useApi'
import { Terminal, Database, User, Copy, Activity, Search, FileQuestion, Clock } from 'lucide-react'
import { formatSeconds, formatBytes, shortenText } from '@/lib/formatting'
import { useSpendDisplay } from '@/hooks/useSpendDisplay'
import WidgetAIInsight from '@/components/ai/WidgetAIInsight'
import QueryDetailModal from '@/components/ui/QueryDetailModal'
import type { QueryType, QueryUser, ExpensiveQuery, QueryTrend, HeatmapData, SpillQuery, PartitionPruningQuery, HighFrequencyQuery, Query } from '@/types'

interface QueriesPageProps {
  dateRange: { start: Date; end: Date }
}

const glassTooltipStyle = {
  backgroundColor: 'rgba(15, 23, 42, 0.95)',
  backdropFilter: 'blur(16px)',
  border: '1px solid rgba(51, 65, 85, 0.8)',
  borderRadius: '8px',
  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
  color: '#f8fafc',
  fontSize: '12px'
}

// ==========================================
// REUSABLE COMPONENTS
// ==========================================

const EmptyState = ({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center w-full">
    <div className="w-10 h-10 rounded-full bg-slate-800/50 flex items-center justify-center mb-3 border border-slate-700/50">
      <Icon className="w-5 h-5 text-slate-500" />
    </div>
    <h4 className="text-sm font-semibold text-slate-200">{title}</h4>
    <p className="text-xs text-slate-400 mt-1 max-w-xs">{desc}</p>
  </div>
)

const SkeletonCard = ({ className = "" }: { className?: string }) => (
  <Card className={`bg-slate-900/60 border-slate-700/60 p-6 ${className}`}>
    <div className="h-4 w-1/3 bg-slate-800 rounded animate-pulse mb-2" />
    <div className="h-3 w-1/2 bg-slate-800 rounded animate-pulse mb-6" />
    <div className="h-64 w-full bg-slate-800/50 rounded animate-pulse" />
  </Card>
)

// Horizontal-scroll wrapper for tables.
// min-w-0 + max-w-full keeps it bounded inside any flex/grid parent.
// Tables inside should set their own min-w-[Npx] to trigger the scroll.
const TableScroll = ({ children, maxHeight }: { children: React.ReactNode, maxHeight?: string }) => (
  <div
    className="w-full min-w-0 max-w-full overflow-x-auto"
    style={{ maxHeight: maxHeight ?? 'none', overflowY: maxHeight ? 'auto' : 'visible' }}
  >
    {children}
  </div>
)

// ==========================================
// MAIN PAGE
// ==========================================

export default function ComprehensiveQueriesPage({ dateRange }: QueriesPageProps) {
  const [selectedQuery, setSelectedQuery] = useState<ExpensiveQuery | SpillQuery | PartitionPruningQuery | Query | null>(null)
  const { formatCreditValue, creditUnitLabel } = useSpendDisplay()
  const startDate = dateRange.start.toISOString().split('T')[0]
  const endDate = dateRange.end.toISOString().split('T')[0]

  const { data: queryTypeData, isLoading: loadingQType } = useFetch<QueryType[]>(['q-type', startDate, endDate], `/api/queries?type=by-type&start=${startDate}&end=${endDate}`)
  const { data: queryUserData, isLoading: loadingQUser } = useFetch<QueryUser[]>(['q-user', startDate, endDate], `/api/queries?type=by-user&start=${startDate}&end=${endDate}`)
  const { data: expensiveData, isLoading: loadingExpensive } = useFetch<ExpensiveQuery[]>(['q-expensive', startDate, endDate], `/api/queries?type=expensive&start=${startDate}&end=${endDate}&limit=20`)
  const { data: longestData, isLoading: loadingLongest } = useFetch<Query[]>(['q-longest', startDate, endDate], `/api/queries?type=longest&start=${startDate}&end=${endDate}&limit=20`)
  const { data: trendData, isLoading: loadingTrend } = useFetch<QueryTrend[]>(['q-trend', startDate, endDate], `/api/queries?type=trend&start=${startDate}&end=${endDate}`)
  const { data: heatmapData, isLoading: loadingHeatmap } = useFetch<HeatmapData[]>(['q-heatmap', startDate, endDate], `/api/queries?type=heatmap&start=${startDate}&end=${endDate}`)
  const { data: spillData, isLoading: loadingSpill } = useFetch<SpillQuery[]>(['q-spill', startDate, endDate], `/api/queries?type=spill&start=${startDate}&end=${endDate}&limit=10`)
  const { data: pruneData, isLoading: loadingPrune } = useFetch<PartitionPruningQuery[]>(['q-prune', startDate, endDate], `/api/queries?type=prune&start=${startDate}&end=${endDate}&limit=10`)
  const { data: highFreqData, isLoading: loadingHighFreq } = useFetch<HighFrequencyQuery[]>(['q-highfreq', startDate, endDate], `/api/queries?type=high-frequency&start=${startDate}&end=${endDate}`)

  const isLoading = loadingQType || loadingQUser || loadingExpensive || loadingLongest || loadingTrend || loadingHeatmap || loadingSpill || loadingPrune || loadingHighFreq

  const hasData = useMemo(() => {
    return !!(queryTypeData?.length || queryUserData?.length || expensiveData?.length || longestData?.length || trendData?.length)
  }, [queryTypeData, queryUserData, expensiveData, longestData, trendData])

  const copyToClipboard = (e: React.MouseEvent, text: string) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text)
  }

  const maxExpensiveCost = useMemo(() => {
    if (!expensiveData || expensiveData.length === 0) return 1
    return Math.max(...expensiveData.map(q => Number(q.CREDITS_ATTRIBUTED_COMPUTE || 0)))
  }, [expensiveData])

  if (isLoading) {
    return (
      <div className="space-y-8 w-full min-w-0 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonCard /><SkeletonCard />
        </div>
        <SkeletonCard className="h-[400px]" />
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-slate-900/40 backdrop-blur-md rounded-xl border border-slate-700/50 w-full">
        <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4 border border-slate-700">
          <Search className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-100">No Query Data Found</h3>
        <p className="text-slate-400 mt-1 text-sm text-center px-4">Try expanding your selected date range to view system workloads.</p>
      </div>
    )
  }

  // overflow-hidden on every card is the key containment fix —
  // no child (chart, table) can bleed outside and widen the page.
const cardClass = "bg-slate-900/40 backdrop-blur-xl border-slate-700/50 shadow-xl overflow-hidden min-w-0 w-full flex flex-col";
  const thClass = "py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap"
  const tdClass = "py-3 px-4 text-xs"

  return (
    // overflow-hidden on the root is the ultimate safety net.
    <div className="space-y-8 w-full min-w-0 overflow-hidden">

      {/* ── SECTION 1: TIMING & PERFORMANCE ── */}
      <div className="border-b border-slate-800 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">

          {/* Avg Execution Time by Query Type */}
          <Card className={cardClass}>
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold text-slate-100 uppercase tracking-wider border-l-2 border-blue-500 pl-3">
                Avg Execution Time by Query Type
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 pl-3.5 mt-1">
                Avg seconds per query type operations
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 flex-1 flex flex-col min-w-0">
              {queryTypeData && queryTypeData.length > 0 ? (
                // Fixed pixel height + overflow-hidden prevents ResponsiveContainer grow loops
                <div className="w-full overflow-hidden" style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={queryTypeData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                      <defs>
                        <linearGradient id="qTypeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#1e3a8a" stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="QUERY_TYPE" stroke="#64748b" axisLine={{ stroke: '#475569' }} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} dy={10} tickFormatter={(val) => val.length > 10 ? `${val.substring(0, 10)}...` : val} />
                      <YAxis stroke="#64748b" axisLine={{ stroke: '#475569' }} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} width={60} label={{ value: 'Seconds', angle: -90, position: 'insideLeft', offset: 15, fill: '#64748b', fontSize: 11, fontWeight: 600 }} />
                      <Tooltip contentStyle={glassTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} formatter={(value) => [formatSeconds(value as number), 'Avg Time']} />
                      <Bar dataKey="AVERAGE_EXECUTION_SECONDS" fill="url(#qTypeGrad)" radius={[2, 2, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState icon={Activity} title="No Execution Data" desc="Not enough queries to calculate averages." />
              )}
              <div className="mt-4 pt-4 border-t border-slate-800/50">
                <WidgetAIInsight title="Avg Execution Time by Query Type" widgetType="query_performance" dateRange={dateRange} widgetId="qtype_timing" widgetKind="chart" templateKey="query_type_timing" dataSample={queryTypeData?.slice(0, 25) ?? []} />
              </div>
            </CardContent>
          </Card>

          {/* Avg Execution Time by User */}
          <Card className={cardClass}>
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold text-slate-100 uppercase tracking-wider border-l-2 border-teal-500 pl-3">
                Avg Execution Time by User
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 pl-3.5 mt-1">
                Avg execution time by top user accounts
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 flex-1 flex flex-col min-w-0">
              {queryUserData && queryUserData.length > 0 ? (
                <div className="w-full overflow-hidden" style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={queryUserData.slice(0, 25)} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                      <defs>
                        <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#115e59" stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="USER_NAME" stroke="#64748b" axisLine={{ stroke: '#475569' }} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} dy={10} tickFormatter={(val) => val.length > 10 ? `${val.substring(0, 10)}...` : val} />
                      <YAxis stroke="#64748b" axisLine={{ stroke: '#475569' }} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} width={60} label={{ value: 'Seconds', angle: -90, position: 'insideLeft', offset: 15, fill: '#64748b', fontSize: 11, fontWeight: 600 }} />
                      <Tooltip contentStyle={glassTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} formatter={(value) => [formatSeconds(value as number), 'Avg Time']} />
                      <Bar dataKey="AVERAGE_EXECUTION_SECONDS" fill="url(#userGrad)" radius={[2, 2, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState icon={User} title="No User Data" desc="No user metrics detected." />
              )}
              <div className="mt-4 pt-4 border-t border-slate-800/50">
                <WidgetAIInsight title="Average Execution Time by User" widgetType="query_performance" dateRange={dateRange} widgetId="quser_timing" widgetKind="chart" templateKey="user_timing" dataSample={queryUserData?.slice(0, 25) ?? []} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── SECTION 2: TRENDS & HEATMAP ── */}
      <div className="border-b border-slate-800 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">

          <Card className={cardClass}>
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold text-slate-100 uppercase tracking-wider border-l-2 border-indigo-500 pl-3">
                Query Load & Trend
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 pl-3.5 mt-1">
                Volume and performance timeline
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 flex-1 flex flex-col min-w-0">
              {trendData && trendData.length > 0 ? (
                <div className="w-full overflow-hidden" style={{ height: 320 }}>
                  <DualAxisChart data={trendData} xKey="QUERY_DAY" barKey="QUERY_COUNT" lineKey="AVG_SECONDS" barLabel="Total Queries" lineLabel="Avg Seconds" height={320} />
                </div>
              ) : (
                <EmptyState icon={Activity} title="No Timeline Data" desc="No trend history available." />
              )}
              <div className="mt-4 pt-4 border-t border-slate-800/50">
                <WidgetAIInsight title="Query Load & Performance Daily Trend" widgetType="query_performance" dateRange={dateRange} widgetId="query_trend" widgetKind="chart" templateKey="query_trend" dataSample={trendData?.slice(0, 60) ?? []} />
              </div>
            </CardContent>
          </Card>

          <Card className={cardClass}>
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold text-slate-100 uppercase tracking-wider border-l-2 border-indigo-500 pl-3">
                Workload Heatmap
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 pl-3.5 mt-1">
                Hourly query volume distribution
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 flex-1 flex flex-col min-w-0">
              {heatmapData && heatmapData.length > 0 ? (
                <div className="w-full overflow-hidden" style={{ height: 320 }}>
                  <HeatmapChart data={heatmapData} height={320} />
                </div>
              ) : (
                <EmptyState icon={Activity} title="No Hourly Data" desc="No patterns detected for this range." />
              )}
              <div className="mt-4 pt-4 border-t border-slate-800/50">
                <WidgetAIInsight title="Workload by Day & Hour" widgetType="query_performance" dateRange={dateRange} widgetId="query_heatmap" widgetKind="chart" templateKey="workload_heatmap" dataSample={heatmapData?.slice(0, 120) ?? []} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── SECTION 3: TABLES ── */}
      <div className="space-y-8">

        {/* Most Expensive Queries */}
        <Card className={cardClass}>
          <CardHeader className="pb-4 border-b border-slate-800">
            <CardTitle className="text-sm font-semibold text-slate-100 uppercase tracking-wider border-l-2 border-amber-500 pl-3">
              Most Expensive Queries
            </CardTitle>
            <CardDescription className="text-xs text-slate-400 pl-3.5 mt-1">
              Top queries driving compute costs — investigate patterns and missing filters
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 min-w-0">
            {expensiveData && expensiveData.length > 0 ? (
              <TableScroll maxHeight="500px">
                {/* min-w triggers horizontal scroll on narrow viewports instead of squashing columns */}
                <table className="min-w-[640px] w-full text-sm text-left">
                  <thead className="bg-slate-950/80 sticky top-0 z-10 border-b border-slate-800">
                    <tr>
                      <th className={`${thClass} w-10 text-center`}>#</th>
                      <th className={thClass}>Query</th>
                      <th className={`${thClass} hidden md:table-cell`}>Timestamp</th>
                      <th className={`${thClass} hidden sm:table-cell`}>User</th>
                      <th className={`${thClass} hidden lg:table-cell`}>Warehouse</th>
                      <th className={`${thClass} text-right hidden sm:table-cell`}>Duration</th>
                      <th className={`${thClass} text-right`}>Cost ({creditUnitLabel})</th>
                      <th className={`${thClass} text-right`}>AI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expensiveData.map((q, i) => {
                      const currentCost = Number(q.CREDITS_ATTRIBUTED_COMPUTE || 0)
                      const costPct = Math.min(100, Math.max(2, (currentCost / maxExpensiveCost) * 100))
                      return (
                        <tr key={(q as any).QUERY_ID || i} className="even:bg-slate-900/40 hover:bg-slate-800/60 transition-colors group border-b border-slate-800/50 last:border-0">
                          <td className={`${tdClass} text-center text-slate-500 font-medium`}>{i + 1}</td>
                          <td className={`${tdClass} max-w-[200px]`}>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2 cursor-pointer" onClick={() => setSelectedQuery(q)}>
                                <Terminal className="w-3 h-3 text-slate-500 shrink-0" />
                                <span className="truncate text-slate-100 font-mono text-[11px] group-hover:text-blue-400 transition-colors" title={q.QUERY_TEXT}>
                                  {shortenText(q.QUERY_TEXT, 60)}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 pl-5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => copyToClipboard(e, q.QUERY_TEXT)} className="text-[10px] text-slate-500 hover:text-blue-400 flex items-center gap-1"><Copy className="w-3 h-3" /> SQL</button>
                                {(q as any).QUERY_ID && <button onClick={(e) => copyToClipboard(e, (q as any).QUERY_ID)} className="text-[10px] text-slate-500 hover:text-blue-400 flex items-center gap-1"><Copy className="w-3 h-3" /> ID</button>}
                              </div>
                            </div>
                          </td>
                          <td className={`${tdClass} text-slate-400 hidden md:table-cell whitespace-nowrap`}>
                            {(q as any).START_TIME ? new Date((q as any).START_TIME).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                          </td>
                          <td className={`${tdClass} hidden sm:table-cell`}>
                            <div className="flex items-center gap-1.5 text-slate-300"><User className="w-3 h-3 text-slate-500 shrink-0" /><span className="text-[11px] truncate max-w-[100px]">{q.USER_NAME}</span></div>
                          </td>
                          <td className={`${tdClass} hidden lg:table-cell`}>
                            <div className="flex items-center gap-1.5 text-slate-300"><Database className="w-3 h-3 text-slate-500 shrink-0" /><span className="text-[11px] truncate max-w-[100px]">{q.WAREHOUSE_NAME}</span></div>
                          </td>
                          <td className={`${tdClass} text-right text-slate-300 hidden sm:table-cell whitespace-nowrap`}>{formatSeconds(q.EXECUTION_SECONDS)}</td>
                          <td className={`${tdClass} text-right relative`}>
                            <div className="absolute inset-y-2 right-4 bg-blue-500/15 rounded pointer-events-none" style={{ width: `calc(${costPct}% - 1rem)` }} />
                            <span className="relative z-10 text-xs font-bold text-blue-400 whitespace-nowrap">{formatCreditValue(q.CREDITS_ATTRIBUTED_COMPUTE)}</span>
                          </td>
                          <td className={`${tdClass} text-right`}>
                            <WidgetAIInsight title="Most Expensive Query" widgetType="cost_analysis" dateRange={dateRange} inline label="Analyze" widgetId="expensive_queries" widgetKind="table_row" templateKey="expensive_queries" dataSample={[q]} selectedRow={q as unknown as Record<string, unknown>} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </TableScroll>
            ) : (
              <EmptyState icon={FileQuestion} title="No Expensive Queries" desc="No queries found with significant compute cost." />
            )}
            <div className="p-4 border-t border-slate-800 bg-slate-900/40">
              <WidgetAIInsight title="Most Expensive Queries" widgetType="cost_analysis" dateRange={dateRange} widgetId="expensive_queries" widgetKind="table" templateKey="expensive_queries" dataSample={expensiveData?.slice(0, 20) ?? []} />
            </div>
          </CardContent>
        </Card>

        {/* Disk Spill & Partition Pruning */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">

          {/* Spill */}
          <Card className={cardClass}>
            <CardHeader className="pb-4 border-b border-slate-800">
              <CardTitle className="text-sm font-semibold text-slate-100 uppercase tracking-wider border-l-2 border-orange-500 pl-3">
                Under-Resourced (Disk Spill)
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 pl-3.5 mt-1">
                Queries exceeding memory limits
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 min-w-0">
              {spillData && spillData.length > 0 ? (
                <TableScroll>
                  <table className="min-w-[360px] w-full text-sm text-left">
                    <thead className="bg-slate-950/80 sticky top-0 z-10 border-b border-slate-800">
                      <tr>
                        <th className={`${thClass} w-10 text-center`}>#</th>
                        <th className={thClass}>Query</th>
                        <th className={`${thClass} text-right`}>Local</th>
                        <th className={`${thClass} text-right`}>Remote</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spillData.map((q, i) => (
                        <tr key={i} className="even:bg-slate-900/40 hover:bg-slate-800/60 border-b border-slate-800/50 last:border-0 group transition-colors">
                          <td className={`${tdClass} text-center text-slate-500 font-medium`}>{i + 1}</td>
                          <td className={`${tdClass} max-w-[160px]`}>
                            <div className="flex items-center gap-2">
                              <span className="truncate text-[11px] text-slate-100 font-mono cursor-pointer group-hover:text-blue-400 transition-colors" title={q.QUERY_TEXT} onClick={() => setSelectedQuery(q)}>
                                {shortenText(q.QUERY_TEXT, 35)}
                              </span>
                              <button onClick={(e) => copyToClipboard(e, q.QUERY_TEXT)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-700 rounded text-slate-400 shrink-0 transition-all"><Copy className="w-3 h-3" /></button>
                            </div>
                          </td>
                          <td className={`${tdClass} text-right whitespace-nowrap`}>
                            <span className="text-[11px] font-bold text-slate-100 bg-amber-500/10 border border-amber-500/40 px-2 py-0.5 rounded">{formatBytes(q.BYTES_SPILLED_TO_LOCAL_STORAGE)}</span>
                          </td>
                          <td className={`${tdClass} text-right whitespace-nowrap`}>
                            <span className="text-[11px] font-bold text-slate-100 bg-red-500/10 border border-red-500/40 px-2 py-0.5 rounded">{formatBytes(q.BYTES_SPILLED_TO_REMOTE_STORAGE)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableScroll>
              ) : (
                <EmptyState icon={Database} title="System Healthy" desc="No local or remote spills detected." />
              )}
              <div className="p-4 border-t border-slate-800 bg-slate-900/40">
                <WidgetAIInsight title="Under-Resourced Queries (Disk Spill)" widgetType="query_performance" dateRange={dateRange} widgetId="spill_queries" widgetKind="table" templateKey="spill_queries" dataSample={spillData?.slice(0, 20) ?? []} />
              </div>
            </CardContent>
          </Card>

          {/* Pruning */}
          <Card className={cardClass}>
            <CardHeader className="pb-4 border-b border-slate-800">
              <CardTitle className="text-sm font-semibold text-slate-100 uppercase tracking-wider border-l-2 border-orange-500 pl-3">
                Poor Partition Pruning
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 pl-3.5 mt-1">
                Inefficient data scanning patterns
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 min-w-0">
              {pruneData && pruneData.length > 0 ? (
                <TableScroll>
                  <table className="min-w-[360px] w-full text-sm text-left">
                    <thead className="bg-slate-950/80 sticky top-0 z-10 border-b border-slate-800">
                      <tr>
                        <th className={`${thClass} w-10 text-center`}>#</th>
                        <th className={thClass}>Query</th>
                        <th className={`${thClass} text-right`}>Pruning %</th>
                        <th className={`${thClass} text-right`}>Scan Ratio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pruneData.map((q, i) => {
                        const ratio = Math.max(0, Math.min(100, Number(q.PRUNING_RATIO || 0) > 1 ? Number(q.PRUNING_RATIO || 0) : Number(q.PRUNING_RATIO || 0) * 100))
                        const ratioColor = ratio < 20 ? 'border-red-500/40 bg-red-500/10' : ratio < 50 ? 'border-amber-500/40 bg-amber-500/10' : 'border-emerald-500/40 bg-emerald-500/10'
                        return (
                          <tr key={i} className="even:bg-slate-900/40 hover:bg-slate-800/60 border-b border-slate-800/50 last:border-0 group transition-colors">
                            <td className={`${tdClass} text-center text-slate-500 font-medium`}>{i + 1}</td>
                            <td className={`${tdClass} max-w-[160px]`}>
                              <div className="flex items-center gap-2">
                                <span className="truncate text-[11px] text-slate-100 font-mono cursor-pointer group-hover:text-blue-400 transition-colors" title={q.QUERY_TEXT} onClick={() => setSelectedQuery(q)}>
                                  {shortenText(q.QUERY_TEXT, 35)}
                                </span>
                                <button onClick={(e) => copyToClipboard(e, q.QUERY_TEXT)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-700 rounded text-slate-400 shrink-0 transition-all"><Copy className="w-3 h-3" /></button>
                              </div>
                            </td>
                            <td className={`${tdClass} text-right whitespace-nowrap`}>
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded border text-slate-100 ${ratioColor}`}>{ratio.toFixed(1)}%</span>
                            </td>
                            <td className={`${tdClass} text-right text-slate-300 whitespace-nowrap`}>
                              {q.PARTITIONS_SCANNED}<span className="text-slate-500 mx-1">/</span>{q.PARTITIONS_TOTAL}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </TableScroll>
              ) : (
                <EmptyState icon={Activity} title="Optimum Performance" desc="All queries scanning data correctly." />
              )}
              <div className="p-4 border-t border-slate-800 bg-slate-900/40">
                <WidgetAIInsight title="Inefficient Queries (Poor Partition Pruning)" widgetType="query_performance" dateRange={dateRange} widgetId="prune_queries" widgetKind="table" templateKey="prune_queries" dataSample={pruneData?.slice(0, 20) ?? []} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* High Frequency Queries */}
        <Card className={cardClass}>
          <CardHeader className="pb-4 border-b border-slate-800">
            <CardTitle className="text-sm font-semibold text-slate-100 uppercase tracking-wider border-l-2 border-teal-500 pl-3">
              High Frequency Queries
            </CardTitle>
            <CardDescription className="text-xs text-slate-400 pl-3.5 mt-1">
              Repeated query fingerprints — prime candidates for caching or materialization
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 min-w-0">
            {highFreqData && highFreqData.length > 0 ? (
              <TableScroll maxHeight="400px">
                <table className="min-w-[560px] w-full text-sm text-left">
                  <thead className="bg-slate-950/80 sticky top-0 z-10 border-b border-slate-800">
                    <tr>
                      <th className={`${thClass} w-10 text-center`}>#</th>
                      <th className={thClass}>Query Pattern</th>
                      <th className={`${thClass} text-right`}>Runs</th>
                      <th className={`${thClass} text-right hidden sm:table-cell`}>Avg Time</th>
                      <th className={`${thClass} text-right hidden sm:table-cell`}>Total Time</th>
                      <th className={`${thClass} hidden md:table-cell`}>User</th>
                    </tr>
                  </thead>
                  <tbody>
                    {highFreqData.map((q, i) => (
                      <tr key={i} className="even:bg-slate-900/40 hover:bg-slate-800/60 transition-colors group border-b border-slate-800/50 last:border-0">
                        <td className={`${tdClass} text-center text-slate-500 font-medium`}>{i + 1}</td>
                        <td className={`${tdClass} max-w-[180px]`}>
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[11px] text-slate-100 font-mono group-hover:text-blue-400 transition-colors" title={q.SAMPLE_QUERY_TEXT}>
                              {shortenText(q.SAMPLE_QUERY_TEXT, 55)}
                            </span>
                            <button onClick={(e) => copyToClipboard(e, q.SAMPLE_QUERY_TEXT)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-700 rounded text-slate-400 shrink-0 transition-all"><Copy className="w-3 h-3" /></button>
                          </div>
                        </td>
                        <td className={`${tdClass} text-right whitespace-nowrap`}>
                          <span className="text-[11px] font-bold text-slate-100 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/40">{q.QUERY_COUNT}x</span>
                        </td>
                        <td className={`${tdClass} text-right text-slate-400 hidden sm:table-cell whitespace-nowrap`}>{q.AVG_EXECUTION_SECONDS}s</td>
                        <td className={`${tdClass} text-right text-slate-100 font-semibold hidden sm:table-cell whitespace-nowrap`}>{q.TOTAL_EXECUTION_SECONDS}s</td>
                        <td className={`${tdClass} hidden md:table-cell`}>
                          <div className="flex items-center gap-1.5 text-slate-300"><User className="w-3 h-3 text-slate-500 shrink-0" /><span className="text-[11px] truncate max-w-[100px]">{shortenText(q.USER_NAMES, 18)}</span></div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            ) : (
              <EmptyState icon={Activity} title="No Repeating Queries" desc="No high-frequency repeating query patterns detected." />
            )}
            <div className="p-4 border-t border-slate-800 bg-slate-900/40">
              <WidgetAIInsight title="High Frequency Queries" widgetType="query_performance" dateRange={dateRange} widgetId="high_frequency_queries" widgetKind="table" templateKey="high_frequency_queries" dataSample={highFreqData?.slice(0, 30) ?? []} />
            </div>
          </CardContent>
        </Card>

        {/* Longest Running Queries */}
        <Card className={cardClass}>
          <CardHeader className="pb-4 border-b border-slate-800">
            <CardTitle className="text-sm font-semibold text-slate-100 uppercase tracking-wider border-l-2 border-red-500 pl-3">
              Longest Running Queries
            </CardTitle>
            <CardDescription className="text-xs text-slate-400 pl-3.5 mt-1">
              Queries with highest elapsed time — identifies severe bottlenecks
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 min-w-0">
            {longestData && longestData.length > 0 ? (
              <TableScroll maxHeight="500px">
                <table className="min-w-[640px] w-full text-sm text-left">
                  <thead className="bg-slate-950/80 sticky top-0 z-10 border-b border-slate-800">
                    <tr>
                      <th className={`${thClass} w-10 text-center`}>#</th>
                      <th className={thClass}>Query Details</th>
                      <th className={`${thClass} hidden md:table-cell`}>Timestamp</th>
                      <th className={`${thClass} hidden sm:table-cell`}>User</th>
                      <th className={`${thClass} hidden lg:table-cell`}>Warehouse</th>
                      <th className={`${thClass} text-right`}>Elapsed</th>
                      <th className={`${thClass} text-right`}>AI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {longestData.map((q, i) => (
                      <tr key={q.QUERY_ID || i} className="even:bg-slate-900/40 hover:bg-slate-800/60 transition-colors group border-b border-slate-800/50 last:border-0">
                        <td className={`${tdClass} text-center text-slate-500 font-medium`}>{i + 1}</td>
                        <td className={`${tdClass} max-w-[200px]`}>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setSelectedQuery(q)}>
                              <Terminal className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="truncate text-[11px] text-slate-100 font-mono group-hover:text-blue-400 transition-colors" title={q.QUERY_TEXT}>
                                {shortenText(q.QUERY_TEXT, 60)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 pl-5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={(e) => copyToClipboard(e, q.QUERY_TEXT)} className="text-[10px] text-slate-500 hover:text-blue-400 flex items-center gap-1"><Copy className="w-3 h-3" /> SQL</button>
                              {q.QUERY_ID && <button onClick={(e) => copyToClipboard(e, q.QUERY_ID as string)} className="text-[10px] text-slate-500 hover:text-blue-400 flex items-center gap-1"><Copy className="w-3 h-3" /> ID</button>}
                            </div>
                          </div>
                        </td>
                        <td className={`${tdClass} text-slate-400 hidden md:table-cell whitespace-nowrap`}>
                          {(q as any).START_TIME ? new Date((q as any).START_TIME).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className={`${tdClass} hidden sm:table-cell`}>
                          <div className="flex items-center gap-1.5 text-slate-300"><User className="w-3 h-3 text-slate-500 shrink-0" /><span className="text-[11px] truncate max-w-[100px]">{q.USER_NAME}</span></div>
                        </td>
                        <td className={`${tdClass} hidden lg:table-cell`}>
                          <div className="flex items-center gap-1.5 text-slate-300"><Database className="w-3 h-3 text-slate-500 shrink-0" /><span className="text-[11px] truncate max-w-[100px]">{q.WAREHOUSE_NAME}</span></div>
                        </td>
                        <td className={`${tdClass} text-right whitespace-nowrap`}>
                          <span className="text-[11px] font-bold text-slate-100 bg-red-500/10 border border-red-500/40 px-2 py-0.5 rounded">
                            {formatSeconds((Number((q as any).ELAPSED_TIME_SEC) || Number(q.EXECUTION_TIME || 0) / 1000 || 0))}
                          </span>
                        </td>
                        <td className={`${tdClass} text-right`}>
                          <WidgetAIInsight title="Longest Running Query" widgetType="query_performance" dateRange={dateRange} inline label="Analyze" widgetId="longest_queries" widgetKind="table_row" templateKey="longest_queries" dataSample={[q]} selectedRow={q as unknown as Record<string, unknown>} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            ) : (
              <EmptyState icon={Clock} title="No Slow Queries" desc="No significantly long-running queries detected." />
            )}
            <div className="p-4 border-t border-slate-800 bg-slate-900/40">
              <WidgetAIInsight title="Longest Running Queries" widgetType="query_performance" dateRange={dateRange} widgetId="longest_queries" widgetKind="table" templateKey="longest_queries" dataSample={longestData?.slice(0, 20) ?? []} />
            </div>
          </CardContent>
        </Card>

      </div>

      <QueryDetailModal isOpen={!!selectedQuery} onClose={() => setSelectedQuery(null)} query={selectedQuery as any} title="Query Details" />
    </div>
  )
}