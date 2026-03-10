import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt' // ✨ The Bouncer
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

// 🚨 Update this list to match exactly what you see in the JSON
const FINANCIAL_KEYS = [
  'CREDITS_USED', 
  'CREDITS_ATTRIBUTED_COMPUTE',
  'TOTAL_CREDITS', 
  'APPROXIMATE_COST', 
  'CREDITS_USED_CLOUD_SERVICES',
  'TOTAL_SPEND_DISPLAY'
];

export async function GET(request: NextRequest) {
  try {
    // 🔐 1. AUTH CHECK
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    if (!token) {
      return NextResponse.json({ status: 'error', error: { message: 'Unauthorized' } }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'expensive'
    const startDate = searchParams.get('start') || searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const endDate = searchParams.get('end') || searchParams.get('endDate') || new Date().toISOString().split('T')[0]
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    let data: any

    switch (type) {
      case 'expensive': data = await getExpensiveQueries(startDate, endDate, limit); break
      case 'longest': data = await getLongestQueries(startDate, endDate, limit); break
      case 'failed': data = await getFailedQueries(startDate, endDate, limit); break
      case 'trend': data = await getQueryTrend(startDate, endDate); break
      case 'by-type': data = await getQueryTypeMetrics(startDate, endDate); break
      case 'by-user': data = await getUserQueryPerformance(startDate, endDate); break
      case 'heatmap': data = await getQueryHeatmapData(startDate, endDate); break
      case 'spill': data = await getSpilledQueries(startDate, endDate, limit); break
      case 'prune': data = await getPruningIssues(startDate, endDate, limit); break
      case 'high-frequency': data = await getHighFrequencyQueries(startDate, endDate); break
      default:
        return NextResponse.json<APIResponse<any>>(
          { status: 'error', error: { message: 'Invalid query type', code: 'INVALID_TYPE' }, timestamp: new Date().toISOString() },
          { status: 400 }
        )
    }

    // 🛡️ 2. ROW-LEVEL SANITIZATION
    // If the user is a Developer, loop through the results and delete financial data
    if (token.role === 'DEVELOPER' && data) {
      const sanitize = (obj: any) => {
        FINANCIAL_KEYS.forEach(key => delete obj[key]);
      }

      if (Array.isArray(data)) {
        data.forEach(sanitize);
      } else {
        sanitize(data);
      }
      console.log(`🔒 SANITIZED: Stripped financial columns from /api/queries?type=${type} for Developer`);
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