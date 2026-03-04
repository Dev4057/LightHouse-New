import { NextRequest, NextResponse } from 'next/server'
import { getLastMartRefreshTimestamp } from '@/lib/snowflake/queries'
import type { APIResponse } from '@/types'

function parseLastRefresh(raw: string | null): Date | null {
  if (!raw) return null

  const trimmed = String(raw).trim()
  if (!trimmed) return null

  const hasTimezone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(trimmed)
  const normalized = hasTimezone ? trimmed : `${trimmed.replace(' ', 'T')}+05:30`
  const parsed = new Date(normalized)

  if (!Number.isNaN(parsed.getTime())) {
    return parsed
  }

  const fallback = new Date(trimmed)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

function formatLocalTimestamp(date: Date | null): string {
  if (!date) return '-'

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', // Set to Indian Standard Time (IST)
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date)

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  
  // Removed the hardcoded 'KSA' and replaced it with 'IST'
  return `${get('day')} ${get('month')} ${get('year')} • ${get('hour')}:${get('minute')} ${get('dayPeriod')} IST`
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'last_refresh'

    if (type !== 'last_refresh') {
      return NextResponse.json<APIResponse<any>>(
        {
          status: 'error',
          error: { message: 'Invalid system type', code: 'INVALID_TYPE' },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      )
    }

    const raw = await getLastMartRefreshTimestamp()
    const parsed = parseLastRefresh(raw)
    
    // Updated to use the new formatting function
    const data = {
      raw: raw ?? null,
      iso: parsed ? parsed.toISOString() : null,
      formatted: formatLocalTimestamp(parsed), 
    }

    return NextResponse.json<APIResponse<typeof data>>(
      { status: 'success', data, timestamp: new Date().toISOString() },
      { status: 200 }
    )
  } catch (error) {
    console.error('System API error:', error)
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
