import { NextRequest, NextResponse } from 'next/server'
import { getKPIMetrics } from '@/lib/snowflake/queries'
import type { APIResponse } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate =
      searchParams.get('startDate') ||
      searchParams.get('start_date') ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const endDate =
      searchParams.get('endDate') ||
      searchParams.get('end_date') ||
      new Date().toISOString().split('T')[0]

    const data = await getKPIMetrics(startDate, endDate)

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
