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
        title: `${creditUnitLabel} consumption above baseline`,
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
      title: 'Idle warehouse cost opportunity',
      severity: convertCredits(Number(topIdle?.idle_credits || 0)) > (creditUnitLabel === 'USD' ? 50 : 15) ? 'critical' : 'warning',
      detail: `${topIdle?.WAREHOUSE_NAME || 'Warehouse'} idle ${creditUnitLabel.toLowerCase()} ${formatCreditValue(Number(topIdle?.idle_credits || 0))}`,
      time: 'Selected window',
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
        time: 'Selected window',
      })
    }
  }

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length
  const warningCount = alerts.filter((a) => a.severity === 'warning').length

  return (
    <div className="card glass flex flex-col h-full">
      
      {/* HEADER */}
      <div className="card-header border-b border-slate-700/50 pb-4 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative flex h-5 w-5 items-center justify-center">
            {criticalCount > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-20"></span>}
            <Activity className={`relative z-10 w-5 h-5 ${criticalCount > 0 ? 'text-red-400' : 'text-blue-400'}`} />
          </div>
          <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">System Alerts</h3>
        </div>
        
        {/* GLOWING BADGES */}
        <div className="flex gap-2">
          {criticalCount > 0 && (
            <span className="px-2.5 py-1 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-full font-bold shadow-[0_0_10px_rgba(239,68,68,0.15)] flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" />
              {criticalCount} Critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-full font-bold shadow-[0_0_10px_rgba(245,158,11,0.15)] flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {warningCount} Warning
            </span>
          )}
        </div>
      </div>

      {/* BODY */}
      <div className="card-body flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3 border border-emerald-500/20">
              <ShieldAlert className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-emerald-400">All Systems Normal</p>
            <p className="text-xs text-slate-500 mt-1">No active anomalies detected in this window.</p>
          </div>
        ) : (
          alerts.map((alert) => {
            const isCritical = alert.severity === 'critical';
            
            return (
              <div
                key={alert.id}
                className={`relative group flex flex-col p-4 rounded-r-xl border border-l-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg backdrop-blur-sm ${
                  isCritical 
                    ? 'bg-red-950/20 border-r-red-900/30 border-y-red-900/30 border-l-red-500 hover:bg-red-950/40' 
                    : 'bg-amber-950/20 border-r-amber-900/30 border-y-amber-900/30 border-l-amber-500 hover:bg-amber-950/40'
                }`}
              >
                {/* Background Glow Effect on Hover */}
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity rounded-r-xl ${isCritical ? 'bg-gradient-to-r from-red-500 to-transparent' : 'bg-gradient-to-r from-amber-500 to-transparent'}`}></div>
                
                <div className="relative z-10 flex justify-between items-start gap-3">
                  <div className="flex items-start gap-3">
                    {isCritical ? (
                      <div className="p-1.5 rounded-md bg-red-500/10 text-red-400 mt-0.5">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-400 mt-0.5">
                        <Zap className="w-4 h-4" />
                      </div>
                    )}
                    
                    <div>
                      <p className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">{alert.title}</p>
                      <p className={`text-xs mt-1 ${isCritical ? 'text-red-300/80' : 'text-amber-300/80'}`}>
                        {alert.detail}
                      </p>
                    </div>
                  </div>

                  {/* Timestamp pinned to top right */}
                  <div className="flex items-center gap-1.5 text-slate-500 shrink-0 mt-0.5">
                    <Clock className="w-3 h-3" />
                    <span className="text-[10px] uppercase font-bold tracking-wider">{alert.time}</span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}