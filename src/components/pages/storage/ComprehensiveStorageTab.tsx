'use client'

import { useMemo, useEffect, useState } from 'react'
import useFetch from '@/hooks/useApi'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader, AlertCircle, Database, HardDrive, ShieldAlert, Layers, Activity, Archive, TrendingDown, Trash2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { formatBytes, formatNumber, shortenText } from '@/lib/formatting'
import WidgetAIInsight from '@/components/ai/WidgetAIInsight'
import { useTheme } from 'next-themes'
import LighthouseLoader from '@/components/ui/LighthouseLoader'

const PIE_COLORS = ['#3b82f6', '#0ea5e9', '#2dd4bf', '#8b5cf6', '#6366f1', '#4f46e5', '#1e40af']

// ── GLASSMORPHISM TAILWIND CLASSES ───────────────────────────────────────────
// These explicit classes guarantee the frosted glass look in both themes
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

// ── Main Component ───────────────────────────────────────────────────────────

export default function ComprehensiveStorageTab({ dateRange }: { dateRange: { start: Date; end: Date } }) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => setMounted(true), [])

  const start = dateRange.start.toISOString().split('T')[0]
  const end = dateRange.end.toISOString().split('T')[0]

  const { data: summaryDist, isLoading: l1 } = useFetch<any[]>(['storage-summary-dist', start, end], '/api/storage?type=summary')
  const { data: summaryKpi, isLoading: l2 } = useFetch<any[]>(['storage-summary-kpi', start, end], `/api/storage?type=summary_kpi&start=${start}&end=${end}`)
  const { data: topDb, isLoading: l3 } = useFetch<any[]>(['storage-top-db', start, end], `/api/storage?type=top_databases&start=${start}&end=${end}`)
  const { data: overall, isLoading: l4 } = useFetch<any[]>(['storage-overall', start, end], `/api/storage?type=overall&start=${start}&end=${end}`)
  const { data: stageBytes, isLoading: l5 } = useFetch<any[]>(['storage-stage-bytes'], '/api/storage?type=stage_bytes')
  const { data: mostAccessed, isLoading: l6 } = useFetch<any[]>(['storage-most-accessed', start, end], `/api/storage?type=most_accessed&start=${start}&end=${end}`)
  const { data: leastAccessed, isLoading: l7 } = useFetch<any[]>(['storage-least-accessed', start, end], `/api/storage?type=least_accessed&start=${start}&end=${end}`)
  const { data: largeUnused, isLoading: l8 } = useFetch<any[]>(['storage-large-unused', start, end], `/api/storage?type=large_unused&start=${start}&end=${end}`)

  const isLoading = l1 || l2 || l3 || l4 || l5 || l6 || l7 || l8

  // Chart Configuration based on theme
  const isDark = resolvedTheme === 'dark'
  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
  const axisColor = isDark ? '#64748b' : '#94a3b8'

  // Glassmorphism tooltips for Recharts
  const glassTooltip = {
    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.75)' : 'rgba(255, 255, 255, 0.75)',
    backdropFilter: 'blur(16px)',
    border: `1px solid ${isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.8)'}`,
    borderRadius: '12px',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
    color: isDark ? '#f8fafc' : '#0f172a',
    fontSize: '12px'
  }

if (isLoading || !mounted) {
    return <LighthouseLoader />
  }

  const kpi = summaryKpi?.[0]
  const hasAny = !!(summaryDist?.length || topDb?.length || overall?.length || stageBytes?.length || largeUnused?.length)

  if (!hasAny) {
    return <EmptyState icon={Archive} title="No Storage Data" desc="Try adjusting your date range to see usage patterns." />
  }

  const thClass = "py-3 px-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap"
  const tdClass = "py-3 px-4 text-xs"

  return (
    <div className="space-y-8 w-full min-w-0 overflow-hidden px-1">
      
      {/* ── KPI GRID ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 min-w-0">
        {[
          { label: 'Database', val: kpi?.DATABASE_D, icon: Database, color: 'text-blue-500' },
          { label: 'Stage', val: kpi?.STAGE_D, icon: Layers, color: 'text-teal-500' },
          { label: 'Failsafe', val: kpi?.FAILSAFE_D, icon: ShieldAlert, color: 'text-red-500' },
          { label: 'Hybrid', val: kpi?.HYBRID_TABLE_D, icon: Activity, color: 'text-purple-500' },
          { label: 'Total', val: kpi?.TOTAL_STORAGE_D, icon: HardDrive, color: 'text-indigo-500' },
        ].map((item) => (
          <Card key={item.label} className={`${glassCard} p-5 hover:-translate-y-1 flex flex-col justify-center`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg bg-slate-500/10 border border-slate-500/20 backdrop-blur-sm`}>
                <item.icon className={`w-4 h-4 ${item.color}`} />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">{item.label}</p>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white truncate">{formatBytes(Number(item.val || 0))}</p>
          </Card>
        ))}
      </div>

      {/* ── DISTRIBUTION CHARTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
        
        <Card className={glassCard}>
          <CardHeader className={glassHeader}>
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider border-l-2 border-blue-500 pl-3">
              Database Distribution
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 pl-3.5 mt-1">
              Storage composition by database average
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 flex-1 flex flex-col min-w-0">
            {summaryDist && summaryDist.length > 0 ? (
              <div className="w-full h-[320px] overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={summaryDist.slice(0, 8)} dataKey="TOTAL_BYTES" nameKey="DATABASE_NAME" outerRadius={100} innerRadius={60} paddingAngle={2} labelLine={false}>
                      {summaryDist.slice(0, 8).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="rgba(255,255,255,0.1)" />)}
                    </Pie>
<Tooltip 
  contentStyle={glassTooltip} 
  formatter={(v) => formatBytes(v as number)} 
  // ✨ ADD THIS LINE to control the text color:
  itemStyle={{ color: isDark ? '#f8fafc' : '#0f172a', fontWeight: 600 }}
/>                    <Legend wrapperStyle={{ fontSize: '11px', color: axisColor, paddingTop: '10px' }} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyState icon={Activity} title="No Data" desc="Distribution data unavailable." />}
            <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
               <WidgetAIInsight title="Storage Distribution" widgetType="storage_analysis" dateRange={dateRange} widgetId="storage_summary" widgetKind="chart" templateKey="storage_footprint" dataSample={summaryDist?.slice(0, 25) ?? []} />
            </div>
          </CardContent>
        </Card>

        <Card className={glassCard}>
          <CardHeader className={glassHeader}>
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider border-l-2 border-indigo-500 pl-3">
              Top Databases (GB)
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 pl-3.5 mt-1">
              Average storage across selected window
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 flex-1 flex flex-col min-w-0">
            {topDb && topDb.length > 0 ? (
              <div className="w-full h-[320px] overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topDb.map((r) => ({ ...r, GB: Number(r.AVG_BYTES || 0) / 1024 ** 3 })).slice(0, 15)} margin={{ bottom: 40, top: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="DATABASE_NAME" stroke={axisColor} angle={-35} textAnchor="end" tick={{ fontSize: 10 }} dy={10} tickFormatter={(val) => shortenText(val, 12)} />
                    <YAxis stroke={axisColor} tick={{ fontSize: 10 }} width={50} />
                    <Tooltip contentStyle={glassTooltip} cursor={{ fill: gridColor }} formatter={(v) => `${Number(v).toFixed(2)} GB`} />
                    <Bar dataKey="GB" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      <Cell fill="url(#barGradient1)" />
                    </Bar>
                    <defs>
                      <linearGradient id="barGradient1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#1e3a8a" stopOpacity={0.4} />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyState icon={Database} title="No Data" desc="Database metrics unavailable." />}
            <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
               <WidgetAIInsight title="Top Databases" widgetType="storage_analysis" dateRange={dateRange} widgetId="storage_top_databases" widgetKind="chart" templateKey="storage_footprint" dataSample={topDb?.slice(0, 25) ?? []} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── OVERALL STORAGE TIMELINE ── */}
      <Card className={glassCard}>
        <CardHeader className={glassHeader}>
          <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider border-l-2 border-emerald-500 pl-3">
            Overall Storage Footprint
          </CardTitle>
          <CardDescription className="text-xs text-slate-500 dark:text-slate-400 pl-3.5 mt-1">
            Combined footprint of all databases and internal stages
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 flex-1 flex flex-col min-w-0">
          {overall && overall.length > 0 ? (
            <div className="w-full h-[360px] overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overall.map((r) => ({ ...r, SIZE_GB: Number(r.STORAGE_BYTES || 0) / 1024 ** 3 })).slice(0, 30)} margin={{ bottom: 50, top: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="NAME" stroke={axisColor} angle={-40} textAnchor="end" tick={{ fontSize: 10 }} dy={10} tickFormatter={(val) => shortenText(val, 15)} />
                  <YAxis stroke={axisColor} tick={{ fontSize: 10 }} width={60} />
                  <Tooltip contentStyle={glassTooltip} cursor={{ fill: gridColor }} formatter={(v) => `${Number(v).toFixed(2)} GB`} />
                  <Bar dataKey="SIZE_GB" fill="url(#barGradient2)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <defs>
                    <linearGradient id="barGradient2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#047857" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState icon={Layers} title="No Data" desc="Overall storage metrics empty." />}
          <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
            <WidgetAIInsight title="Full Footprint Analysis" widgetType="storage_analysis" dateRange={dateRange} widgetId="storage_overall" widgetKind="chart" templateKey="storage_footprint" dataSample={overall?.slice(0, 40) ?? []} />
          </div>
        </CardContent>
      </Card>

      {/* ── TABLES: STAGES & UNUSED ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
        
        <Card className={glassCard}>
          <CardHeader className={glassHeader}>
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider border-l-2 border-slate-500 pl-3">
              Stage Storage Usage
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 min-w-0">
            {stageBytes && stageBytes.length > 0 ? (
              <TableScroll maxHeight="400px">
                <table className="w-full text-sm text-left">
                  <thead className={glassTableHead}>
                    <tr><th className={thClass}>Stage Name</th><th className={`${thClass} text-right`}>Size</th></tr>
                  </thead>
                  <tbody>
                    {stageBytes.slice(0, 50).map((r, i) => (
                      <tr key={i} className={glassRow}>
                        <td className={`${tdClass} font-medium text-slate-700 dark:text-slate-300`}>{shortenText(r.STAGE_NAME, 40)}</td>
                        <td className={`${tdClass} text-right font-bold text-slate-900 dark:text-white`}>{formatBytes(Number(r.TOTAL_BYTES || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            ) : <EmptyState icon={Layers} title="No Stages" desc="No data found in internal stages." />}
            <div className="p-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-500/5 backdrop-blur-md">
              <WidgetAIInsight title="Stage Utilization" widgetType="storage_analysis" dateRange={dateRange} widgetId="storage_stage_bytes" widgetKind="table" templateKey="storage_footprint" dataSample={stageBytes?.slice(0, 40) ?? []} />
            </div>
          </CardContent>
        </Card>

        <Card className={glassCard}>
          <CardHeader className={glassHeader}>
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider border-l-2 border-orange-500 pl-3">
              Large Inactive Tables
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 pl-3.5 mt-1">
              Candidate tables for cleanup or archiving
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 min-w-0">
            {largeUnused && largeUnused.length > 0 ? (
              <TableScroll maxHeight="400px">
                <table className="w-full text-sm text-left">
                  <thead className={glassTableHead}>
                    <tr><th className={thClass}>Table Path</th><th className={`${thClass} text-right`}>GB</th><th className={`${thClass} text-right`}>Last Read</th></tr>
                  </thead>
                  <tbody>
                    {largeUnused.map((r, i) => (
                      <tr key={i} className={glassRow}>
                        <td className={`${tdClass} font-medium text-slate-700 dark:text-slate-300`} title={r.FQ_TABLE_NAME}>{shortenText(r.FQ_TABLE_NAME, 30)}</td>
                        <td className={`${tdClass} text-right font-bold text-amber-600 dark:text-amber-400`}>{Number(r.ACTIVE_GB || 0).toFixed(1)}</td>
                        <td className={`${tdClass} text-right text-slate-500 dark:text-slate-400`}>{r.LAST_ACCESS_TIME ? new Date(r.LAST_ACCESS_TIME).toLocaleDateString() : 'Never'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            ) : <EmptyState icon={Trash2} title="Clean Slate" desc="No large unused tables detected." />}
            <div className="p-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-500/5 backdrop-blur-md">
              <WidgetAIInsight title="Cleanup Opportunities" widgetType="storage_analysis" dateRange={dateRange} widgetId="storage_large_unused_tables" widgetKind="table" templateKey="table_access_optimization" dataSample={largeUnused?.slice(0, 30) ?? []} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── ACCESS FREQUENCY ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
        
        <Card className={glassCard}>
          <CardHeader className={glassHeader}>
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider border-l-2 border-blue-500 pl-3">
              Most Accessed Tables
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 min-w-0">
            {mostAccessed && mostAccessed.length > 0 ? (
              <TableScroll maxHeight="400px">
                <table className="w-full text-sm text-left">
                  <thead className={glassTableHead}>
                    <tr><th className={thClass}>Full Path</th><th className={`${thClass} text-right`}>Access Count</th></tr>
                  </thead>
                  <tbody>
                    {mostAccessed.map((r, i) => (
                      <tr key={i} className={glassRow}>
                        <td className={`${tdClass} text-slate-700 dark:text-slate-300 font-mono`} title={r.FULL_TABLE_NAME}>{shortenText(r.FULL_TABLE_NAME, 40)}</td>
                        <td className={`${tdClass} text-right font-bold text-blue-600 dark:text-blue-400`}>{formatNumber(r.ACCESS_COUNT)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            ) : <EmptyState icon={Activity} title="No Metrics" desc="Access patterns not yet tracked." />}
            <div className="p-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-500/5 backdrop-blur-md">
               <WidgetAIInsight title="Hot Tables" widgetType="storage_analysis" dateRange={dateRange} widgetId="storage_most_accessed_tables" widgetKind="table" templateKey="table_access_optimization" dataSample={mostAccessed?.slice(0, 30) ?? []} />
            </div>
          </CardContent>
        </Card>

        <Card className={glassCard}>
          <CardHeader className={glassHeader}>
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider border-l-2 border-red-500 pl-3">
              Least Accessed Tables
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 min-w-0">
            {leastAccessed && leastAccessed.length > 0 ? (
              <TableScroll maxHeight="400px">
                <table className="w-full text-sm text-left">
                  <thead className={glassTableHead}>
                    <tr><th className={thClass}>Full Path</th><th className={`${thClass} text-right`}>Access Count</th></tr>
                  </thead>
                  <tbody>
                    {leastAccessed.map((r, i) => (
                      <tr key={i} className={glassRow}>
                        <td className={`${tdClass} text-slate-700 dark:text-slate-300 font-mono`} title={r.FULL_TABLE_NAME}>{shortenText(r.FULL_TABLE_NAME, 40)}</td>
                        <td className={`${tdClass} text-right font-bold text-red-600 dark:text-red-400`}>{formatNumber(r.ACCESS_COUNT)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            ) : <EmptyState icon={TrendingDown} title="No Metrics" desc="Access patterns not yet tracked." />}
            <div className="p-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-500/5 backdrop-blur-md">
              <WidgetAIInsight title="Cold Tables" widgetType="storage_analysis" dateRange={dateRange} widgetId="storage_least_accessed_tables" widgetKind="table" templateKey="table_access_optimization" dataSample={leastAccessed?.slice(0, 30) ?? []} />
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  )
}