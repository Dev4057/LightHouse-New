'use client'

import useFetch from '@/hooks/useApi'
import { AlertTriangle, Clock, Activity, ShieldAlert, Zap } from 'lucide-react'
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

  const { data: kpi }       = useFetch<any>   (['alerts-kpi',  start, end], `/api/kpi?start_date=${start}&end_date=${end}`)
  const { data: idle }      = useFetch<any[]> (['alerts-idle', start, end], `/api/warehouses?type=idle&start=${start}&end=${end}`)
  const { data: authFails } = useFetch<any[]> (['alerts-auth', start, end], `/api/identity?type=auth_failures&startDate=${start}&endDate=${end}&limit=20`)
  const { formatCreditValueWithUnit, formatCreditValue, convertCredits, creditUnitLabel } = useSpendDisplay()

  const alerts: AlertItem[] = []

  if (kpi) {
    const avgTime    = Number(kpi.AVERAGE_QUERY_TIME  || 0)
    const failed     = Number(kpi.FAILED_QUERY_COUNT  || 0)
    const costPerDay = Number(kpi.COST_PER_DAY        || 0)

    if (avgTime > 2) {
      alerts.push({
        id: 'avg-time',
        title: 'High avg. query time',
        severity: avgTime > 5 ? 'critical' : 'warning',
        detail: `Average query time is ${avgTime.toFixed(2)}s`,
        time: 'Selected window',
      })
    }
    if (failed > 0) {
      alerts.push({
        id: 'failed-q',
        title: 'Failed queries detected',
        severity: failed > 20 ? 'critical' : 'warning',
        detail: `${failed} failed queries in selected window`,
        time: 'Selected window',
      })
    }
    if (costPerDay > 100) {
      alerts.push({
        id: 'cost-day',
        title: `${creditUnitLabel} above baseline`,
        severity: costPerDay > 250 ? 'critical' : 'warning',
        detail: `${formatCreditValueWithUnit(costPerDay)}/day`,
        time: 'Selected window',
      })
    }
  }

  if (idle && idle.length > 0) {
    const topIdle = idle[0]
    alerts.push({
      id: 'idle-cost',
      title: 'Idle warehouse detected',
      severity: convertCredits(Number(topIdle?.idle_credits || 0)) > (creditUnitLabel === 'USD' ? 50 : 15) ? 'critical' : 'warning',
      detail: `${topIdle?.WAREHOUSE_NAME || 'Warehouse'} — ${formatCreditValue(Number(topIdle?.idle_credits || 0))} idle ${creditUnitLabel.toLowerCase()}`,
      time: 'Selected window',
    })
  }

  if (authFails && authFails.length > 0) {
    const total = authFails.reduce((sum, r) => sum + Number(r.FAILURE_COUNT || 0), 0)
    if (total > 0) {
      alerts.push({
        id: 'auth-fail',
        title: 'Auth failures detected',
        severity: total > 20 ? 'critical' : 'warning',
        detail: `${total} failed login attempts`,
        time: 'Selected window',
      })
    }
  }

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length
  const warningCount  = alerts.filter((a) => a.severity === 'warning').length

  return (
    <div className="
      flex flex-col h-full rounded-xl overflow-hidden
      bg-white/70 dark:bg-transparent
      border border-slate-200 dark:border-slate-700/50
      shadow-sm dark:shadow-none
      card glass
    ">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700/50">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-5 w-5 items-center justify-center shrink-0">
            {criticalCount > 0 && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-20" />
            )}
            <Activity className={`relative z-10 w-4 h-4 ${criticalCount > 0 ? 'text-red-400' : 'text-blue-400'}`} />
          </div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-100">
            System Alerts
          </h3>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5">
          {criticalCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold
              bg-red-100 dark:bg-red-500/10
              border border-red-300 dark:border-red-500/20
              text-red-600 dark:text-red-400">
              <ShieldAlert className="w-3 h-3" />
              {criticalCount} Critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold
              bg-amber-100 dark:bg-amber-500/10
              border border-amber-300 dark:border-amber-500/20
              text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              {warningCount} Warning
            </span>
          )}
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3 border border-emerald-500/20">
              <ShieldAlert className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">All Systems Normal</p>
            <p className="text-xs text-slate-400 mt-1">No anomalies detected in this window.</p>
          </div>
        ) : (
          alerts.map((alert) => {
            const isCritical = alert.severity === 'critical'
            return (
              <div
                key={alert.id}
                className={`
                  relative flex items-start gap-3 p-3 rounded-lg
                  border-l-[3px] transition-all duration-200
                  hover:shadow-md hover:-translate-y-px
                  ${isCritical
                    ? 'border-l-red-500 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30'
                    : 'border-l-amber-500 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30'
                  }
                `}
              >
                {/* Icon */}
                <div className={`shrink-0 mt-0.5 p-1.5 rounded-md ${
                  isCritical
                    ? 'bg-red-100 dark:bg-red-500/10 text-red-500 dark:text-red-400'
                    : 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                }`}>
                  {isCritical
                    ? <AlertTriangle className="w-3.5 h-3.5" />
                    : <Zap className="w-3.5 h-3.5" />
                  }
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold leading-snug truncate
                    ${isCritical
                      ? 'text-red-700 dark:text-slate-200'
                      : 'text-amber-800 dark:text-slate-200'
                    }`}>
                    {alert.title}
                  </p>
                  <p className={`text-[11px] mt-0.5 leading-snug truncate
                    ${isCritical
                      ? 'text-red-500 dark:text-red-300/80'
                      : 'text-amber-600 dark:text-amber-300/80'
                    }`}>
                    {alert.detail}
                  </p>
                </div>

                {/* Timestamp — pinned right */}
                <div className="shrink-0 flex items-center gap-1 text-slate-400 dark:text-slate-500 mt-0.5">
                  <Clock className="w-3 h-3" />
                  <span className="text-[9px] uppercase font-bold tracking-wide whitespace-nowrap">
                    {alert.time}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}