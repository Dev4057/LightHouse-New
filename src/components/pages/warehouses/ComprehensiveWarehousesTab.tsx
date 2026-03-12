'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import useFetch from '@/hooks/useApi'
import { Search, Database, AlertTriangle, TrendingDown, TrendingUp, Users, Moon, Activity, ServerCog } from 'lucide-react'
import { formatNumber } from '@/lib/formatting'
import { useSpendDisplay } from '@/hooks/useSpendDisplay'
import WidgetAIInsight from '@/components/ai/WidgetAIInsight'
import type { WarehouseCredit, ServiceCredit, IdleCost, OverprovisionedWH, UnderprovisionedWH, WarehouseUser, DormantWarehouse, MixedWorkload, Warehouse } from '@/types'
import { useTheme } from 'next-themes'
import LighthouseLoader from '@/components/ui/LighthouseLoader'
import InfoTooltip from '@/components/ui/InfoTooltip' // ✨ Imported Tooltip

interface WarehousesPageProps {
  dateRange: { start: Date; end: Date }
}

const PIE_COLORS = ['#3b82f6', '#0ea5e9', '#2dd4bf', '#8b5cf6', '#6366f1', '#4f46e5', '#1e40af']

// ── Reusable components ──────────────────────────────────────────────────────

const EmptyState = ({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center w-full">
    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center mb-3 border border-slate-200 dark:border-slate-700/50">
      <Icon className="w-5 h-5 text-slate-400 dark:text-slate-500" />
    </div>
    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h4>
    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">{desc}</p>
  </div>
)

const TableScroll = ({ children, maxHeight }: { children: React.ReactNode; maxHeight?: string }) => (
  <div
    className="w-full min-w-0 max-w-full overflow-x-auto scrollbar-thin"
    style={{ maxHeight: maxHeight ?? 'none', overflowY: maxHeight ? 'auto' : 'visible' }}
  >
    {children}
  </div>
)

// ── Main page ────────────────────────────────────────────────────────────────

export default function ComprehensiveWarehousesPage({ dateRange }: WarehousesPageProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isDark = mounted ? resolvedTheme === 'dark' : true

  const startDate = dateRange.start.toISOString().split('T')[0]
  const endDate = dateRange.end.toISOString().split('T')[0]

  const { data: rawWhCredits, isLoading: loadingCredits } = useFetch<any>(['wh-credits', startDate, endDate], `/api/warehouses?type=credits&start=${startDate}&end=${endDate}`)
  const { data: rawServices, isLoading: loadingServices } = useFetch<any>(['service-credits', startDate, endDate], `/api/warehouses?type=services&start=${startDate}&end=${endDate}`)
  const { data: rawIdle, isLoading: loadingIdle } = useFetch<any>(['idle-cost', startDate, endDate], `/api/warehouses?type=idle&start=${startDate}&end=${endDate}`)
  const { data: rawOverprov, isLoading: loadingOverprov } = useFetch<any>(['overprovisioned', startDate, endDate], `/api/warehouses?type=overprovisioned&start=${startDate}&end=${endDate}`)
  const { data: rawUnderprov, isLoading: loadingUnderprov } = useFetch<any>(['underprovisioned', startDate, endDate], `/api/warehouses?type=underprovisioned&start=${startDate}&end=${endDate}`)
  const { data: rawByUser, isLoading: loadingByUser } = useFetch<any>(['warehouse-user-credits', startDate, endDate], `/api/warehouses?type=by_user&start=${startDate}&end=${endDate}`)
  const { data: rawDormant, isLoading: loadingDormant } = useFetch<any>(['dormant-warehouses', startDate, endDate], `/api/warehouses?type=dormant&start=${startDate}&end=${endDate}`)
  const { data: rawMixed, isLoading: loadingMixed } = useFetch<any>(['mixed-workloads', startDate, endDate], `/api/warehouses?type=mixed&start=${startDate}&end=${endDate}`)
  const { data: rawWarehouseList, error: warehouseListError, refetch: refetchWarehouseList } = useFetch<any>(['warehouse-list-controls'], '/api/warehouses?type=list')

  const whCredits = useMemo(() => rawWhCredits?.data || (Array.isArray(rawWhCredits) ? rawWhCredits : []), [rawWhCredits])
  const services = useMemo(() => rawServices?.data || (Array.isArray(rawServices) ? rawServices : []), [rawServices])
  const idle = useMemo(() => rawIdle?.data || (Array.isArray(rawIdle) ? rawIdle : []), [rawIdle])
  const overprov = useMemo(() => rawOverprov?.data || (Array.isArray(rawOverprov) ? rawOverprov : []), [rawOverprov])
  const underprov = useMemo(() => rawUnderprov?.data || (Array.isArray(rawUnderprov) ? rawUnderprov : []), [rawUnderprov])
  const byUser = useMemo(() => rawByUser?.data || (Array.isArray(rawByUser) ? rawByUser : []), [rawByUser])
  const dormant = useMemo(() => rawDormant?.data || (Array.isArray(rawDormant) ? rawDormant : []), [rawDormant])
  const mixed = useMemo(() => rawMixed?.data || (Array.isArray(rawMixed) ? rawMixed : []), [rawMixed])
  const warehouseList = useMemo(() => rawWarehouseList?.data || (Array.isArray(rawWarehouseList) ? rawWarehouseList : []), [rawWarehouseList])

  const isLoading = loadingCredits || loadingServices || loadingIdle || loadingOverprov || loadingUnderprov || loadingByUser || loadingDormant || loadingMixed
  const hasData = !!(whCredits?.length || services?.length || idle?.length)

  const [warehouseControls, setWarehouseControls] = useState<Record<string, { autoSuspend: string; autoResume: boolean }>>({})
  const [savingWarehouse, setSavingWarehouse] = useState<string | null>(null)
  const [warehouseControlError, setWarehouseControlError] = useState<string | null>(null)
  const [warehouseControlMessage, setWarehouseControlMessage] = useState<string | null>(null)
  const { isUsd, creditUnitLabel, convertCredits, formatCreditValue } = useSpendDisplay()

  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
  const axisColor = isDark ? '#64748b' : '#94a3b8'

  const glassTooltipStyle = {
    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(16px)',
    border: `1px solid ${isDark ? 'rgba(51, 65, 85, 0.8)' : 'rgba(226, 232, 240, 0.8)'}`,
    borderRadius: '8px',
    boxShadow: '0 8px 32px 0 rgba(0,0,0,0.2)',
    color: isDark ? '#f8fafc' : '#0f172a',
    fontSize: '12px',
  }

  const n = (value: unknown) => { const p = Number(value); return Number.isFinite(p) ? p : 0 }
  const firstRecommendationPart = (value: unknown) => String(value || '').split(' - ')[0] || '-'

  const idleRows = useMemo(() => (idle ?? []).map((row: any) => ({
    ...row,
    WAREHOUSE_NAME: row.WAREHOUSE_NAME ?? row.warehouse_name ?? '',
    total_compute_credits: row.total_compute_credits ?? row.TOTAL_COMPUTE_CREDITS,
    query_execution_credits: row.query_execution_credits ?? row.QUERY_EXECUTION_CREDITS,
    idle_credits: row.idle_credits ?? row.IDLE_CREDITS,
    idle_percentage: row.idle_percentage ?? row.IDLE_PERCENTAGE,
    estimated_idle_cost_usd: row.estimated_idle_cost_usd ?? row.ESTIMATED_IDLE_COST_USD,
    recommendation: row.recommendation ?? row.RECOMMENDATION,
  })), [idle])

  const maxIdleCredits = useMemo(() => {
    if (!idleRows.length) return 1
    return Math.max(...idleRows.map((r: any) => n(r.idle_credits)))
  }, [idleRows])

  const maxUserCredits = useMemo(() => {
    if (!byUser?.length) return 1
    return Math.max(...byUser.map((u: any) => n(u.CREDITS)))
  }, [byUser])

  useEffect(() => {
    if (!warehouseList?.length) return
    setWarehouseControls((prev) => {
      const next = { ...prev }
      for (const wh of warehouseList) {
        if (!next[wh.WAREHOUSE_NAME]) {
          next[wh.WAREHOUSE_NAME] = {
            autoSuspend: wh.AUTO_SUSPEND === null || typeof wh.AUTO_SUSPEND === 'undefined' ? '' : String(wh.AUTO_SUSPEND),
            autoResume: Boolean(wh.AUTO_RESUME),
          }
        }
      }
      return next
    })
  }, [warehouseList])

  async function saveWarehouseControls(warehouseName: string) {
    const draft = warehouseControls[warehouseName]
    if (!draft || savingWarehouse) return
    setSavingWarehouse(warehouseName)
    setWarehouseControlError(null)
    setWarehouseControlMessage(null)
    try {
      const response = await fetch('/api/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_controls', warehouseName, autoSuspend: draft.autoSuspend === '' ? null : Number(draft.autoSuspend), autoResume: draft.autoResume }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error?.message || payload?.error || 'Failed to update warehouse controls')
      setWarehouseControlMessage(`Updated controls for ${warehouseName}`)
      await refetchWarehouseList()
    } catch (e) {
      setWarehouseControlError(e instanceof Error ? e.message : 'Failed to update warehouse controls')
    } finally {
      setSavingWarehouse(null)
    }
  }

  if (isLoading || !mounted) {
    return <LighthouseLoader />
  }

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white/60 dark:bg-slate-900/40 backdrop-blur-md rounded-xl border border-slate-200 dark:border-slate-700/50 w-full">
        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 border border-slate-200 dark:border-slate-700">
          <Search className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">No Warehouse Data Found</h3>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm text-center px-4">Try expanding your selected date range.</p>
      </div>
    )
  }

  // ✨ FIX: Removed overflow-hidden from the main card container, added z-10
  const cardClass = "bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl  w-full min-w-0 flex flex-col transition-all duration-300 relative z-10"
  
  const tdClass = "py-3 px-4 text-xs"
  const thClass = "py-3 px-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap bg-slate-100/80 dark:bg-slate-950/80 sticky top-0 z-0 border-b border-slate-200 dark:border-slate-800" // ✨ Lowered z-index of table header
  const trClass = "even:bg-slate-50 dark:even:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800/50 last:border-0 transition-colors"
  const cardHeaderClass = "pb-4 border-b border-slate-200/50 dark:border-slate-700/50 relative z-50" // ✨ Added z-50 to Header
  const cardFooterClass = "p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40"
  const sectionDividerClass = "border-b border-slate-200 dark:border-slate-800 pb-8"

  return (
    <div className="space-y-8 w-full min-w-0"> {/* ✨ Removed overflow-hidden */}

      {/* ── SECTION 1: COST DISTRIBUTION ── */}
      <div className={sectionDividerClass}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"> {/* ✨ Removed overflow-hidden */}

          {/* Credits by Warehouse */}
          <Card className={cardClass}>
            <CardHeader className={cardHeaderClass}>
              <div className="flex items-center gap-2 border-l-2 border-blue-500 pl-3">
                <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                  {creditUnitLabel} Consumed by Warehouse
                </CardTitle>
                <InfoTooltip text="Warehouses are the 'compute engines' running your database. This chart shows exactly which engines are burning the most fuel (credits) to complete their tasks." />
              </div>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 pl-3.5 mt-1">
                Total spend breakdown across compute resources
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 flex-1 flex flex-col min-w-0 p-6 relative z-0"> {/* ✨ Added z-0 to Content */}
              {whCredits && whCredits.length > 0 ? (
                <div className="w-full" style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={whCredits.map((row: any) => ({ ...row, TOTAL_SPEND_DISPLAY: convertCredits(row.TOTAL_CREDITS_USED) }))}
                      margin={{ top: 20, right: 20, left: 10, bottom: 20 }}
                    >
                      <defs>
                        <linearGradient id="whGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#1e3a8a" stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis
                        dataKey="WAREHOUSE_NAME"
                        stroke={axisColor}
                        axisLine={{ stroke: axisColor }}
                        tickLine={false}
                        tick={{ fill: axisColor, fontSize: 10 }}
                        dy={10}
                        tickFormatter={(val) => val.length > 10 ? `${val.substring(0, 10)}…` : val}
                      />
                      <YAxis
                        stroke={axisColor}
                        axisLine={{ stroke: axisColor }}
                        tickLine={false}
                        tick={{ fill: axisColor, fontSize: 10 }}
                        width={60}
                        label={{ value: creditUnitLabel, angle: -90, position: 'insideLeft', offset: 15, fill: axisColor, fontSize: 11, fontWeight: 600 }}
                      />
                      <Tooltip 
                        contentStyle={glassTooltipStyle} 
                        formatter={(v) => formatCreditValue(v as number)} 
                        itemStyle={{ color: isDark ? '#f8fafc' : '#0f172a', fontWeight: 600 }}
                      />
                      <Bar dataKey="TOTAL_SPEND_DISPLAY" fill="url(#whGrad)" radius={[2, 2, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState icon={Database} title="No Warehouse Usage" desc="No compute credits consumed in this period." />
              )}
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800/50">
                <WidgetAIInsight title="Credits Consumed by Each Warehouse" widgetType="warehouse_optimization" dateRange={dateRange} widgetId="wh_credits_by_warehouse" widgetKind="chart" templateKey="warehouse_cost_distribution" dataSample={whCredits?.slice(0, 25) ?? []} />
              </div>
            </CardContent>
          </Card>

          {/* Service Type Credits */}
          <Card className={cardClass}>
            <CardHeader className={cardHeaderClass}>
              <div className="flex items-center gap-2 border-l-2 border-indigo-500 pl-3">
                <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                  {creditUnitLabel} by Service Type
                </CardTitle>
                <InfoTooltip text="Snowflake bills for different types of operations. This splits your bill into Compute (running queries), Storage (holding data), and Cloud Services (background maintenance)." />
              </div>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 pl-3.5 mt-1">
                Compute, storage, and cloud services breakdown
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 flex-1 flex flex-col min-w-0 p-6 relative z-0">
              {services && services.length > 0 ? (
                <div className="w-full" style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        <linearGradient id="pieGrad0" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                          <stop offset="100%" stopColor="#1e3a8a" stopOpacity={0.7} />
                        </linearGradient>
                        <linearGradient id="pieGrad1" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
                          <stop offset="100%" stopColor="#4c1d95" stopOpacity={0.7} />
                        </linearGradient>
                        <linearGradient id="pieGrad2" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#2dd4bf" stopOpacity={1} />
                          <stop offset="100%" stopColor="#0f766e" stopOpacity={0.7} />
                        </linearGradient>
                        <linearGradient id="pieGrad3" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#0ea5e9" stopOpacity={1} />
                          <stop offset="100%" stopColor="#0369a1" stopOpacity={0.7} />
                        </linearGradient>
                        <linearGradient id="pieGrad4" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#f43f5e" stopOpacity={1} />
                          <stop offset="100%" stopColor="#9f1239" stopOpacity={0.7} />
                        </linearGradient>
                      </defs>
                      <Pie
                        data={services.map((row: any) => ({ ...row, TOTAL_SPEND_DISPLAY: convertCredits(row.TOTAL_CREDITS) }))}
                        dataKey="TOTAL_SPEND_DISPLAY"
                        nameKey="SERVICE_TYPE"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        innerRadius={65}
                        paddingAngle={3}
                        stroke="none"
                      >
                        {services.map((_: any, index: number) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={`url(#pieGrad${index % 5})`}
                            stroke="rgba(148, 163, 184, 0.1)"
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={glassTooltipStyle} 
                        formatter={(v) => formatCreditValue(v as number)} 
                        itemStyle={{ color: isDark ? '#f8fafc' : '#0f172a', fontWeight: 600 }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', color: axisColor, paddingTop: '10px' }} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState icon={Activity} title="No Service Data" desc="No service consumption recorded." />
              )}
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800/50">
                <WidgetAIInsight title="Credit Consumption by Service Type" widgetType="cost_analysis" dateRange={dateRange} widgetId="wh_service_type_credits" widgetKind="chart" templateKey="warehouse_cost_distribution" dataSample={services?.slice(0, 25) ?? []} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── SECTION 2: EFFICIENCY & SIZING ── */}
      <div className={`${sectionDividerClass} space-y-6`}>

        {/* Idle Cost */}
        <Card className={cardClass}>
          <CardHeader className={cardHeaderClass}>
            <div className="flex items-center gap-2 border-l-2 border-red-500 pl-3">
              <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                Idle Spend by Warehouse
              </CardTitle>
              <InfoTooltip text="Highlights warehouses that are running but not executing any queries. This is pure wasted money. Fix this by lowering your Auto-Suspend settings below." />
            </div>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 pl-3.5 mt-1">
              {isUsd ? 'Estimated USD cost of unused compute resources' : 'Idle compute credits (unused warehouse spend)'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 min-w-0 relative z-0">
            {idleRows.length > 0 ? (
              <TableScroll maxHeight="500px">
                <table className="min-w-[600px] w-full text-sm text-left">
                  <thead className={thClass}>
                    <tr>
                      <th className={`w-10 text-center`}>#</th>
                      <th>Warehouse</th>
                      <th className={`text-right hidden sm:table-cell`}>Total {creditUnitLabel}</th>
                      <th className={`text-right hidden md:table-cell`}>Query {creditUnitLabel}</th>
                      <th className={`text-right`}>Idle %</th>
                      <th className={`text-right`}>Idle {creditUnitLabel}</th>
                      <th className={`hidden lg:table-cell`}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {idleRows.map((w: any, i: number) => {
                      const costPct = Math.min(100, Math.max(2, (n(w.idle_credits) / maxIdleCredits) * 100))
                      return (
                        <tr key={i} className={trClass}>
                          <td className={`${tdClass} text-center text-slate-500 font-medium`}>{i + 1}</td>
                          <td className={tdClass}>
                            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                              <Database className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
                              <span className="text-[11px] font-medium truncate max-w-[120px]">{w.WAREHOUSE_NAME}</span>
                            </div>
                          </td>
                          <td className={`${tdClass} text-right text-slate-600 dark:text-slate-300 hidden sm:table-cell whitespace-nowrap`}>{formatCreditValue(w.total_compute_credits)}</td>
                          <td className={`${tdClass} text-right text-slate-600 dark:text-slate-300 hidden md:table-cell whitespace-nowrap`}>{formatCreditValue(w.query_execution_credits)}</td>
                          <td className={`${tdClass} text-right font-bold text-amber-500 dark:text-amber-400 whitespace-nowrap`}>{n(w.idle_percentage).toFixed(1)}%</td>
                          <td className={`${tdClass} text-right relative`}>
                            <div className="absolute inset-y-2 right-4 bg-red-500/15 rounded pointer-events-none" style={{ width: `calc(${costPct}% - 1rem)` }} />
                            <span className="relative z-10 text-xs font-bold text-red-500 dark:text-red-400 whitespace-nowrap">{formatCreditValue(w.idle_credits)}</span>
                          </td>
                          <td className={`${tdClass} text-slate-500 dark:text-slate-400 hidden lg:table-cell`}>
                            <span className="truncate block max-w-[180px] text-[11px]" title={w.recommendation}>{firstRecommendationPart(w.recommendation)}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </TableScroll>
            ) : (
              <EmptyState icon={Moon} title="No Idle Cost" desc="No material idle cost detected — good auto-suspend settings!" />
            )}
            <div className={cardFooterClass}>
              <WidgetAIInsight title="Idle Cost Consumed by Warehouse" widgetType="warehouse_optimization" dateRange={dateRange} widgetId="wh_idle_cost" widgetKind="table" templateKey="idle_cost" dataSample={idleRows.slice(0, 30)} />
            </div>
          </CardContent>
        </Card>

        {/* Over / Under provisioned */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Overprovisioned */}
          <Card className={cardClass}>
            <CardHeader className={cardHeaderClass}>
              <div className="flex items-center gap-2 border-l-2 border-amber-500 pl-3">
                <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                  Overprovisioned Warehouses
                </CardTitle>
                <InfoTooltip text="These warehouses are too large for the work they are doing. You can safely 'downsize' them (e.g., from Large to Medium) to save money without hurting performance." />
              </div>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 pl-3.5 mt-1">
                Low utilization with no queueing downsize opportunity
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 min-w-0 relative z-0">
              {overprov && overprov.length > 0 ? (
                <TableScroll>
                  <table className="min-w-[400px] w-full text-sm text-left">
                    <thead className={thClass}>
                      <tr>
                        <th className={`w-10 text-center`}>#</th>
                        <th>Warehouse</th>
                        <th className={`text-right`}>Util %</th>
                        <th className={`text-right hidden sm:table-cell`}>Queue %</th>
                        <th className={`text-right`}>{creditUnitLabel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overprov.map((w: any, i: number) => (
                        <tr key={i} className={trClass}>
                          <td className={`${tdClass} text-center text-slate-500 font-medium`}>{i + 1}</td>
                          <td className={tdClass}><span className="text-[11px] font-medium text-slate-700 dark:text-slate-200 truncate block max-w-[120px]">{w.warehouse_name}</span></td>
                          <td className={`${tdClass} text-right font-bold text-amber-500 dark:text-amber-400 whitespace-nowrap`}>{n(w.utilization_percentage).toFixed(1)}%</td>
                          <td className={`${tdClass} text-right text-slate-600 dark:text-slate-300 hidden sm:table-cell whitespace-nowrap`}>{(n(w.avg_queued_load_ratio) * 100).toFixed(2)}%</td>
                          <td className={`${tdClass} text-right text-slate-700 dark:text-slate-200 whitespace-nowrap`}>{formatCreditValue(w.total_credits || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableScroll>
              ) : (
                <EmptyState icon={TrendingDown} title="Well Provisioned" desc="No overprovisioned warehouses detected." />
              )}
              <div className={cardFooterClass}>
                <WidgetAIInsight title="Overprovisioned Warehouses" widgetType="warehouse_optimization" dateRange={dateRange} widgetId="wh_overprovisioned" widgetKind="table" templateKey="warehouse_sizing" dataSample={overprov?.slice(0, 30) ?? []} />
              </div>
            </CardContent>
          </Card>

          {/* Underprovisioned */}
          <Card className={cardClass}>
            <CardHeader className={cardHeaderClass}>
              <div className="flex items-center gap-2 border-l-2 border-red-500 pl-3">
                <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                  Underprovisioned Warehouses
                </CardTitle>
                <InfoTooltip text="These warehouses are struggling to keep up with the volume of queries. Users are likely experiencing slow load times. Consider 'upsizing' them or adding clusters." />
              </div>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 pl-3.5 mt-1">
                High utilization with queueing upsize opportunity
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 min-w-0 relative z-0">
              {underprov && underprov.length > 0 ? (
                <TableScroll>
                  <table className="min-w-[400px] w-full text-sm text-left">
                    <thead className={thClass}>
                      <tr>
                        <th className={`w-10 text-center`}>#</th>
                        <th>Warehouse</th>
                        <th className={`text-right`}>Util %</th>
                        <th className={`text-right hidden sm:table-cell`}>Queue %</th>
                        <th className={`hidden md:table-cell`}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {underprov.map((w: any, i: number) => (
                        <tr key={i} className={trClass}>
                          <td className={`${tdClass} text-center text-slate-500 font-medium`}>{i + 1}</td>
                          <td className={tdClass}><span className="text-[11px] font-medium text-slate-700 dark:text-slate-200 truncate block max-w-[120px]">{w.WAREHOUSE_NAME}</span></td>
                          <td className={`${tdClass} text-right font-bold text-red-500 dark:text-red-400 whitespace-nowrap`}>{n(w.utilization_percentage).toFixed(1)}%</td>
                          <td className={`${tdClass} text-right font-bold text-red-500 dark:text-red-400 hidden sm:table-cell whitespace-nowrap`}>{(n(w.avg_queued_load_ratio) * 100).toFixed(2)}%</td>
                          <td className={`${tdClass} text-blue-600 dark:text-blue-400 hidden md:table-cell`}>
                            <span className="truncate block max-w-[140px] text-[11px]" title={w.recommendation}>{firstRecommendationPart(w.recommendation)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableScroll>
              ) : (
                <EmptyState icon={TrendingUp} title="Adequately Sized" desc="All warehouses handling load well." />
              )}
              <div className={cardFooterClass}>
                <WidgetAIInsight title="Underprovisioned Warehouses" widgetType="warehouse_optimization" dateRange={dateRange} widgetId="wh_underprovisioned" widgetKind="table" templateKey="warehouse_sizing" dataSample={underprov?.slice(0, 30) ?? []} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── SECTION 3: USAGE & CONTROLS ── */}
      <div className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* User Attribution */}
          <Card className={cardClass}>
            <CardHeader className={cardHeaderClass}>
              <div className="flex items-center gap-2 border-l-2 border-blue-400 pl-3">
                <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                  Credit Consumed by Each User
                </CardTitle>
                <InfoTooltip text="Shows exactly which people or automated service accounts are driving up your warehouse costs. Great for finding rogue scripts." />
              </div>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 pl-3.5 mt-1">
                Top user/warehouse credit attribution
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 min-w-0 relative z-0">
              {byUser && byUser.length > 0 ? (
                <TableScroll maxHeight="400px">
                  <table className="min-w-[380px] w-full text-sm text-left">
                    <thead className={thClass}>
                      <tr>
                        <th className={`w-10 text-center`}>#</th>
                        <th>User</th>
                        <th className={`hidden sm:table-cell`}>Warehouse</th>
                        <th className={`text-right`}>{creditUnitLabel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byUser.slice(0, 25).map((row: any, i: number) => {
                        const costPct = Math.min(100, Math.max(2, (n(row.CREDITS) / maxUserCredits) * 100))
                        return (
                          <tr key={i} className={trClass}>
                            <td className={`${tdClass} text-center text-slate-500 font-medium`}>{i + 1}</td>
                            <td className={tdClass}><span className="text-[11px] font-medium text-slate-700 dark:text-slate-200 truncate block max-w-[120px]">{row.USER_NAME}</span></td>
                            <td className={`${tdClass} hidden sm:table-cell`}><span className="text-[11px] text-slate-500 dark:text-slate-400 truncate block max-w-[120px]">{row.WAREHOUSE_NAME}</span></td>
                            <td className={`${tdClass} text-right relative`}>
                              <div className="absolute inset-y-2 right-4 bg-blue-500/15 rounded pointer-events-none" style={{ width: `calc(${costPct}% - 1rem)` }} />
                              <span className="relative z-10 text-xs font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">{formatCreditValue(row.CREDITS)}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </TableScroll>
              ) : (
                <EmptyState icon={Users} title="No User Data" desc="No user credit attribution available." />
              )}
              <div className={cardFooterClass}>
                <WidgetAIInsight title="Credit Consumed by Each User" widgetType="cost_analysis" dateRange={dateRange} widgetId="wh_credits_by_user" widgetKind="table" templateKey="warehouse_cost_distribution" dataSample={byUser?.slice(0, 30) ?? []} />
              </div>
            </CardContent>
          </Card>

          {/* Dormant + Mixed stacked */}
          <div className="flex flex-col gap-6 min-w-0">

            <Card className={cardClass}>
              <CardHeader className={cardHeaderClass}>
                <div className="flex items-center gap-2 border-l-2 border-slate-500 pl-3">
                  <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                    Dormant Warehouses
                  </CardTitle>
                  <InfoTooltip text="These warehouses haven't executed a query in a long time. You can probably safely delete them to clean up your Snowflake environment." />
                </div>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400 pl-3.5 mt-1">
                  Warehouses with negligible usage (&lt; 1 credit)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 min-w-0 relative z-0">
                {dormant && dormant.length > 0 ? (
                  <TableScroll maxHeight="180px">
                    <table className="min-w-[320px] w-full text-sm text-left">
                      <thead className={thClass}>
                        <tr>
                          <th>Warehouse</th>
                          <th className={`text-right`}>{creditUnitLabel}</th>
                          <th className={`text-right`}>Days Inactive</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dormant.map((w: any, i: number) => (
                          <tr key={i} className={trClass}>
                            <td className={tdClass}><span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate block max-w-[140px]">{w.WAREHOUSE_NAME}</span></td>
                            <td className={`${tdClass} text-right text-slate-500 dark:text-slate-400 whitespace-nowrap`}>{formatCreditValue(w.total_credit)}</td>
                            <td className={`${tdClass} text-right font-bold text-amber-500 dark:text-amber-400 whitespace-nowrap`}>{w.days_since_active}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableScroll>
                ) : (
                  <EmptyState icon={Moon} title="No Dormant Warehouses" desc="All active warehouses are utilized." />
                )}
              </CardContent>
            </Card>

            <Card className={cardClass}>
              <CardHeader className={cardHeaderClass}>
                <div className="flex items-center gap-2 border-l-2 border-purple-500 pl-3">
                  <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                    Mixed Workloads
                  </CardTitle>
                  <InfoTooltip text="These warehouses are processing both tiny, fast queries and massive, slow queries at the same time. You should create separate warehouses for these workloads so the big jobs don't block the small ones." />
                </div>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400 pl-3.5 mt-1">
                  Warehouses executing multiple workload sizes
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 min-w-0 relative z-0">
                {mixed && mixed.length > 0 ? (
                  <TableScroll maxHeight="180px">
                    <table className="min-w-[320px] w-full text-sm text-left">
                      <thead className={thClass}>
                        <tr>
                          <th>Warehouse</th>
                          <th className={`text-right`}>S</th>
                          <th className={`text-right`}>M</th>
                          <th className={`text-right hidden sm:table-cell`}>L</th>
                          <th className={`text-right hidden sm:table-cell`}>XL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mixed.map((w: any, i: number) => (
                          <tr key={i} className={trClass}>
                            <td className={tdClass}><span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate block max-w-[130px]">{w.WAREHOUSE_NAME}</span></td>
                            <td className={`${tdClass} text-right text-slate-500 dark:text-slate-400 whitespace-nowrap`}>{formatNumber(w.SMALL_QUERIES)}</td>
                            <td className={`${tdClass} text-right text-slate-500 dark:text-slate-400 whitespace-nowrap`}>{formatNumber(w.MEDIUM_QUERIES)}</td>
                            <td className={`${tdClass} text-right text-slate-500 dark:text-slate-400 hidden sm:table-cell whitespace-nowrap`}>{formatNumber(w.LARGE_QUERIES)}</td>
                            <td className={`${tdClass} text-right text-slate-500 dark:text-slate-400 hidden sm:table-cell whitespace-nowrap`}>{formatNumber(w.EXTRA_LARGE_QUERIES)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableScroll>
                ) : (
                  <EmptyState icon={Activity} title="Workloads Isolated" desc="No heavily mixed workloads found." />
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Warehouse Controls */}
        <Card className={cardClass}>
          <CardHeader className={cardHeaderClass}>
            <div className="flex items-center gap-2 border-l-2 border-teal-500 pl-3">
              <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                Warehouse Auto-Suspend Controls
              </CardTitle>
              <InfoTooltip text="Directly change how many seconds a warehouse waits before turning itself off when not in use. Dropping this from 600s to 60s is the easiest way to save money instantly." />
            </div>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 pl-3.5 mt-1">
              Adjust suspend/resume settings directly from the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 min-w-0 relative z-0">
            <div className="p-4 space-y-2">
              {warehouseListError && (
                <div className="rounded border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 px-3 py-2 text-xs text-red-700 dark:text-red-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {warehouseListError.message}
                </div>
              )}
              {warehouseControlError && (
                <div className="rounded border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 px-3 py-2 text-xs text-red-700 dark:text-red-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {warehouseControlError}
                </div>
              )}
              {warehouseControlMessage && (
                <div className="rounded border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-200">
                  {warehouseControlMessage}
                </div>
              )}
            </div>

            {warehouseList && warehouseList.length > 0 ? (
              <TableScroll maxHeight="500px">
                <table className="min-w-[640px] w-full text-sm text-left">
                  <thead className={thClass}>
                    <tr>
                      <th>Warehouse</th>
                      <th className={`hidden sm:table-cell`}>State</th>
                      <th className={`hidden md:table-cell`}>Size</th>
                      <th>Auto-Suspend (s)</th>
                      <th className={`text-center`}>Auto-Resume</th>
                      <th className={`text-right`}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {warehouseList.slice(0, 30).map((wh: any, i: number) => {
                      const draft = warehouseControls[wh.WAREHOUSE_NAME] || {
                        autoSuspend: wh.AUTO_SUSPEND ? String(wh.AUTO_SUSPEND) : '',
                        autoResume: Boolean(wh.AUTO_RESUME),
                      }
                      const isSaving = savingWarehouse === wh.WAREHOUSE_NAME
                      return (
                        <tr key={`${wh.WAREHOUSE_NAME}-${i}`} className={trClass}>
                          <td className={`${tdClass} font-medium text-slate-700 dark:text-slate-200`}>
                            <span className="truncate block max-w-[130px]">{wh.WAREHOUSE_NAME}</span>
                          </td>
                          <td className={`${tdClass} hidden sm:table-cell`}>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
                              wh.STATE === 'RUNNING'
                                ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/20'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                            }`}>
                              {wh.STATE}
                            </span>
                          </td>
                          <td className={`${tdClass} text-slate-600 dark:text-slate-300 font-mono hidden md:table-cell whitespace-nowrap`}>{wh.WAREHOUSE_SIZE}</td>
                          <td className={tdClass}>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={draft.autoSuspend}
                              onChange={(e) => setWarehouseControls((prev) => ({ ...prev, [wh.WAREHOUSE_NAME]: { ...draft, autoSuspend: e.target.value } }))}
                              className="w-20 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                              placeholder="NULL"
                            />
                          </td>
                          <td className={`${tdClass} text-center`}>
                            <label className="inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={draft.autoResume}
                                onChange={(e) => setWarehouseControls((prev) => ({ ...prev, [wh.WAREHOUSE_NAME]: { ...draft, autoResume: e.target.checked } }))}
                              />
                              <div className="relative w-9 h-5 bg-slate-300 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500" />
                            </label>
                          </td>
                          <td className={`${tdClass} text-right`}>
                            <button
                              type="button"
                              onClick={() => saveWarehouseControls(wh.WAREHOUSE_NAME)}
                              disabled={isSaving}
                              className="rounded-md bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                              {isSaving ? 'Saving…' : 'Apply'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </TableScroll>
            ) : (
              <EmptyState icon={ServerCog} title="No Controls Available" desc="Unable to load warehouse configurations." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}