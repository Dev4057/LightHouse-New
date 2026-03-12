'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { useSession } from 'next-auth/react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import useFetch from '@/hooks/useApi'
import { Loader } from 'lucide-react'
import { useSpendDisplay } from '@/hooks/useSpendDisplay'
import InfoTooltip from '@/components/ui/InfoTooltip' // ✨ Imported Tooltip

const COLORS = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

const CustomXAxisTick = ({ x, y, payload }: any) => {
  const text = payload.value
  const truncatedText = text.length > 11 ? `${text.substring(0, 9)}...` : text
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={16} textAnchor="middle" fill="#94a3b8" fontSize={11}>
        <title>{text}</title>
        {truncatedText}
      </text>
    </g>
  )
}

type Role = 'WORKSPACE_ADMIN' | 'COMPUTE_ADMIN' | 'DEVELOPER'

export default function ChartsGrid({ dateRange }: { dateRange: { start: Date; end: Date } }) {
  const { data: session } = useSession()
  const userRole = (session?.user?.role as Role) || 'DEVELOPER'
  const showFinancials = userRole === 'WORKSPACE_ADMIN' || userRole === 'COMPUTE_ADMIN'

  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isDark = mounted ? resolvedTheme === 'dark' : true

  const start = dateRange.start.toISOString().split('T')[0]
  const end = dateRange.end.toISOString().split('T')[0]

  const { data: trend, isLoading: l1 } = useFetch<any[]>(['dash-trend', start, end], `/api/queries?type=trend&start=${start}&end=${end}`)
  const { data: whCredits, isLoading: l2 } = useFetch<any[]>(['dash-wh-credits', start, end], `/api/warehouses?type=credits&start=${start}&end=${end}`)
  const { data: serviceCredits, isLoading: l3 } = useFetch<any[]>(['dash-service-credits', start, end], `/api/warehouses?type=services&start=${start}&end=${end}`)
  const { convertCredits, formatCreditValue, creditUnitLabel } = useSpendDisplay()

  const gridColor       = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'
  const axisStroke      = isDark ? '#64748b'                : '#94a3b8'
  const axisStrokeStrong= isDark ? '#475569'                : '#cbd5e1'
  const tickFill        = isDark ? '#94a3b8'                : '#64748b'

  const glassTooltipStyle = {
    backgroundColor : isDark ? 'rgba(30, 41, 59, 0.85)'    : 'rgba(255, 255, 255, 0.97)',
    backdropFilter  : 'blur(16px)',
    border          : `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(226,232,240,0.8)'}`,
    borderRadius    : '12px',
    boxShadow       : '0 8px 32px 0 rgba(0,0,0,0.2)',
    color           : isDark ? '#f8fafc' : '#0f172a',
    fontSize        : '12px',
  }

  if (l1 || l2 || l3) {
    return (
      <div className="card glass bg-white/70 dark:bg-transparent border border-slate-200 dark:border-slate-700/50 flex items-center justify-center py-12">
        <Loader className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    )
  }

  const processedTrendData = (trend || []).map((row) => ({
    ...row,
    TOTAL_SPEND_DISPLAY: convertCredits(row.TOTAL_CREDITS),
  }))

  const topWarehouses = (whCredits || []).slice(0, 6)
  const maxWhCredits = topWarehouses.length > 0
    ? Math.max(...topWarehouses.map((w) => Number(w.TOTAL_CREDITS_USED || 0)))
    : 1

  const chartCardClass = `chart-container group bg-white/70 dark:bg-transparent border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none rounded-xl`

  return (
    <div className="space-y-6">
      {/* 1. Credits & Query Trends */}
      <div className={chartCardClass}>
        {/* ✨ Added Tooltip */}
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100 uppercase tracking-wider">
            {showFinancials ? `${creditUnitLabel} & Query Trends` : 'Query Trends'}
          </h3>
          <InfoTooltip text="This chart tracks daily activity. 'Query Count' is how many tasks your database performed. If you see spend going up but queries staying flat, you might be wasting money." />
        </div>

        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={processedTrendData} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="barCredits" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#3b82f6" stopOpacity={1}   />
                <stop offset="100%" stopColor="#1e3a8a" stopOpacity={0.6} />
              </linearGradient>
              <linearGradient id="barQueries" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#2dd4bf" stopOpacity={1}   />
                <stop offset="100%" stopColor="#115e59" stopOpacity={0.6} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />

            <XAxis dataKey="QUERY_DAY" stroke={axisStroke} axisLine={{ stroke: axisStrokeStrong, strokeWidth: 1.5 }} tickLine={false} dy={10} tick={{ fill: isDark ? '#ffffff' : '#000000', fontSize: 11, fontWeight: 500 }} />
            
            {showFinancials && (
              <YAxis yAxisId="left" stroke="#3b82f6" axisLine={{ stroke: '#3b82f6', strokeWidth: 1.5, strokeOpacity: 0.5 }} tickLine={false} tick={{ fill: isDark ? '#ffffff' : '#000000', fontSize: 11, fontWeight: 500 }} width={60} />
            )}
            
            <YAxis yAxisId="right" orientation={showFinancials ? "right" : "left"} stroke="#2dd4bf" axisLine={{ stroke: '#2dd4bf', strokeWidth: 1.5, strokeOpacity: 0.5 }} tickLine={false} tick={{ fill: isDark ? '#ffffff' : '#000000', fontSize: 11, fontWeight: 500 }} width={60} />

            <Tooltip contentStyle={glassTooltipStyle} itemStyle={{ fontWeight: 600 }} cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }} formatter={(value, name) => {
                if (name === 'Credits Used' || name === 'USD Used') return [formatCreditValue(Number(value)), name]
                return [value as any, name]
              }}
            />

            <Legend wrapperStyle={{ paddingTop: '10px', paddingBottom: '20px', fontSize: '12px', color: tickFill }} verticalAlign="top" />

            {showFinancials && (
              <Bar yAxisId="left" dataKey="TOTAL_SPEND_DISPLAY" name={`${creditUnitLabel} Used`} fill="url(#barCredits)" radius={[4,4,0,0]} maxBarSize={40} />
            )}
            <Bar yAxisId="right" dataKey="QUERY_COUNT" name="Query Count" fill="url(#barQueries)" radius={[4,4,0,0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {showFinancials && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* 2. Credits by Warehouse */}
          <div className={`${chartCardClass} flex flex-col`}>
            {/* ✨ Added Tooltip */}
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100 uppercase tracking-wider">
                {creditUnitLabel} by Warehouse
              </h3>
              <InfoTooltip text="Warehouses are the 'engines' that run your database. This shows which engines are burning the most fuel (credits) to complete tasks." />
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/50 backdrop-blur-md rounded-xl p-5 shadow-inner flex-1 flex flex-col justify-center">
              <div className="space-y-4">
                {topWarehouses.map((item, idx) => {
                  const val   = Number(item.TOTAL_CREDITS_USED || 0)
                  const pct   = Math.min(100, Math.max(0.5, (val / maxWhCredits) * 100))
                  const color = COLORS[idx % COLORS.length]
                  return (
                    <div key={idx} className="group/item relative">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform group-hover/item:scale-125" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}80` }} />
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate group-hover/item:text-slate-900 dark:group-hover/item:text-white transition-colors">
                            {item.WAREHOUSE_NAME}
                          </p>
                        </div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white flex-shrink-0">
                          {formatCreditValue(val)}
                        </p>
                      </div>

                      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-300/30 dark:border-slate-700/30">
                        <div className="h-full rounded-full transition-all duration-1000 ease-out relative" style={{ width: `${pct}%`, backgroundColor: color }}>
                          <div className="absolute inset-0 bg-white/20 w-full h-full opacity-0 group-hover/item:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* 3. Credits by Service Type */}
          <div className={chartCardClass}>
            {/* ✨ Added Tooltip */}
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100 uppercase tracking-wider">
                {creditUnitLabel} by Service Type
              </h3>
              <InfoTooltip text="Snowflake charges for different types of work. This breaks down exactly what kind of work (like storing data vs. running queries) is costing you the most." />
            </div>

            <ResponsiveContainer width="100%" height={320}>
              <BarChart layout="vertical" data={(serviceCredits || []).slice(0, 10).map((row) => ({ ...row, TOTAL_SPEND_DISPLAY: convertCredits(row.TOTAL_CREDITS) }))} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorServiceBarHorizontal" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} vertical={true} />
                <XAxis type="number" stroke={axisStroke} axisLine={{ stroke: axisStrokeStrong, strokeWidth: 1.5 }} tickLine={false} tick={{ fill: isDark ? '#ffffff' : '#000000', fontSize: 10, fontWeight: 600 }} />
                <YAxis type="category" dataKey="SERVICE_TYPE" stroke={axisStroke} axisLine={{ stroke: axisStrokeStrong, strokeWidth: 1.5 }} tickLine={false} width={150} tick={{ fill: isDark ? '#ffffff' : '#000000', fontSize: 10, fontWeight: 600 }} tickFormatter={(value) => {
                    const cleanText = typeof value === 'string' ? value.replace(/_/g, ' ') : value;
                    return cleanText.length > 22 ? `${cleanText.substring(0, 20)}...` : cleanText;
                  }}
                />
                <Tooltip contentStyle={glassTooltipStyle} itemStyle={{ color: isDark ? '#f8fafc' : '#0f172a', fontWeight: 600 }} cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }} formatter={(value) => formatCreditValue(Number(value))} />
                <Bar dataKey="TOTAL_SPEND_DISPLAY" fill="url(#colorServiceBarHorizontal)" radius={[0,4,4,0]} name={`${creditUnitLabel} Used`} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}