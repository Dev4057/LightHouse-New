'use client'

import {
  LineChart,
  Line,
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

const COLORS = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

export default function ChartsGrid({ dateRange }: { dateRange: { start: Date; end: Date } }) {
  const start = dateRange.start.toISOString().split('T')[0]
  const end = dateRange.end.toISOString().split('T')[0]

  const { data: trend, isLoading: l1 } = useFetch<any[]>(
    ['dash-trend', start, end],
    `/api/queries?type=trend&start=${start}&end=${end}`
  )
  const { data: whCredits, isLoading: l2 } = useFetch<any[]>(
    ['dash-wh-credits', start, end],
    `/api/warehouses?type=credits&start=${start}&end=${end}`
  )
  const { data: serviceCredits, isLoading: l3 } = useFetch<any[]>(
    ['dash-service-credits', start, end],
    `/api/warehouses?type=services&start=${start}&end=${end}`
  )
  const { convertCredits, formatCreditValue, creditUnitLabel } = useSpendDisplay()

  if (l1 || l2 || l3) {
    return (
      <div className="card flex items-center justify-center py-12">
        <Loader className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="chart-container">
        <h3 className="text-lg font-semibold text-white mb-4">{creditUnitLabel} & Query Trends</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={(trend || []).map((row) => ({ ...row, TOTAL_SPEND_DISPLAY: convertCredits(row.TOTAL_CREDITS) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="QUERY_DAY" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
              formatter={(value, name) => {
                if (name === 'Credits Used' || name === 'USD Used') {
                  return [formatCreditValue(Number(value)), name]
                }
                return [value as any, name]
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="TOTAL_SPEND_DISPLAY"
              stroke="#3b82f6"
              strokeWidth={2}
              name={`${creditUnitLabel} Used`}
            />
            <Line type="monotone" dataKey="QUERY_COUNT" stroke="#06b6d4" strokeWidth={2} name="Query Count" yAxisId="right" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="chart-container">
          <h3 className="text-lg font-semibold text-white mb-4">{creditUnitLabel} by Warehouse</h3>
          <div className="bg-slate-800/30 rounded-lg p-4">
            <div className="space-y-2">
              {(whCredits || []).slice(0, 6).map((item, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{item.WAREHOUSE_NAME}</p>
                  </div>
                  <p className="text-sm font-semibold text-blue-300 flex-shrink-0">
                    {formatCreditValue(item.TOTAL_CREDITS_USED || 0)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="chart-container">
          <h3 className="text-lg font-semibold text-white mb-4">{creditUnitLabel} by Service Type</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={(serviceCredits || []).slice(0, 10).map((row) => ({
                ...row,
                TOTAL_SPEND_DISPLAY: convertCredits(row.TOTAL_CREDITS),
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="SERVICE_TYPE" stroke="#94a3b8" angle={-25} textAnchor="end" height={70} />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                formatter={(value) => formatCreditValue(Number(value))}
              />
              <Bar dataKey="TOTAL_SPEND_DISPLAY" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
