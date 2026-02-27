'use client'

import { TrendingUp, TrendingDown, Zap, Activity, Clock, Database } from 'lucide-react'

export interface KPICardProps {
  label: string
  value: string
  change: string
  icon: 'zap' | 'activity' | 'clock' | 'database'
}

const iconMap = {
  zap: Zap,
  activity: Activity,
  clock: Clock,
  database: Database,
}

export default function KPICard({ label, value, change, icon }: KPICardProps) {
  const Icon = iconMap[icon]
  const isPositive = change.startsWith('+')
  const isNegative = change.startsWith('-')
  const isStable = change === 'stable'

  return (
    <div className="kpi-card">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="kpi-label">{label}</p>
          <p className="kpi-value">{value}</p>
          <div className="flex items-center gap-1 mt-3">
            {isPositive && <TrendingUp className="w-4 h-4 text-yellow-400" />}
            {isNegative && <TrendingDown className="w-4 h-4 text-green-400" />}
            {isStable && <Activity className="w-4 h-4 text-blue-400" />}
            <span className={`text-xs font-semibold ${isNegative ? 'text-green-200' : 'text-yellow-200'}`}>
              {change}
            </span>
          </div>
        </div>
        <div className="p-3 bg-white bg-opacity-10 rounded-lg">
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  )
}
