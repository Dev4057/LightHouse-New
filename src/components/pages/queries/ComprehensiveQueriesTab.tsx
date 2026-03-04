'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { DualAxisChart, HeatmapChart } from '@/components/ui/AdvancedCharts'
import useFetch from '@/hooks/useApi'
import { Loader, AlertCircle, Terminal, Database, User, Copy, Activity, Search, FileQuestion, Clock } from 'lucide-react'
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
};

const PillBadge = ({ children, icon: Icon, colorClass }: { children: React.ReactNode, icon?: any, colorClass: string }) => (
  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-semibold border ${colorClass} whitespace-nowrap`}>
    {Icon && <Icon className="w-3 h-3" />}
    {children}
  </span>
);

const EmptyState = ({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center w-full min-w-0">
    <div className="w-10 h-10 rounded-full bg-slate-800/50 flex items-center justify-center mb-3 border border-slate-700/50">
      <Icon className="w-5 h-5 text-slate-500" />
    </div>
    <h4 className="text-sm font-semibold text-slate-200">{title}</h4>
    <p className="text-xs text-slate-400 mt-1 max-w-sm">{desc}</p>
  </div>
);

const SkeletonCard = ({ className = "" }: { className?: string }) => (
  <Card className={`bg-slate-900/60 border-slate-700/60 p-6 min-w-0 ${className}`}>
    <div className="h-4 w-1/3 bg-slate-800 rounded animate-pulse mb-2"></div>
    <div className="h-3 w-1/2 bg-slate-800 rounded animate-pulse mb-6"></div>
    <div className="h-64 w-full bg-slate-800/50 rounded animate-pulse"></div>
  </Card>
);

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
      <div className="space-y-8 w-full max-w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonCard className="h-[400px]" />
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-slate-900/40 backdrop-blur-md rounded-xl border border-slate-700/50 shadow-inner w-full min-w-0">
        <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4 border border-slate-700">
          <Search className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-100">No Query Data Found</h3>
        <p className="text-slate-400 mt-1">Try expanding your selected date range to view system workloads.</p>
      </div>
    )
  }

  const cardClass = "bg-slate-900 border-slate-800 shadow-sm overflow-hidden group min-w-0 w-full flex flex-col";

  return (
    <div className="space-y-8 w-full max-w-full overflow-hidden px-1">
      {/* SECTION 1: TIMING & PERFORMANCE */}
      <div className="border-b border-slate-800 pb-8 min-w-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
          
          {/* Query Type Timing */}
          <Card className={cardClass}>
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold text-slate-100 uppercase tracking-wider border-l-2 border-blue-500 pl-3">
                Avg Execution Time by Query Type
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 pl-3.5 mt-1 truncate">
                Avg seconds per query type
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 flex-1 flex flex-col min-w-0">
              {queryTypeData && queryTypeData.length > 0 ? (
                <div className="w-full h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={queryTypeData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                      <defs>
                        <linearGradient id="qTypeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#1e3a8a" stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="QUERY_TYPE" stroke="#64748b" axisLine={{ stroke: '#475569' }} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} dy={10} tickFormatter={(val) => val.length > 10 ? `${val.substring(0, 10)}...` : val} />
                      {/* FIXED Y-AXIS WIDTH & LABEL OFFSET */}
                      <YAxis stroke="#64748b" axisLine={{ stroke: '#475569' }} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} width={60} label={{ value: 'Seconds', angle: -90, position: 'insideLeft', offset: 15, fill: '#64748b', fontSize: 11, fontWeight: 600 }} />
                      <Tooltip contentStyle={glassTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} formatter={(value) => [formatSeconds(value as number), 'Avg Time']} />
                      <Bar dataKey="AVERAGE_EXECUTION_SECONDS" fill="url(#qTypeGrad)" radius={[2, 2, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState icon={Activity} title="No Execution Data" desc="Not enough queries to calculate averages." />
              )}
              <div className="mt-4 pt-4 border-t border-slate-800/50 min-w-0">
                <WidgetAIInsight title="Avg Execution Time Insight" widgetType="query_performance" dateRange={dateRange} widgetId="qtype_timing" widgetKind="chart" templateKey="query_type_timing" dataSample={queryTypeData?.slice(0, 25) ?? []} />
              </div>
            </CardContent>
          </Card>

          {/* User Performance */}
          <Card className={cardClass}>
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold text-slate-100 uppercase tracking-wider border-l-2 border-blue-500 pl-3">
                Avg Execution Time by User
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 pl-3.5 mt-1 truncate">
                Avg execution time by top user accounts
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 flex-1 flex flex-col min-w-0">
              {queryUserData && queryUserData.length > 0 ? (
                <div className="w-full h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={queryUserData.slice(0, 25)} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                      <defs>
                        <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#115e59" stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="USER_NAME" stroke="#64748b" axisLine={{ stroke: '#475569' }} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} dy={10} tickFormatter={(val) => val.length > 10 ? `${val.substring(0, 10)}...` : val} />
                      {/* FIXED Y-AXIS WIDTH & LABEL OFFSET */}
                      <YAxis stroke="#64748b" axisLine={{ stroke: '#475569' }} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} width={60} label={{ value: 'Seconds', angle: -90, position: 'insideLeft', offset: 15, fill: '#64748b', fontSize: 11, fontWeight: 600 }} />
                      <Tooltip contentStyle={glassTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} formatter={(value) => [formatSeconds(value as number), 'Avg Time']} />
                      <Bar dataKey="AVERAGE_EXECUTION_SECONDS" fill="url(#userGrad)" radius={[2, 2, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState icon={User} title="No User Data" desc="No user metrics detected." />
              )}
              <div className="mt-4 pt-4 border-t border-slate-800/50 min-w-0">
                <WidgetAIInsight title="User Performance Insight" widgetType="query_performance" dateRange={dateRange} widgetId="quser_timing" widgetKind="chart" templateKey="user_timing" dataSample={queryUserData?.slice(0, 25) ?? []} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* SECTION 2: TRENDS & HEATMAP */}
      <div className="border-b border-slate-800 pb-8 min-w-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
          <Card className={cardClass}>
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold text-slate-100 uppercase tracking-wider border-l-2 border-indigo-500 pl-3">
                Query Load & Trend
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 pl-3.5 mt-1 truncate">
                Volume and performance timeline
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 min-w-0">
              {trendData && trendData.length > 0 ? (
                <div className="-ml-4 -mr-4 h-[320px]">
                  <DualAxisChart data={trendData} xKey="QUERY_DAY" barKey="QUERY_COUNT" lineKey="AVG_SECONDS" barLabel="Total Queries" lineLabel="Avg Seconds" height={320} />
                </div>
              ) : (
                <EmptyState icon={Activity} title="No Timeline Data" desc="No trend history available." />
              )}
            </CardContent>
          </Card>

          <Card className={cardClass}>
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold text-slate-100 uppercase tracking-wider border-l-2 border-indigo-500 pl-3">
                Workload Heatmap
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 pl-3.5 mt-1 truncate">
                Hourly query volume distribution
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 min-w-0">
              {heatmapData && heatmapData.length > 0 ? (
                <div className="h-[320px] overflow-hidden">
                  <HeatmapChart data={heatmapData} height={320} />
                </div>
              ) : (
                <EmptyState icon={Activity} title="No Hourly Data" desc="No patterns detected for this range." />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* SECTION 3: TABLES & DRILLDOWNS */}
      <div className="space-y-8 min-w-0">

        {/* DBA-Grade Most Expensive Queries */}
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
              <div className="overflow-x-auto custom-scrollbar w-full max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-slate-950/80 backdrop-blur-md sticky top-0 z-10 text-[11px] font-bold text-slate-400 uppercase tracking-wider shadow-sm border-b border-slate-800">
                    <tr>
                      <th className="py-4 px-4 w-12 text-center">#</th>
                      <th className="py-4 px-6 min-w-[250px]">Query Details</th>
                      <th className="py-4 px-6">Timestamp</th>
                      <th className="py-4 px-6">User</th>
                      <th className="py-4 px-6">Warehouse</th>
                      <th className="py-4 px-6 text-right">Duration</th>
                      <th className="py-4 px-6 text-right w-32">Cost ({creditUnitLabel})</th>
                      <th className="py-4 px-6 text-right">AI Insight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expensiveData.map((q, i) => {
                      const currentCost = Number(q.CREDITS_ATTRIBUTED_COMPUTE || 0);
                      const costPct = Math.min(100, Math.max(2, (currentCost / maxExpensiveCost) * 100));

                      return (
                        <tr key={(q as any).QUERY_ID || i} className="even:bg-slate-900/40 odd:bg-transparent hover:bg-slate-800/60 transition-colors group border-b border-slate-800/50 last:border-0">
                          <td className="py-3 px-4 text-center text-xs font-medium text-slate-500">{i + 1}</td>
                          
                          <td className="py-3 px-6">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2 cursor-pointer" onClick={() => setSelectedQuery(q)}>
                                <Terminal className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                <span className="max-w-[250px] lg:max-w-[350px] truncate text-[11px] text-slate-100 font-mono group-hover:text-blue-400 transition-colors" title={q.QUERY_TEXT}>
                                  {shortenText(q.QUERY_TEXT, 80)}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 pl-5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => copyToClipboard(e, q.QUERY_TEXT)} className="text-[10px] text-slate-500 hover:text-blue-400 flex items-center gap-1 font-medium">
                                  <Copy className="w-3 h-3" /> SQL
                                </button>
                                {(q as any).QUERY_ID && (
                                  <button onClick={(e) => copyToClipboard(e, (q as any).QUERY_ID as string)} className="text-[10px] text-slate-500 hover:text-blue-400 flex items-center gap-1 font-medium">
                                    <Copy className="w-3 h-3" /> ID
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-6 text-[11px] text-slate-400">
                            {(q as any).START_TIME ? new Date((q as any).START_TIME).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                          </td>

                          <td className="py-3 px-6">
                            <div className="flex items-center gap-1.5 text-slate-200">
                              <User className="w-3 h-3 text-slate-500" />
                              <span className="text-[11px] font-medium">{q.USER_NAME}</span>
                            </div>
                          </td>
                          <td className="py-3 px-6">
                            <div className="flex items-center gap-1.5 text-slate-200">
                              <Database className="w-3 h-3 text-slate-500" />
                              <span className="text-[11px] font-medium">{q.WAREHOUSE_NAME}</span>
                            </div>
                          </td>

                          <td className="py-3 px-6 text-right text-slate-300 text-xs">
                            {formatSeconds(q.EXECUTION_SECONDS)}
                          </td>
                          
                          <td className="py-3 px-6 text-right relative">
                            <div className="absolute inset-y-2.5 right-6 bg-blue-500/15 rounded-md pointer-events-none" style={{ width: `calc(${costPct}% - 1rem)` }}></div>
                            <span className="relative z-10 text-xs font-bold text-blue-400 tracking-wide pr-2">
                              {formatCreditValue(q.CREDITS_ATTRIBUTED_COMPUTE)}
                            </span>
                          </td>

                          <td className="py-3 px-6 text-right">
                            <WidgetAIInsight title="Most Expensive Query" widgetType="cost_analysis" dateRange={dateRange} inline label="Analyze" widgetId="expensive_queries" widgetKind="table_row" templateKey="expensive_queries" dataSample={[q]} selectedRow={q as unknown as Record<string, unknown>} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={FileQuestion} title="No Expensive Queries" desc="No queries found with significant compute cost." />
            )}
            <div className="p-4 border-t border-slate-800 bg-slate-900/40">
              <WidgetAIInsight title="Most Expensive Queries" widgetType="cost_analysis" dateRange={dateRange} widgetId="expensive_queries" widgetKind="table" templateKey="expensive_queries" dataSample={expensiveData?.slice(0, 20) ?? []} />
            </div>
          </CardContent>
        </Card>

        {/* Disk Spill & Partition Pruning */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
          
          {/* Spill Table */}
          <Card className={cardClass}>
            <CardHeader className="pb-4 border-b border-slate-800">
              <CardTitle className="text-sm font-semibold text-slate-100 uppercase tracking-wider border-l-2 border-orange-500 pl-3">
                Under-Resourced (Disk Spill)
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 pl-3.5 mt-1 truncate">
                Queries exceeding memory limits
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 min-w-0 flex-1 overflow-hidden">
              {spillData && spillData.length > 0 ? (
                <div className="overflow-x-auto w-full custom-scrollbar">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-slate-950/80 backdrop-blur-md sticky top-0 z-10 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4 w-10 text-center">#</th>
                        <th className="py-3 px-4">Query</th>
                        <th className="py-3 px-4 text-right">Local Spill</th>
                        <th className="py-3 px-4 text-right pr-6">Remote Spill</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spillData.map((q, i) => (
                        <tr key={(q as any).QUERY_ID || i} className="even:bg-slate-900/40 odd:bg-transparent hover:bg-slate-800/60 border-b border-slate-800/50 last:border-0 group">
                          <td className="py-3 px-4 text-center text-xs font-medium text-slate-500">{i + 1}</td>
                          <td className="py-3 px-4 cursor-pointer" onClick={() => setSelectedQuery(q)}>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-slate-100 font-mono group-hover:text-blue-400 transition-colors truncate max-w-[150px] lg:max-w-[200px]" title={q.QUERY_TEXT}>
                                {shortenText(q.QUERY_TEXT, 40)}
                              </span>
                              <button onClick={(e) => copyToClipboard(e, q.QUERY_TEXT)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 transition-all shrink-0"><Copy className="w-3 h-3" /></button>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-xs font-bold text-slate-100 bg-amber-500/10 border border-amber-500/40 px-2 py-1 rounded">
                              {formatBytes(q.BYTES_SPILLED_TO_LOCAL_STORAGE)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right pr-6">
                            <span className="text-xs font-bold text-slate-100 bg-red-500/10 border border-red-500/40 px-2 py-1 rounded">
                              {formatBytes(q.BYTES_SPILLED_TO_REMOTE_STORAGE)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState icon={Database} title="System Healthy" desc="No local or remote spills detected." />
              )}
            </CardContent>
          </Card>

          {/* Pruning Table */}
          <Card className={cardClass}>
            <CardHeader className="pb-4 border-b border-slate-800">
              <CardTitle className="text-sm font-semibold text-slate-100 uppercase tracking-wider border-l-2 border-orange-500 pl-3">
                Poor Partition Pruning
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 pl-3.5 mt-1 truncate">
                Inefficient data scanning patterns
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 min-w-0 flex-1 overflow-hidden">
              {pruneData && pruneData.length > 0 ? (
                <div className="overflow-x-auto w-full custom-scrollbar">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-slate-950/80 backdrop-blur-md sticky top-0 z-10 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4 w-10 text-center">#</th>
                        <th className="py-3 px-4">Query</th>
                        <th className="py-3 px-4 text-right">Pruning %</th>
                        <th className="py-3 px-4 text-right pr-6">Scan Ratio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pruneData.map((q, i) => {
                        const ratio = Math.max(0, Math.min(100, Number(q.PRUNING_RATIO || 0) > 1 ? Number(q.PRUNING_RATIO || 0) : Number(q.PRUNING_RATIO || 0) * 100))
                        const ratioColor = ratio < 20 ? 'text-slate-100 border-red-500/40 bg-red-500/10' : ratio < 50 ? 'text-slate-100 border-amber-500/40 bg-amber-500/10' : 'text-slate-100 border-emerald-500/40 bg-emerald-500/10'
                        return (
                          <tr key={(q as any).QUERY_ID || i} className="even:bg-slate-900/40 odd:bg-transparent hover:bg-slate-800/60 border-b border-slate-800/50 last:border-0 group">
                            <td className="py-3 px-4 text-center text-xs font-medium text-slate-500">{i + 1}</td>
                            <td className="py-3 px-4 cursor-pointer" onClick={() => setSelectedQuery(q)}>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-slate-100 font-mono group-hover:text-blue-400 transition-colors truncate max-w-[150px] lg:max-w-[200px]" title={q.QUERY_TEXT}>
                                  {shortenText(q.QUERY_TEXT, 40)}
                                </span>
                                <button onClick={(e) => copyToClipboard(e, q.QUERY_TEXT)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 transition-all shrink-0"><Copy className="w-3 h-3" /></button>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className={`text-xs font-bold px-2 py-1 rounded border ${ratioColor}`}>
                                {ratio.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right text-xs text-slate-300 pr-6">
                              {q.PARTITIONS_SCANNED} <span className="text-slate-500 font-normal">/</span> {q.PARTITIONS_TOTAL}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState icon={Activity} title="Optimum Performance" desc="All queries scanning data correctly." />
              )}
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
              Top repeated exact query fingerprints — prime candidates for caching
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 min-w-0">
            {highFreqData && highFreqData.length > 0 ? (
              <div className="overflow-x-auto custom-scrollbar w-full max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-slate-950/80 backdrop-blur-md sticky top-0 z-10 text-[11px] font-bold text-slate-400 uppercase tracking-wider shadow-sm border-b border-slate-800">
                    <tr>
                      <th className="py-4 px-4 w-12 text-center">#</th>
                      <th className="py-4 px-6 min-w-[200px]">Query Pattern</th>
                      <th className="py-4 px-6 text-right">Runs</th>
                      <th className="py-4 px-6 text-right">Avg Time</th>
                      <th className="py-4 px-6 text-right">Total Time</th>
                      <th className="py-4 px-6">User</th>
                    </tr>
                  </thead>
                  <tbody>
                    {highFreqData.map((q, i) => (
                      <tr key={(q as any).QUERY_ID || i} className="even:bg-slate-900/40 odd:bg-transparent hover:bg-slate-800/60 transition-colors group border-b border-slate-800/50 last:border-0">
                        <td className="py-3 px-4 text-center text-xs font-medium text-slate-500">{i + 1}</td>
                        <td className="py-3 px-6">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-100 font-mono group-hover:text-blue-400 transition-colors truncate max-w-[200px] lg:max-w-[300px]" title={q.SAMPLE_QUERY_TEXT}>
                              {shortenText(q.SAMPLE_QUERY_TEXT, 70)}
                            </span>
                            <button onClick={(e) => copyToClipboard(e, q.SAMPLE_QUERY_TEXT)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 transition-all shrink-0"><Copy className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                        <td className="py-3 px-6 text-right">
                          <span className="text-xs font-bold text-slate-100 bg-blue-500/10 px-2.5 py-1 rounded-md border border-blue-500/40">
                            {q.QUERY_COUNT}x
                          </span>
                        </td>
                        <td className="py-3 px-6 text-right text-xs text-slate-400">{q.AVG_EXECUTION_SECONDS}s</td>
                        <td className="py-3 px-6 text-right text-xs text-slate-100 font-semibold">{q.TOTAL_EXECUTION_SECONDS}s</td>
                        <td className="py-3 px-6">
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <User className="w-3 h-3 text-slate-500" />
                            <span className="text-[11px]">{shortenText(q.USER_NAMES, 20)}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
              <div className="overflow-x-auto custom-scrollbar w-full max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-slate-950/80 backdrop-blur-md sticky top-0 z-10 text-[11px] font-bold text-slate-400 uppercase tracking-wider shadow-sm border-b border-slate-800">
                    <tr>
                      <th className="py-4 px-4 w-12 text-center">#</th>
                      <th className="py-4 px-6 min-w-[250px]">Query Details</th>
                      <th className="py-4 px-6">Timestamp</th>
                      <th className="py-4 px-6">User</th>
                      <th className="py-4 px-6">Warehouse</th>
                      <th className="py-4 px-6 text-right">Elapsed Time</th>
                      <th className="py-4 px-6 text-right">AI Insight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {longestData.map((q, i) => (
                      <tr key={q.QUERY_ID || i} className="even:bg-slate-900/40 odd:bg-transparent hover:bg-slate-800/60 transition-colors group border-b border-slate-800/50 last:border-0">
                        <td className="py-3 px-4 text-center text-xs font-medium text-slate-500">{i + 1}</td>
                        <td className="py-3 px-6">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setSelectedQuery(q)}>
                              <Terminal className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <span className="max-w-[250px] lg:max-w-[350px] truncate text-[11px] text-slate-100 font-mono group-hover:text-blue-400 transition-colors" title={q.QUERY_TEXT}>
                                {shortenText(q.QUERY_TEXT, 80)}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 pl-5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={(e) => copyToClipboard(e, q.QUERY_TEXT)} className="text-[10px] text-slate-500 hover:text-blue-400 flex items-center gap-1 font-medium"><Copy className="w-3 h-3" /> SQL</button>
                              {q.QUERY_ID && <button onClick={(e) => copyToClipboard(e, q.QUERY_ID as string)} className="text-[10px] text-slate-500 hover:text-blue-400 flex items-center gap-1 font-medium"><Copy className="w-3 h-3" /> ID</button>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-6 text-[11px] text-slate-400">
                          {(q as any).START_TIME ? new Date((q as any).START_TIME).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="py-3 px-6">
                          <div className="flex items-center gap-1.5 text-slate-200">
                            <User className="w-3 h-3 text-slate-500" />
                            <span className="text-[11px] font-medium">{q.USER_NAME}</span>
                          </div>
                        </td>
                        <td className="py-3 px-6">
                          <div className="flex items-center gap-1.5 text-slate-200">
                            <Database className="w-3 h-3 text-slate-500" />
                            <span className="text-[11px] font-medium">{q.WAREHOUSE_NAME}</span>
                          </div>
                        </td>
                        <td className="py-3 px-6 text-right">
                          <span className="text-sm font-bold text-slate-100 bg-red-500/10 border border-red-500/40 px-3 py-1.5 rounded-md shadow-sm">
                            {formatSeconds((Number((q as any).ELAPSED_TIME_SEC) || Number(q.EXECUTION_TIME || 0) / 1000 || 0))}
                          </span>
                        </td>
                        <td className="py-3 px-6 text-right">
                          <WidgetAIInsight title="Longest Running Query" widgetType="query_performance" dateRange={dateRange} inline label="Analyze" widgetId="longest_queries" widgetKind="table_row" templateKey="longest_queries" dataSample={[q]} selectedRow={q as unknown as Record<string, unknown>} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={Clock} title="No Slow Queries" desc="No significantly long-running queries detected." />
            )}
            <div className="p-4 border-t border-slate-800 bg-slate-900/40">
              <WidgetAIInsight title="Longest Running Queries" widgetType="query_performance" dateRange={dateRange} widgetId="longest_queries" widgetKind="table" templateKey="longest_queries" dataSample={longestData?.slice(0, 20) ?? []} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Query Detail Modal */}
      <QueryDetailModal isOpen={!!selectedQuery} onClose={() => setSelectedQuery(null)} query={selectedQuery as any} title="Query Details" />
    </div>
  )
}