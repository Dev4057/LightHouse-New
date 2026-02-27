import { generateAIInsight } from '@/lib/ai'
import { executeQuery } from '@/lib/snowflake/connection'
import { NextRequest, NextResponse } from 'next/server'

interface AIInsightWidgetRequest {
  type?: string
  title?: string
  start_date?: string
  end_date?: string
  widgetId?: string
  widgetKind?: string
  templateKey?: string
  sqlText?: string
  dataSample?: unknown
  selectedRow?: Record<string, unknown> | null
  selectedRowEvidence?: Record<string, unknown> | null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const widgetType = searchParams.get('type') || 'default'
    const title = searchParams.get('title') || 'Overview'
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const dataSummary = await buildGenericDataSummary(startDate, endDate)

    const insight = await generateAIInsight(widgetType, title, dataSummary, {
      timeWindow: [startDate, endDate].filter(Boolean).join(' to '),
    })

    return NextResponse.json(insight)
  } catch (error) {
    console.error('AI insights generation error (GET):', error)
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AIInsightWidgetRequest

    const widgetType = body.type || 'default'
    const title = body.title || 'Overview'
    const startDate = body.start_date || undefined
    const endDate = body.end_date || undefined

    const dataSummary = summarizeWidgetPayload(body.dataSample, startDate, endDate)

    const insight = await generateAIInsight(widgetType, title, dataSummary, {
      timeWindow: [startDate, endDate].filter(Boolean).join(' to '),
      widgetId: body.widgetId,
      widgetKind: body.widgetKind,
      templateKey: body.templateKey,
      sqlText: body.sqlText,
      dataSample: body.dataSample,
      selectedRow: body.selectedRow ?? null,
      selectedRowEvidence: body.selectedRowEvidence ?? null,
    })

    return NextResponse.json(insight)
  } catch (error) {
    console.error('AI insights generation error (POST):', error)
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 })
  }
}

function summarizeWidgetPayload(dataSample: unknown, startDate?: string, endDate?: string): string {
  const header = [`Date window: ${[startDate, endDate].filter(Boolean).join(' to ') || 'unspecified'}`]

  if (Array.isArray(dataSample)) {
    const rowCount = dataSample.length
    const sampleRow = dataSample[0]
    const keys =
      sampleRow && typeof sampleRow === 'object' && !Array.isArray(sampleRow)
        ? Object.keys(sampleRow as Record<string, unknown>)
        : []

    const numericHints = collectNumericHints(dataSample)
    header.push(`Rows provided: ${rowCount}`)
    if (keys.length) header.push(`Columns: ${keys.join(', ')}`)
    if (numericHints.length) header.push(`Numeric hints: ${numericHints.join('; ')}`)
    return header.join('\n')
  }

  if (dataSample && typeof dataSample === 'object') {
    header.push(`Object keys: ${Object.keys(dataSample as Record<string, unknown>).join(', ')}`)
    return header.join('\n')
  }

  if (typeof dataSample === 'string') {
    header.push(`Text sample length: ${dataSample.length}`)
    return header.join('\n')
  }

  header.push('No structured widget sample provided')
  return header.join('\n')
}

function collectNumericHints(rows: unknown[]): string[] {
  const firstObjects = rows.filter((r) => r && typeof r === 'object' && !Array.isArray(r)).slice(0, 10) as Array<
    Record<string, unknown>
  >
  if (!firstObjects.length) return []

  const numericKeys = new Set<string>()
  for (const row of firstObjects) {
    for (const [k, v] of Object.entries(row)) {
      const n = Number(v)
      if (Number.isFinite(n)) numericKeys.add(k)
    }
  }

  return Array.from(numericKeys)
    .slice(0, 6)
    .map((k) => {
      const values = firstObjects
        .map((row) => Number(row[k]))
        .filter((n) => Number.isFinite(n))
      if (!values.length) return k
      const sum = values.reduce((a, b) => a + b, 0)
      const avg = sum / values.length
      return `${k} avg=${avg.toFixed(2)}`
    })
}

async function buildGenericDataSummary(startDate?: string | null, endDate?: string | null): Promise<string> {
  if (!startDate || !endDate) return 'No data available'

  try {
    const metrics = await executeQuery<any>(`
      WITH qdaily AS (
        SELECT
          COALESCE(SUM(QUERY_COUNT), 0) AS query_count,
          COALESCE(AVG(AVG_SECONDS), 0) AS avg_time_sec,
          COALESCE(MAX(AVG_SECONDS), 0) AS max_time_sec
        FROM ${process.env.SNOWFLAKE_DATABASE || 'MART_DB'}.${process.env.SNOWFLAKE_SCHEMA || 'LIGHTHOUSE_MART'}.QUERIES_DAILY
        WHERE QUERY_DAY BETWEEN '${startDate}' AND '${endDate}'
      ),
      svc AS (
        SELECT COALESCE(SUM(CREDITS_USED), 0) AS total_credits
        FROM ${process.env.SNOWFLAKE_DATABASE || 'MART_DB'}.${process.env.SNOWFLAKE_SCHEMA || 'LIGHTHOUSE_MART'}.SERVICE_CREDITS_DAILY
        WHERE USAGE_DATE BETWEEN '${startDate}' AND '${endDate}'
      ),
      usr AS (
        SELECT COUNT(DISTINCT USER_NAME) AS distinct_users
        FROM ${process.env.SNOWFLAKE_DATABASE || 'MART_DB'}.${process.env.SNOWFLAKE_SCHEMA || 'LIGHTHOUSE_MART'}.USER_CREDITS_DAILY
        WHERE USAGE_DATE BETWEEN '${startDate}' AND '${endDate}'
      )
      SELECT qdaily.query_count, qdaily.avg_time_sec, qdaily.max_time_sec, svc.total_credits, usr.distinct_users
      FROM qdaily CROSS JOIN svc CROSS JOIN usr
    `)

    if (!metrics?.length) return 'No data available'
    const m = metrics[0]
    return [
      `Queries in period: ${m.QUERY_COUNT ?? 0}`,
      `Average execution time: ${(Number(m.AVG_TIME_SEC) || 0).toFixed(1)}s`,
      `Max execution time: ${(Number(m.MAX_TIME_SEC) || 0).toFixed(1)}s`,
      `Total credits used: ${(Number(m.TOTAL_CREDITS) || 0).toFixed(2)}`,
      `Distinct users: ${m.DISTINCT_USERS ?? 0}`,
    ].join('\n')
  } catch (e) {
    return `Data summary unavailable due to query error: ${e instanceof Error ? e.message : 'unknown error'}`
  }
}

