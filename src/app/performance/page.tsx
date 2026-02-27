'use client'

import { useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import DateRangeSelector from '@/components/dashboard/DateRangeSelector'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import useFetch from '@/hooks/useApi'
import { Loader, AlertCircle } from 'lucide-react'
import { formatSeconds, formatNumber } from '@/lib/formatting'

export default function PerformancePage() {
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date(),
  })

  const startDate = dateRange.start.toISOString().split('T')[0]
  const endDate = dateRange.end.toISOString().split('T')[0]

  const { data: trendData, isLoading: loadingTrend } = useFetch<any[]>(
    ['perf-trend', startDate, endDate],
    `/api/queries?type=trend&start=${startDate}&end=${endDate}`
  )

  const { data: queryTypeData, isLoading: loadingQueryType } = useFetch<any[]>(
    ['perf-query-type', startDate, endDate],
    `/api/queries?type=by-type&start=${startDate}&end=${endDate}`
  )

  const { data: userPerf, isLoading: loadingUserPerf } = useFetch<any[]>(
    ['perf-user', startDate, endDate],
    `/api/queries?type=by-user&start=${startDate}&end=${endDate}`
  )

  const isLoading = loadingTrend || loadingQueryType || loadingUserPerf
  const hasData = !!trendData?.length

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  if (!hasData) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <AlertCircle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
          <p className="text-slate-400">No performance data available</p>
        </div>
      </DashboardLayout>
    )
  }

  const avgQueryTime = trendData ? (trendData.reduce((sum, d) => sum + (d.AVG_SECONDS || 0), 0) / trendData.length).toFixed(2) : '0'
  const totalQueries = trendData ? trendData.reduce((sum, d) => sum + (d.QUERY_COUNT || 0), 0) : 0
  const maxQueryTime = trendData ? Math.max(...trendData.map(d => d.AVG_SECONDS || 0)).toFixed(2) : '0'
  const slowestQueryType = queryTypeData?.[queryTypeData.length - 1]
  const n = (value: unknown) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Performance Analytics</h1>
            <p className="text-slate-400 mt-1">Query execution performance trends and insights</p>
          </div>
          <DateRangeSelector value={dateRange} onChange={setDateRange} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="pt-6">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Average Query Time</p>
              <p className="text-3xl font-bold text-blue-300 mt-2">{formatSeconds(parseFloat(avgQueryTime))}</p>
              <p className="text-xs text-slate-500 mt-2">Across all queries</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="pt-6">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Total Queries</p>
              <p className="text-3xl font-bold text-green-300 mt-2">{formatNumber(totalQueries)}</p>
              <p className="text-xs text-slate-500 mt-2">Period execution count</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="pt-6">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Max Query Time</p>
              <p className="text-3xl font-bold text-yellow-300 mt-2">{formatSeconds(parseFloat(maxQueryTime))}</p>
              <p className="text-xs text-slate-500 mt-2">Peak execution duration</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="pt-6">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Slowest Type</p>
              <p className="text-2xl font-bold text-red-300 mt-2 truncate">{slowestQueryType?.QUERY_TYPE || 'N/A'}</p>
              <p className="text-xs text-slate-500 mt-2">{slowestQueryType ? formatSeconds(slowestQueryType.AVERAGE_EXECUTION_SECONDS) : '-'}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-base">Query Performance Trend</CardTitle>
              <CardDescription>Average execution time over time</CardDescription>
            </CardHeader>
            <CardContent>
              {trendData?.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                    <XAxis dataKey="QUERY_DAY" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" label={{ value: 'Seconds', angle: -90, position: 'insideLeft' }} />
                    <Tooltip cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} />
                    <Line type="monotone" dataKey="AVG_SECONDS" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-80 flex items-center justify-center text-slate-300">No data</div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-base">Execution Time by Query Type</CardTitle>
              <CardDescription>Performance across query categories</CardDescription>
            </CardHeader>
            <CardContent>
              {queryTypeData?.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={queryTypeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                    <XAxis dataKey="QUERY_TYPE" angle={-45} textAnchor="end" height={80} stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" label={{ value: 'Seconds', angle: -90, position: 'insideLeft' }} />
                    <Tooltip cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} />
                    <Bar dataKey="AVERAGE_EXECUTION_SECONDS" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-80 flex items-center justify-center text-slate-300">No data</div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-base">Average Execution Time by User</CardTitle>
            <CardDescription>Mart-backed per-user daily average execution timing (`USER_EXEC_DAILY`)</CardDescription>
          </CardHeader>
          <CardContent>
            {userPerf?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-600 bg-slate-800/50">
                      <th className="text-left py-3 px-3 font-semibold text-slate-100 uppercase text-xs tracking-wide">User</th>
                      <th className="text-right py-3 px-3 font-semibold text-slate-100 uppercase text-xs tracking-wide">Avg Time</th>
                      <th className="text-right py-3 px-3 font-semibold text-slate-100 uppercase text-xs tracking-wide">Days Observed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userPerf.slice(0, 20).map((user, i) => (
                      (() => {
                        const avgSeconds = n(user.AVERAGE_EXECUTION_SECONDS ?? user.average_execution_seconds ?? user.AVG_SECONDS)
                        const activeDays = n(user.ACTIVE_DAYS ?? user.active_days)
                        const userName = user.USER_NAME ?? user.user_name ?? '-'
                        return (
                      <tr key={i} className="border-b border-slate-800 hover:bg-slate-800">
                        <td className="py-3 px-3 text-slate-200">{userName}</td>
                        <td className="py-3 px-3 text-right text-red-300 font-medium">{formatSeconds(avgSeconds)}</td>
                        <td className="py-3 px-3 text-right text-slate-200">{formatNumber(activeDays)}</td>
                      </tr>
                        )
                      })()
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-300">No data available</div>
            )}
            <p className="text-xs text-slate-500 mt-3">
              `USER_EXEC_DAILY` does not provide query-level counts in this mart schema, so query-count and true total-time metrics are not shown here.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
