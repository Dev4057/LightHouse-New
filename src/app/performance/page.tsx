'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import DateRangeSelector from '@/components/dashboard/DateRangeSelector'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import useFetch from '@/hooks/useApi'
import { Loader, AlertCircle, Clock, Zap, Activity, AlertTriangle, Terminal } from 'lucide-react'
import { formatSeconds, formatNumber, shortenText } from '@/lib/formatting'
import WidgetAIInsight from '@/components/ai/WidgetAIInsight'
import { useTheme } from 'next-themes'

// ── GLASSMORPHISM TAILWIND CLASSES (Customized to 900/40 opacity) ────────────
const glassCard = "bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl dark:shadow-2xl min-w-0 overflow-hidden transition-all duration-300"
const glassHeader = "px-6 py-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-slate-50/40 dark:bg-slate-800/40 backdrop-blur-md"
const glassTableHead = "bg-slate-100/60 dark:bg-slate-950/60 backdrop-blur-xl sticky top-0 z-10 border-b border-slate-200/50 dark:border-slate-700/50"
const glassRow = "border-b border-slate-200/50 dark:border-slate-800/50 hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors group"

// ── Reusable Components ──────────────────────────────────────────────────────
const EmptyState = ({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center w-full min-w-0">
    <div className="w-12 h-12 rounded-full bg-slate-500/10 flex items-center justify-center mb-4 border border-slate-500/20 backdrop-blur-sm">
      <Icon className="w-6 h-6 text-slate-500" />
    </div>
    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h4>
    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">{desc}</p>
  </div>
)

const TableScroll = ({ children, maxHeight }: { children: React.ReactNode, maxHeight?: string }) => (
  <div
    className="w-full max-w-full overflow-x-auto scrollbar-thin"
    style={{ maxHeight: maxHeight ?? 'none', overflowY: maxHeight ? 'auto' : 'visible' }}
  >
    {children}
  </div>
)

// ── Main Page ────────────────────────────────────────────────────────────────
export default function PerformancePage() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date(),
  })

  useEffect(() => setMounted(true), [])

  const startDate = dateRange.start.toISOString().split('T')[0]
  const endDate = dateRange.end.toISOString().split('T')[0]

  const { data: trendData, isLoading: loadingTrend } = useFetch<any[]>(
    ['perf-trend', startDate, endDate],
    `/api/queries?type=trend&start=${startDate}&end=${endDate}`
  )

  const { data: queryTypeData, isLoading: loadingQueryType } = useFetch<any[]>(
    ['perf-query-type', startDate, endDate],
    `/api/queries?type=by-type&start=${startDate}&end=${endDate}`
  )

  const { data: userPerf, isLoading: loadingUserPerf } = useFetch<any[]>(
    ['perf-user', startDate, endDate],
    `/api/queries?type=by-user&start=${startDate}&end=${endDate}`
  )

  const isLoading = loadingTrend || loadingQueryType || loadingUserPerf
  const hasData = !!trendData?.length

  // Chart Configuration based on theme
  const isDark = resolvedTheme === 'dark'
  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
  const axisColor = isDark ? '#64748b' : '#94a3b8'

  const glassTooltip = {
    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.75)' : 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(16px)',
    border: `1px solid ${isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.8)'}`,
    borderRadius: '12px',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
    color: isDark ? '#f8fafc' : '#0f172a',
    fontSize: '12px'
  }

  if (isLoading || !mounted) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24 w-full min-w-0">
          <Loader className="w-10 h-10 text-blue-500 animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  if (!hasData) {
    return (
      <DashboardLayout>
        <EmptyState icon={AlertCircle} title="No Performance Data" desc="Adjust the date range to see performance trends." />
      </DashboardLayout>
    )
  }

  const avgQueryTime = trendData ? (trendData.reduce((sum, d) => sum + (d.AVG_SECONDS || 0), 0) / trendData.length).toFixed(2) : '0'
  const totalQueries = trendData ? trendData.reduce((sum, d) => sum + (d.QUERY_COUNT || 0), 0) : 0
  const maxQueryTime = trendData ? Math.max(...trendData.map(d => d.AVG_SECONDS || 0)).toFixed(2) : '0'
  
  // Sort query types so the longest execution times are at the top of the horizontal chart
  const sortedQueryTypes = [...(queryTypeData || [])].sort((a, b) => b.AVERAGE_EXECUTION_SECONDS - a.AVERAGE_EXECUTION_SECONDS)
  const slowestQueryType = sortedQueryTypes[0]

  const n = (value: unknown) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const thClass = "py-3 px-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap"
  const tdClass = "py-3 px-4 text-xs"

  return (
    <DashboardLayout>
      <div className="space-y-6 w-full min-w-0 overflow-hidden">
        
        {/* Header & Date Picker */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Performance</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Query execution trends and system bottlenecks</p>
          </div>
          <DateRangeSelector value={dateRange} onChange={setDateRange} />
        </div>

        {/* ── KPI GRID ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 min-w-0">
          {[
            { label: 'Avg Query Time', val: formatSeconds(parseFloat(avgQueryTime)), desc: 'Across all queries', icon: Clock, color: 'text-blue-500' },
            { label: 'Total Queries', val: formatNumber(totalQueries), desc: 'Period execution count', icon: Zap, color: 'text-emerald-500' },
            { label: 'Max Query Time', val: formatSeconds(parseFloat(maxQueryTime)), desc: 'Peak execution duration', icon: AlertTriangle, color: 'text-amber-500' },
            { label: 'Slowest Type', val: slowestQueryType?.QUERY_TYPE || 'N/A', desc: slowestQueryType ? formatSeconds(slowestQueryType.AVERAGE_EXECUTION_SECONDS) : '-', icon: Terminal, color: 'text-red-500' },
          ].map((item, i) => (
            <Card key={i} className={`${glassCard} p-5 hover:-translate-y-1 flex flex-col justify-center`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg bg-slate-500/10 border border-slate-500/20 backdrop-blur-sm`}>
                  <item.icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">{item.label}</p>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white truncate">{item.val}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{item.desc}</p>
            </Card>
          ))}
        </div>

        {/* ── CHARTS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
          
          {/* Performance Trend (Area Chart) */}
          <Card className={glassCard}>
            <CardHeader className={glassHeader}>
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider border-l-2 border-emerald-500 pl-3">
                Query Performance Trend
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 pl-3.5 mt-1">
                Average execution time over time
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 min-w-0">
              {trendData?.length ? (
                <div className="w-full h-[320px] overflow-hidden">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                      <defs>
                        <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={isDark ? 0.4 : 0.2}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis dataKey="QUERY_DAY" stroke={axisColor} tick={{ fontSize: 10 }} dy={10} />
                      <YAxis stroke={axisColor} tick={{ fontSize: 10 }} width={45} />
                      <Tooltip contentStyle={glassTooltip} cursor={{ stroke: gridColor, strokeWidth: 2 }} />
                      <Area type="monotone" dataKey="AVG_SECONDS" name="Avg Seconds" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#trendGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState icon={Activity} title="No Trends" desc="Insufficient data to map performance trends." />
              )}
            </CardContent>
          </Card>

          {/* Horizontal Bar Chart for Query Types */}
          <Card className={glassCard}>
            <CardHeader className={glassHeader}>
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider border-l-2 border-blue-500 pl-3">
                Execution Time by Query Type
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 pl-3.5 mt-1">
                Longest running query operations
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 min-w-0">
              {sortedQueryTypes?.length ? (
                <div className="w-full h-[320px] overflow-hidden">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sortedQueryTypes.slice(0, 10)} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                      {/* FIX: <defs> correctly placed inside the Chart root, NOT inside the Bar */}
                      <defs>
                        <linearGradient id="queryTypeHorizontalGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
                          <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.9} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={true} vertical={false} />
                      <XAxis type="number" stroke={axisColor} tick={{ fontSize: 10 }} />
                      {/* FIX: Increased width to 105 so labels fit perfectly */}
                      <YAxis type="category" dataKey="QUERY_TYPE" stroke={axisColor} tick={{ fontSize: 10 }} width={105} tickFormatter={(val) => shortenText(val, 16)} />
                      <Tooltip contentStyle={glassTooltip} cursor={{ fill: gridColor }} formatter={(v) => [formatSeconds(v as number), 'Avg Time']} />
                      <Bar dataKey="AVERAGE_EXECUTION_SECONDS" radius={[0, 4, 4, 0]} maxBarSize={20} fill="url(#queryTypeHorizontalGrad)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState icon={Terminal} title="No Data" desc="No query type data available." />
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── USER PERFORMANCE TABLE ── */}
        <Card className={glassCard}>
          <CardHeader className={glassHeader}>
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider border-l-2 border-purple-500 pl-3">
              Average Execution Time by User
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 pl-3.5 mt-1">
              Mart-backed per-user daily average execution timing
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 min-w-0">
            {userPerf?.length ? (
              <TableScroll maxHeight="400px">
                <table className="w-full text-sm text-left">
                  <thead className={glassTableHead}>
                    <tr>
                      <th className={thClass}>User</th>
                      <th className={`${thClass} text-right`}>Avg Time</th>
                      <th className={`${thClass} text-right`}>Days Observed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userPerf.slice(0, 20).map((user, i) => {
                      const avgSeconds = n(user.AVERAGE_EXECUTION_SECONDS ?? user.average_execution_seconds ?? user.AVG_SECONDS)
                      const activeDays = n(user.ACTIVE_DAYS ?? user.active_days)
                      const userName = user.USER_NAME ?? user.user_name ?? '-'
                      return (
                        <tr key={i} className={glassRow}>
                          <td className={`${tdClass} font-medium text-slate-700 dark:text-slate-300`}>{userName}</td>
                          <td className={`${tdClass} text-right font-bold text-red-600 dark:text-red-400`}>{formatSeconds(avgSeconds)}</td>
                          <td className={`${tdClass} text-right text-slate-600 dark:text-slate-400 font-mono`}>{formatNumber(activeDays)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </TableScroll>
            ) : (
              <EmptyState icon={Activity} title="No Metrics" desc="No user-level performance data tracked." />
            )}
            <div className="p-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-500/5 backdrop-blur-md flex flex-col gap-2">
              <p className="text-xs text-slate-500 italic">
                * Note: Query-count and true total-time metrics are omitted per schema limitations.
              </p>
              <WidgetAIInsight title="User Performance Audit" widgetType="query_performance" dateRange={dateRange} widgetId="perf_user_timing" widgetKind="table" templateKey="user_timing" dataSample={userPerf?.slice(0, 20) ?? []} />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}