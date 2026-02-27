import { NextRequest, NextResponse } from 'next/server'
import {
  getStorageSummary,
  getLargestTables,
  getUnusedTables,
  getStorageSummaryKpi,
  getTopDatabasesByStorage,
  getOverallStorage,
  getStageBytesByStage,
  getTableAccessCounts,
  getLargeUnusedTables,
} from '@/lib/snowflake/queries'
import type { APIResponse } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'summary'
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const daysUnused = parseInt(searchParams.get('daysUnused') || '30', 10)
    const startDate = searchParams.get('start') || searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const endDate = searchParams.get('end') || searchParams.get('endDate') || new Date().toISOString().split('T')[0]

    let data

    switch (type) {
      case 'summary':
        data = await getStorageSummary()
        break
      case 'largest':
        data = await getLargestTables(limit)
        break
      case 'unused':
        data = await getUnusedTables(daysUnused)
        break
      case 'summary_kpi':
        data = await getStorageSummaryKpi(startDate, endDate)
        break
      case 'top_databases':
        data = await getTopDatabasesByStorage(startDate, endDate)
        break
      case 'overall':
        data = await getOverallStorage(startDate, endDate)
        break
      case 'stage_bytes':
        data = await getStageBytesByStage()
        break
      case 'most_accessed':
        data = await getTableAccessCounts(startDate, endDate, 'most')
        break
      case 'least_accessed':
        data = await getTableAccessCounts(startDate, endDate, 'least')
        break
      case 'large_unused':
        data = await getLargeUnusedTables(startDate, endDate)
        break
      default:
        return NextResponse.json<APIResponse<any>>(
          { status: 'error', error: { message: 'Invalid storage type', code: 'INVALID_TYPE' }, timestamp: new Date().toISOString() },
          { status: 400 }
        )
    }

    return NextResponse.json<APIResponse<any>>(
      { status: 'success', data, timestamp: new Date().toISOString() },
      { status: 200 }
    )
  } catch (error) {
    console.error('Storage API error:', error)
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
