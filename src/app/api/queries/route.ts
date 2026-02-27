import { NextRequest, NextResponse } from 'next/server'
import {
  getExpensiveQueries,
  getLongestQueries,
  getFailedQueries,
  getQueryTrend,
  getQueryTypeMetrics,
  getUserQueryPerformance,
  getQueryHeatmapData,
  getSpilledQueries,
  getPruningIssues,
  getHighFrequencyQueries,
} from '@/lib/snowflake/queries'
import type { APIResponse } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'expensive'
    const startDate = searchParams.get('start') || searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const endDate = searchParams.get('end') || searchParams.get('endDate') || new Date().toISOString().split('T')[0]
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    let data

    switch (type) {
      case 'expensive':
        data = await getExpensiveQueries(startDate, endDate, limit)
        break
      case 'longest':
        data = await getLongestQueries(startDate, endDate, limit)
        break
      case 'failed':
        data = await getFailedQueries(startDate, endDate, limit)
        break
      case 'trend':
        data = await getQueryTrend(startDate, endDate)
        break
      case 'by-type':
        data = await getQueryTypeMetrics(startDate, endDate)
        break
      case 'by-user':
        data = await getUserQueryPerformance(startDate, endDate)
        break
      case 'heatmap':
        data = await getQueryHeatmapData(startDate, endDate)
        break
      case 'spill':
        data = await getSpilledQueries(startDate, endDate, limit)
        break
      case 'prune':
        data = await getPruningIssues(startDate, endDate, limit)
        break
      case 'high-frequency':
        data = await getHighFrequencyQueries(startDate, endDate)
        break
      default:
        return NextResponse.json<APIResponse<any>>(
          { status: 'error', error: { message: 'Invalid query type', code: 'INVALID_TYPE' }, timestamp: new Date().toISOString() },
          { status: 400 }
        )
    }

    return NextResponse.json<APIResponse<any>>(
      { status: 'success', data, timestamp: new Date().toISOString() },
      { status: 200 }
    )
  } catch (error) {
    console.error('Query API error:', error)
    return NextResponse.json<APIResponse<any>>(
      {
        status: 'error',
        error: { message: error instanceof Error ? error.message : 'Internal server error', code: 'SERVER_ERROR' },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
