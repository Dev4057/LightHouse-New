import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getPerformanceTrend, getKPIMetrics as getSnowflakeKPIs } from '@/lib/snowflake/queries'
import { getDuckDbKPIs } from '@/lib/duckdb/queries' // ✨ Uncommented and imported!
import type { APIResponse } from '@/types'

export async function GET(request: NextRequest) {
  try {
    // 1. GET THE USER TOKEN
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET 
    })

    // If not logged in at all, block immediately
    if (!token) {
      return NextResponse.json(
        { status: 'error', error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'summary'
    const startDate =
      searchParams.get('startDate') ||
      searchParams.get('start_date') ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const endDate =
      searchParams.get('endDate') ||
      searchParams.get('end_date') ||
      new Date().toISOString().split('T')[0]

    let data

    // ✨ Route to the correct queries based on 'type'
    if (type === 'performance_trend') {
      // Keep this hitting Snowflake (or migrate to DuckDB later if you want!)
      data = await getPerformanceTrend(startDate, endDate)
    } else {
      // ⚡ HYBRID FETCH: Run both local DuckDB and remote Snowflake in parallel
      const [snowflakeData, duckDbData] = await Promise.all([
        getSnowflakeKPIs(startDate, endDate),
        getDuckDbKPIs(startDate, endDate)
      ])

      // Merge the data perfectly for your frontend components
      data = {
        TOTAL_CREDITS_USED: snowflakeData.TOTAL_CREDITS_USED,
        COST_PER_DAY: snowflakeData.COST_PER_DAY,
        AVERAGE_QUERY_TIME: snowflakeData.AVERAGE_QUERY_TIME,
        TOTAL_QUERIES_EXECUTED: duckDbData.TOTAL_QUERIES_EXECUTED, // From DuckDB!
        FAILED_QUERY_COUNT: duckDbData.FAILED_QUERY_COUNT          // From DuckDB!
      }
      
      // 2. FIELD-LEVEL SECURITY
      // If the user is a Developer, we strip out the financial field
      if (token.role === 'DEVELOPER' && data) {
        data.TOTAL_CREDITS_USED = null 
      }
    }

    return NextResponse.json<APIResponse<any>>(
      { status: 'success', data, timestamp: new Date().toISOString() },
      { status: 200 }
    )
  } catch (error) {
    console.error('KPI API error:', error)
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