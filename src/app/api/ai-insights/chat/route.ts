import { executeQuery } from '@/lib/snowflake/connection'
import { NextRequest, NextResponse } from 'next/server'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AIInsightChatRequest {
  widgetType?: string
  title?: string
  insight?: unknown
  widgetContext?: unknown
  messages?: ChatMessage[]
  question?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AIInsightChatRequest
    const question = String(body.question || '').trim()
    if (!question) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    const messages = Array.isArray(body.messages) ? body.messages.slice(-8) : []
    const prompt = buildFollowUpPrompt({
      widgetType: String(body.widgetType || 'default'),
      title: String(body.title || 'AI Insight'),
      insight: body.insight,
      widgetContext: body.widgetContext,
      messages,
      question,
    })

    const answer = await cortexCompleteText(prompt)
    return NextResponse.json({ answer })
  } catch (error) {
    console.error('AI follow-up chat error:', summarizeRouteError(error))
    return NextResponse.json(
      { error: userFacingChatError(error) },
      { status: 500 }
    )
  }
}

function buildFollowUpPrompt(args: {
  widgetType: string
  title: string
  insight: unknown
  widgetContext: unknown
  messages: ChatMessage[]
  question: string
}): string {
  const history = args.messages
    .map((m) => `${m.role.toUpperCase()}: ${String(m.content || '').trim()}`)
    .join('\n')

  return [
    'You are continuing a Snowflake analytics conversation about one dashboard widget.',
    'Answer the user follow-up concisely, grounded in the provided insight and widget data context.',
    'If the question requires data not present in the context, say exactly what is missing.',
    'Do not claim SQL execution unless explicitly shown in the context.',
    '',
    `Widget title: ${args.title}`,
    `Widget type: ${args.widgetType}`,
    '',
    'Current AI insight JSON:',
    safeJson(args.insight),
    '',
    'Widget context JSON:',
    safeJson(args.widgetContext),
    '',
    'Recent conversation (if any):',
    history || '(none)',
    '',
    `User follow-up question: ${args.question}`,
    '',
    'Respond in plain text with: direct answer, evidence from context, and any suggested next validation step if needed.',
  ].join('\n')
}

async function cortexCompleteText(prompt: string): Promise<string> {
  const model =
    process.env.CORTEX_MODEL || process.env.SNOWFLAKE_CORTEX_MODEL || 'openai-gpt-5-chat'
  const mode = (process.env.CORTEX_MODE || 'focused').toLowerCase()
  const temperature = mode === 'balanced' ? 0.3 : 0.1

  const sql = `
    SELECT SNOWFLAKE.CORTEX.COMPLETE(
      ${sqlQuote(model)},
      ARRAY_CONSTRUCT(
        OBJECT_CONSTRUCT(
          'role', 'user',
          'content', ${sqlQuote(prompt)}
        )
      ),
      OBJECT_CONSTRUCT(
        'temperature', ${temperature}
      )
    ) AS RESPONSE
  `

  const rows = await executeQuery<{ RESPONSE: unknown }>(sql)
  const raw = rows?.[0]?.RESPONSE
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw ?? '')
  return extractResponseText(text)
}

function extractResponseText(raw: string): string {
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw) as any
    if (typeof parsed === 'string') return parsed
    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.response === 'string') return parsed.response
      if (Array.isArray(parsed.choices) && parsed.choices[0]) {
        const first = parsed.choices[0]
        if (typeof first.messages === 'string') return first.messages
        if (Array.isArray(first.messages)) {
          return first.messages
            .map((m: any) => (typeof m?.content === 'string' ? m.content : JSON.stringify(m)))
            .join('\n')
        }
      }
    }
  } catch {
    // fall back to raw
  }
  return raw
}

function sqlQuote(value: string): string {
  return `'${String(value).replace(/'/g, "''")}'`
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value ?? '')
  }
}

function summarizeRouteError(error: unknown) {
  if (!error || typeof error !== 'object') return error
  const e = error as Record<string, unknown>
  return {
    name: e.name,
    message: e.message,
    code: e.code,
    sqlState: e.sqlState,
  }
}

function userFacingChatError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error || 'Failed to answer follow-up question')
  if (msg.includes('SNOWFLAKE.CORTEX.COMPLETE')) {
    return 'Snowflake Cortex chat call failed. Check Cortex model availability/privileges and retry.'
  }
  return msg
}
