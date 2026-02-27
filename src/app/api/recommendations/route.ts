import { NextRequest, NextResponse } from 'next/server'
import { getRecommendations, getRecommendationEvidence } from '@/lib/snowflake/queries'
import { executeQuery } from '@/lib/snowflake/connection'
import type { APIResponse } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'list'
    const startDate =
      searchParams.get('start') ||
      searchParams.get('startDate') ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const endDate =
      searchParams.get('end') ||
      searchParams.get('endDate') ||
      new Date().toISOString().split('T')[0]

    let data

    switch (type) {
      case 'list':
        data = await getRecommendations(startDate, endDate)
        break
      case 'evidence': {
        const runDate = searchParams.get('runDate')
        const findingId = searchParams.get('findingId')
        if (!runDate || !findingId) {
          return NextResponse.json<APIResponse<any>>(
            {
              status: 'error',
              error: { message: 'runDate and findingId are required', code: 'MISSING_PARAMS' },
              timestamp: new Date().toISOString(),
            },
            { status: 400 }
          )
        }
        data = await getRecommendationEvidence(runDate, findingId)
        break
      }
      default:
        return NextResponse.json<APIResponse<any>>(
          { status: 'error', error: { message: 'Invalid recommendations type', code: 'INVALID_TYPE' }, timestamp: new Date().toISOString() },
          { status: 400 }
        )
    }

    return NextResponse.json<APIResponse<any>>(
      { status: 'success', data, timestamp: new Date().toISOString() },
      { status: 200 }
    )
  } catch (error) {
    console.error('Recommendations API error:', error)
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
    const body = await request.json()
    const action = String(body?.action || '')

    if (action !== 'update_feedback') {
      return NextResponse.json<APIResponse<any>>(
        {
          status: 'error',
          error: { message: 'Invalid action', code: 'INVALID_ACTION' },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      )
    }

    const runDate = String(body?.runDate || '').trim()
    const findingId = String(body?.findingId || '').trim()
    const statusOverride = String(body?.statusOverride || '').trim().toLowerCase()
    const note = String(body?.note || '')
    const updatedBy = String(body?.updatedBy || 'web-ui').trim() || 'web-ui'

    const validStatuses = new Set(['open', 'in_progress', 'accepted', 'done', 'snoozed', 'dismissed'])
    if (!runDate || !findingId || !validStatuses.has(statusOverride)) {
      return NextResponse.json<APIResponse<any>>(
        {
          status: 'error',
          error: { message: 'runDate, findingId, and valid statusOverride are required', code: 'INVALID_PARAMS' },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      )
    }

    const mart = `${process.env.SNOWFLAKE_DATABASE || 'MART_DB'}.${process.env.SNOWFLAKE_SCHEMA || 'LIGHTHOUSE_MART'}`

    const sql = `
      MERGE INTO ${mart}.OPT_FINDING_FEEDBACK t
      USING (
        SELECT
          '${sqlEscape(runDate)}'::DATE AS RUN_DATE,
          '${sqlEscape(findingId)}' AS FINDING_ID,
          '${sqlEscape(statusOverride)}' AS STATUS_OVERRIDE,
          '${sqlEscape(note)}' AS NOTE,
          '${sqlEscape(updatedBy)}' AS UPDATED_BY,
          CURRENT_TIMESTAMP() AS UPDATED_AT
      ) s
      ON t.RUN_DATE = s.RUN_DATE AND t.FINDING_ID = s.FINDING_ID
      WHEN MATCHED THEN UPDATE SET
        STATUS_OVERRIDE = s.STATUS_OVERRIDE,
        NOTE = s.NOTE,
        UPDATED_BY = s.UPDATED_BY,
        UPDATED_AT = s.UPDATED_AT
      WHEN NOT MATCHED THEN INSERT (RUN_DATE, FINDING_ID, STATUS_OVERRIDE, NOTE, UPDATED_BY, UPDATED_AT)
      VALUES (s.RUN_DATE, s.FINDING_ID, s.STATUS_OVERRIDE, s.NOTE, s.UPDATED_BY, s.UPDATED_AT)
    `

    await executeQuery(sql)

    return NextResponse.json<APIResponse<any>>(
      {
        status: 'success',
        data: { runDate, findingId, statusOverride, note, updatedBy },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Recommendations feedback update error:', error)
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

function sqlEscape(value: string): string {
  return String(value).replace(/'/g, "''")
}
