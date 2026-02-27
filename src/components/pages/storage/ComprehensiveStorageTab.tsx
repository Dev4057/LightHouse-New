'use client'

import useFetch from '@/hooks/useApi'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader, AlertCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { formatBytes, formatNumber } from '@/lib/formatting'
import WidgetAIInsight from '@/components/ai/WidgetAIInsight'

const COLORS = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function ComprehensiveStorageTab({ dateRange }: { dateRange: { start: Date; end: Date } }) {
  const start = dateRange.start.toISOString().split('T')[0]
  const end = dateRange.end.toISOString().split('T')[0]

  const { data: summaryDist, isLoading: l1 } = useFetch<any[]>(['storage-summary-dist', start, end], '/api/storage?type=summary')
  const { data: summaryKpi, isLoading: l2 } = useFetch<any[]>(['storage-summary-kpi', start, end], `/api/storage?type=summary_kpi&start=${start}&end=${end}`)
  const { data: topDb, isLoading: l3 } = useFetch<any[]>(['storage-top-db', start, end], `/api/storage?type=top_databases&start=${start}&end=${end}`)
  const { data: overall, isLoading: l4 } = useFetch<any[]>(['storage-overall', start, end], `/api/storage?type=overall&start=${start}&end=${end}`)
  const { data: stageBytes, isLoading: l5 } = useFetch<any[]>(['storage-stage-bytes'], '/api/storage?type=stage_bytes')
  const { data: mostAccessed, isLoading: l6 } = useFetch<any[]>(['storage-most-accessed', start, end], `/api/storage?type=most_accessed&start=${start}&end=${end}`)
  const { data: leastAccessed, isLoading: l7 } = useFetch<any[]>(['storage-least-accessed', start, end], `/api/storage?type=least_accessed&start=${start}&end=${end}`)
  const { data: largeUnused, isLoading: l8 } = useFetch<any[]>(['storage-large-unused', start, end], `/api/storage?type=large_unused&start=${start}&end=${end}`)

  const isLoading = l1 || l2 || l3 || l4 || l5 || l6 || l7 || l8

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader className="w-8 h-8 text-blue-400 animate-spin" /></div>
  }

  const kpi = summaryKpi?.[0]
  const hasAny = !!(summaryDist?.length || topDb?.length || overall?.length || stageBytes?.length || largeUnused?.length)

  if (!hasAny) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
        <p className="text-slate-400">No storage data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          ['Database', kpi?.DATABASE_D],
          ['Stage', kpi?.STAGE_D],
          ['Failsafe', kpi?.FAILSAFE_D],
          ['Hybrid', kpi?.HYBRID_TABLE_D],
          ['Total', kpi?.TOTAL_STORAGE_D],
        ].map(([label, value]) => (
          <Card key={String(label)} className="bg-slate-900 border-slate-700">
            <CardContent className="pt-6">
              <p className="text-xs text-slate-400">{label}</p>
              <p className="text-lg font-semibold text-white mt-1">{formatBytes(Number(value || 0))}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-base">Storage Distribution by Database</CardTitle>
            <CardDescription>Database-level average storage composition</CardDescription>
          </CardHeader>
          <CardContent>
            {summaryDist && summaryDist.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie data={summaryDist.slice(0, 8)} dataKey="TOTAL_BYTES" nameKey="DATABASE_NAME" outerRadius={100} label>
                    {summaryDist.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatBytes(v as number)} />
                  <Legend wrapperStyle={{ color: '#cbd5e1', paddingTop: '20px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="h-80 flex items-center justify-center text-slate-300">No data</div>}
            <WidgetAIInsight
              title="Storage Distribution by Database"
              widgetType="storage_analysis"
              dateRange={dateRange}
              widgetId="storage_summary"
              widgetKind="chart"
              templateKey="storage_footprint"
              dataSample={summaryDist?.slice(0, 25) ?? []}
            />
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-base">Top Databases by Storage (Avg)</CardTitle>
            <CardDescription>Average bytes across selected window</CardDescription>
          </CardHeader>
          <CardContent>
            {topDb && topDb.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={topDb.map((r) => ({ ...r, GB: Number(r.AVG_BYTES || 0) / 1024 ** 3 })).slice(0, 20)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="DATABASE_NAME" angle={-35} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip formatter={(v) => `${Number(v).toFixed(2)} GB`} />
                  <Bar dataKey="GB" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-80 flex items-center justify-center text-slate-400">No data</div>}
            <WidgetAIInsight
              title="Top Databases by Storage"
              widgetType="storage_analysis"
              dateRange={dateRange}
              widgetId="storage_top_databases"
              widgetKind="chart"
              templateKey="storage_footprint"
              dataSample={topDb?.slice(0, 25) ?? []}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-base">Overall Storage (Databases + Stages)</CardTitle>
          <CardDescription>Combined stage and database footprint</CardDescription>
        </CardHeader>
        <CardContent>
          {overall && overall.length > 0 ? (
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={overall.map((r) => ({ ...r, SIZE_GB: Number(r.STORAGE_BYTES || 0) / 1024 ** 3 })).slice(0, 30)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="NAME" angle={-40} textAnchor="end" height={90} />
                <YAxis />
                <Tooltip formatter={(v) => `${Number(v).toFixed(2)} GB`} />
                <Bar dataKey="SIZE_GB" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="py-8 text-center text-slate-400">No overall storage rows</div>}
          <WidgetAIInsight
            title="Overall Storage (Databases + Stages)"
            widgetType="storage_analysis"
            dateRange={dateRange}
            widgetId="storage_overall"
            widgetKind="chart"
            templateKey="storage_footprint"
            dataSample={overall?.slice(0, 40) ?? []}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-base">Data Stored by Each Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs lh-dark-table">
                <thead><tr className="border-b border-slate-700"><th className="text-left py-2 px-2">Stage</th><th className="text-right py-2 px-2">Bytes</th></tr></thead>
                <tbody>
                  {(stageBytes || []).slice(0, 100).map((r, i) => (
                    <tr key={i} className="border-b border-slate-800">
                      <td className="py-2 px-2 text-slate-300">{r.STAGE_NAME}</td>
                      <td className="py-2 px-2 text-right text-slate-200">{formatBytes(Number(r.TOTAL_BYTES || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <WidgetAIInsight
              title="Data Stored by Each Stage"
              widgetType="storage_analysis"
              dateRange={dateRange}
              widgetId="storage_stage_bytes"
              widgetKind="table"
              templateKey="storage_footprint"
              dataSample={stageBytes?.slice(0, 40) ?? []}
            />
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-base">Large Unused Tables</CardTitle>
            <CardDescription>Top 10 large inactive tables in mart snapshot</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs lh-dark-table">
                <thead><tr className="border-b border-slate-700"><th className="text-left py-2 px-2">Table</th><th className="text-right py-2 px-2">GB</th><th className="text-left py-2 px-2">Last Access</th></tr></thead>
                <tbody>
                  {(largeUnused || []).map((r, i) => (
                    <tr key={i} className="border-b border-slate-800">
                      <td className="py-2 px-2 text-slate-300">{r.FQ_TABLE_NAME}</td>
                      <td className="py-2 px-2 text-right text-yellow-300">{Number(r.ACTIVE_GB || 0).toFixed(2)}</td>
                      <td className="py-2 px-2 text-slate-400">{r.LAST_ACCESS_TIME ? new Date(r.LAST_ACCESS_TIME).toLocaleString() : 'Never'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <WidgetAIInsight
              title="Large Unused Tables"
              widgetType="storage_analysis"
              dateRange={dateRange}
              widgetId="storage_large_unused_tables"
              widgetKind="table"
              templateKey="table_access_optimization"
              dataSample={largeUnused?.slice(0, 30) ?? []}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader><CardTitle className="text-base">Most Accessed Tables (Top 5)</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs lh-dark-table">
                <thead><tr className="border-b border-slate-700"><th className="text-left py-2 px-2">Table</th><th className="text-right py-2 px-2">Access Count</th></tr></thead>
                <tbody>{(mostAccessed || []).map((r, i) => <tr key={i} className="border-b border-slate-800"><td className="py-2 px-2 text-slate-300">{r.FULL_TABLE_NAME}</td><td className="py-2 px-2 text-right">{formatNumber(r.ACCESS_COUNT)}</td></tr>)}</tbody>
              </table>
            </div>
            <WidgetAIInsight
              title="Most Accessed Tables"
              widgetType="storage_analysis"
              dateRange={dateRange}
              widgetId="storage_most_accessed_tables"
              widgetKind="table"
              templateKey="table_access_optimization"
              dataSample={mostAccessed?.slice(0, 30) ?? []}
            />
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader><CardTitle className="text-base">Least Accessed Tables (Bottom 5)</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs lh-dark-table">
                <thead><tr className="border-b border-slate-700"><th className="text-left py-2 px-2">Table</th><th className="text-right py-2 px-2">Access Count</th></tr></thead>
                <tbody>{(leastAccessed || []).map((r, i) => <tr key={i} className="border-b border-slate-800"><td className="py-2 px-2 text-slate-300">{r.FULL_TABLE_NAME}</td><td className="py-2 px-2 text-right">{formatNumber(r.ACCESS_COUNT)}</td></tr>)}</tbody>
              </table>
            </div>
            <WidgetAIInsight
              title="Least Accessed Tables"
              widgetType="storage_analysis"
              dateRange={dateRange}
              widgetId="storage_least_accessed_tables"
              widgetKind="table"
              templateKey="table_access_optimization"
              dataSample={leastAccessed?.slice(0, 30) ?? []}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
