'use client'

import useFetch from '@/hooks/useApi'
import { AlertTriangle, Clock, Activity } from 'lucide-react'
import { useSpendDisplay } from '@/hooks/useSpendDisplay'

interface AlertItem {
  id: string
  title: string
  severity: 'warning' | 'critical'
  detail: string
  time: string
}

export default function AlertsPanel({ dateRange }: { dateRange: { start: Date; end: Date } }) {
  const start = dateRange.start.toISOString().split('T')[0]
  const end = dateRange.end.toISOString().split('T')[0]

  const { data: kpi } = useFetch<any>(['alerts-kpi', start, end], `/api/kpi?start_date=${start}&end_date=${end}`)
  const { data: idle } = useFetch<any[]>(['alerts-idle', start, end], `/api/warehouses?type=idle&start=${start}&end=${end}`)
  const { data: authFails } = useFetch<any[]>(
    ['alerts-auth', start, end],
    `/api/identity?type=auth_failures&startDate=${start}&endDate=${end}&limit=20`
  )
  const { formatCreditValueWithUnit, formatCreditValue, convertCredits, creditUnitLabel } = useSpendDisplay()

  const alerts: AlertItem[] = []

  if (kpi) {
    const avgTime = Number(kpi.AVERAGE_QUERY_TIME || 0)
    const failed = Number(kpi.FAILED_QUERY_COUNT || 0)
    const costPerDay = Number(kpi.COST_PER_DAY || 0)

    if (avgTime > 2) {
      alerts.push({
        id: 'avg-time',
        title: 'High average query execution time',
        severity: avgTime > 5 ? 'critical' : 'warning',
        detail: `Average query time is ${avgTime.toFixed(2)}s`,
        time: 'selected window',
      })
    }
    if (failed > 0) {
      alerts.push({
        id: 'failed-q',
        title: 'Failed queries detected',
        severity: failed > 20 ? 'critical' : 'warning',
        detail: `${failed} failed queries in selected window`,
        time: 'selected window',
      })
    }
    if (costPerDay > 100) {
      alerts.push({
        id: 'cost-day',
        title: `${creditUnitLabel} consumption above baseline`,
        severity: costPerDay > 250 ? 'critical' : 'warning',
        detail: `${formatCreditValueWithUnit(costPerDay)}/day`,
        time: 'selected window',
      })
    }
  }

  if (idle && idle.length > 0) {
    const topIdle = idle[0]
    alerts.push({
      id: 'idle-cost',
      title: 'Idle warehouse cost opportunity detected',
      severity: convertCredits(Number(topIdle?.idle_credits || 0)) > (creditUnitLabel === 'USD' ? 50 : 15) ? 'critical' : 'warning',
      detail: `${topIdle?.WAREHOUSE_NAME || 'Warehouse'} idle ${creditUnitLabel.toLowerCase()} ${formatCreditValue(Number(topIdle?.idle_credits || 0))}`,
      time: 'selected window',
    })
  }

  if (authFails && authFails.length > 0) {
    const total = authFails.reduce((sum, r) => sum + Number(r.FAILURE_COUNT || 0), 0)
    if (total > 0) {
      alerts.push({
        id: 'auth-fail',
        title: 'Authentication failures detected',
        severity: total > 20 ? 'critical' : 'warning',
        detail: `${total} failed login attempts`,
        time: 'selected window',
      })
    }
  }

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length
  const warningCount = alerts.filter((a) => a.severity === 'warning').length

  return (
    <div className="card">
      <div className="card-header flex items-center gap-2">
        <Activity className="w-5 h-5 text-orange-400" />
        <h3 className="text-lg font-semibold text-white">System Alerts</h3>
        <div className="ml-auto flex gap-2">
          {criticalCount > 0 && <span className="px-2 py-1 bg-red-900/50 text-red-200 text-xs rounded-full font-semibold">{criticalCount} Critical</span>}
          {warningCount > 0 && <span className="px-2 py-1 bg-yellow-900/50 text-yellow-200 text-xs rounded-full font-semibold">{warningCount} Warning</span>}
        </div>
      </div>
      <div className="card-body space-y-2">
        {alerts.length === 0 ? (
          <div className="text-center text-slate-400 text-sm py-4">No active alerts</div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-start gap-3 p-3 rounded-lg border ${
                alert.severity === 'critical' ? 'bg-red-900/10 border-red-700/50' : 'bg-yellow-900/10 border-yellow-700/50'
              }`}
            >
              <AlertTriangle className={`w-4 h-4 mt-0.5 ${alert.severity === 'critical' ? 'text-red-400' : 'text-yellow-400'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-100">{alert.title}</p>
                <p className="text-xs text-slate-400 mt-1">{alert.detail}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span className="text-xs text-slate-400">{alert.time}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
