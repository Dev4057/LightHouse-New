'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import useFetch from '@/hooks/useApi'
import { Loader, AlertCircle } from 'lucide-react'
import { formatNumber } from '@/lib/formatting'
import { useSpendDisplay } from '@/hooks/useSpendDisplay'
import WidgetAIInsight from '@/components/ai/WidgetAIInsight'
import type { WarehouseCredit, ServiceCredit, IdleCost, OverprovisionedWH, UnderprovisionedWH, WarehouseUser, DormantWarehouse, MixedWorkload, Warehouse } from '@/types'

interface WarehousesPageProps {
  dateRange: { start: Date; end: Date }
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

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
  const idleRows = (idle ?? []).map((row) => ({
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
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
        <p className="text-slate-400">No warehouse data available for the selected date range</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Credits Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Credits by Warehouse */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-base">{creditUnitLabel} Consumed by Each Warehouse</CardTitle>
            <CardDescription>Total spend breakdown across warehouses</CardDescription>
          </CardHeader>
          <CardContent>
            {whCredits && whCredits.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={whCredits.map((row) => ({ ...row, TOTAL_SPEND_DISPLAY: convertCredits(row.TOTAL_CREDITS_USED) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="WAREHOUSE_NAME" angle={-45} textAnchor="end" height={80} stroke="#94a3b8" />
                  <YAxis label={{ value: creditUnitLabel, angle: -90, position: 'insideLeft' }} stroke="#94a3b8" />
                  <Tooltip formatter={(v) => formatCreditValue(v as number)} cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} />
                  <Bar dataKey="TOTAL_SPEND_DISPLAY" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-slate-300">No data</div>
            )}
            <WidgetAIInsight
              title="Credits Consumed by Each Warehouse"
              widgetType="warehouse_optimization"
              dateRange={dateRange}
              widgetId="wh_credits_by_warehouse"
              widgetKind="chart"
              templateKey="warehouse_cost_distribution"
              dataSample={whCredits?.slice(0, 25) ?? []}
            />
          </CardContent>
        </Card>

        {/* Service Type Credits */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-base">{creditUnitLabel} Consumption by Service Type</CardTitle>
            <CardDescription>Break down by compute, storage, cloud services, etc</CardDescription>
          </CardHeader>
          <CardContent>
            {services && services.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={services.map((row) => ({ ...row, TOTAL_SPEND_DISPLAY: convertCredits(row.TOTAL_CREDITS) }))}
                    dataKey="TOTAL_SPEND_DISPLAY"
                    nameKey="SERVICE_TYPE"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {services.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCreditValue(v as number)} />
                  <Legend wrapperStyle={{ color: '#cbd5e1', paddingTop: '20px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-slate-300">No data</div>
            )}
            <WidgetAIInsight
              title="Credit Consumption by Service Type"
              widgetType="cost_analysis"
              dateRange={dateRange}
              widgetId="wh_service_type_credits"
              widgetKind="chart"
              templateKey="warehouse_cost_distribution"
              dataSample={services?.slice(0, 25) ?? []}
            />
          </CardContent>
        </Card>
      </div>

      {/* Idle Cost Analysis */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-base">Idle Spend by Warehouse</CardTitle>
          <CardDescription>
            {isUsd ? 'Estimated USD cost of unused compute resources' : 'Idle compute credits (unused warehouse spend)'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {idleRows.length > 0 ? (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={idleRows.slice(0, 20).map((row) => ({
                    ...row,
                    idle_spend_display: convertCredits(row.idle_credits),
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="WAREHOUSE_NAME" angle={-45} textAnchor="end" height={80} />
                  <YAxis label={{ value: `Idle ${creditUnitLabel}`, angle: -90, position: 'insideLeft' }} />
                  <Tooltip formatter={(v) => formatCreditValue(n(v))} />
                  <Bar dataKey="idle_spend_display" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>

              <div className="overflow-x-auto">
                <table className="w-full text-sm lh-dark-table">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-2 px-3 font-semibold">Warehouse</th>
                      <th className="text-right py-2 px-3 font-semibold">Total {creditUnitLabel}</th>
                      <th className="text-right py-2 px-3 font-semibold">Query {creditUnitLabel}</th>
                      <th className="text-right py-2 px-3 font-semibold">Idle %</th>
                      <th className="text-right py-2 px-3 font-semibold">Idle {creditUnitLabel}</th>
                      <th className="text-left py-2 px-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {idleRows.map((w, i) => (
                      <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/50">
                        <td className="py-2 px-3 text-slate-300">{w.WAREHOUSE_NAME}</td>
                        <td className="py-2 px-3 text-right text-slate-300">{formatCreditValue(w.total_compute_credits)}</td>
                        <td className="py-2 px-3 text-right text-slate-300">{formatCreditValue(w.query_execution_credits)}</td>
                        <td className="py-2 px-3 text-right font-medium text-yellow-400">{n(w.idle_percentage).toFixed(1)}%</td>
                        <td className="py-2 px-3 text-right font-medium text-red-400">{formatCreditValue(w.idle_credits)}</td>
                        <td className="py-2 px-3 text-xs">{firstRecommendationPart(w.recommendation)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400">No material idle cost detected - good auto-suspend settings!</div>
          )}
          <WidgetAIInsight
            title="Idle Cost Consumed by Warehouse"
            widgetType="warehouse_optimization"
            dateRange={dateRange}
            widgetId="wh_idle_cost"
            widgetKind="table"
            templateKey="idle_cost"
            dataSample={idleRows.slice(0, 30)}
          />
        </CardContent>
      </Card>

      {/* Sizing Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overprovisioned */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-base">Overprovisioned Warehouses</CardTitle>
            <CardDescription>Low utilization with no queueing - downsize opportunity</CardDescription>
          </CardHeader>
          <CardContent>
            {overprov && overprov.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs lh-dark-table">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-1 px-2 font-semibold">Warehouse</th>
                      <th className="text-right py-1 px-2 font-semibold">Util %</th>
                      <th className="text-right py-1 px-2 font-semibold">Queue %</th>
                      <th className="text-right py-1 px-2 font-semibold">{creditUnitLabel}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overprov.map((w, i) => (
                      <tr key={i} className="border-b border-slate-800">
                        <td className="py-1 px-2 text-slate-300">{w.warehouse_name}</td>
                        <td className="py-1 px-2 text-right text-yellow-400">{n(w.utilization_percentage).toFixed(1)}%</td>
                        <td className="py-1 px-2 text-right text-slate-300">{(n(w.avg_queued_load_ratio) * 100).toFixed(2)}%</td>
                        <td className="py-1 px-2 text-right text-slate-300">{formatCreditValue(w.total_credits || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400">All warehouses properly sized</div>
            )}
            <WidgetAIInsight
              title="Overprovisioned Warehouses"
              widgetType="warehouse_optimization"
              dateRange={dateRange}
              widgetId="wh_overprovisioned"
              widgetKind="table"
              templateKey="warehouse_sizing"
              dataSample={overprov?.slice(0, 30) ?? []}
            />
          </CardContent>
        </Card>

        {/* Underprovisioned */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-base">Underprovisioned Warehouses</CardTitle>
            <CardDescription>High utilization with queueing - upsize opportunity</CardDescription>
          </CardHeader>
          <CardContent>
            {underprov && underprov.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs lh-dark-table">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-1 px-2 font-semibold">Warehouse</th>
                      <th className="text-right py-1 px-2 font-semibold">Util %</th>
                      <th className="text-right py-1 px-2 font-semibold">Queue %</th>
                      <th className="text-left py-1 px-2 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {underprov.map((w, i) => (
                      <tr key={i} className="border-b border-slate-800">
                        <td className="py-1 px-2 text-slate-300">{w.WAREHOUSE_NAME}</td>
                        <td className="py-1 px-2 text-right font-medium text-red-400">{n(w.utilization_percentage).toFixed(1)}%</td>
                        <td className="py-1 px-2 text-right font-medium text-red-400">{(n(w.avg_queued_load_ratio) * 100).toFixed(2)}%</td>
                        <td className="py-1 px-2 text-xs text-blue-400">{firstRecommendationPart(w.recommendation)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400">All warehouses adequately provisioned</div>
            )}
            <WidgetAIInsight
              title="Underprovisioned Warehouses"
              widgetType="warehouse_optimization"
              dateRange={dateRange}
              widgetId="wh_underprovisioned"
              widgetKind="table"
              templateKey="warehouse_sizing"
              dataSample={underprov?.slice(0, 30) ?? []}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-base">Credit Consumed by Each User</CardTitle>
            <CardDescription>Top user/warehouse credit attribution from mart</CardDescription>
          </CardHeader>
          <CardContent>
            {byUser && byUser.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs lh-dark-table">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-2 px-2 font-semibold">User</th>
                      <th className="text-left py-2 px-2 font-semibold">Warehouse</th>
                      <th className="text-right py-2 px-2 font-semibold">{creditUnitLabel}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byUser.slice(0, 25).map((row, i) => (
                      <tr key={i} className="border-b border-slate-800">
                        <td className="py-2 px-2 text-slate-300">{row.USER_NAME}</td>
                        <td className="py-2 px-2 text-slate-400">{row.WAREHOUSE_NAME}</td>
                        <td className="py-2 px-2 text-right text-blue-400">{formatCreditValue(row.CREDITS)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400">No user credit attribution data</div>
            )}
            <WidgetAIInsight
              title="Credit Consumed by Each User"
              widgetType="cost_analysis"
              dateRange={dateRange}
              widgetId="wh_credits_by_user"
              widgetKind="table"
              templateKey="warehouse_cost_distribution"
              dataSample={byUser?.slice(0, 30) ?? []}
            />
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-base">Dormant Warehouses (&lt; 1 credit)</CardTitle>
            <CardDescription>Warehouses with negligible usage in the selected window</CardDescription>
          </CardHeader>
          <CardContent>
            {dormant && dormant.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs lh-dark-table">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-2 px-2 font-semibold">Warehouse</th>
                      <th className="text-right py-2 px-2 font-semibold">{creditUnitLabel}</th>
                      <th className="text-right py-2 px-2 font-semibold">Days Since Active</th>
                      <th className="text-left py-2 px-2 font-semibold">Recommendation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dormant.map((w, i) => (
                      <tr key={i} className="border-b border-slate-800">
                        <td className="py-2 px-2 text-slate-300">{w.WAREHOUSE_NAME}</td>
                        <td className="py-2 px-2 text-right text-yellow-400">{formatCreditValue(w.total_credit)}</td>
                        <td className="py-2 px-2 text-right text-slate-300">{w.days_since_active}</td>
                        <td className="py-2 px-2 text-slate-400">{w.recommendation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400">No dormant warehouses in window</div>
            )}
            <WidgetAIInsight
              title="Dormant Warehouses"
              widgetType="warehouse_optimization"
              dateRange={dateRange}
              widgetId="wh_dormant_warehouses"
              widgetKind="table"
              templateKey="warehouse_lifecycle"
              dataSample={dormant?.slice(0, 30) ?? []}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-base">Warehouses with Mixed Workloads</CardTitle>
          <CardDescription>Warehouses executing multiple workload size buckets</CardDescription>
        </CardHeader>
        <CardContent>
          {mixed && mixed.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs lh-dark-table">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 px-2 font-semibold">Warehouse</th>
                    <th className="text-right py-2 px-2 font-semibold">Small</th>
                    <th className="text-right py-2 px-2 font-semibold">Medium</th>
                    <th className="text-right py-2 px-2 font-semibold">Large</th>
                    <th className="text-right py-2 px-2 font-semibold">XL</th>
                  </tr>
                </thead>
                <tbody>
                  {mixed.map((w, i) => (
                    <tr key={i} className="border-b border-slate-800">
                      <td className="py-2 px-2 text-slate-300">{w.WAREHOUSE_NAME}</td>
                      <td className="py-2 px-2 text-right">{formatNumber(w.SMALL_QUERIES)}</td>
                      <td className="py-2 px-2 text-right">{formatNumber(w.MEDIUM_QUERIES)}</td>
                      <td className="py-2 px-2 text-right">{formatNumber(w.LARGE_QUERIES)}</td>
                      <td className="py-2 px-2 text-right">{formatNumber(w.EXTRA_LARGE_QUERIES)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400">No mixed workload indicators</div>
          )}
          <WidgetAIInsight
            title="Warehouses with Mixed Workloads"
            widgetType="warehouse_optimization"
            dateRange={dateRange}
            widgetId="wh_mixed_workloads"
            widgetKind="table"
            templateKey="warehouse_lifecycle"
            dataSample={mixed?.slice(0, 30) ?? []}
          />
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-base">Warehouse Auto-Suspend / Auto-Resume Controls</CardTitle>
          <CardDescription>Manual control actions from Streamlit parity (`ALTER WAREHOUSE ... SET AUTO_SUSPEND/AUTO_RESUME`)</CardDescription>
        </CardHeader>
        <CardContent>
          {warehouseListError && (
            <div className="mb-3 rounded border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-200">
              {warehouseListError.message}
            </div>
          )}
          {warehouseControlError && (
            <div className="mb-3 rounded border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-200">
              {warehouseControlError}
            </div>
          )}
          {warehouseControlMessage && (
            <div className="mb-3 rounded border border-green-900/40 bg-green-950/20 px-3 py-2 text-xs text-green-200">
              {warehouseControlMessage}
            </div>
          )}

          {warehouseList && warehouseList.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs lh-dark-table">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 px-2 font-semibold">Warehouse</th>
                    <th className="text-left py-2 px-2 font-semibold">State</th>
                    <th className="text-left py-2 px-2 font-semibold">Size</th>
                    <th className="text-right py-2 px-2 font-semibold">Auto-Suspend (sec)</th>
                    <th className="text-left py-2 px-2 font-semibold">Auto-Resume</th>
                    <th className="text-right py-2 px-2 font-semibold">Action</th>
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
                      <tr key={`${wh.WAREHOUSE_NAME}-${i}`} className="border-b border-slate-800 hover:bg-slate-800/30">
                        <td className="py-2 px-2 text-slate-200">{wh.WAREHOUSE_NAME}</td>
                        <td className="py-2 px-2 text-slate-400">{wh.STATE}</td>
                        <td className="py-2 px-2 text-slate-400">{wh.WAREHOUSE_SIZE}</td>
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={draft.autoSuspend}
                            onChange={(e) =>
                              setWarehouseControls((prev) => ({
                                ...prev,
                                [wh.WAREHOUSE_NAME]: {
                                  autoSuspend: e.target.value,
                                  autoResume: draft.autoResume,
                                },
                              }))
                            }
                            className="w-28 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-right"
                            placeholder="NULL"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <label className="inline-flex items-center gap-2 text-slate-300">
                            <input
                              type="checkbox"
                              checked={draft.autoResume}
                              onChange={(e) =>
                                setWarehouseControls((prev) => ({
                                  ...prev,
                                  [wh.WAREHOUSE_NAME]: {
                                    autoSuspend: draft.autoSuspend,
                                    autoResume: e.target.checked,
                                  },
                                }))
                              }
                            />
                            {draft.autoResume ? 'Enabled' : 'Disabled'}
                          </label>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <button
                            type="button"
                            onClick={() => saveWarehouseControls(wh.WAREHOUSE_NAME)}
                            disabled={isSaving}
                            className="rounded-md border border-cyan-700/50 bg-cyan-950/30 px-2.5 py-1 text-[11px] text-cyan-200 disabled:opacity-50"
                          >
                            {isSaving ? 'Saving...' : 'Save'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400">No warehouse metadata rows available</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
