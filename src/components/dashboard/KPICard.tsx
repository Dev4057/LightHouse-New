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
    // Light: bg-white/80, border-slate-200, shadow-sm (UNTOUCHED)
    // Dark: bg-slate-900/40, frosted glass blur, border-slate-700/50, shadow-xl (ADDED PROPER BOX)
    <div className="kpi-card p-6 rounded-xl bg-white/80 dark:bg-slate-900/40 dark:backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-xl transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Dark: kpi-label CSS class | Light: slate-500 */}
          <p className="kpi-label text-slate-500 dark:text-[inherit]">{label}</p>
          {/* Dark: kpi-value CSS class | Light: slate-900 */}
          <p className="kpi-value text-slate-900 dark:text-[inherit] text-3xl font-bold mt-2">{value}</p>
          <div className="flex items-center gap-1 mt-3">
            {/* ORIGINAL icon colours — untouched */}
            {isPositive && <TrendingUp   className="w-4 h-4 text-yellow-400" />}
            {isNegative && <TrendingDown className="w-4 h-4 text-green-400"  />}
            {isStable   && <Activity     className="w-4 h-4 text-blue-400"   />}
            <span className={`text-xs font-semibold ${
              isNegative ? 'text-green-600 dark:text-green-200' : 'text-amber-600 dark:text-amber-200'
            }`}>
              {change}
            </span>
          </div>
        </div>

        {/* ORIGINAL icon box colours exactly preserved:
            Dark:  bg-white/10  (subtle white tint)  + white icon
            Light: bg-slate-900/10 (subtle dark tint) + slate-700 icon — same as original */}
        <div className="p-3 bg-slate-900/10 dark:bg-white/10 rounded-lg">
          <Icon className="w-6 h-6 text-slate-700 dark:text-white" />
        </div>
      </div>
    </div>
  )
}