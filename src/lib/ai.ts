/**
 * AI Insights utilities (Snowflake Cortex COMPLETE first, external APIs as fallback)
 * Template-aware prompting is modeled after the Streamlit app's Cortex dialog flow.
 */
import { executeQuery } from '@/lib/snowflake/connection'

export interface AIInsight {
  summary: string
  signal: 'high' | 'medium' | 'low'
  decision: 'action_required' | 'monitor' | 'no_material_insight'
  findings: Array<{
    title: string
    impact: 'high' | 'medium' | 'low'
    confidence: 'high' | 'medium' | 'low'
    pattern: string
    evidence: string
  }>
  recommendations: Array<{
    action: string
    priority: 'P1' | 'P2' | 'P3'
    confidence: 'high' | 'medium' | 'low'
    why: string
    whenNotToApply?: string
  }>
  suggestedSQL: Array<{
    goal: string
    sql: string
  }>
}

export interface AIInsightPromptContext {
  timeWindow?: string
  widgetId?: string
  widgetKind?: string
  templateKey?: string
  sqlText?: string
  dataSample?: unknown
  selectedRow?: Record<string, unknown> | null
  selectedRowEvidence?: Record<string, unknown> | null
  [key: string]: unknown
}

const AI_PROMPT_TEMPLATES: Record<string, string> = {
  query_type_timing:
    'Focus on slow query categories. Look for expensive query types and recommend prioritized tuning actions.',
  user_timing:
    'Focus on users with high average execution time. Suggest workload segmentation, warehouse routing, and review targets.',
  expensive_queries:
    'Focus on credit-heavy SQL. Flag anti-patterns and suggest query rewrites that can reduce credits and runtime.',
  longest_queries:
    'Focus on runtime bottlenecks. Prioritize root causes and low-risk optimization ideas.',
  failed_queries:
    'Focus on repetitive failures and likely causes. Recommend triage order and prevention steps.',
  query_trend:
    'Focus on frequency spikes and workload scheduling. Separate likely-normal calendar effects from anomalous behavior. Recommend action only when evidence indicates avoidable cost or risk.',
  high_frequency_queries:
    'Focus on repeat query patterns. Distinguish between justified frequent calls and genuine waste, and propose action only where evidence clearly supports it.',
  workload_heatmap:
    'Focus on peak-hour concentration and bursty patterns. Suggest scheduling and warehouse policy changes.',
  spill_queries:
    'Focus on spill-heavy queries. Suggest SQL and warehouse-level adjustments to reduce spilling.',
  prune_queries:
    'Focus on poor partition pruning. Suggest predicate/cluster key and filter improvements.',
  auth_failures:
    'Focus on security posture: recurring failure reasons, concentration by user, and anomaly candidates.',
  auth_methods:
    'Focus on authentication hygiene and method risk distribution, not SQL tuning.',
  mfa_risk:
    'Focus on MFA coverage, inactive-risk cohorts, and actionable security controls.',
  access_risk:
    'Focus on role/grant exposure, privileged-account risk, and governance controls.',
  warehouse_sizing:
    'Focus on warehouse sizing/right-sizing evidence, queueing, and utilization behavior.',
  idle_cost:
    'Focus on idle-credit drivers and operational controls that reduce idle spend safely.',
  warehouse_cost_distribution:
    'Focus on cost distribution across warehouses/users/services and identify concentrated spend drivers.',
  warehouse_lifecycle:
    'Focus on dormant/mixed-usage lifecycle signals and whether operational cleanup or standardization is justified.',
  storage_footprint:
    'Focus on storage composition, concentration, and growth-risk indicators with practical retention/cleanup actions.',
  table_access_optimization:
    'Focus on access concentration, cold/unused assets, and governance-safe optimization opportunities.',
  optimization_playbook:
    'Generate a concrete remediation playbook for a single optimization finding with validation SQL, rollback, owner routing, and ticket-ready text. Manual execution only.',
  // Backward-compatible category aliases already used in the Next UI
  query_performance:
    'Focus on slow query categories, workload bottlenecks, and prioritized tuning opportunities backed by evidence.',
  warehouse_optimization:
    'Focus on warehouse sizing/right-sizing evidence, queueing, and utilization behavior. Identify idle costs and consolidation opportunities.',
  storage_analysis:
    'Focus on storage composition, concentration, and lifecycle cleanup opportunities.',
  user_access:
    'Focus on identity and access risk posture, privileged exposure, and governance controls.',
  cost_analysis:
    'Focus on credit-heavy operations and cost distribution. Identify concentrated spend drivers and low-risk optimization actions.',
  default:
    'Focus on performance, cost, and operational efficiency improvements with concrete next steps.',
}

const AI_TEMPLATE_EXTRA_RULES: Record<string, string[]> = {
  query_trend: [
    'Pattern/Entity must be a date or date-range (for example: 2026-02-12, weekday cluster).',
    'Do not use SQL text, table names, or database names in Pattern/Entity.',
  ],
  high_frequency_queries: [
    'Pattern/Entity must be a recognizable query pattern label from data values, not SQL syntax blocks.',
    'Explicitly classify each major pattern as likely justified, unclear, or likely wasteful with reason.',
  ],
  auth_failures: [
    'Treat this as security analysis over pre-aggregated mart data.',
    'Do not recommend clustering/partition/full-scan/index tuning unless explicit query profile evidence is provided.',
    'Pattern/Entity must reference USER_NAME and/or ERROR_MESSAGE values, not SQL/table names.',
  ],
  auth_methods: [
    'Do not provide SQL physical tuning advice for this widget.',
    'Pattern/Entity must reference AUTHENTICATION_METHOD or user cohort labels.',
  ],
  mfa_risk: [
    'Do not provide SQL physical tuning advice for this widget.',
    'Pattern/Entity must reference user cohorts (for example: SERVICE users without MFA).',
  ],
  idle_cost: ['Pattern/Entity must reference warehouse names or utilization bands, not SQL/table names.'],
  warehouse_sizing: ['Pattern/Entity must reference warehouse names or queue/utilization cohorts.'],
  warehouse_cost_distribution: [
    'Pattern/Entity must reference warehouse names, users, or service types from data.',
    'Do not suggest engine-level SQL tuning unless query-level evidence is present in the widget.',
  ],
  warehouse_lifecycle: [
    'Pattern/Entity must reference warehouse names or workload-class distributions.',
    'Recommendations should separate cleanup candidates vs keep-as-is candidates.',
  ],
  storage_footprint: [
    'Pattern/Entity must reference database/stage names or storage tiers.',
    'Avoid query-tuning advice; focus on storage governance and lifecycle actions.',
  ],
  table_access_optimization: [
    'Pattern/Entity must reference table names/access cohorts from data.',
    'Do not recommend dropping data without an explicit validation step.',
  ],
  optimization_playbook: [
    'Treat the selected row as the primary source of truth for estimated savings and confidence; do not recalculate or invent new numbers.',
    'Use read-only SQL checks only. Do not produce DDL/DML or execution commands.',
    'Always include rollback considerations and validation steps before/after manual changes.',
  ],
}

const AI_SQL_PATTERN_ALLOWED_TEMPLATES = new Set([
  'expensive_queries',
  'longest_queries',
  'spill_queries',
  'prune_queries',
  'high_frequency_queries',
])

const AI_SECURITY_TEMPLATES = new Set([
  'auth_failures',
  'auth_methods',
  'mfa_risk',
  'access_risk',
])

const AI_WIDGET_TEMPLATE_OVERRIDES: Record<string, string> = {
  wh_credits_by_warehouse: 'warehouse_cost_distribution',
  wh_credits_by_user: 'warehouse_cost_distribution',
  wh_dormant_warehouses: 'warehouse_lifecycle',
  wh_service_type_credits: 'warehouse_cost_distribution',
  wh_mixed_workloads: 'warehouse_lifecycle',
  wh_idle_cost: 'idle_cost',
  wh_overprovisioned: 'warehouse_sizing',
  wh_underprovisioned: 'warehouse_sizing',
  qtype_timing: 'query_type_timing',
  quser_timing: 'user_timing',
  expensive_queries: 'expensive_queries',
  longest_queries: 'longest_queries',
  failed_queries: 'failed_queries',
  query_trend: 'query_trend',
  high_frequency_queries: 'high_frequency_queries',
  query_heatmap: 'workload_heatmap',
  spill_queries: 'spill_queries',
  prune_queries: 'prune_queries',
  storage_summary: 'storage_footprint',
  storage_top_databases: 'storage_footprint',
  storage_overall: 'storage_footprint',
  storage_stage_bytes: 'storage_footprint',
  storage_most_accessed_tables: 'table_access_optimization',
  storage_least_accessed_tables: 'table_access_optimization',
  storage_large_unused_tables: 'table_access_optimization',
  id_users_under_role: 'access_risk',
  id_mfa_status: 'mfa_risk',
  id_inactive_users: 'mfa_risk',
  id_users_without_mfa: 'mfa_risk',
  id_auth_failures: 'auth_failures',
  id_auth_method_breakdown: 'auth_methods',
  id_accountadmin_grants: 'access_risk',
  id_accountadmin_no_mfa: 'mfa_risk',
  id_oldest_passwords: 'mfa_risk',
  opt_ranked_findings: 'optimization_playbook',
  opt_findings_by_category: 'default',
}

const AI_TEMPLATE_MATERIALITY_HINTS: Record<string, string> = {
  query_trend:
    'Only mark action_required if there is a meaningful anomaly (for example >=50% spike and material absolute volume).',
  high_frequency_queries:
    'Only mark action_required when repeated patterns have meaningful cumulative impact or clear waste indicators.',
  auth_failures:
    'Only mark action_required when concentration, severity, or trend indicates meaningful security risk.',
  auth_methods: 'Only mark action_required when method mix indicates elevated risk posture.',
  mfa_risk:
    'Only mark action_required when risky cohorts are material (privileged/service/inactive exposure).',
  warehouse_sizing:
    'Only mark action_required when utilization/queue and credit impact jointly indicate sizing mismatch.',
  idle_cost: 'Only mark action_required when idle cost impact is non-trivial.',
  optimization_playbook:
    'Recommend only manual, staged changes with explicit validation and rollback steps; avoid broad changes when evidence is weak.',
}

const CORTEX_DEFAULT_MODEL =
  process.env.CORTEX_MODEL || process.env.SNOWFLAKE_CORTEX_MODEL || 'openai-gpt-5-chat'
const CORTEX_DEFAULT_MODE = (process.env.CORTEX_MODE || 'focused').toLowerCase()

export async function generateAIInsight(
  widgetType: string,
  title: string,
  data: string,
  context?: AIInsightPromptContext
): Promise<AIInsight> {
  const templateKey = resolveTemplateKey(
    String(context?.templateKey || 'default'),
    title,
    typeof context?.widgetId === 'string' ? context.widgetId : undefined
  )
  const prompt = buildAIPrompt({
    widgetType,
    title,
    dataSummary: data,
    context,
    templateKey,
  })

  try {
    return await callSnowflakeCortexComplete(prompt, templateKey)
  } catch (cortexError) {
    console.error('Snowflake Cortex AI insight error:', cortexError)
  }

  try {
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (anthropicKey) {
      return await callClaudeAPI(prompt, anthropicKey, templateKey)
    }

    const openaiKey = process.env.OPENAI_API_KEY
    if (openaiKey) {
      return await callOpenAIAPI(prompt, openaiKey, templateKey)
    }

    return unavailableInsight(
      'AI insights unavailable because Snowflake Cortex is not available and no external AI API key is configured.'
    )
  } catch (error) {
    console.error('AI insight generation error:', error)
    return unavailableInsight(`AI insights unavailable due to an AI provider error for ${title}.`)
  }
}

function buildAIPrompt(args: {
  widgetType: string
  title: string
  dataSummary: string
  context?: AIInsightPromptContext
  templateKey: string
}): string {
  const { widgetType, title, dataSummary, context, templateKey } = args
  const widgetId = strOrEmpty(context?.widgetId)
  const widgetKind = strOrEmpty(context?.widgetKind) || 'widget'
  const isSecurityTemplate = AI_SECURITY_TEMPLATES.has(templateKey)
  const objective = AI_PROMPT_TEMPLATES[templateKey] || AI_PROMPT_TEMPLATES[widgetType] || AI_PROMPT_TEMPLATES.default
  const extraRules = AI_TEMPLATE_EXTRA_RULES[templateKey] || []
  const materialityHint =
    AI_TEMPLATE_MATERIALITY_HINTS[templateKey] || 'Only mark action_required for materially meaningful signals.'

  let analysisFocus = 'General performance/cost analysis.'
  if (templateKey === 'high_frequency_queries') {
    analysisFocus =
      'Prioritize non-obvious insights: identify which frequent patterns are likely justified vs wasteful, and only recommend changes when confidence is high.'
  } else if (templateKey === 'auth_failures') {
    analysisFocus =
      'Prioritize attack/failure patterns by user/reason and operational security actions, not SQL retrieval tuning.'
  } else if (templateKey === 'mfa_risk' || templateKey === 'auth_methods') {
    analysisFocus = 'Prioritize identity and access risk insights and policy/operational controls.'
  } else if (templateKey === 'warehouse_sizing' || templateKey === 'idle_cost') {
    analysisFocus = 'Prioritize warehouse efficiency actions with clear cost/queue/utilization evidence.'
  } else if (templateKey === 'optimization_playbook') {
    analysisFocus =
      'Produce a concrete, low-risk remediation playbook for one finding with validation SQL, rollback steps, and ticket-ready text.'
  }

  const baseConstraints = [
    '- Return only valid JSON matching the schema exactly.',
    '- Insights only. Do not claim you executed SQL.',
    '- Be specific and tie each recommendation to evidence from the provided data.',
    '- Use human-readable Pattern labels from data values; never return schema/table names as pattern labels unless the widget itself is about objects (e.g., tables/stages/warehouses/users).',
    '- Do not force optimization. If no material action is warranted, set decision to no_material_insight and keep arrays empty.',
    '- Keep recommendations concise and high-signal (max 3).',
    '- If confidence is low, prefer targeted validation steps over strong action.',
    '- Any SQL shown must be read-only SELECT/CTE/EXPLAIN and only when useful.',
  ]

  if (isSecurityTemplate) {
    baseConstraints.push(
      '- This is a security/risk template. Prefer control and investigation actions over SQL tuning advice.'
    )
  }

  const selectedRowJson = safeJsonStringify(context?.selectedRow ?? {})
  const selectedRowEvidenceJson = safeJsonStringify(context?.selectedRowEvidence ?? {})

  const promptSections = [
    'You are a Snowflake performance, cost, and governance advisor.',
    'Return only valid JSON with this exact schema:',
    '{',
    '  "summary": "short summary of key insights",',
    '  "signal": "high|medium|low",',
    '  "decision": "action_required|monitor|no_material_insight",',
    '  "findings": [',
    '    {',
    '      "title": "finding title",',
    '      "impact": "high|medium|low",',
    '      "confidence": "high|medium|low",',
    '      "pattern": "human-readable pattern/entity label from data",',
    '      "evidence": "evidence supporting this finding"',
    '    }',
    '  ],',
    '  "recommendations": [',
    '    {',
    '      "action": "specific actionable recommendation",',
    '      "priority": "P1|P2|P3",',
    '      "confidence": "high|medium|low",',
    '      "why": "reason and expected benefit",',
    '      "whenNotToApply": "optional conditions when this does not apply"',
    '    }',
    '  ],',
    '  "suggestedSQL": [',
    '    {',
    '      "goal": "what this query validates",',
    '      "sql": "SELECT ..."',
    '    }',
    '  ]',
    '}',
    '',
    'Constraints:',
    ...baseConstraints,
    '',
    `Widget title: ${title}`,
    `Widget type: ${widgetType}`,
    `Widget kind: ${widgetKind}`,
    `Widget id: ${widgetId || '-'}`,
    `Template: ${templateKey}`,
    `Date window: ${strOrEmpty(context?.timeWindow) || '-'}`,
    `Primary objective: ${objective}`,
    `Analysis focus: ${analysisFocus}`,
    `Materiality hint: ${materialityHint}`,
    '',
    'Template-specific rules:',
    ...(extraRules.length ? extraRules.map((rule) => `- ${rule}`) : ['- (none)']),
    '',
    'Metric/data summary:',
    dataSummary || '(not provided)',
    '',
    'SQL used for this widget (context only):',
    resolveSqlForPrompt(strOrEmpty(context?.sqlText)),
    '',
    'Data sample (JSON):',
    previewJson(context?.dataSample),
    '',
    'Selected row context (JSON, empty when not used):',
    selectedRowJson,
    '',
    'Selected row evidence (JSON, empty when not used):',
    selectedRowEvidenceJson,
  ]

  return promptSections.join('\n')
}

function unavailableInsight(summary: string): AIInsight {
  return {
    summary,
    signal: 'low',
    decision: 'no_material_insight',
    findings: [],
    recommendations: [],
    suggestedSQL: [],
  }
}

function resolveTemplateKey(templateKey: string, widgetTitle: string, widgetId?: string): string {
  if (templateKey && templateKey !== 'default') return templateKey
  if (widgetId && AI_WIDGET_TEMPLATE_OVERRIDES[widgetId]) return AI_WIDGET_TEMPLATE_OVERRIDES[widgetId]

  const wt = (widgetTitle || '').trim().toLowerCase()
  if (wt.includes('authentication failures')) return 'auth_failures'
  if (wt.includes('authentication breakdown') || wt.includes('auth method')) return 'auth_methods'
  if (wt.includes('mfa') || wt.includes('oldest password') || wt.includes('inactive')) return 'mfa_risk'
  if (wt.includes('grant') || wt.includes('accountadmin') || wt.includes('users under role')) return 'access_risk'
  if (wt.includes('idle cost')) return 'idle_cost'
  if (wt.includes('overprovisioned') || wt.includes('underprovisioned')) return 'warehouse_sizing'
  return widgetTypeToTemplateFallback(wt)
}

function widgetTypeToTemplateFallback(widgetTitleLower: string): string {
  if (widgetTitleLower.includes('storage')) return 'storage_footprint'
  if (widgetTitleLower.includes('warehouse')) return 'warehouse_sizing'
  if (widgetTitleLower.includes('query')) return 'query_performance'
  return 'default'
}

function normalizePatternEntity(rawPattern: unknown, allowSqlLike = false): string {
  let p = strOrEmpty(rawPattern).replace(/\s+/g, ' ').trim()
  if (!p) return ''
  if (/\b(select|from|where|group\s+by|order\s+by|join|mart_db|lighthouse_mart)\b/i.test(p)) {
    return allowSqlLike ? shortenText(p, 120) : 'Derived from data rows/metrics'
  }
  p = shortenText(p, 120)
  return p
}

function sanitizeInsightPayload(payload: AIInsight, templateKey: string): AIInsight {
  const allowSqlLike = AI_SQL_PATTERN_ALLOWED_TEMPLATES.has(templateKey)
  return {
    ...payload,
    summary: strOrEmpty(payload.summary),
    signal: normalizeEnum(payload.signal, ['high', 'medium', 'low'], 'low'),
    decision: normalizeEnum(
      payload.decision,
      ['action_required', 'monitor', 'no_material_insight'],
      'no_material_insight'
    ),
    findings: Array.isArray(payload.findings)
      ? payload.findings.slice(0, 8).map((f) => ({
          title: strOrEmpty(f?.title) || 'Finding',
          impact: normalizeEnum(f?.impact, ['high', 'medium', 'low'], 'low'),
          confidence: normalizeEnum(f?.confidence, ['high', 'medium', 'low'], 'low'),
          pattern: normalizePatternEntity(f?.pattern, allowSqlLike) || 'Derived from data rows/metrics',
          evidence: shortenText(strOrEmpty(f?.evidence), 500),
        }))
      : [],
    recommendations: Array.isArray(payload.recommendations)
      ? payload.recommendations.slice(0, 5).map((r) => ({
          action: strOrEmpty(r?.action) || 'Review and validate',
          priority: normalizeEnum(r?.priority, ['P1', 'P2', 'P3'], 'P3'),
          confidence: normalizeEnum(r?.confidence, ['high', 'medium', 'low'], 'low'),
          why: shortenText(strOrEmpty(r?.why), 500),
          whenNotToApply: strOrEmpty(r?.whenNotToApply) || undefined,
        }))
      : [],
    suggestedSQL: Array.isArray(payload.suggestedSQL)
      ? payload.suggestedSQL.slice(0, 5).map((s) => ({
          goal: strOrEmpty(s?.goal) || 'Validation query',
          sql: strOrEmpty(s?.sql),
        }))
      : [],
  }
}

function normalizeEnum<T extends string>(value: unknown, valid: readonly T[], fallback: T): T {
  const v = String(value || '').trim() as T
  return valid.includes(v) ? v : fallback
}

function shortenText(value: unknown, limit = 160): string {
  const txt = strOrEmpty(value)
  if (txt.length <= limit) return txt
  return `${txt.slice(0, Math.max(0, limit - 3))}...`
}

function previewJson(data: unknown, maxRows = 25, maxChars = 20000): string {
  if (data == null) return '[]'

  let preview: unknown = data
  if (Array.isArray(data)) {
    preview = data.slice(0, maxRows).map((row) => normalizeJsonValue(row))
  } else if (typeof data === 'object') {
    preview = normalizeJsonValue(data)
  }

  let txt = safeJsonStringify(preview)
  if (txt.length > maxChars) txt = `${txt.slice(0, maxChars - 3)}...`
  return txt
}

function normalizeJsonValue(value: unknown): unknown {
  if (value == null) return value
  if (Array.isArray(value)) return value.map((v) => normalizeJsonValue(v))
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v instanceof Date) {
        out[k] = v.toISOString()
      } else if (typeof v === 'bigint') {
        out[k] = Number(v)
      } else if (typeof v === 'object' && v !== null) {
        out[k] = normalizeJsonValue(v)
      } else {
        out[k] = v
      }
    }
    return out
  }
  if (typeof value === 'bigint') return Number(value)
  return value
}

function resolveSqlForPrompt(sqlText: string): string {
  return sqlText || '(not provided)'
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? Number(v) : v), 2)
  } catch {
    return String(value ?? '')
  }
}

function strOrEmpty(value: unknown): string {
  return value == null ? '' : String(value)
}

function sqlQuote(value: string): string {
  return `'${String(value).replace(/'/g, "''")}'`
}

function extractJsonObject(rawText: string): Record<string, unknown> | null {
  if (!rawText) return null
  const txt = rawText.trim()

  try {
    const parsed = JSON.parse(txt)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // continue
  }

  const first = txt.indexOf('{')
  const last = txt.lastIndexOf('}')
  if (first === -1 || last === -1 || last <= first) return null

  try {
    const parsed = JSON.parse(txt.slice(first, last + 1))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    return null
  }

  return null
}

function parseAIInsightPayload(rawText: string, templateKey: string): AIInsight {
  const outer = extractJsonObject(rawText)
  let responseText = rawText

  if (outer && Array.isArray(outer.choices)) {
    const firstChoice = outer.choices[0] as Record<string, unknown> | undefined
    const messages = firstChoice?.messages

    if (Array.isArray(messages)) {
      responseText = JSON.stringify(messages)
    } else if (typeof messages === 'string') {
      responseText = messages
    }
  }

  const payload = extractJsonObject(responseText)
  if (!payload) throw new Error('No JSON payload found in AI response')

  return sanitizeInsightPayload(payload as unknown as AIInsight, templateKey)
}

async function callSnowflakeCortexComplete(prompt: string, templateKey: string): Promise<AIInsight> {
  const mode = CORTEX_DEFAULT_MODE === 'balanced' ? 'balanced' : 'focused'
  const temperature = mode === 'balanced' ? 0.3 : 0.1
  const modelName = CORTEX_DEFAULT_MODEL

  const sql = `
    SELECT SNOWFLAKE.CORTEX.COMPLETE(
      ${sqlQuote(modelName)},
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
  const text =
    typeof raw === 'string'
      ? raw
      : raw === null || typeof raw === 'undefined'
        ? ''
        : JSON.stringify(raw)

  return parseAIInsightPayload(text, templateKey)
}

async function callClaudeAPI(prompt: string, apiKey: string, templateKey: string): Promise<AIInsight> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) throw new Error(`Claude API error: ${response.statusText}`)

  const data = await response.json()
  const content = data.content?.[0]?.text || ''
  return parseAIInsightPayload(content, templateKey)
}

async function callOpenAIAPI(prompt: string, apiKey: string, templateKey: string): Promise<AIInsight> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo',
      temperature: 0.1,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) throw new Error(`OpenAI API error: ${response.statusText}`)

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''
  return parseAIInsightPayload(content, templateKey)
}
