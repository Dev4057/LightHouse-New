'use client'

import { useState, useEffect } from 'react'
import KPICard from './KPICard'
import type { KPICardProps } from './KPICard'
import DateRangeSelector from './DateRangeSelector'
import ChartsGrid from './ChartsGrid'
import AlertsPanel from './AlertsPanel'
import LighthouseLoader from '@/components/ui/LighthouseLoader' // ✨ Imported the new loader
import { formatNumber, formatSeconds } from '@/lib/formatting'
import { useSpendDisplay } from '@/hooks/useSpendDisplay'
import type { KPIMetrics } from '@/types'

export default function Dashboard() {
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date(),
  })

  const [kpiData, setKpiData] = useState<KPIMetrics | null>(null)
  
  // ✨ ADDED: Loading state for the splash screen
  const [isLoading, setIsLoading] = useState(true)
  
  const { formatCreditValue, creditUnitLabel } = useSpendDisplay()

  useEffect(() => {
    async function fetchKPIs() {
      setIsLoading(true) // Start loading animation
      try {
        const start = dateRange.start.toISOString().split('T')[0]
        const end = dateRange.end.toISOString().split('T')[0]
        const response = await fetch(`/api/kpi?start_date=${start}&end_date=${end}`)
        if (response.ok) {
          const payload = await response.json()
          setKpiData(payload?.data ?? null)
        }
      } catch (error) {
        console.error('Failed to fetch KPI data:', error)
      } finally {
        // ✨ Add a tiny 500ms delay so the splash screen doesn't jitter 
        // if the API responds too quickly.
        setTimeout(() => setIsLoading(false), 500)
      }
    }
    fetchKPIs()
  }, [dateRange])

  // ✨ ADDED: If loading is true, hijack the render to show the splash screen
  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <LighthouseLoader />
      </div>
    )
  }

  const kpiCards: KPICardProps[] = kpiData
    ? [
        { label: `${creditUnitLabel} Used`, value: formatCreditValue(kpiData.TOTAL_CREDITS_USED || 0), change: '+12.5%', icon: 'zap' },
        { label: 'Queries Executed', value: formatNumber(kpiData.TOTAL_QUERIES_EXECUTED || 0), change: '+8.2%', icon: 'activity' },
        { label: 'Avg Query Time', value: formatSeconds(kpiData.AVERAGE_QUERY_TIME || 0), change: '-3.1%', icon: 'clock' },
        { label: 'Failed Queries', value: formatNumber(kpiData.FAILED_QUERY_COUNT || 0), change: '-1.2%', icon: 'database' },
      ]
    : [
        { label: `${creditUnitLabel} Used`, value: '-', change: '-', icon: 'zap' },
        { label: 'Queries Executed', value: '-', change: '-', icon: 'activity' },
        { label: 'Avg Query Time', value: '-', change: '-', icon: 'clock' },
        { label: 'Failed Queries', value: '-', change: '-', icon: 'database' },
      ]

  return (
    // ✨ ADDED: animate-in fade-in duration-500 so it crossfades smoothly after loading
    <div className="space-y-6 w-full min-w-0 overflow-hidden animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          {/* Light: dark text | Dark: white (original) */}
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Dashboard</h1>
        </div>
        <DateRangeSelector value={dateRange} onChange={setDateRange} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 min-w-0">
        {kpiCards.map((kpi, idx) => (
          <KPICard key={idx} {...kpi} />
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ChartsGrid dateRange={dateRange} />
        </div>
        <div className="space-y-6">
          <AlertsPanel dateRange={dateRange} />
        </div>
      </div>
    </div>
  )
}