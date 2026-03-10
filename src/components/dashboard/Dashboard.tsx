'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react' // ✨ Imported NextAuth session
import KPICard from './KPICard'
import type { KPICardProps } from './KPICard'
import DateRangeSelector from './DateRangeSelector'
import ChartsGrid from './ChartsGrid'
import AlertsPanel from './AlertsPanel'
import LighthouseLoader from '@/components/ui/LighthouseLoader'
import { formatNumber, formatSeconds } from '@/lib/formatting'
import { useSpendDisplay } from '@/hooks/useSpendDisplay'
import type { KPIMetrics } from '@/types'

// Define our valid roles
type Role = 'WORKSPACE_ADMIN' | 'COMPUTE_ADMIN' | 'DEVELOPER'

export default function Dashboard() {
  const { data: session } = useSession() // ✨ Grab the logged-in user
  const userRole = (session?.user?.role as Role) || 'DEVELOPER' // Default to lowest privilege

  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date(),
  })

  const [kpiData, setKpiData] = useState<KPIMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { formatCreditValue, creditUnitLabel } = useSpendDisplay()

  useEffect(() => {
    async function fetchKPIs() {
      setIsLoading(true)
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
        setTimeout(() => setIsLoading(false), 500)
      }
    }
    fetchKPIs()
  }, [dateRange])

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <LighthouseLoader />
      </div>
    )
  }

  // ✨ THE ACCESS MATRIX FOR KPI CARDS ✨
  // We add 'allowedRoles' to easily filter out financial data
  const allKpiCards = kpiData
    ? [
        { label: `${creditUnitLabel} Used`, value: formatCreditValue(kpiData.TOTAL_CREDITS_USED || 0), change: '+12.5%', icon: 'zap', allowedRoles: ['WORKSPACE_ADMIN', 'COMPUTE_ADMIN'] }, // 🚫 Hidden from Developers
        { label: 'Queries Executed', value: formatNumber(kpiData.TOTAL_QUERIES_EXECUTED || 0), change: '+8.2%', icon: 'activity', allowedRoles: ['WORKSPACE_ADMIN', 'COMPUTE_ADMIN', 'DEVELOPER'] },
        { label: 'Avg Query Time', value: formatSeconds(kpiData.AVERAGE_QUERY_TIME || 0), change: '-3.1%', icon: 'clock', allowedRoles: ['WORKSPACE_ADMIN', 'COMPUTE_ADMIN', 'DEVELOPER'] },
        { label: 'Failed Queries', value: formatNumber(kpiData.FAILED_QUERY_COUNT || 0), change: '-1.2%', icon: 'database', allowedRoles: ['WORKSPACE_ADMIN', 'COMPUTE_ADMIN', 'DEVELOPER'] },
      ]
    : [
        { label: `${creditUnitLabel} Used`, value: '-', change: '-', icon: 'zap', allowedRoles: ['WORKSPACE_ADMIN', 'COMPUTE_ADMIN'] }, // 🚫 Hidden from Developers
        { label: 'Queries Executed', value: '-', change: '-', icon: 'activity', allowedRoles: ['WORKSPACE_ADMIN', 'COMPUTE_ADMIN', 'DEVELOPER'] },
        { label: 'Avg Query Time', value: '-', change: '-', icon: 'clock', allowedRoles: ['WORKSPACE_ADMIN', 'COMPUTE_ADMIN', 'DEVELOPER'] },
        { label: 'Failed Queries', value: '-', change: '-', icon: 'database', allowedRoles: ['WORKSPACE_ADMIN', 'COMPUTE_ADMIN', 'DEVELOPER'] },
      ]

  // Filter the cards based on the user's role
  const visibleKpiCards = allKpiCards.filter(card => card.allowedRoles.includes(userRole))

  return (
    <div className="space-y-6 w-full min-w-0 overflow-hidden animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Dashboard</h1>
        </div>
        <DateRangeSelector value={dateRange} onChange={setDateRange} />
      </div>

      {/* KPI Cards Grid */}
      {/* ✨ Dynamic grid sizing: If they only see 3 cards, stretch them perfectly across 3 columns! */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${visibleKpiCards.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 min-w-0`}>
        {visibleKpiCards.map((kpi, idx) => (
          <KPICard key={idx} label={kpi.label} value={kpi.value} change={kpi.change} icon={kpi.icon as any} />
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