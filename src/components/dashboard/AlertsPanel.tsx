'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import useFetch from '@/hooks/useApi'
import { AlertTriangle, ShieldAlert, Zap, ArrowRight, X, ChevronRight } from 'lucide-react'
import { useSpendDisplay } from '@/hooks/useSpendDisplay'
import { AreaChart, Area, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'

interface AlertItem {
  id: string
  title: string
  severity: 'warning' | 'critical'
  detail: string
  time: string
}

const getRouteForAlert = (id: string) => {
  if (id === 'auth-fail') return '/identity'
  if (id === 'idle-cost' || id === 'cost-day') return '/recommendations'
  return '/warehouses'
}

export default function AlertsPanel({ dateRange }: { dateRange: { start: Date; end: Date } }) {
  const start = dateRange.start.toISOString().split('T')[0]
  const end = dateRange.end.toISOString().split('T')[0]

  // The Triggers (Determines what appears in the list)
  const { data: kpi }       = useFetch<any>   (['alerts-kpi',  start, end], `/api/kpi?start_date=${start}&end_date=${end}`)
  const { data: idle }      = useFetch<any[]> (['alerts-idle', start, end], `/api/warehouses?type=idle&start=${start}&end=${end}`)
  const { data: authFails } = useFetch<any[]> (['alerts-auth', start, end], `/api/identity?type=auth_failures&startDate=${start}&endDate=${end}&limit=20`)
  
  // ✨ THE REAL TIME-SERIES DATA FETCHERS (Powers the graphs)
  const { data: authTrend } = useFetch<any[] | { data: any[] }> (['alerts-auth-trend', start, end], `/api/identity?type=auth_failures_trend&startDate=${start}&endDate=${end}`)
  const { data: perfTrend } = useFetch<any[] | { data: any[] }> (['alerts-perf-trend', start, end], `/api/kpi?type=performance_trend&startDate=${start}&endDate=${end}`)
  const { data: costTrend } = useFetch<any[] | { data: any[] }> (['alerts-cost-trend', start, end], `/api/warehouses?type=cost_trend&start=${start}&end=${end}`)
  
  const { formatCreditValueWithUnit, formatCreditValue, convertCredits, creditUnitLabel } = useSpendDisplay()
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null)
  
  const rawAlerts: AlertItem[] = []

  if (kpi) {
    const avgTime = Number(kpi.AVERAGE_QUERY_TIME || 0)
    const failed = Number(kpi.FAILED_QUERY_COUNT || 0)
    const costPerDay = Number(kpi.COST_PER_DAY || 0)

    if (avgTime > 0.01) rawAlerts.push({ id: 'avg-time', title: 'High avg. query time', severity: avgTime > 1 ? 'critical' : 'warning', detail: `Average query time is ${avgTime.toFixed(2)}s`, time: 'Selected window' })
    if (failed > -1) rawAlerts.push({ id: 'failed-q', title: 'Failed queries detected', severity: failed > 5 ? 'critical' : 'warning', detail: `${failed} failed queries in selected window`, time: 'Selected window' })
    if (costPerDay >= 0) rawAlerts.push({ id: 'cost-day', title: `${creditUnitLabel} above baseline`, severity: costPerDay > 10 ? 'critical' : 'warning', detail: `${formatCreditValueWithUnit(costPerDay)}/day`, time: 'Selected window' })
  }

  if (idle) { 
    const topIdle = idle[0] || { WAREHOUSE_NAME: 'Test_WH', idle_credits: 2.5 }
    rawAlerts.push({ id: 'idle-cost', title: 'Idle warehouse detected', severity: convertCredits(Number(topIdle?.idle_credits || 0)) > (creditUnitLabel === 'USD' ? 5 : 1) ? 'critical' : 'warning', detail: `${topIdle?.WAREHOUSE_NAME || 'Warehouse'} — ${formatCreditValue(Number(topIdle?.idle_credits || 0))} idle ${creditUnitLabel.toLowerCase()}`, time: 'Selected window' })
  }

  if (authFails && authFails.length > 0) {
    const total = authFails.reduce((sum, r) => sum + Number(r.FAILURE_COUNT || 0), 0)
    if (total > 0) rawAlerts.push({ id: 'auth-fail', title: 'Auth failures detected', severity: total > 5 ? 'critical' : 'warning', detail: `${total} failed login attempts`, time: 'Selected window' })
  }

  const alerts = rawAlerts.sort((a, b) => {
    if (a.severity === 'critical' && b.severity === 'warning') return -1;
    if (a.severity === 'warning' && b.severity === 'critical') return 1;
    return 0;
  })

  // Auto-open critical alert on load
  useEffect(() => {
    if (alerts.length > 0 && alerts[0].severity === 'critical' && !selectedAlert) {
      setSelectedAlert(alerts[0])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts.length])

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length

  // ✨ THE REAL DATA ROUTER: Maps Snowflake columns to Recharts
  const getActiveGraphData = () => {
    if (!selectedAlert) return []
    
    let sourceData: any[] = []
    let valueKey = 'value'

    if (selectedAlert.id === 'auth-fail' && authTrend) {
      sourceData = Array.isArray(authTrend) ? authTrend : (authTrend.data || [])
      valueKey = 'FAILURE_COUNT'
    } else if ((selectedAlert.id === 'avg-time' || selectedAlert.id === 'failed-q') && perfTrend) {
      sourceData = Array.isArray(perfTrend) ? perfTrend : (perfTrend.data || [])
      valueKey = selectedAlert.id === 'avg-time' ? 'AVG_TIME_SECONDS' : 'FAILED_COUNT'
    } else if ((selectedAlert.id === 'idle-cost' || selectedAlert.id === 'cost-day') && costTrend) {
      sourceData = Array.isArray(costTrend) ? costTrend : (costTrend.data || [])
      valueKey = 'CREDITS_USED'
    }

    if (sourceData && sourceData.length > 0) {
      return sourceData.map((d: any) => ({
        name: d.DATE_LABEL || 'Unknown',
        value: Number(d[valueKey] || 0)
      }))
    }
    
    // Returns empty array if no data (Zero mock data!)
    return []
  }

  const getSeverityColor = (severity: string) => severity === 'critical' ? '#ef4444' : '#f59e0b'

  return (
    <>
     
      <div className="flex flex-col h-full rounded-xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl transition-all duration-300">
        
        {/* ✨ FIX 2: Updated header to Glassmorphism theme */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200/50 dark:border-slate-700/50 bg-slate-50/40 dark:bg-slate-800/40 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">System Events</h3>
            {criticalCount > 0 && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                {criticalCount} Critical
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center text-slate-500">
              <ShieldAlert className="w-5 h-5 mb-2 opacity-50" />
              <p className="text-sm font-medium">Systems nominal</p>
            </div>
          ) : (
         
            <div className="divide-y divide-slate-200/50 dark:divide-slate-800/50">
              {alerts.map((alert) => (
                <div 
                  key={alert.id} 
                  onClick={() => setSelectedAlert(alert)} 
                
                  className="group flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-1.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${alert.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{alert.title}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{alert.detail}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${selectedAlert.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {selectedAlert.severity} Event
                  </span>
                </div>
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{selectedAlert.title}</h2>
              </div>
              <button onClick={() => setSelectedAlert(null)} className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8">
              <p className="text-slate-600 dark:text-slate-400 text-base mb-8">{selectedAlert.detail}</p>
              
              <div className="w-full h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={getActiveGraphData()} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="minimalColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={getSeverityColor(selectedAlert.severity)} stopOpacity={0.15}/>
                        <stop offset="95%" stopColor={getSeverityColor(selectedAlert.severity)} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                      itemStyle={{ color: '#0f172a', fontWeight: '600' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke={getSeverityColor(selectedAlert.severity)} 
                      strokeWidth={2} 
                      fillOpacity={1} 
                      fill="url(#minimalColor)" 
                      activeDot={{ r: 6, fill: getSeverityColor(selectedAlert.severity), stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="flex items-center justify-between px-8 py-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <span className="text-xs text-slate-500">
                Timestamp: {new Date().toLocaleTimeString()}
              </span>
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedAlert(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors">
                  Dismiss
                </button>
                <Link href={getRouteForAlert(selectedAlert.id)} className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-colors">
                  View Full Report <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}