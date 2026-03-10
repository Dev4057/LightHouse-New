import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt' // ✨ The Backend Bouncer
import {
  getWarehouses,
  getWarehouseCreditsByDay,
  getWarehouseCreditsSummary,
  getIdleWarehouses,
  getDormantWarehouses,
  getServiceCredits,
  getOverprovisionedWarehouses,
  getUnderprovisionedWarehouses,
  getWarehouseUserCredits,
  getMixedWorkloads,
} from '@/lib/snowflake/queries'
import { executeQuery } from '@/lib/snowflake/connection'
import type { APIResponse } from '@/types'

// ✨ Reusable Security Check Function
async function checkPermissions(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  
  if (!token) {
    return { error: 'Unauthorized', status: 401 }
  }
  
  // Developers cannot view or modify warehouse data
  if (token.role === 'DEVELOPER') {
    return { error: 'Forbidden: You do not have permission to access warehouse data.', status: 403 }
  }
  
  return { authorized: true }
}

export async function GET(request: NextRequest) {
  try {
    // 🚨 1. RUN THE SECURITY CHECK FIRST 🚨
    const auth = await checkPermissions(request)
    if (auth.error) {
      return NextResponse.json<APIResponse<any>>(
        { status: 'error', error: { message: auth.error, code: 'ACCESS_DENIED' }, timestamp: new Date().toISOString() },
        { status: auth.status }
      )
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'list'
    const startDate = searchParams.get('start') || searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const endDate = searchParams.get('end') || searchParams.get('endDate') || new Date().toISOString().split('T')[0]

    let data

    switch (type) {
      case 'list':
        data = await getWarehouses()
        break
      case 'credits_by_day':
        data = await getWarehouseCreditsByDay(startDate, endDate)
        break
      case 'credits':
        data = await getWarehouseCreditsSummary(startDate, endDate)
        break
      case 'idle':
        data = await getIdleWarehouses(startDate, endDate)
        break
      case 'dormant':
        data = await getDormantWarehouses(startDate, endDate)
        break
      case 'services':
        data = await getServiceCredits(startDate, endDate)
        break
      case 'by_user':
        data = await getWarehouseUserCredits(startDate, endDate)
        break
      case 'mixed':
        data = await getMixedWorkloads(startDate, endDate)
        break
      case 'overprovisioned':
        data = await getOverprovisionedWarehouses(startDate, endDate)
        break
      case 'underprovisioned':
        data = await getUnderprovisionedWarehouses(startDate, endDate)
        break
      default:
        return NextResponse.json<APIResponse<any>>(
          { status: 'error', error: { message: 'Invalid warehouse type', code: 'INVALID_TYPE' }, timestamp: new Date().toISOString() },
          { status: 400 }
        )
    }

    return NextResponse.json<APIResponse<any>>(
      { status: 'success', data, timestamp: new Date().toISOString() },
      { status: 200 }
    )
  } catch (error) {
    console.error('Warehouse API error:', error)
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

export async function POST(request: NextRequest) {
  try {
    // 🚨 1. RUN THE SECURITY CHECK FIRST 🚨
    const auth = await checkPermissions(request)
    if (auth.error) {
      return NextResponse.json<APIResponse<any>>(
        { status: 'error', error: { message: auth.error, code: 'ACCESS_DENIED' }, timestamp: new Date().toISOString() },
        { status: auth.status }
      )
    }

    const body = await request.json()
    const action = String(body?.action || '')

    if (action !== 'update_controls') {
      return NextResponse.json<APIResponse<any>>(
        {
          status: 'error',
          error: { message: 'Invalid action', code: 'INVALID_ACTION' },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      )
    }

    const warehouseName = String(body?.warehouseName || '').trim()
    if (!warehouseName) {
      return NextResponse.json<APIResponse<any>>(
        {
          status: 'error',
          error: { message: 'warehouseName is required', code: 'MISSING_WAREHOUSE' },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      )
    }

    const autoSuspendRaw = body?.autoSuspend
    const autoResumeRaw = body?.autoResume
    const autoSuspend =
      autoSuspendRaw === null || typeof autoSuspendRaw === 'undefined' || autoSuspendRaw === ''
        ? null
        : Number(autoSuspendRaw)
    const autoResume =
      typeof autoResumeRaw === 'boolean'
        ? autoResumeRaw
        : String(autoResumeRaw || '').toLowerCase() === 'true'

    if (autoSuspend !== null && (!Number.isFinite(autoSuspend) || autoSuspend < 0)) {
      return NextResponse.json<APIResponse<any>>(
        {
          status: 'error',
          error: { message: 'autoSuspend must be a non-negative number of seconds', code: 'INVALID_AUTO_SUSPEND' },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      )
    }

    const quotedWarehouse = quoteIdentifier(warehouseName)
    const setClauses = [
      autoSuspend === null ? 'AUTO_SUSPEND = NULL' : `AUTO_SUSPEND = ${Math.round(autoSuspend)}`,
      `AUTO_RESUME = ${autoResume ? 'TRUE' : 'FALSE'}`,
    ]

    await executeQuery(`ALTER WAREHOUSE ${quotedWarehouse} SET ${setClauses.join(', ')}`)

    return NextResponse.json<APIResponse<any>>(
      {
        status: 'success',
        data: {
          warehouseName,
          autoSuspend,
          autoResume,
          message: 'Warehouse controls updated',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Warehouse control update error:', error)
    return NextResponse.json<APIResponse<any>>(
      {
        status: 'error',
        error: {
          message: error instanceof Error ? error.message : 'Internal server error',
          code: 'SERVER_ERROR',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}