'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import useFetch from '@/hooks/useApi'
import { Loader, Search, Database, AlertTriangle, TrendingDown, TrendingUp, Users, Moon, Activity, ServerCog } from 'lucide-react'
import { formatNumber } from '@/lib/formatting'
import { useSpendDisplay } from '@/hooks/useSpendDisplay'
import WidgetAIInsight from '@/components/ai/WidgetAIInsight'
import type { WarehouseCredit, ServiceCredit, IdleCost, OverprovisionedWH, UnderprovisionedWH, WarehouseUser, DormantWarehouse, MixedWorkload, Warehouse } from '@/types'

interface WarehousesPageProps {
  dateRange: { start: Date; end: Date }
}

// Professional Pie Chart Palette
const PIE_COLORS = ['#3b82f6', '#0ea5e9', '#2dd4bf', '#8b5cf6', '#6366f1', '#4f46e5', '#1e40af'];

// Shared Glass Tooltip Style for Recharts
const glassTooltipStyle = {
  backgroundColor: 'rgba(15, 23, 42, 0.95)',
  backdropFilter: 'blur(16px)',
  border: '1px solid rgba(51, 65, 85, 0.8)',
  borderRadius: '8px',
  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
  color: '#f8fafc',
  fontSize: '12px'
};

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

const PillBadge = ({ children, icon: Icon, colorClass }: { children: React.ReactNode, icon?: any, colorClass: string }) => (
  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-semibold border ${colorClass} whitespace-nowrap`}>
    {Icon && <Icon className="w-3 h-3" />}
    {children}
  </span>
);

export default function ComprehensiveWarehousesPage({ dateRange }: WarehousesPageProps) {
  const startDate = dateRange.start.toISOString().split('T')[0]
  const endDate = dateRange.end.toISOString().split('T')[0]

  const { data: whCredits, isLoading: loadingCredits } = useFetch<WarehouseCredit[]>(
    ['wh-credits', startDate, endDate],
    `/api/warehouses?type=credits&start=${startDate}&end=${endDate}`
  )

  const { data: services, isLoading: loadingServices } = useFetch<ServiceCredit[]>(
    ['service-credits', startDate, endDate],
    `/api/warehouses?type=services&start=${startDate}&end=${endDate}`
  )

  const { data: idle, isLoading: loadingIdle } = useFetch<IdleCost[]>(
    ['idle-cost', startDate, endDate],
    `/api/warehouses?type=idle&start=${startDate}&end=${endDate}`
  )

  const { data: overprov, isLoading: loadingOverprov } = useFetch<OverprovisionedWH[]>(
    ['overprovisioned', startDate, endDate],
    `/api/warehouses?type=overprovisioned&start=${startDate}&end=${endDate}`
  )

  const { data: underprov, isLoading: loadingUnderprov } = useFetch<UnderprovisionedWH[]>(
    ['underprovisioned', startDate, endDate],
    `/api/warehouses?type=underprovisioned&start=${startDate}&end=${endDate}`
  )

  const { data: byUser, isLoading: loadingByUser } = useFetch<WarehouseUser[]>(
    ['warehouse-user-credits', startDate, endDate],
    `/api/warehouses?type=by_user&start=${startDate}&end=${endDate}`
  )

  const { data: dormant, isLoading: loadingDormant } = useFetch<DormantWarehouse[]>(
    ['dormant-warehouses', startDate, endDate],
    `/api/warehouses?type=dormant&start=${startDate}&end=${endDate}`
  )

  const { data: mixed, isLoading: loadingMixed } = useFetch<MixedWorkload[]>(
    ['mixed-workloads', startDate, endDate],
    `/api/warehouses?type=mixed&start=${startDate}&end=${endDate}`
  )

  const {
    data: warehouseList,
    error: warehouseListError,
    refetch: refetchWarehouseList,
  } = useFetch<Warehouse[]>(['warehouse-list-controls'], '/api/warehouses?type=list')

  const isLoading = loadingCredits || loadingServices || loadingIdle || loadingOverprov || loadingUnderprov || loadingByUser || loadingDormant || loadingMixed
  const hasData = !!(whCredits?.length || services?.length || idle?.length)
  const [warehouseControls, setWarehouseControls] = useState<Record<string, { autoSuspend: string; autoResume: boolean }>>({})
  const [savingWarehouse, setSavingWarehouse] = useState<string | null>(null)
  const [warehouseControlError, setWarehouseControlError] = useState<string | null>(null)
  const [warehouseControlMessage, setWarehouseControlMessage] = useState<string | null>(null)
  const { isUsd, creditUnitLabel, convertCredits, formatCreditValue } = useSpendDisplay()

  const n = (value: unknown) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  const firstRecommendationPart = (value: unknown) => String(value || '').split(' - ')[0] || '-'
  
  const idleRows = useMemo(() => {
    return (idle ?? []).map((row) => ({
      ...row,
      WAREHOUSE_NAME: (row as any).WAREHOUSE_NAME ?? (row as any).warehouse_name ?? '',
      total_compute_credits: (row as any).total_compute_credits ?? (row as any).TOTAL_COMPUTE_CREDITS,
      query_execution_credits: (row as any).query_execution_credits ?? (row as any).QUERY_EXECUTION_CREDITS,
      idle_credits: (row as any).idle_credits ?? (row as any).IDLE_CREDITS,
      idle_percentage: (row as any).idle_percentage ?? (row as any).IDLE_PERCENTAGE,
      estimated_idle_cost_usd:
        (row as any).estimated_idle_cost_usd ?? (row as any).ESTIMATED_IDLE_COST_USD,
      recommendation: (row as any).recommendation ?? (row as any).RECOMMENDATION,
    }))
  }, [idle])

  const maxIdleCredits = useMemo(() => {
    if (!idleRows || idleRows.length === 0) return 1;
    return Math.max(...idleRows.map(r => n(r.idle_credits)));
  }, [idleRows]);

  const maxUserCredits = useMemo(() => {
    if (!byUser || byUser.length === 0) return 1;
    return Math.max(...byUser.map(u => n(u.CREDITS)));
  }, [byUser]);

  useEffect(() => {
    if (!warehouseList?.length) return
    setWarehouseControls((prev) => {
      const next = { ...prev }
      for (const wh of warehouseList) {
        if (!next[wh.WAREHOUSE_NAME]) {
          next[wh.WAREHOUSE_NAME] = {
            autoSuspend:
              wh.AUTO_SUSPEND === null || typeof wh.AUTO_SUSPEND === 'undefined'
                ? ''
                : String(wh.AUTO_SUSPEND),
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
        body: JSON.stringify({
          action: 'update_controls',
          warehouseName,
          autoSuspend: draft.autoSuspend === '' ? null : Number(draft.autoSuspend),
          autoResume: draft.autoResume,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error?.message || payload?.error || 'Failed to update warehouse controls')
      }
      setWarehouseControlMessage(`Updated controls for ${warehouseName}`)
      await refetchWarehouseList()
    } catch (e) {
      setWarehouseControlError(e instanceof Error ? e.message : 'Failed to update warehouse controls')
    } finally {
      setSavingWarehouse(null)
    }
  }

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
        <Search className="w-10 h-10 text-slate-400 mb-3" />
        <h3 className="text-lg font-semibold text-slate-100">No Warehouse Data Found</h3>
        <p className="text-slate-400 mt-1">Try expanding your selected date range.</p>
      </div>
    )
  }

const cardClass = "bg-slate-900/60 backdrop-blur-xl border-slate-700/50 shadow-xl overflow-hidden min-w-0 w-full flex flex-col";
  return (
    <div className="space-y-8 w-full max-w-full overflow-hidden px-1">
      {/* SECTION 1: COST DISTRIBUTION */}
      <div className="border-b border-slate-800 pb-8 min-w-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
          
          {/* Credits by Warehouse */}
          <Card className={cardClass}>
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold text-slate-100 uppercase tracking-wider border-l-2 border-blue-500 pl-3">
                {creditUnitLabel} Consumed by Each Warehouse
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 pl-3.5 mt-1 truncate">
                Total spend breakdown across compute resources
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 flex-1 flex flex-col min-w-0">
              {whCredits && whCredits.length > 0 ? (
                <div className="w-full h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={whCredits.map((row) => ({ ...row, TOTAL_SPEND_DISPLAY: convertCredits(row.TOTAL_CREDITS_USED) }))} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                      <defs>
                        <linearGradient id="whGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#1e3a8a" stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="WAREHOUSE_NAME" stroke="#64748b" axisLine={{ stroke: '#475569' }} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} dy={10} tickFormatter={(val) => val.length > 10 ? `${val.substring(0, 10)}...` : val} />
                      <YAxis stroke="#64748b" axisLine={{ stroke: '#475569' }} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} width={60} label={{ value: creditUnitLabel, angle: -90, position: 'insideLeft', offset: 15, fill: '#64748b', fontSize: 11, fontWeight: 600 }} />
                      <Tooltip contentStyle={glassTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} formatter={(v) => formatCreditValue(v as number)} />
                      <Bar dataKey="TOTAL_SPEND_DISPLAY" fill="url(#whGrad)" radius={[2, 2, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState icon={Database} title="No Warehouse Usage" desc="No compute credits consumed in this period." />
              )}
              <div className="mt-4 pt-4 border-t border-slate-800/50 min-w-0">
                <WidgetAIInsight title="Credits Consumed by Each Warehouse" widgetType="warehouse_optimization" dateRange={dateRange} widgetId="wh_credits_by_warehouse" widgetKind="chart" templateKey="warehouse_cost_distribution" dataSample={whCredits?.slice(0, 25) ?? []} />
              </div>
            </CardContent>
          </Card>

          {/* Service Type Credits */}
          <Card className={cardClass}>
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold text-slate-100 uppercase tracking-wider border-l-2 border-indigo-500 pl-3">
                {creditUnitLabel} Consumption by Service Type
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 pl-3.5 mt-1 truncate">
                Break down by compute, storage, and cloud services
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 flex-1 flex flex-col min-w-0">
              {services && services.length > 0 ? (
                <div className="w-full h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={services.map((row) => ({ ...row, TOTAL_SPEND_DISPLAY: convertCredits(row.TOTAL_CREDITS) }))}
                        dataKey="TOTAL_SPEND_DISPLAY"
                        nameKey="SERVICE_TYPE"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        innerRadius={60}
                        paddingAngle={2}
                      >
                        {services.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="rgba(0,0,0,0.2)" />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={glassTooltipStyle} formatter={(v) => formatCreditValue(v as number)} />
                      <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8', paddingTop: '10px' }} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState icon={Activity} title="No Service Data" desc="No service consumption recorded." />
              )}
              <div className="mt-4 pt-4 border-t border-slate-800/50 min-w-0">
                <WidgetAIInsight title="Credit Consumption by Service Type" widgetType="cost_analysis" dateRange={dateRange} widgetId="wh_service_type_credits" widgetKind="chart" templateKey="warehouse_cost_distribution" dataSample={services?.slice(0, 25) ?? []} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* SECTION 2: EFFICIENCY & SIZING */}
      <div className="border-b border-slate-800 pb-8 min-w-0">
        {/* Idle Cost Analysis */}
        <Card className={`${cardClass} mb-6`}>
          <CardHeader className="pb-4 border-b border-slate-800">
            <CardTitle className="text-sm font-semibold text-slate-100 uppercase tracking-wider border-l-2 border-red-500 pl-3">
              Idle Spend by Warehouse
            </CardTitle>
            <CardDescription className="text-xs text-slate-400 pl-3.5 mt-1">
              {isUsd ? 'Estimated USD cost of unused compute resources' : 'Idle compute credits (unused warehouse spend)'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 min-w-0">
            {idleRows && idleRows.length > 0 ? (
              <div className="overflow-x-auto custom-scrollbar w-full max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-slate-950/80 backdrop-blur-md sticky top-0 z-10 text-[11px] font-bold text-slate-400 uppercase tracking-wider shadow-sm border-b border-slate-800">
                    <tr>
                      <th className="py-4 px-4 w-12 text-center">#</th>
                      <th className="py-4 px-6 min-w-[200px]">Warehouse</th>
                      <th className="py-4 px-6 text-right">Total {creditUnitLabel}</th>
                      <th className="py-4 px-6 text-right">Query {creditUnitLabel}</th>
                      <th className="py-4 px-6 text-right">Idle %</th>
                      <th className="py-4 px-6 text-right w-32">Idle {creditUnitLabel}</th>
                      <th className="py-4 px-6">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {idleRows.map((w, i) => {
                      const idleSpend = convertCredits(w.idle_credits);
                      const costPct = Math.min(100, Math.max(2, (n(w.idle_credits) / maxIdleCredits) * 100));
                      
                      return (
                        <tr key={i} className="even:bg-slate-900/40 odd:bg-transparent hover:bg-slate-800/60 transition-colors border-b border-slate-800/50 last:border-0">
                          <td className="py-3 px-4 text-center text-xs font-medium text-slate-500">{i + 1}</td>
                          <td className="py-3 px-6">
                            <PillBadge icon={Database} colorClass="bg-slate-800/50 text-slate-300 border-slate-700/50">
                              {w.WAREHOUSE_NAME}
                            </PillBadge>
                          </td>
                          <td className="py-3 px-6 text-right text-slate-300">{formatCreditValue(w.total_compute_credits)}</td>
                          <td className="py-3 px-6 text-right text-slate-300">{formatCreditValue(w.query_execution_credits)}</td>
                          <td className="py-3 px-6 text-right font-bold text-amber-400">{n(w.idle_percentage).toFixed(1)}%</td>
                          <td className="py-3 px-6 text-right relative">
                             <div className="absolute inset-y-2.5 right-6 bg-red-500/15 rounded-md pointer-events-none" style={{ width: `calc(${costPct}% - 1rem)` }}></div>
                            <span className="relative z-10 text-xs font-bold text-red-400 tracking-wide pr-2">{formatCreditValue(w.idle_credits)}</span>
                          </td>
                          <td className="py-3 px-6 text-xs text-slate-400 truncate max-w-[200px]" title={w.recommendation}>{firstRecommendationPart(w.recommendation)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={Moon} title="No Idle Cost" desc="No material idle cost detected - good auto-suspend settings!" />
            )}
            <div className="p-4 border-t border-slate-800 bg-slate-900/40">
              <WidgetAIInsight title="Idle Cost Consumed by Warehouse" widgetType="warehouse_optimization" dateRange={dateRange} widgetId="wh_idle_cost" widgetKind="table" templateKey="idle_cost" dataSample={idleRows.slice(0, 30)} />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
          {/* Overprovisioned */}
          <Card className={cardClass}>
            <CardHeader className="pb-4 border-b border-slate-800">
              <CardTitle className="text-sm font-semibold text-slate-100 uppercase tracking-wider border-l-2 border-amber-500 pl-3">
                Overprovisioned Warehouses
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 pl-3.5 mt-1 truncate">
                Low utilization with no queueing - downsize opportunity
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 min-w-0 flex-1 overflow-hidden">
              {overprov && overprov.length > 0 ? (
                <div className="overflow-x-auto w-full custom-scrollbar">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-slate-950/80 backdrop-blur-md sticky top-0 z-10 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4 w-10 text-center">#</th>
                        <th className="py-3 px-4">Warehouse</th>
                        <th className="py-3 px-4 text-right">Util %</th>
                        <th className="py-3 px-4 text-right">Queue %</th>
                        <th className="py-3 px-4 text-right pr-6">{creditUnitLabel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overprov.map((w, i) => (
                        <tr key={i} className="even:bg-slate-900/40 odd:bg-transparent hover:bg-slate-800/60 border-b border-slate-800/50 last:border-0">
                          <td className="py-3 px-4 text-center text-xs font-medium text-slate-500">{i + 1}</td>
                          <td className="py-3 px-4"><span className="text-[11px] font-medium text-slate-200">{w.warehouse_name}</span></td>
                          <td className="py-3 px-4 text-right font-bold text-amber-400">{n(w.utilization_percentage).toFixed(1)}%</td>
                          <td className="py-3 px-4 text-right text-xs text-slate-300">{(n(w.avg_queued_load_ratio) * 100).toFixed(2)}%</td>
                          <td className="py-3 px-4 text-right text-xs text-slate-300 pr-6">{formatCreditValue(w.total_credits || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState icon={TrendingDown} title="Well Provisioned" desc="No overprovisioned warehouses detected." />
              )}
              <div className="p-4 border-t border-slate-800 bg-slate-900/40 mt-auto">
                 <WidgetAIInsight title="Overprovisioned Warehouses" widgetType="warehouse_optimization" dateRange={dateRange} widgetId="wh_overprovisioned" widgetKind="table" templateKey="warehouse_sizing" dataSample={overprov?.slice(0, 30) ?? []} />
              </div>
            </CardContent>
          </Card>

          {/* Underprovisioned */}
          <Card className={cardClass}>
            <CardHeader className="pb-4 border-b border-slate-800">
              <CardTitle className="text-sm font-semibold text-slate-100 uppercase tracking-wider border-l-2 border-red-500 pl-3">
                Underprovisioned Warehouses
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 pl-3.5 mt-1 truncate">
                High utilization with queueing - upsize opportunity
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 min-w-0 flex-1 overflow-hidden">
              {underprov && underprov.length > 0 ? (
                <div className="overflow-x-auto w-full custom-scrollbar">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-slate-950/80 backdrop-blur-md sticky top-0 z-10 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4 w-10 text-center">#</th>
                        <th className="py-3 px-4">Warehouse</th>
                        <th className="py-3 px-4 text-right">Util %</th>
                        <th className="py-3 px-4 text-right">Queue %</th>
                        <th className="py-3 px-4 pr-6">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {underprov.map((w, i) => (
                        <tr key={i} className="even:bg-slate-900/40 odd:bg-transparent hover:bg-slate-800/60 border-b border-slate-800/50 last:border-0">
                          <td className="py-3 px-4 text-center text-xs font-medium text-slate-500">{i + 1}</td>
                          <td className="py-3 px-4"><span className="text-[11px] font-medium text-slate-200">{w.WAREHOUSE_NAME}</span></td>
                          <td className="py-3 px-4 text-right font-bold text-red-400">{n(w.utilization_percentage).toFixed(1)}%</td>
                          <td className="py-3 px-4 text-right font-bold text-red-400">{(n(w.avg_queued_load_ratio) * 100).toFixed(2)}%</td>
                          <td className="py-3 px-4 text-xs text-blue-400 pr-6 truncate max-w-[150px]" title={w.recommendation}>{firstRecommendationPart(w.recommendation)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState icon={TrendingUp} title="Adequately Sized" desc="All warehouses handling load well." />
              )}
              <div className="p-4 border-t border-slate-800 bg-slate-900/40 mt-auto">
                 <WidgetAIInsight title="Underprovisioned Warehouses" widgetType="warehouse_optimization" dateRange={dateRange} widgetId="wh_underprovisioned" widgetKind="table" templateKey="warehouse_sizing" dataSample={underprov?.slice(0, 30) ?? []} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* SECTION 3: USAGE & CONTROLS */}
      <div className="space-y-8 min-w-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
          
          {/* User Attribution */}
          <Card className={cardClass}>
            <CardHeader className="pb-4 border-b border-slate-800">
              <CardTitle className="text-sm font-semibold text-slate-100 uppercase tracking-wider border-l-2 border-blue-400 pl-3">
                Credit Consumed by Each User
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 pl-3.5 mt-1 truncate">
                Top user/warehouse credit attribution
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 min-w-0 flex-1 overflow-hidden">
              {byUser && byUser.length > 0 ? (
                <div className="overflow-x-auto w-full custom-scrollbar max-h-[400px]">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-slate-950/80 backdrop-blur-md sticky top-0 z-10 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4 w-10 text-center">#</th>
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Warehouse</th>
                        <th className="py-3 px-4 text-right pr-6 w-32">{creditUnitLabel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byUser.slice(0, 25).map((row, i) => {
                         const costPct = Math.min(100, Math.max(2, (n(row.CREDITS) / maxUserCredits) * 100));
                         return (
                          <tr key={i} className="even:bg-slate-900/40 odd:bg-transparent hover:bg-slate-800/60 border-b border-slate-800/50 last:border-0">
                            <td className="py-3 px-4 text-center text-xs font-medium text-slate-500">{i + 1}</td>
                            <td className="py-3 px-4"><span className="text-[11px] font-medium text-slate-200">{row.USER_NAME}</span></td>
                            <td className="py-3 px-4"><span className="text-[11px] text-slate-400">{row.WAREHOUSE_NAME}</span></td>
                            <td className="py-3 px-4 text-right relative pr-6">
                              <div className="absolute inset-y-2 right-6 bg-blue-500/15 rounded-md pointer-events-none" style={{ width: `calc(${costPct}% - 1rem)` }}></div>
                              <span className="relative z-10 text-xs font-bold text-blue-400 tracking-wide pr-2">{formatCreditValue(row.CREDITS)}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState icon={Users} title="No User Data" desc="No user credit attribution available." />
              )}
               <div className="p-4 border-t border-slate-800 bg-slate-900/40 mt-auto">
                 <WidgetAIInsight title="Credit Consumed by Each User" widgetType="cost_analysis" dateRange={dateRange} widgetId="wh_credits_by_user" widgetKind="table" templateKey="warehouse_cost_distribution" dataSample={byUser?.slice(0, 30) ?? []} />
              </div>
            </CardContent>
          </Card>

          {/* Dormant / Mixed Workloads */}
          <div className="flex flex-col gap-6">
            <Card className={cardClass}>
              <CardHeader className="pb-4 border-b border-slate-800">
                <CardTitle className="text-sm font-semibold text-slate-100 uppercase tracking-wider border-l-2 border-slate-500 pl-3">
                  Dormant Warehouses
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 pl-3.5 mt-1 truncate">
                  Warehouses with negligible usage (&lt; 1 credit)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 min-w-0">
                {dormant && dormant.length > 0 ? (
                  <div className="overflow-x-auto w-full custom-scrollbar max-h-[160px]">
                    <table className="w-full text-left whitespace-nowrap">
                      <thead className="bg-slate-950/80 backdrop-blur-md sticky top-0 z-10 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-800">
                        <tr>
                          <th className="py-3 px-4">Warehouse</th>
                          <th className="py-3 px-4 text-right">{creditUnitLabel}</th>
                          <th className="py-3 px-4 text-right">Days Inactive</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dormant.map((w, i) => (
                          <tr key={i} className="even:bg-slate-900/40 odd:bg-transparent hover:bg-slate-800/60 border-b border-slate-800/50 last:border-0">
                            <td className="py-2 px-4"><span className="text-[11px] font-medium text-slate-300">{w.WAREHOUSE_NAME}</span></td>
                            <td className="py-2 px-4 text-right text-xs text-slate-400">{formatCreditValue(w.total_credit)}</td>
                            <td className="py-2 px-4 text-right text-xs font-bold text-amber-400">{w.days_since_active}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState icon={Moon} title="No Dormant Warehouses" desc="All active warehouses are utilized." />
                )}
              </CardContent>
            </Card>

            <Card className={cardClass}>
              <CardHeader className="pb-4 border-b border-slate-800">
                <CardTitle className="text-sm font-semibold text-slate-100 uppercase tracking-wider border-l-2 border-purple-500 pl-3">
                  Mixed Workloads
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 pl-3.5 mt-1 truncate">
                  Warehouses executing multiple workload sizes
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 min-w-0">
                {mixed && mixed.length > 0 ? (
                  <div className="overflow-x-auto w-full custom-scrollbar max-h-[160px]">
                    <table className="w-full text-left whitespace-nowrap">
                      <thead className="bg-slate-950/80 backdrop-blur-md sticky top-0 z-10 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-800">
                        <tr>
                          <th className="py-3 px-4">Warehouse</th>
                          <th className="py-3 px-4 text-right">S</th>
                          <th className="py-3 px-4 text-right">M</th>
                          <th className="py-3 px-4 text-right">L</th>
                          <th className="py-3 px-4 text-right pr-4">XL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mixed.map((w, i) => (
                          <tr key={i} className="even:bg-slate-900/40 odd:bg-transparent hover:bg-slate-800/60 border-b border-slate-800/50 last:border-0 text-xs">
                            <td className="py-2 px-4 font-medium text-slate-300">{w.WAREHOUSE_NAME}</td>
                            <td className="py-2 px-4 text-right text-slate-400">{formatNumber(w.SMALL_QUERIES)}</td>
                            <td className="py-2 px-4 text-right text-slate-400">{formatNumber(w.MEDIUM_QUERIES)}</td>
                            <td className="py-2 px-4 text-right text-slate-400">{formatNumber(w.LARGE_QUERIES)}</td>
                            <td className="py-2 px-4 text-right text-slate-400 pr-4">{formatNumber(w.EXTRA_LARGE_QUERIES)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState icon={Activity} title="Workloads Isolated" desc="No heavily mixed workloads found." />
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Warehouse Controls */}
        <Card className={cardClass}>
          <CardHeader className="pb-4 border-b border-slate-800">
            <CardTitle className="text-sm font-semibold text-slate-100 uppercase tracking-wider border-l-2 border-teal-500 pl-3">
              Warehouse Auto-Suspend Controls
            </CardTitle>
            <CardDescription className="text-xs text-slate-400 pl-3.5 mt-1">
              Manual control actions to adjust suspend/resume settings directly
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 min-w-0">
             <div className="p-4 space-y-2">
              {warehouseListError && (
                <div className="rounded border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> {warehouseListError.message}
                </div>
              )}
              {warehouseControlError && (
                <div className="rounded border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> {warehouseControlError}
                </div>
              )}
              {warehouseControlMessage && (
                <div className="rounded border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200">
                  {warehouseControlMessage}
                </div>
              )}
            </div>

            {warehouseList && warehouseList.length > 0 ? (
              <div className="overflow-x-auto w-full custom-scrollbar max-h-[500px] overflow-y-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead className="bg-slate-950/80 backdrop-blur-md sticky top-0 z-10 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 shadow-sm">
                    <tr>
                      <th className="py-4 px-6">Warehouse</th>
                      <th className="py-4 px-6">State</th>
                      <th className="py-4 px-6">Size</th>
                      <th className="py-4 px-6">Auto-Suspend (sec)</th>
                      <th className="py-4 px-6 text-center">Auto-Resume</th>
                      <th className="py-4 px-6 text-right pr-6">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {warehouseList.slice(0, 30).map((wh, i) => {
                      const draft = warehouseControls[wh.WAREHOUSE_NAME] || {
                        autoSuspend: wh.AUTO_SUSPEND ? String(wh.AUTO_SUSPEND) : '',
                        autoResume: Boolean(wh.AUTO_RESUME),
                      }
                      const isSaving = savingWarehouse === wh.WAREHOUSE_NAME
                      return (
                        <tr key={`${wh.WAREHOUSE_NAME}-${i}`} className="even:bg-slate-900/40 odd:bg-transparent hover:bg-slate-800/60 border-b border-slate-800/50 last:border-0 transition-colors">
                          <td className="py-3 px-6 font-medium text-slate-200">{wh.WAREHOUSE_NAME}</td>
                          <td className="py-3 px-6">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${wh.STATE === 'RUNNING' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>                              {wh.STATE}
                            </span>
                          </td>
                          <td className="py-3 px-6 text-xs text-slate-300 font-mono">{wh.WAREHOUSE_SIZE}</td>
                          <td className="py-3 px-6">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={draft.autoSuspend}
                              onChange={(e) =>
                                setWarehouseControls((prev) => ({
                                  ...prev,
                                  [wh.WAREHOUSE_NAME]: { ...draft, autoSuspend: e.target.value },
                                }))
                              }
                              className="w-24 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                              placeholder="NULL"
                            />
                          </td>
                          <td className="py-3 px-6 text-center">
                            <label className="inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={draft.autoResume}
                                onChange={(e) =>
                                  setWarehouseControls((prev) => ({
                                    ...prev,
                                    [wh.WAREHOUSE_NAME]: { ...draft, autoResume: e.target.checked },
                                  }))
                                }
                              />
                              <div className="relative w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                            </label>
                          </td>
                          <td className="py-3 px-6 text-right pr-6">
                            <button
                              type="button"
                              onClick={() => saveWarehouseControls(wh.WAREHOUSE_NAME)}
                              disabled={isSaving}
                              className="rounded-md bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isSaving ? 'Saving...' : 'Apply'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={ServerCog} title="No Controls Available" desc="Unable to load warehouse configurations." />
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  )
}