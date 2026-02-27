'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { DualAxisChart, HeatmapChart } from '@/components/ui/AdvancedCharts'
import useFetch from '@/hooks/useApi'
import { Loader, AlertCircle } from 'lucide-react'
import { formatSeconds, formatBytes, shortenText } from '@/lib/formatting'
import { useSpendDisplay } from '@/hooks/useSpendDisplay'
import WidgetAIInsight from '@/components/ai/WidgetAIInsight'
import QueryDetailModal from '@/components/ui/QueryDetailModal'
import type { QueryType, QueryUser, ExpensiveQuery, QueryTrend, HeatmapData, SpillQuery, PartitionPruningQuery, HighFrequencyQuery, Query } from '@/types'

interface QueriesPageProps {
  dateRange: { start: Date; end: Date }
}

// const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']

export default function ComprehensiveQueriesPage({ dateRange }: QueriesPageProps) {
  const [selectedQuery, setSelectedQuery] = useState<ExpensiveQuery | SpillQuery | PartitionPruningQuery | null>(null)
  const { formatCreditValue, creditUnitLabel } = useSpendDisplay()
  const startDate = dateRange.start.toISOString().split('T')[0]
  const endDate = dateRange.end.toISOString().split('T')[0]

  // Fetch all query data in parallel
  const { data: queryTypeData, isLoading: loadingQType } = useFetch<QueryType[]>(
    ['query-by-type', startDate, endDate],
    `/api/queries?type=by-type&start=${startDate}&end=${endDate}`
  )

  const { data: queryUserData, isLoading: loadingQUser } = useFetch<QueryUser[]>(
    ['query-by-user', startDate, endDate],
    `/api/queries?type=by-user&start=${startDate}&end=${endDate}`
  )

  const { data: expensiveData, isLoading: loadingExpensive } = useFetch<ExpensiveQuery[]>(
    ['expensive-queries', startDate, endDate],
    `/api/queries?type=expensive&start=${startDate}&end=${endDate}&limit=20`
  )

  const { data: longestData, isLoading: loadingLongest } = useFetch<Query[]>(
    ['longest-queries', startDate, endDate],
    `/api/queries?type=longest&start=${startDate}&end=${endDate}&limit=20`
  )

  const { data: trendData, isLoading: loadingTrend } = useFetch<QueryTrend[]>(
    ['query-trend', startDate, endDate],
    `/api/queries?type=trend&start=${startDate}&end=${endDate}`
  )

  const { data: heatmapData, isLoading: loadingHeatmap } = useFetch<HeatmapData[]>(
    ['query-heatmap', startDate, endDate],
    `/api/queries?type=heatmap&start=${startDate}&end=${endDate}`
  )

  const { data: spillData, isLoading: loadingSpill } = useFetch<SpillQuery[]>(
    ['spill-queries', startDate, endDate],
    `/api/queries?type=spill&start=${startDate}&end=${endDate}&limit=10`
  )

  const { data: pruneData, isLoading: loadingPrune } = useFetch<PartitionPruningQuery[]>(
    ['prune-queries', startDate, endDate],
    `/api/queries?type=prune&start=${startDate}&end=${endDate}&limit=10`
  )

  const { data: highFreqData, isLoading: loadingHighFreq } = useFetch<HighFrequencyQuery[]>(
    ['high-frequency-queries', startDate, endDate],
    `/api/queries?type=high-frequency&start=${startDate}&end=${endDate}`
  )

  const isLoading =
    loadingQType ||
    loadingQUser ||
    loadingExpensive ||
    loadingLongest ||
    loadingTrend ||
    loadingHeatmap ||
    loadingSpill ||
    loadingPrune ||
    loadingHighFreq

  const hasData = useMemo(() => {
    return !!(
      queryTypeData?.length ||
      queryUserData?.length ||
      expensiveData?.length ||
      longestData?.length ||
      trendData?.length
    )
  }, [queryTypeData, queryUserData, expensiveData, longestData, trendData])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
        <p className="text-slate-400">No query data available for the selected date range</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
      {/* Row 1: Query Type and User Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Query Type Timing */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-base">Avg Execution Time by Query Type</CardTitle>
            <CardDescription>Compare performance patterns by query category</CardDescription>
          </CardHeader>
          <CardContent>
            {queryTypeData && queryTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={queryTypeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="QUERY_TYPE" angle={-45} textAnchor="end" height={80} stroke="#94a3b8" />
                  <YAxis label={{ value: 'Seconds', angle: -90, position: 'insideLeft' }} stroke="#94a3b8" />
                  <Tooltip formatter={(value) => formatSeconds(value as number)} cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} />
                  <Bar dataKey="AVERAGE_EXECUTION_SECONDS" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-slate-300">No data</div>
            )}
            <WidgetAIInsight
              title="Average Execution Time by Query Type"
              widgetType="query_performance"
              dateRange={dateRange}
              widgetId="qtype_timing"
              widgetKind="chart"
              templateKey="query_type_timing"
              dataSample={queryTypeData?.slice(0, 25) ?? []}
            />
          </CardContent>
        </Card>

        {/* User Performance */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-base">Avg Execution Time by User (Top 25)</CardTitle>
            <CardDescription>Identify users with slowest queries</CardDescription>
          </CardHeader>
          <CardContent>
            {queryUserData && queryUserData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={queryUserData.slice(0, 25)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="USER_NAME" angle={-45} textAnchor="end" height={80} stroke="#94a3b8" />
                  <YAxis label={{ value: 'Seconds', angle: -90, position: 'insideLeft' }} stroke="#94a3b8" />
                  <Tooltip formatter={(value) => formatSeconds(value as number)} cursor={{ fill: 'rgba(239, 68, 68, 0.1)' }} />
                  <Bar dataKey="AVERAGE_EXECUTION_SECONDS" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-slate-300">No data</div>
            )}
            <WidgetAIInsight
              title="Average Execution Time by User"
              widgetType="query_performance"
              dateRange={dateRange}
              widgetId="quser_timing"
              widgetKind="chart"
              templateKey="user_timing"
              dataSample={queryUserData?.slice(0, 25) ?? []}
            />
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Trend and Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Query Trend */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-base">Query Load & Performance Daily Trend</CardTitle>
            <CardDescription>Volume and execution time over time</CardDescription>
          </CardHeader>
          <CardContent>
            {trendData && trendData.length > 0 ? (
              <DualAxisChart
                data={trendData}
                xKey="QUERY_DAY"
                barKey="QUERY_COUNT"
                lineKey="AVG_SECONDS"
                barLabel="Total Queries"
                lineLabel="Avg Seconds"
                height={320}
              />
            ) : (
              <div className="h-80 flex items-center justify-center text-slate-300">No data</div>
            )}
            <WidgetAIInsight
              title="Query Load & Performance Daily Trend"
              widgetType="query_performance"
              dateRange={dateRange}
              widgetId="query_trend"
              widgetKind="chart"
              templateKey="query_trend"
              dataSample={trendData?.slice(0, 60) ?? []}
            />
          </CardContent>
        </Card>

        {/* Heatmap */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-base">Workload by Day & Hour</CardTitle>
            <CardDescription>Query volume patterns across week</CardDescription>
          </CardHeader>
          <CardContent>
            {heatmapData && heatmapData.length > 0 ? (
              <HeatmapChart data={heatmapData} height={320} />
            ) : (
              <div className="h-80 flex items-center justify-center text-slate-300">No data</div>
            )}
            <WidgetAIInsight
              title="Workload by Day & Hour"
              widgetType="query_performance"
              dateRange={dateRange}
              widgetId="query_heatmap"
              widgetKind="chart"
              templateKey="workload_heatmap"
              dataSample={heatmapData?.slice(0, 120) ?? []}
            />
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Most Expensive Queries */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-base">Most Expensive Queries (by compute {creditUnitLabel.toLowerCase()})</CardTitle>
          <CardDescription>Top 20 queries consuming the most resources</CardDescription>
        </CardHeader>
        <CardContent>
          {expensiveData && expensiveData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm lh-dark-table">
                <thead>
                  <tr className="border-b border-slate-600 bg-slate-800/50">
                    <th className="text-left py-3 px-3 font-semibold text-slate-100 uppercase text-xs tracking-wide">Query Text</th>
                    <th className="text-left py-3 px-3 font-semibold text-slate-100 uppercase text-xs tracking-wide">User</th>
                    <th className="text-left py-3 px-3 font-semibold text-slate-100 uppercase text-xs tracking-wide">Warehouse</th>
                    <th className="text-right py-3 px-3 font-semibold text-slate-100 uppercase text-xs tracking-wide">{creditUnitLabel}</th>
                    <th className="text-right py-3 px-3 font-semibold text-slate-100 uppercase text-xs tracking-wide">Time</th>
                    <th className="text-right py-3 px-3 font-semibold text-slate-100 uppercase text-xs tracking-wide">AI</th>
                  </tr>
                </thead>
                <tbody>
                  {expensiveData.map((q, i) => (
                    <tr key={i} className="border-b border-slate-800 hover:bg-slate-800 transition-colors">
                      <td className="py-3 px-3 text-slate-100 cursor-pointer hover:text-blue-300 transition-colors" onClick={() => setSelectedQuery(q)}>
                        <span className="inline-block max-w-xs truncate hover:underline">{shortenText(q.QUERY_TEXT, 80)}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-200">{q.USER_NAME}</td>
                      <td className="py-3 px-3 text-slate-200">{q.WAREHOUSE_NAME}</td>
                      <td className="py-3 px-3 text-right text-blue-300 font-semibold">{formatCreditValue(q.CREDITS_ATTRIBUTED_COMPUTE)}</td>
                      <td className="py-3 px-3 text-right text-slate-200">{formatSeconds(q.EXECUTION_SECONDS)}</td>
                      <td className="py-3 px-3 text-right">
                        <WidgetAIInsight
                          title="Most Expensive Query (Row)"
                          widgetType="cost_analysis"
                          dateRange={dateRange}
                          inline
                          label="AI"
                          widgetId="expensive_queries"
                          widgetKind="table_row"
                          templateKey="expensive_queries"
                          dataSample={[q]}
                          selectedRow={q as unknown as Record<string, unknown>}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400">No expensive queries found</div>
          )}
          <WidgetAIInsight
            title="Most Expensive Queries"
            widgetType="cost_analysis"
            dateRange={dateRange}
            widgetId="expensive_queries"
            widgetKind="table"
            templateKey="expensive_queries"
            dataSample={expensiveData?.slice(0, 20) ?? []}
          />
        </CardContent>
      </Card>

      {/* Row 4: Resource Issues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Disk Spill */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-base">Under-Resourced Queries (Disk Spill)</CardTitle>
            <CardDescription>Queries using temporary storage</CardDescription>
          </CardHeader>
          <CardContent>
            {spillData && spillData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs lh-dark-table">
                  <thead>
                    <tr className="border-b border-slate-600 bg-slate-800/50">
                      <th className="text-left py-3 px-2 font-semibold text-slate-100 uppercase tracking-wide">Query</th>
                      <th className="text-right py-3 px-2 font-semibold text-slate-100 uppercase tracking-wide">Local Spill</th>
                      <th className="text-right py-3 px-2 font-semibold text-slate-100 uppercase tracking-wide">Remote Spill</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spillData.map((q, i) => (
                      <tr key={i} className="border-b border-slate-800 hover:bg-slate-800 transition-colors">
                        <td className="py-3 px-2 text-slate-100 truncate cursor-pointer hover:text-blue-300" onClick={() => setSelectedQuery(q)}>
                          {shortenText(q.QUERY_TEXT, 50)}
                        </td>
                        <td className="py-3 px-2 text-right text-red-300 font-medium">{formatBytes(q.BYTES_SPILLED_TO_LOCAL_STORAGE)}</td>
                        <td className="py-3 px-2 text-right text-red-300 font-medium">{formatBytes(q.BYTES_SPILLED_TO_REMOTE_STORAGE)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-300">No spill detected - good performance!</div>
            )}
            <WidgetAIInsight
              title="Under-Resourced Queries (Disk Spill)"
              widgetType="query_performance"
              dateRange={dateRange}
              widgetId="spill_queries"
              widgetKind="table"
              templateKey="spill_queries"
              dataSample={spillData?.slice(0, 20) ?? []}
            />
          </CardContent>
        </Card>

        {/* Partition Pruning */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-base">Inefficient Queries (Poor Partition Pruning)</CardTitle>
            <CardDescription>Queries scanning unnecessary partitions</CardDescription>
          </CardHeader>
          <CardContent>
            {pruneData && pruneData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs lh-dark-table">
                  <thead>
                    <tr className="border-b border-slate-600 bg-slate-800/50">
                      <th className="text-left py-3 px-2 font-semibold text-slate-100 uppercase tracking-wide">Query</th>
                      <th className="text-right py-3 px-2 font-semibold text-slate-100 uppercase tracking-wide">Pruning %</th>
                      <th className="text-right py-3 px-2 font-semibold text-slate-100 uppercase tracking-wide">Partitions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pruneData.map((q, i) => (
                      <tr key={i} className="border-b border-slate-800 hover:bg-slate-800 transition-colors">
                        <td className="py-3 px-2 text-slate-100 truncate cursor-pointer hover:text-blue-300" onClick={() => setSelectedQuery(q)}>
                          {shortenText(q.QUERY_TEXT, 50)}
                        </td>
                        <td className="py-3 px-2 text-right text-yellow-300 font-semibold">
                          {`${(Math.max(0, Math.min(100, Number(q.PRUNING_RATIO || 0) > 1 ? Number(q.PRUNING_RATIO || 0) : Number(q.PRUNING_RATIO || 0) * 100))).toFixed(1)}%`}
                        </td>
                        <td className="py-3 px-2 text-right text-slate-200">{q.PARTITIONS_SCANNED} / {q.PARTITIONS_TOTAL}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-300">Excellent partition pruning!</div>
            )}
            <WidgetAIInsight
              title="Inefficient Queries (Poor Partition Pruning)"
              widgetType="query_performance"
              dateRange={dateRange}
              widgetId="prune_queries"
              widgetKind="table"
              templateKey="prune_queries"
              dataSample={pruneData?.slice(0, 20) ?? []}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-base">High Frequency Queries (Repeat Patterns)</CardTitle>
          <CardDescription>Top repeated query fingerprints across the selected window</CardDescription>
        </CardHeader>
        <CardContent>
          {highFreqData && highFreqData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs lh-dark-table">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 px-2 font-semibold text-slate-100">Pattern</th>
                    <th className="text-right py-2 px-2 font-semibold text-slate-100">Runs</th>
                    <th className="text-right py-2 px-2 font-semibold text-slate-100">Avg Sec</th>
                    <th className="text-right py-2 px-2 font-semibold text-slate-100">Total Sec</th>
                    <th className="text-left py-2 px-2 font-semibold text-slate-100">Users</th>
                    <th className="text-left py-2 px-2 font-semibold text-slate-100">Warehouses</th>
                  </tr>
                </thead>
                <tbody>
                  {highFreqData.map((q, i) => (
                    <tr key={i} className="border-b border-slate-800">
                      <td className="py-2 px-2 text-slate-300">{shortenText(q.SAMPLE_QUERY_TEXT, 70)}</td>
                      <td className="py-2 px-2 text-right text-slate-200">{q.QUERY_COUNT}</td>
                      <td className="py-2 px-2 text-right text-slate-200">{q.AVG_EXECUTION_SECONDS}</td>
                      <td className="py-2 px-2 text-right text-blue-300">{q.TOTAL_EXECUTION_SECONDS}</td>
                      <td className="py-2 px-2 text-slate-400">{shortenText(q.USER_NAMES, 40)}</td>
                      <td className="py-2 px-2 text-slate-400">{shortenText(q.WAREHOUSE_NAMES, 40)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400">No repeated query patterns found</div>
          )}
          <WidgetAIInsight
            title="High Frequency Queries"
            widgetType="query_performance"
            dateRange={dateRange}
            widgetId="high_frequency_queries"
            widgetKind="table"
            templateKey="high_frequency_queries"
            dataSample={highFreqData?.slice(0, 30) ?? []}
          />
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-base">Longest Running Queries</CardTitle>
          <CardDescription>Use row AI to run explain/rewrite validation in the AI modal</CardDescription>
        </CardHeader>
        <CardContent>
          {longestData && longestData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs lh-dark-table">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 px-2 font-semibold text-slate-100">Query</th>
                    <th className="text-left py-2 px-2 font-semibold text-slate-100">User</th>
                    <th className="text-left py-2 px-2 font-semibold text-slate-100">Warehouse</th>
                    <th className="text-right py-2 px-2 font-semibold text-slate-100">Elapsed</th>
                    <th className="text-right py-2 px-2 font-semibold text-slate-100">AI</th>
                  </tr>
                </thead>
                <tbody>
                  {longestData.map((q, i) => (
                    <tr key={q.QUERY_ID || i} className="border-b border-slate-800 hover:bg-slate-800/50">
                      <td className="py-2 px-2 text-slate-300">{shortenText(q.QUERY_TEXT, 70)}</td>
                      <td className="py-2 px-2 text-slate-300">{q.USER_NAME}</td>
                      <td className="py-2 px-2 text-slate-400">{q.WAREHOUSE_NAME}</td>
                      <td className="py-2 px-2 text-right text-red-300">
                        {formatSeconds((Number((q as any).ELAPSED_TIME_SEC) || Number(q.EXECUTION_TIME || 0) / 1000 || 0))}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <WidgetAIInsight
                          title="Longest Running Query (Row)"
                          widgetType="query_performance"
                          dateRange={dateRange}
                          inline
                          label="AI"
                          widgetId="longest_queries"
                          widgetKind="table_row"
                          templateKey="longest_queries"
                          dataSample={[q]}
                          selectedRow={q as unknown as Record<string, unknown>}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-300">No long-running queries found</div>
          )}
          <WidgetAIInsight
            title="Longest Running Queries"
            widgetType="query_performance"
            dateRange={dateRange}
            widgetId="longest_queries"
            widgetKind="table"
            templateKey="longest_queries"
            dataSample={longestData?.slice(0, 20) ?? []}
          />
        </CardContent>
      </Card>
      </div>

      {/* Query Detail Modal */}
      <QueryDetailModal
        isOpen={!!selectedQuery}
        onClose={() => setSelectedQuery(null)}
        query={selectedQuery as any}
        title="Query Details"
      />
    </>
  )
}
