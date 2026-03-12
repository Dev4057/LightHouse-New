'use client'

import { useMemo, useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { DualAxisChart, HeatmapChart } from '@/components/ui/AdvancedCharts'
import useFetch from '@/hooks/useApi'
import { Terminal, Database, User, Copy, Activity, Search, FileQuestion, Clock, Flame, HardDrive, Layers } from 'lucide-react'
import { formatSeconds, formatBytes, shortenText, formatNumber } from '@/lib/formatting' 
import { useSpendDisplay } from '@/hooks/useSpendDisplay'
import WidgetAIInsight from '@/components/ai/WidgetAIInsight'
import QueryDetailModal from '@/components/ui/QueryDetailModal'
import { useTheme } from 'next-themes'
import InfoTooltip from '@/components/ui/InfoTooltip' 

interface QueriesPageProps {
  dateRange: { start: Date; end: Date }
}

// ==========================================
// REUSABLE COMPONENTS
// ==========================================

type EmptyStateProps = {
  icon: React.ComponentType<{ className?: string }>
  title: string
  desc: string
}

const EmptyState = ({ icon: Icon, title, desc }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-16 text-center w-full">
    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center mb-3 border border-slate-200 dark:border-slate-700/50">
      <Icon className="w-5 h-5 text-slate-400 dark:text-slate-500" />
    </div>
    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h4>
    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">{desc}</p>
  </div>
)

const SkeletonCard = ({ className = "" }: { className?: string }) => (
  <Card className={`bg-slate-100 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700/60 p-6 ${className}`}>
    <div className="h-4 w-1/3 bg-slate-200 dark:bg-slate-800 rounded animate-pulse mb-2" />
    <div className="h-3 w-1/2 bg-slate-200 dark:bg-slate-800 rounded animate-pulse mb-6" />
    <div className="h-64 w-full bg-slate-200/50 dark:bg-slate-800/50 rounded animate-pulse" />
  </Card>
)

const TableScroll = ({ children, maxHeight }: { children: React.ReactNode, maxHeight?: string }) => (
  <div
    className="w-full min-w-0 max-w-full overflow-x-auto scrollbar-thin"
    style={{ maxHeight: maxHeight ?? 'none', overflowY: maxHeight ? 'auto' : 'visible' }}
  >
    {children}
  </div>
)

// ==========================================
// MAIN PAGE
// ==========================================

export default function ComprehensiveQueriesPage({ dateRange }: QueriesPageProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isDark = mounted ? resolvedTheme === 'dark' : true

  const [selectedQuery, setSelectedQuery] = useState<any | null>(null)
  
  const { formatCreditValue, creditUnitLabel } = useSpendDisplay()
  const startDate = dateRange.start.toISOString().split('T')[0]
  const endDate = dateRange.end.toISOString().split('T')[0]

  const { data: queryTypeData, isLoading: loadingQType } = useFetch<any[]>(['q-type', startDate, endDate], `/api/queries?type=by-type&start=${startDate}&end=${endDate}`)
  const { data: queryUserData, isLoading: loadingQUser } = useFetch<any[]>(['q-user', startDate, endDate], `/api/queries?type=by-user&start=${startDate}&end=${endDate}`)
  const { data: expensiveData, isLoading: loadingExpensive } = useFetch<any[]>(['q-expensive', startDate, endDate], `/api/queries?type=expensive&start=${startDate}&end=${endDate}&limit=20`)
  const { data: longestData, isLoading: loadingLongest } = useFetch<any[]>(['q-longest', startDate, endDate], `/api/queries?type=longest&start=${startDate}&end=${endDate}&limit=20`)
  const { data: trendData, isLoading: loadingTrend } = useFetch<any[]>(['q-trend', startDate, endDate], `/api/queries?type=trend&start=${startDate}&end=${endDate}`)
  const { data: heatmapData, isLoading: loadingHeatmap } = useFetch<any[]>(['q-heatmap', startDate, endDate], `/api/queries?type=heatmap&start=${startDate}&end=${endDate}`)
  const { data: spillData, isLoading: loadingSpill } = useFetch<any[]>(['q-spill', startDate, endDate], `/api/queries?type=spill&start=${startDate}&end=${endDate}&limit=10`)
  const { data: pruneData, isLoading: loadingPrune } = useFetch<any[]>(['q-prune', startDate, endDate], `/api/queries?type=prune&start=${startDate}&end=${endDate}&limit=10`)
  const { data: highFreqData, isLoading: loadingHighFreq } = useFetch<any[]>(['q-highfreq', startDate, endDate], `/api/queries?type=high-frequency&start=${startDate}&end=${endDate}`)

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

  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
  const axisStroke = isDark ? '#64748b' : '#94a3b8'
  const axisStrokeStrong = isDark ? '#475569' : '#cbd5e1'
  const tickColor = isDark ? '#ffffff' : '#000000'

  const glassTooltipStyle = {
    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(16px)',
    border: `1px solid ${isDark ? 'rgba(51, 65, 85, 0.8)' : 'rgba(226, 232, 240, 0.8)'}`,
    borderRadius: '8px',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
    color: isDark ? '#f8fafc' : '#0f172a',
    fontSize: '12px'
  }

  if (isLoading || !mounted) {
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
      <div className="flex flex-col items-center justify-center py-24 bg-white/60 dark:bg-slate-900/40 backdrop-blur-md rounded-xl border border-slate-200 dark:border-slate-700/50 w-full">
        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 border border-slate-200 dark:border-slate-700">
          <Search className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">No Query Data Found</h3>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm text-center px-4">Try expanding your selected date range to view system workloads.</p>
      </div>
    )
  }

  // ✨ FIX: Removed overflow-hidden from the main card container, added z-10 
  const cardClass = "bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl min-w-0 w-full flex flex-col transition-colors duration-300 relative z-10"
  
  const tdClass = "py-3 px-4 text-xs text-slate-600 dark:text-slate-300"
  const thClass = "py-3 px-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap bg-slate-100/60 dark:bg-slate-950/60 backdrop-blur-xl sticky top-0 z-0" // ✨ Lowered z-index of table header
  const trClass = "even:bg-slate-50/50 dark:even:bg-slate-900/20 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 border-b border-slate-200/50 dark:border-slate-800/50 transition-colors cursor-pointer group"

  return (
    <div className="space-y-8 w-full min-w-0"> {/* ✨ Removed overflow-hidden here too */}

      {/* ── SECTION 1: TIMING & PERFORMANCE ── */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"> {/* ✨ Removed overflow-hidden here too */}

          {/* Avg Execution Time by Query Type */}
          <Card className={cardClass}>
            <CardHeader className="pb-4 relative z-50"> {/* ✨ Added relative z-50 to Header */}
              <div className="flex items-center gap-2 border-l-2 border-blue-500 pl-3">
                <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Avg Execution Time by Query Type
                </CardTitle>
                <InfoTooltip text="Compares how long different types of operations (like reading data vs writing data) take to run. If basic SELECT queries are taking too long, your database might need clustering." />
              </div>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 pl-3.5 mt-1">
                Avg seconds per query type operations
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 flex-1 flex flex-col min-w-0 relative z-0"> {/* ✨ Added relative z-0 to Content */}
              {queryTypeData && queryTypeData.length > 0 ? (
               <div className="w-full" style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      layout="vertical" 
                      data={queryTypeData} 
                      margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="qTypeGrad" x1="0" y1="0" x2="1" y2="0"> 
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#1e3a8a" stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} vertical={true} />
                      <XAxis type="number" stroke={axisStroke} axisLine={{ stroke: axisStrokeStrong }} tickLine={false} tick={{ fill: tickColor, fontSize: 10, fontWeight: 500 }} />
                      <YAxis 
                        type="category" 
                        dataKey="QUERY_TYPE" 
                        stroke={axisStroke} 
                        axisLine={{ stroke: axisStrokeStrong }} 
                        tickLine={false} 
                        tick={{ fill: tickColor, fontSize: 10, fontWeight: 600 }} 
                        width={120} 
                        tickFormatter={(val) => {
                          const cleanText = typeof val === 'string' ? val.replace(/_/g, ' ') : val;
                          return cleanText.length > 18 ? `${cleanText.substring(0, 16)}...` : cleanText;
                        }} 
                      />
                      <Tooltip contentStyle={glassTooltipStyle} itemStyle={{ fontWeight: 600, color: tickColor }} cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }} formatter={(value) => [formatSeconds(value as number), 'Avg Time']} />
                      <Bar dataKey="AVERAGE_EXECUTION_SECONDS" fill="url(#qTypeGrad)" radius={[0, 4, 4, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState icon={Activity} title="No Execution Data" desc="Not enough queries to calculate averages." />
              )}
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800/50">
                <WidgetAIInsight title="Avg Execution Time by Query Type" widgetType="query_performance" dateRange={dateRange} widgetId="qtype_timing" widgetKind="chart" templateKey="query_type_timing" dataSample={queryTypeData?.slice(0, 25) ?? []} />
              </div>
            </CardContent>
          </Card>

          {/* Avg Execution Time by User */}
          <Card className={cardClass}>
            <CardHeader className="pb-4 relative z-50">
              <div className="flex items-center gap-2 border-l-2 border-teal-500 pl-3">
                <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Avg Execution Time by User
                </CardTitle>
                <InfoTooltip text="Identifies which specific people or service accounts are forcing the database to work the hardest. Useful for tracking down analysts running unoptimized code." />
              </div>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 pl-3.5 mt-1">
                Avg execution time by top user accounts
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 flex-1 flex flex-col min-w-0 relative z-0">
              {queryUserData && queryUserData.length > 0 ? (
                <div className="w-full" style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={queryUserData.slice(0, 25)} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                      <defs>
                        <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#115e59" stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis dataKey="USER_NAME" stroke={axisStroke} axisLine={{ stroke: axisStrokeStrong }} tickLine={false} tick={{ fill: tickColor, fontSize: 10, fontWeight: 500 }} dy={10} tickFormatter={(val) => val.length > 10 ? `${val.substring(0, 10)}...` : val} />
                      <YAxis stroke={axisStroke} axisLine={{ stroke: axisStrokeStrong }} tickLine={false} tick={{ fill: tickColor, fontSize: 10, fontWeight: 500 }} width={60} label={{ value: 'Seconds', angle: -90, position: 'insideLeft', offset: 15, fill: axisStroke, fontSize: 11, fontWeight: 600 }} />
                      <Tooltip contentStyle={glassTooltipStyle} itemStyle={{ fontWeight: 600, color: tickColor }} cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }} formatter={(value) => [formatSeconds(value as number), 'Avg Time']} />
                      <Bar dataKey="AVERAGE_EXECUTION_SECONDS" fill="url(#userGrad)" radius={[2, 2, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState icon={User} title="No User Data" desc="No user metrics detected." />
              )}
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800/50">
                <WidgetAIInsight title="Average Execution Time by User" widgetType="query_performance" dateRange={dateRange} widgetId="quser_timing" widgetKind="chart" templateKey="user_timing" dataSample={queryUserData?.slice(0, 25) ?? []} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── SECTION 2: TRENDS & HEATMAP ── */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Trend Chart */}
          <Card className={cardClass}>
            <CardHeader className="pb-4 relative z-50">
              <div className="flex items-center gap-2 border-l-2 border-indigo-500 pl-3">
                <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Query Load & Trend
                </CardTitle>
                <InfoTooltip text="Tracks your database activity over time. Watch for the 'Avg Seconds' line spiking upwards while 'Total Queries' stays flat — that indicates a severe system bottleneck." />
              </div>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 pl-3.5 mt-1">
                Volume and performance timeline
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 flex-1 flex flex-col min-w-0 relative z-0">
              {trendData && trendData.length > 0 ? (
                <div className="w-full" style={{ height: 320 }}>
                  <DualAxisChart 
                    data={trendData} 
                    xKey="QUERY_DAY" 
                    barKey="QUERY_COUNT" 
                    lineKey="AVG_SECONDS" 
                    barLabel="Total Queries" 
                    lineLabel="Avg Seconds" 
                    height={320} 
                  />
                </div>
              ) : (
                <EmptyState icon={Activity} title="No Trend Data" desc="Insufficient data to build timeline." />
              )}
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800/50">
                <WidgetAIInsight title="Query Load & Trend" widgetType="query_performance" dateRange={dateRange} widgetId="q_trend" widgetKind="chart" templateKey="query_type_timing" dataSample={trendData?.slice(0, 25) ?? []} />
              </div>
            </CardContent>
          </Card>

          {/* Heatmap */}
          <Card className={cardClass}>
            <CardHeader className="pb-4 relative z-50">
              <div className="flex items-center gap-2 border-l-2 border-purple-500 pl-3">
                <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Workload Heatmap
                </CardTitle>
                <InfoTooltip text="Shows exactly when your database is the busiest during the week. Darker squares mean more queries are running. Use this to schedule heavy automated jobs during 'light' hours." />
              </div>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 pl-3.5 mt-1">
                Query volume by day of week and hour
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 flex-1 flex flex-col min-w-0 relative z-0">
              {heatmapData && heatmapData.length > 0 ? (
                <div className="w-full" style={{ height: 320 }}>
                  <HeatmapChart data={heatmapData} height={320} />
                </div>
              ) : (
                <EmptyState icon={Clock} title="No Heatmap Data" desc="Requires longer timeframe to map." />
              )}
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800/50">
                <WidgetAIInsight title="Workload Heatmap Analysis" widgetType="query_performance" dateRange={dateRange} widgetId="q_heatmap" widgetKind="chart" templateKey="query_type_timing" dataSample={heatmapData?.slice(0, 25) ?? []} />
              </div>
            </CardContent>
          </Card>

        </div>
      </div>

      {/* ── SECTION 3: TOP COST & DURATION ── */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Most Expensive Queries */}
          <Card className={cardClass}>
            <CardHeader className="pb-4 relative z-50">
              <div className="flex items-center gap-2 border-l-2 border-red-500 pl-3">
                <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Most Expensive Queries
                </CardTitle>
                <InfoTooltip text="These specific queries burned the most compute credits (money). Optimizing even one of these top queries can significantly lower your monthly Snowflake bill." />
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col min-w-0 relative z-0">
              {expensiveData && expensiveData.length > 0 ? (
                <TableScroll maxHeight="400px">
                  <table className="w-full text-left">
                    <thead>
                      <tr>
                        <th className={thClass}>Query ID</th>
                        <th className={thClass}>User</th>
                        <th className={`${thClass} text-right`}>{creditUnitLabel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expensiveData.map((q, i) => (
                        <tr key={i} className={trClass} onClick={() => setSelectedQuery(q)}>
                          <td className={`${tdClass} font-mono font-medium flex items-center gap-2`}>
                            {shortenText(q.QUERY_ID, 12)}
                            <button onClick={(e) => copyToClipboard(e, q.QUERY_ID)} className="text-slate-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Copy className="w-3 h-3" />
                            </button>
                          </td>
                          <td className={tdClass}>{shortenText(q.USER_NAME, 15)}</td>
                          <td className={`${tdClass} text-right font-bold text-red-500 dark:text-red-400`}>
                            {formatCreditValue(Number(q.CREDITS_ATTRIBUTED_COMPUTE || 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableScroll>
              ) : (
                <EmptyState icon={Database} title="No Expensive Queries" desc="No high-cost queries detected." />
              )}
            </CardContent>
          </Card>

          {/* Longest Running Queries */}
          <Card className={cardClass}>
            <CardHeader className="pb-4 relative z-50">
              <div className="flex items-center gap-2 border-l-2 border-amber-500 pl-3">
                <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Longest Running Queries
                </CardTitle>
                <InfoTooltip text="These queries took the longest wall-clock time to finish. Slow queries frustrate users and tie up warehouses, blocking other queries from running." />
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col min-w-0 relative z-0">
              {longestData && longestData.length > 0 ? (
                <TableScroll maxHeight="400px">
                  <table className="w-full text-left">
                    <thead>
                      <tr>
                        <th className={thClass}>Query ID</th>
                        <th className={thClass}>User</th>
                        <th className={`${thClass} text-right`}>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {longestData.map((q, i) => (
                        <tr key={i} className={trClass} onClick={() => setSelectedQuery(q)}>
                          <td className={`${tdClass} font-mono font-medium flex items-center gap-2`}>
                            {shortenText(q.QUERY_ID, 12)}
                            <button onClick={(e) => copyToClipboard(e, q.QUERY_ID)} className="text-slate-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Copy className="w-3 h-3" />
                            </button>
                          </td>
                          <td className={tdClass}>{shortenText(q.USER_NAME, 15)}</td>
                          <td className={`${tdClass} text-right font-bold text-amber-600 dark:text-amber-400`}>
                            {formatSeconds(Number(q.TOTAL_ELAPSED_TIME || 0) / 1000)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableScroll>
              ) : (
                <EmptyState icon={Clock} title="No Slow Queries" desc="System performance looks healthy." />
              )}
            </CardContent>
          </Card>

        </div>
      </div>

      {/* ── SECTION 4: INEFFICIENCIES (Spill & Pruning) ── */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Spilling Queries */}
          <Card className={cardClass}>
            <CardHeader className="pb-4 relative z-50">
              <div className="flex items-center gap-2 border-l-2 border-orange-500 pl-3">
                <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Data Spilling to Disk
                </CardTitle>
                <InfoTooltip text="'Spilling' happens when a query runs out of memory (RAM) and is forced to write temporary data to the hard drive. This makes the query extremely slow. You may need to increase the warehouse size." />
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col min-w-0 relative z-0">
              {spillData && spillData.length > 0 ? (
                <TableScroll maxHeight="400px">
                  <table className="w-full text-left">
                    <thead>
                      <tr>
                        <th className={thClass}>Query ID</th>
                        <th className={`${thClass} text-right`}>Local Spill</th>
                        <th className={`${thClass} text-right`}>Remote Spill</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spillData.map((q, i) => (
                        <tr key={i} className={trClass} onClick={() => setSelectedQuery(q)}>
                          <td className={`${tdClass} font-mono font-medium flex items-center gap-2`}>
                            {shortenText(q.QUERY_ID, 12)}
                            <button onClick={(e) => copyToClipboard(e, q.QUERY_ID)} className="text-slate-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Copy className="w-3 h-3" />
                            </button>
                          </td>
                          <td className={`${tdClass} text-right text-orange-500`}>{formatBytes(Number(q.BYTES_SPILLED_TO_LOCAL_STORAGE || 0))}</td>
                          <td className={`${tdClass} text-right text-red-500 font-bold`}>{formatBytes(Number(q.BYTES_SPILLED_TO_REMOTE_STORAGE || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableScroll>
              ) : (
                <EmptyState icon={HardDrive} title="No Spilling" desc="Warehouses have sufficient memory." />
              )}
            </CardContent>
          </Card>

          {/* Partition Pruning Issues */}
          <Card className={cardClass}>
            <CardHeader className="pb-4 relative z-50">
              <div className="flex items-center gap-2 border-l-2 border-pink-500 pl-3">
                <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Poor Partition Pruning
                </CardTitle>
                <InfoTooltip text="These queries scanned way too much data instead of using filters (like a 'WHERE date =' clause). This is a huge waste of resources and usually means bad SQL code." />
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col min-w-0 relative z-0">
              {pruneData && pruneData.length > 0 ? (
                <TableScroll maxHeight="400px">
                  <table className="w-full text-left">
                    <thead>
                      <tr>
                        <th className={thClass}>Query ID</th>
                        <th className={`${thClass} text-right`}>Scanned</th>
                        <th className={`${thClass} text-right`}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pruneData.map((q, i) => (
                        <tr key={i} className={trClass} onClick={() => setSelectedQuery(q)}>
                          <td className={`${tdClass} font-mono font-medium flex items-center gap-2`}>
                            {shortenText(q.QUERY_ID, 12)}
                            <button onClick={(e) => copyToClipboard(e, q.QUERY_ID)} className="text-slate-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Copy className="w-3 h-3" />
                            </button>
                          </td>
                          <td className={`${tdClass} text-right text-pink-500 font-bold`}>{formatNumber(Number(q.PARTITIONS_SCANNED || 0))}</td>
                          <td className={`${tdClass} text-right text-slate-500`}>{formatNumber(Number(q.PARTITIONS_TOTAL || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableScroll>
              ) : (
                <EmptyState icon={Layers} title="Efficient Scanning" desc="No major pruning issues detected." />
              )}
            </CardContent>
          </Card>

        </div>
      </div>

      {/* ── SECTION 5: HIGH FREQUENCY ── */}
      <div>
        <Card className={cardClass}>
          <CardHeader className="pb-4 relative z-50">
            <div className="flex items-center gap-2 border-l-2 border-cyan-500 pl-3">
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                High Frequency / Robotic Queries
              </CardTitle>
              <InfoTooltip text="Queries running thousands of times a day. This is often a sign of a broken automated script, a dashboard refreshing too fast, or an app missing a cache layer." />
            </div>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 pl-3.5 mt-1">
              Exact SQL statements executed repeatedly
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col min-w-0 relative z-0">
            {highFreqData && highFreqData.length > 0 ? (
              <TableScroll maxHeight="400px">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th className={thClass}>Query Text</th>
                      <th className={`${thClass} text-right`}>Executions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {highFreqData.map((q, i) => (
                      <tr key={i} className={trClass}>
                        <td className={`${tdClass} font-mono text-slate-600 dark:text-slate-300`} title={q.QUERY_TEXT}>
                          {shortenText(q.QUERY_TEXT, 80)}
                        </td>
                        <td className={`${tdClass} text-right font-bold text-cyan-600 dark:text-cyan-400`}>
                          {formatNumber(Number(q.EXECUTION_COUNT || 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            ) : (
              <EmptyState icon={Terminal} title="Normal Volume" desc="No unusual robotic query patterns." />
            )}
          </CardContent>
        </Card>
      </div>

      {selectedQuery && (
        <QueryDetailModal query={selectedQuery} onClose={() => setSelectedQuery(null)} isOpen={false} />
      )}

    </div>
  )
}