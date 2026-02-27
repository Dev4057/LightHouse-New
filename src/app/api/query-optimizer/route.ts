import { executeQuery } from '@/lib/snowflake/connection'
import { NextRequest, NextResponse } from 'next/server'

interface QueryOptimizerRequest {
  queryText?: string
  observedElapsedSeconds?: number
  queryId?: string
  limit?: number
  stream?: boolean
}

interface QueryOptimizationResult {
  originalQuery: string
  observedElapsedSeconds?: number
  agenticFlow: {
    stages: Array<{
      key: string
      label: string
      status: 'completed' | 'failed' | 'skipped'
      detail?: string
    }>
    plannerTrace: {
      original: string[]
      suggested: string[]
    }
  }
  originalExplain: unknown[]
  originalExplainText: string
  originalExplainSummary?: string
  aiSuggestion: {
    estimated_runtime_change: string
    likely_issues: string[]
    suggested_query: string
    why: string
    validation_notes: string[]
  }
  suggestedExplain: unknown[]
  suggestedExplainText: string
  reducedValidation: {
    attempted: boolean
    executedOnSnowflake?: boolean
    limit: number
    originalValidationSource?: string
    suggestedValidationSource?: string
    originalValidationQuery?: string
    suggestedValidationQuery?: string
    originalRowCount?: number
    suggestedRowCount?: number
    columnsMatch?: boolean
    exactSampleMatch?: boolean
    normalizedSetMatch?: boolean
    message: string
    originalSample?: Record<string, unknown>[]
    suggestedSample?: Record<string, unknown>[]
  }
}

interface ValidationPlannerToolContext {
  sourceObjects: string[]
  aliasToSourceObject: Record<string, string>
  inspectedSchemas: Array<{ objectName: string; columns: string[]; source: string }>
  catalogColumnHints: string
  aliasColumnHints: string
  toolTrace: string[]
}

interface CompileValidationResult {
  ok: boolean
  reason?: string
  rawMessage?: string
  errorCode?: string
  sqlState?: string
  explainText?: string
  planHeavyReason?: string
}

type AgenticStage = QueryOptimizationResult['agenticFlow']['stages'][number]

export async function POST(request: NextRequest) {
  const body = (await request.json()) as QueryOptimizerRequest
  if (body.stream) {
    return streamQueryOptimizerPipeline(body)
  }

  try {
    const payload = await runQueryOptimizerPipeline(body)
    return NextResponse.json(payload)
  } catch (error) {
    console.error('Query optimizer error:', summarizeRouteError(error))
    return NextResponse.json(
      { error: userFacingOptimizerError(error) },
      { status: 500 }
    )
  }
}

async function runQueryOptimizerPipeline(
  body: QueryOptimizerRequest,
  hooks?: { onStage?: (stage: AgenticStage) => void }
): Promise<QueryOptimizationResult> {
  const limit = Math.min(Math.max(Number(body.limit || 20), 1), 50)
  const originalQuery = sanitizeSingleStatementForExplain(String(body.queryText || ''))
  if (!originalQuery) {
    throw new Error('A SQL statement is required')
  }

  const agenticStages: QueryOptimizationResult['agenticFlow']['stages'] = []
  const pushStage = (key: string, label: string, status: AgenticStage['status'], detail?: string) => {
    const s = { key, label, status, detail }
    agenticStages.push(s)
    hooks?.onStage?.(s)
  }

  const originalExplainRows = await explainQuery(originalQuery)
  pushStage('explain_original', 'Explain original query', 'completed')
  const originalExplainText = explainRowsToText(originalExplainRows)

  let originalExplainSummary = ''
  try {
    originalExplainSummary = await summarizeExplainForOptimization({
      queryText: originalQuery,
      explainText: originalExplainText,
      observedElapsedSeconds: Number(body.observedElapsedSeconds || 0) || undefined,
    })
    pushStage('summarize_original_explain', 'Summarize original EXPLAIN', 'completed')
  } catch (summaryError) {
    console.error('EXPLAIN summary generation error:', summarizeRouteError(summaryError))
    originalExplainSummary = buildExplainFallbackSummary(originalExplainText)
    pushStage('summarize_original_explain', 'Summarize original EXPLAIN', 'completed', 'Fallback summary used')
  }

  const aiSuggestion = await suggestQueryRewrite({
    queryText: originalQuery,
    observedElapsedSeconds: Number(body.observedElapsedSeconds || 0) || undefined,
    originalExplainSummary,
  })
  pushStage('generate_rewrite', 'Generate optimized rewrite with Cortex', 'completed')

  const suggestedQuery = sanitizeSingleStatementForExplain(aiSuggestion.suggested_query)
  const suggestedExplainRows = suggestedQuery ? await explainQuery(suggestedQuery) : []
  pushStage(
    'explain_suggested',
    'Explain suggested query',
    suggestedQuery ? 'completed' : 'skipped',
    suggestedQuery ? undefined : 'No suggested query returned'
  )
  const suggestedExplainText = explainRowsToText(suggestedExplainRows)

  let originalValidation = await deriveValidationQueryAgentic({
    queryText: originalQuery,
    role: 'original',
    limit,
  })
  pushStage(
    'derive_original_validation',
    'Derive original validation query (agentic planner)',
    originalValidation.sql ? 'completed' : 'failed',
    originalValidation.source
  )

  let suggestedValidation = suggestedQuery
    ? await deriveValidationQueryAgentic({
        queryText: suggestedQuery,
        role: 'suggested',
        limit,
        allowReferenceReuse: false,
        requiredColumns: originalValidation.projectedColumns,
        sliceContract: originalValidation.sliceContract,
        referenceValidationSql: originalValidation.sql || undefined,
      })
    : {
        sql: null,
        projectedColumns: [] as string[],
        sliceContract: '',
        source: 'no suggested query returned by optimizer',
        plannerTrace: [] as string[],
      }
  pushStage(
    'derive_suggested_validation',
    'Derive suggested validation query (agentic planner)',
    suggestedValidation.sql ? 'completed' : suggestedQuery ? 'failed' : 'skipped',
    suggestedValidation.source
  )

  let reducedValidation =
    originalValidation.sql && suggestedValidation.sql
      ? buildNonMeaningfulValidationReuseResult(
            originalQuery,
            suggestedQuery,
            originalValidation.sql,
            suggestedValidation.sql,
            limit,
            {
              originalSource: originalValidation.source,
              suggestedSource: suggestedValidation.source,
            }
          ) ||
          (await compareReducedQueryOutputs(originalValidation.sql, suggestedValidation.sql, limit, {
            originalSource: originalValidation.source,
            suggestedSource: suggestedValidation.source,
          }))
      : buildValidationUnavailableResult(limit, originalValidation, suggestedValidation)
  pushStage(
    'validate_compare',
    'Execute reduced validation and compare outputs',
    reducedValidation.executedOnSnowflake ? 'completed' : reducedValidation.attempted ? 'failed' : 'skipped',
    reducedValidation.message
  )

  const shouldRetryAggressiveValidation =
    (!reducedValidation.executedOnSnowflake &&
      (/identical validation (?:queries|probes)|reference reuse|downtime-only subproblem|changed-path metric/i.test(
        String(reducedValidation.message || '')
      ) ||
        /canceled|cancelled|timeout|statement timeout|sql compilation error|invalid identifier|syntax error|unsupported|undefined aliases|undefined cte|recursive cte/i.test(
          String(reducedValidation.message || '')
        ))) ||
    (reducedValidation.executedOnSnowflake &&
      'columnsMatch' in reducedValidation &&
      reducedValidation.columnsMatch === false) ||
    (originalValidation.sql && looksTooExpensiveForValidation(originalValidation.sql)) ||
    (suggestedValidation.sql && looksTooExpensiveForValidation(suggestedValidation.sql))

  if (shouldRetryAggressiveValidation && suggestedQuery) {
    pushStage(
      'retry_aggressive',
      'Retry validation derivation in aggressive mode',
      'completed',
      'Triggered due to failed/mismatched/expensive initial validation'
    )
    const originalRetry = await deriveValidationQueryAgentic({
      queryText: originalQuery,
      role: 'original',
      limit,
      aggressive: true,
      failureHint: reducedValidation.message,
    })
    pushStage(
      'derive_original_validation_retry',
      'Re-derive original validation query (aggressive)',
      originalRetry.sql ? 'completed' : 'failed',
      originalRetry.source
    )
    const suggestedRetry = await deriveValidationQueryAgentic({
      queryText: suggestedQuery,
      role: 'suggested',
      limit,
      aggressive: true,
      failureHint: reducedValidation.message,
      allowReferenceReuse: false,
      requiredColumns: originalRetry.projectedColumns || originalValidation.projectedColumns,
      sliceContract: originalRetry.sliceContract || originalValidation.sliceContract,
      referenceValidationSql: originalRetry.sql || originalValidation.sql || undefined,
    })
    pushStage(
      'derive_suggested_validation_retry',
      'Re-derive suggested validation query (aggressive)',
      suggestedRetry.sql ? 'completed' : 'failed',
      suggestedRetry.source
    )

    originalValidation = originalRetry.sql ? originalRetry : originalValidation
    suggestedValidation = suggestedRetry.sql ? suggestedRetry : suggestedValidation

    reducedValidation =
      originalValidation.sql && suggestedValidation.sql
        ? buildNonMeaningfulValidationReuseResult(
              originalQuery,
              suggestedQuery,
              originalValidation.sql,
              suggestedValidation.sql,
              limit,
              {
                originalSource: originalValidation.source,
                suggestedSource: suggestedValidation.source,
              }
            ) ||
            (await compareReducedQueryOutputs(originalValidation.sql, suggestedValidation.sql, limit, {
              originalSource: originalValidation.source,
              suggestedSource: suggestedValidation.source,
            }))
        : buildValidationUnavailableResult(limit, originalValidation, suggestedValidation)
    pushStage(
      'validate_compare_retry',
      'Execute reduced validation and compare outputs (retry)',
      reducedValidation.executedOnSnowflake ? 'completed' : reducedValidation.attempted ? 'failed' : 'skipped',
      reducedValidation.message
    )

    reducedValidation.message = reducedValidation.executedOnSnowflake
      ? `Validation succeeded after aggressive re-derivation. ${reducedValidation.message}`
      : `Validation retry (aggressive re-derivation) did not complete. ${reducedValidation.message}`
  }

  return {
    originalQuery,
    observedElapsedSeconds: Number(body.observedElapsedSeconds || 0) || undefined,
    agenticFlow: {
      stages: agenticStages,
      plannerTrace: {
        original: originalValidation.plannerTrace || [],
        suggested: suggestedValidation.plannerTrace || [],
      },
    },
    originalExplain: originalExplainRows,
    originalExplainText,
    originalExplainSummary,
    aiSuggestion: { ...aiSuggestion, suggested_query: suggestedQuery || aiSuggestion.suggested_query },
    suggestedExplain: suggestedExplainRows,
    suggestedExplainText,
    reducedValidation,
  }
}

function streamQueryOptimizerPipeline(body: QueryOptimizerRequest): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      }
      ;(async () => {
        try {
          write({ type: 'started' })
          const result = await runQueryOptimizerPipeline(body, {
            onStage: (stage) => write({ type: 'stage', stage }),
          })
          write({ type: 'result', result })
        } catch (error) {
          console.error('Query optimizer stream error:', summarizeRouteError(error))
          write({ type: 'error', error: userFacingOptimizerError(error) })
        } finally {
          controller.close()
        }
      })().catch((error) => {
        console.error('Query optimizer stream fatal error:', summarizeRouteError(error))
        try {
          write({ type: 'error', error: userFacingOptimizerError(error) })
          controller.close()
        } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}

async function explainQuery(queryText: string): Promise<unknown[]> {
  const sql = `EXPLAIN USING TEXT ${queryText}`
  return executeQuery<unknown>(sql)
}

function explainRowsToText(rows: unknown[]): string {
  if (!Array.isArray(rows) || rows.length === 0) return '(no explain output)'
  return rows
    .slice(0, 200)
    .map((row) => {
      if (row && typeof row === 'object') {
        return Object.values(row as Record<string, unknown>)
          .map((v) => String(v ?? ''))
          .join(' | ')
      }
      return String(row ?? '')
    })
    .join('\n')
}

function buildExplainFallbackSummary(explainText: string): string {
  const lines = String(explainText || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const global = lines.find((l) => l.startsWith('GlobalStats:')) || 'GlobalStats: unavailable'
  const partitionLines = lines.filter((l) => /partitions(total|assigned)|bytesassigned/i.test(l)).slice(0, 6)
  const joinLines = lines.filter((l) => /join/i.test(l)).slice(0, 8)
  const scanLines = lines.filter((l) => /tablescan/i.test(l)).slice(0, 8)
  const aggLines = lines.filter((l) => /aggregate/i.test(l)).slice(0, 6)

  return [
    'Fallback EXPLAIN summary (LLM summarization unavailable):',
    global,
    ...partitionLines,
    ...joinLines,
    ...scanLines,
    ...aggLines,
  ].join('\n')
}

async function suggestQueryRewrite(args: {
  queryText: string
  observedElapsedSeconds?: number
  originalExplainSummary: string
}): Promise<QueryOptimizationResult['aiSuggestion']> {
  const prompt = [
    'You are a Snowflake SQL performance optimization assistant.',
    'Return ONLY valid JSON matching this schema:',
    '{',
    '  "estimated_runtime_change": "short estimate statement based on plan + observed runtime",',
    '  "likely_issues": ["..."],',
    '  "suggested_query": "optimized SQL statement or equivalent optimized SELECT for validation",',
    '  "why": "why this rewrite may help",',
    '  "validation_notes": ["..."]',
    '}',
    '',
    'Rules:',
    '- You may return an optimized statement OR an optimized read-only SELECT equivalent (preferred when original is CREATE ... AS SELECT / INSERT ... SELECT).',
    '- Preserve business logic/output semantics as much as possible.',
    '- If exact rewrite is unsafe, return the original query and explain why.',
    '- Do not invent indexes; use Snowflake-appropriate guidance.',
    '- If the original is a CTAS/INSERT wrapper, focus optimization on the underlying SELECT body and mention wrapper preservation considerations.',
    '- IMPORTANT: suggested_query must contain the FULL optimized SQL text. Do not use placeholders like "same as before", "unchanged CTEs", "...", "<rest omitted>", or comments telling the user to reuse prior sections.',
    '- Do not abbreviate repeated CTEs. Return a complete executable statement (or complete SELECT body if you intentionally return SELECT-only validation SQL).',
    '',
    `Observed elapsed seconds (from mart): ${args.observedElapsedSeconds ?? 'unknown'}`,
    '',
    'Original query:',
    args.queryText,
    '',
    'EXPLAIN plan summary (LLM-distilled from EXPLAIN USING TEXT):',
    args.originalExplainSummary || '(summary unavailable)',
  ].join('\n')

  const raw = await cortexCompleteText(prompt)
  const parsed = extractJsonObject(raw)
  if (!parsed) {
    throw new Error('AI did not return valid JSON for query optimization suggestion')
  }

  const suggestedQuery = String(parsed.suggested_query || args.queryText)
  ensureFullSqlReturned(suggestedQuery)

  return {
    estimated_runtime_change: String(parsed.estimated_runtime_change || 'Unknown (estimate unavailable)'),
    likely_issues: Array.isArray(parsed.likely_issues)
      ? parsed.likely_issues.slice(0, 8).map((v) => String(v))
      : [],
    suggested_query: suggestedQuery,
    why: String(parsed.why || ''),
    validation_notes: Array.isArray(parsed.validation_notes)
      ? parsed.validation_notes.slice(0, 8).map((v) => String(v))
      : [],
  }
}

async function summarizeExplainForOptimization(args: {
  queryText: string
  explainText: string
  observedElapsedSeconds?: number
}): Promise<string> {
  const prompt = [
    'You are summarizing a Snowflake EXPLAIN plan for a later SQL optimization step.',
    'Return concise plain text (not JSON), max 18 bullets/lines.',
    'Focus on facts that matter for rewrite decisions.',
    'Do not restate the full plan. Do not include large operator dumps.',
    '',
    'Include these sections in order:',
    '1. Workload shape (CTAS/INSERT/SELECT, major joins/aggregations)',
    '2. Biggest cost drivers (scans, joins, repartitioning, repeated scans, broad joins)',
    '3. Pruning/partition observations (partitions assigned vs total, bytes assigned if present)',
    '4. Likely optimization opportunities (specific and actionable)',
    '5. Cautions for semantic preservation',
    '',
    `Observed elapsed seconds (from mart): ${args.observedElapsedSeconds ?? 'unknown'}`,
    '',
    'Original SQL (for context only):',
    shortenForPrompt(args.queryText, 12000),
    '',
    'Raw EXPLAIN USING TEXT output:',
    shortenForPrompt(args.explainText, 30000),
  ].join('\n')

  const raw = await cortexCompleteText(prompt)
  const summary = String(raw || '').trim()
  return summary || 'EXPLAIN summary unavailable.'
}

async function compareReducedQueryOutputs(
  originalQuery: string,
  suggestedQuery: string,
  limit: number,
  sources?: { originalSource?: string; suggestedSource?: string }
) {
  try {
    const originalSample = await executeReducedQuery(originalQuery, limit)
    const suggestedSample = await executeReducedQuery(suggestedQuery, limit)

    const originalCols = objectKeysSet(originalSample)
    const suggestedCols = objectKeysSet(suggestedSample)
    const columnsMatch = setEquals(originalCols, suggestedCols)

    const exactSampleMatch =
      JSON.stringify(normalizeRowsForJson(originalSample)) === JSON.stringify(normalizeRowsForJson(suggestedSample))

    const normalizedSetMatch = compareAsUnorderedSets(originalSample, suggestedSample)

    const message = exactSampleMatch
      ? 'Reduced samples matched exactly (order-sensitive).'
      : normalizedSetMatch
        ? 'Reduced samples matched after normalization (order-insensitive).'
        : 'Reduced samples differ. Review semantics before applying rewrite.'

    return {
      attempted: true,
      executedOnSnowflake: true,
      limit,
      originalValidationSource: sources?.originalSource,
      suggestedValidationSource: sources?.suggestedSource,
      originalValidationQuery: originalQuery,
      suggestedValidationQuery: suggestedQuery,
      originalRowCount: originalSample.length,
      suggestedRowCount: suggestedSample.length,
      columnsMatch,
      exactSampleMatch,
      normalizedSetMatch,
      message,
      originalSample: originalSample.slice(0, 10),
      suggestedSample: suggestedSample.slice(0, 10),
    }
  } catch (error) {
    return {
      attempted: true,
      executedOnSnowflake: false,
      limit,
      originalValidationSource: sources?.originalSource,
      suggestedValidationSource: sources?.suggestedSource,
      originalValidationQuery: originalQuery,
      suggestedValidationQuery: suggestedQuery,
      message: `Reduced sample validation failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    }
  }
}

function buildValidationUnavailableResult(
  limit: number,
  originalValidation: { sql: string | null; source: string },
  suggestedValidation: { sql: string | null; source: string }
) {
  return {
    attempted: false,
    executedOnSnowflake: false,
    limit,
    originalValidationSource: originalValidation.source,
    suggestedValidationSource: suggestedValidation.source,
    originalValidationQuery: originalValidation.sql ?? undefined,
    suggestedValidationQuery: suggestedValidation.sql ?? undefined,
    message:
      !originalValidation.sql && !suggestedValidation.sql
        ? `Could not derive read-only validation SELECTs from original or suggested statement. Original: ${originalValidation.source}. Suggested: ${suggestedValidation.source}.`
        : !originalValidation.sql
          ? `Could not derive a read-only validation SELECT from the original statement. ${originalValidation.source}.`
          : `Could not derive a read-only validation SELECT from the suggested statement. ${suggestedValidation.source}.`,
  }
}

function buildNonMeaningfulValidationReuseResult(
  originalQuery: string,
  suggestedQuery: string,
  originalValidationQuery: string,
  suggestedValidationQuery: string,
  limit: number,
  sources?: { originalSource?: string; suggestedSource?: string }
) {
  const sameValidationProbe = sqlFingerprint(originalValidationQuery) === sqlFingerprint(suggestedValidationQuery)
  const sameOptimizedStatement = sqlFingerprint(originalQuery) === sqlFingerprint(suggestedQuery)
  if (sameOptimizedStatement) return null

  const sourceRiskTags = getValidationRiskCoverageTags(`${originalQuery}\n${suggestedQuery}`)
  const validationRiskTags = getValidationRiskCoverageTags(`${originalValidationQuery}\n${suggestedValidationQuery}`)
  const sourceHasOpRiskBeyondDowntime = Array.from(sourceRiskTags).some((t) => t !== 'downtime_path')
  const validationIsDowntimeOnly =
    validationRiskTags.size > 0 &&
    Array.from(validationRiskTags).every((t) => t === 'downtime_path')

  if (sameValidationProbe) {
    return {
      attempted: false,
      executedOnSnowflake: false,
      limit,
      originalValidationSource: sources?.originalSource,
      suggestedValidationSource: sources?.suggestedSource,
      originalValidationQuery,
      suggestedValidationQuery,
      message:
        sourceHasOpRiskBeyondDowntime && validationIsDowntimeOnly
          ? 'Rejected validation: original and suggested validation probes are identical and collapse to a shared downtime-only subproblem, which is not a meaningful equivalence test for this rewrite. Re-derivation required.'
          : 'Rejected validation: original and suggested validation probes are identical (likely reference reuse), so this does not meaningfully validate the rewrite. Re-derivation required.',
    }
  }

  // Even if the probes are not text-identical, reject if a complex OEE/ops rewrite is being "validated"
  // only through a shared downtime-only subgraph.
  if (sourceHasOpRiskBeyondDowntime && validationIsDowntimeOnly) {
    return {
      attempted: false,
      executedOnSnowflake: false,
      limit,
      originalValidationSource: sources?.originalSource,
      suggestedValidationSource: sources?.suggestedSource,
      originalValidationQuery,
      suggestedValidationQuery,
      message:
        'Rejected validation: derived probes only validate a downtime-only subproblem while the rewrite touches operation/execution/waste/scoring paths. Add at least one changed-path metric to the validation probe.',
    }
  }

  return null
}

function sqlFingerprint(sql: string): string {
  return stripTrailingSemicolon(String(sql || ''))
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function getValidationRiskCoverageTags(sql: string): Set<string> {
  const text = String(sql || '')
  const tags = new Set<string>()
  if (/\bTIMED_EVENT_DETAILS\b|\bDOWNTIME\b/i.test(text)) tags.add('downtime_path')
  if (/\bOIG_LIVEO3DB\.DBO\.EXECUTION\b|\bEXEC_DATA\b|\bOP_ACTUAL_OUTPUT\b|\bACTUAL_OUTPUT_FOR_PERF\b/i.test(text)) {
    tags.add('execution_path')
  }
  if (/\bWASTE_EVENT_DETAILS\b|\bWASTECFMAPPING\b|\bOP_WASTE\b|\bWASTE_(?:RAW|ADJ|NORM|AMOUNT)\b/i.test(text)) {
    tags.add('waste_path')
  }
  if (/\bACTIVE_SPECS\b|\bSPECIFICATIONS\b|\bPRODUCT_CHARACTERISTICS\b|\bTARGET_SPEED\b|\bRATEUNIT\b/i.test(text)) {
    tags.add('target_speed_path')
  }
  if (/\bPRODUCTION_STARTS\b|\bPRODUCTIONPLANDETAILS\b|\bRAW_OPS\b|\bOP_WINDOWS\b|\bOP_DOWNTIME_TOTAL\b/i.test(text)) {
    tags.add('operation_window_path')
  }
  if (/\bOP_METRICS\b|\bOP_SCORED\b|\bIDEAL_OUTPUT\b|\bGROSS_OUTPUT\b|\bGOOD_OUTPUT\b|\bPERFORMANCE_RATE\b|\bQUALITY_RATE\b|\bOEE\b/i.test(text)) {
    tags.add('scoring_rollup_path')
  }
  return tags
}

async function executeReducedQuery(
  queryText: string,
  limit: number
): Promise<Record<string, unknown>[]> {
  const base = stripTrailingSemicolon(queryText).trim()
  let sqlToRun: string

  // Snowflake does not accept wrapping a top-level WITH query as FROM (WITH ... SELECT ...).
  if (/^(with|select)\b/i.test(base)) {
    sqlToRun = hasLimitClause(base) ? base : appendInternalLimit(base, limit)
  } else {
    sqlToRun = `SELECT * FROM (\n${base}\n) AS WK_OPT_Q\nLIMIT ${limit}`
  }

  const rows = await executeQuery<Record<string, unknown>>(sqlToRun)
  return rows.map((r) => normalizeRow(r))
}


async function deriveValidationQueryAgentic(args: {
  queryText: string
  role: 'original' | 'suggested'
  limit: number
  aggressive?: boolean
  allowReferenceReuse?: boolean
  failureHint?: string
  requiredColumns?: string[]
  sliceContract?: string
  referenceValidationSql?: string
}): Promise<{ sql: string | null; projectedColumns: string[]; sliceContract: string; source: string; plannerTrace: string[] }> {
  const toolCtx = await buildValidationPlannerToolContext(args.queryText, args.referenceValidationSql)
  const normalizeDerived = (r: {
    sql: string | null
    source: string
    projectedColumns?: string[]
    sliceContract?: string
  }): { sql: string | null; projectedColumns: string[]; sliceContract: string; source: string; plannerTrace: string[] } => ({
    sql: r.sql,
    source: r.source,
    projectedColumns: r.projectedColumns || [],
    sliceContract: r.sliceContract || '',
    plannerTrace: [...toolCtx.toolTrace],
  })
  const attempts: Array<() => Promise<{ sql: string | null; projectedColumns: string[]; sliceContract: string; source: string; plannerTrace: string[] }>> = []

  // 1) Deterministic/template path first (fast + no hallucination)
  attempts.push(async () => {
    toolCtx.toolTrace.push(`[deterministic_template] attempting ${args.role} deterministic template`)
    const res = deriveValidationQueryDeterministic(args)
    toolCtx.toolTrace.push(
      `[deterministic_template] ${args.role}: ${res.sql ? 'matched' : 'no match'}${res.source ? ` -> ${res.source}` : ''}`
    )
    return normalizeDerived(res)
  })

  // 2) LLM derivation with compile guard
  attempts.push(async () => {
    toolCtx.toolTrace.push(`[llm_derive] attempting ${args.role} validation derivation`)
    const llm = await deriveValidationQueryWithLlm({ ...args, plannerToolContext: toolCtx })
    if (!llm.sql) return normalizeDerived(llm)
    toolCtx.toolTrace.push(`[compile_explain] validating ${args.role} LLM candidate`)
    const compile = await validateValidationSqlCompiles(llm.sql)
    if (!compile.ok) {
      await maybeAugmentPlannerContextFromCompileFailure(toolCtx, llm.sql, compile)
      return {
        sql: null,
        projectedColumns: llm.projectedColumns || [],
        sliceContract: llm.sliceContract || '',
        source: `LLM validation query rejected (${args.role}): ${compile.reason || 'compile failed'}`,
        plannerTrace: [...toolCtx.toolTrace],
      }
    }
    if (compile.planHeavyReason) {
      toolCtx.toolTrace.push(`[compile_explain] ${args.role}: compile ok but plan flagged heavy -> ${compile.planHeavyReason}`)
      return {
        sql: null,
        projectedColumns: llm.projectedColumns || [],
        sliceContract: llm.sliceContract || '',
        source: `LLM validation query rejected (${args.role}): compile OK but validation plan looks too expensive (${compile.planHeavyReason})`,
        plannerTrace: [...toolCtx.toolTrace],
      }
    }
    return normalizeDerived(llm)
  })

  // 3) LLM repair pass using compiler errors + schema/tool context
  attempts.push(async () => {
    toolCtx.toolTrace.push(`[llm_repair_loop] starting ${args.role} derive+repair loop`)
    const failureHint = args.failureHint || 'Previous attempt failed to compile; repair aliases/CTEs and remove fabricated placeholders.'
    const seeded = await deriveValidationQueryWithLlm({
      ...args,
      aggressive: true,
      failureHint,
      plannerToolContext: toolCtx,
    })
    if (!seeded.sql) return normalizeDerived(seeded)
    let current = seeded
    let compile = await validateValidationSqlCompiles(current.sql!)
    let repairRounds = 0
    while ((!compile.ok || Boolean(compile.planHeavyReason)) && repairRounds < 3) {
      toolCtx.toolTrace.push(
        `[compile_explain] ${args.role}: round ${repairRounds + 1} ${compile.ok ? `plan-heavy (${compile.planHeavyReason})` : `compile-failed (${compile.reason || compile.rawMessage || 'unknown'})`}`
      )
      if (!compile.ok) {
        await maybeAugmentPlannerContextFromCompileFailure(toolCtx, current.sql!, compile)
      }
      toolCtx.toolTrace.push(`[llm_repair] ${args.role}: repair round ${repairRounds + 1}`)
      const repaired = await repairValidationQueryWithLlm({
        ...args,
        brokenValidationSql: current.sql!,
        compilerFailure:
          compile.ok && compile.planHeavyReason
            ? `Compile succeeded but EXPLAIN shows validation query is too expensive: ${compile.planHeavyReason}. Reduce scan volume and keep the same slice/output shape.`
            : compile.reason || compile.rawMessage || failureHint,
        validationExplainSummary: compile.explainText ? summarizeValidationExplainForPrompt(compile.explainText) : undefined,
        plannerToolContext: toolCtx,
      })
      if (!repaired.sql) {
        current = repaired
        break
      }
      current = repaired
      compile = await validateValidationSqlCompiles(current.sql!)
      repairRounds += 1
    }
    if (compile.ok && !compile.planHeavyReason) {
      toolCtx.toolTrace.push(`[llm_repair_loop] ${args.role}: compile+plan checks passed after ${repairRounds} repair round(s)`)
    }
    if (!compile.ok) {
      return {
        sql: null,
        projectedColumns: current.projectedColumns || [],
        sliceContract: current.sliceContract || '',
        source: `LLM validation query rejected (${args.role}): ${compile.reason || 'compile failed after repair loop'}`,
        plannerTrace: [...toolCtx.toolTrace],
      }
    }
    return normalizeDerived(current)
  })

  let last: { sql: string | null; projectedColumns: string[]; sliceContract: string; source: string; plannerTrace: string[] } = {
    sql: null,
    projectedColumns: [],
    sliceContract: '',
    source: 'validation derivation unavailable',
    plannerTrace: [...toolCtx.toolTrace],
  }
  for (const fn of attempts) {
    try {
      const res = await fn()
      last = res
      if (res.sql) return res
    } catch (e) {
      toolCtx.toolTrace.push(`[planner_error] ${summarizeRouteError(e)}`)
      last = { ...last, source: `validation derivation error: ${summarizeRouteError(e)}`, plannerTrace: [...toolCtx.toolTrace] }
    }
  }
  return last
}

async function validateValidationSqlCompiles(sql: string): Promise<CompileValidationResult> {
  try {
    const explainRows = await explainQuery(sql)
    const explainText = explainRowsToText(explainRows)
    return {
      ok: true,
      explainText,
      planHeavyReason: assessValidationPlanCost(explainText),
    }
  } catch (e) {
    const s = summarizeRouteError(e) as any
    const rawMessage = String(s?.message || e || 'compile failed')
    return {
      ok: false,
      reason: formatCompileFailureForPrompt(e),
      rawMessage,
      errorCode: s?.code ? String(s.code) : undefined,
      sqlState: s?.sqlState ? String(s.sqlState) : undefined,
    }
  }
}

function deriveValidationQueryDeterministic(args: {
  queryText: string
  role: 'original' | 'suggested'
  limit: number
  aggressive?: boolean
  allowReferenceReuse?: boolean
  failureHint?: string
  requiredColumns?: string[]
  sliceContract?: string
  referenceValidationSql?: string
}): { sql: string | null; projectedColumns: string[]; sliceContract: string; source: string } {
  // If we already have a trusted reference validation SQL (from original), reuse it for suggested path.
  if (args.allowReferenceReuse !== false && args.referenceValidationSql && /\bselect\b/i.test(args.referenceValidationSql)) {
    const q = stripOuterLimitAgentic2(String(args.referenceValidationSql).trim())
    return {
      sql: ensureTopLevelLimitAgentic2(q, 100),
      projectedColumns: extractSelectAliases(q),
      sliceContract: args.sliceContract || inferSliceContractFromSqlAgentic2(q),
      source: 'deterministic reuse of reference validation SQL',
    }
  }

  const sql = args.queryText || ''
  const looksLikeShiftOee = /FACT_SHIFT_SCHEDULE/i.test(sql) && /DIM_UNIT/i.test(sql) && /TIMED_EVENT_DETAILS/i.test(sql)
  if (!looksLikeShiftOee) {
    return { sql: null, projectedColumns: [], sliceContract: '', source: 'no deterministic validation template matched; falling back to LLM' }
  }
  const queryRiskTags = getValidationRiskCoverageTags(sql)
  const hasComplexOpPaths = Array.from(queryRiskTags).some((t) => t !== 'downtime_path')
  const requiredColumnsUpper = (args.requiredColumns || []).map((c) => String(c).toUpperCase())
  const downtimeOnlyRequiredColumns =
    requiredColumnsUpper.length > 0 &&
    requiredColumnsUpper.every((c) =>
      [
        'SCHEDULE_KEY',
        'UNIT_KEY',
        'SHIFT_DATE',
        'SHIFT_NAME',
        'PLANNED_TIME_MINS',
        'TOTAL_DOWNTIME_MINS',
        'EXCLUDED_DOWNTIME_MINS',
        'INCLUDED_DOWNTIME_MINS',
      ].includes(c)
    )
  if (hasComplexOpPaths && !downtimeOnlyRequiredColumns) {
    return {
      sql: null,
      projectedColumns: [],
      sliceContract: '',
      source:
        'deterministic shift-downtime template skipped: query includes execution/waste/op-scoring paths, so validation must include at least one changed-path metric',
    }
  }

  const slice = parseSliceContractAgentic2(args.sliceContract) || inferShiftSliceFromSqlAgentic2(sql) || { shiftDate: '2024-06-01', unitKeys: ['101','102'] }
  const unitList = slice.unitKeys.join(',')
  const projected = ['SCHEDULE_KEY','UNIT_KEY','SHIFT_DATE','SHIFT_NAME','PLANNED_TIME_MINS','TOTAL_DOWNTIME_MINS','EXCLUDED_DOWNTIME_MINS','INCLUDED_DOWNTIME_MINS']
  if (args.requiredColumns?.length) {
    const req = args.requiredColumns.map(c => c.toUpperCase())
    const supported = projected
    const allSupported = req.every(c => supported.includes(c))
    if (!allSupported) {
      return {
        sql: null,
        projectedColumns: [],
        sliceContract: `SHIFT_DATE = '${slice.shiftDate}' AND UNIT_KEY IN (${unitList})`,
        source: 'deterministic template cannot satisfy required output columns without heavy lineage; falling back to LLM',
      }
    }
  }

  const q = `WITH shift_schedules AS (
  SELECT ss.SCHEDULE_KEY, ss.UNIT_KEY, ss.SHIFT_DATE, ss.SHIFT_NAME, ss.SHIFT_START, ss.SHIFT_END, ss.PLANNED_TIME_MINS
  FROM RAI.RAI4.FACT_SHIFT_SCHEDULE ss
  WHERE ss.SHIFT_DATE = '${slice.shiftDate}' AND ss.UNIT_KEY IN (${unitList})
),
unit_cfg AS (
  SELECT u.UNIT_KEY, u.EXCLUDED_DOWNTIME_CATEGORY_ID
  FROM RAI.RAI4.DIM_UNIT u
  WHERE u.UNIT_KEY IN (${unitList})
),
downtime_events AS (
  SELECT ted.PU_ID AS UNIT_KEY, ted.START_TIME AS DT_START, COALESCE(ted.END_TIME, CURRENT_TIMESTAMP()) AS DT_END, c.ERC_ID AS CATEGORY_ID
  FROM OIG_LIVEO3DB.DBO.TIMED_EVENT_DETAILS ted
  JOIN OIG_LIVEO3DB.DBO.TIMED_EVENT_FAULT te ON ted.TEFAULT_ID = te.TEFAULT_ID
  JOIN OIG_LIVEO3DB.DBO.EVENT_REASON_TREE_DATA evt ON te.EVENT_REASON_TREE_DATA_ID = evt.ERTD_ID
  JOIN OIG_LIVEO3DB.DBO.EVENT_REASON_CATEGORY_DATA ecd ON evt.ERTD_ID = ecd.ERTD_ID
  JOIN OIG_LIVEO3DB.DBO.EVENT_REASON_CATAGORIES c ON ecd.ERC_ID = c.ERC_ID
  WHERE ted.PU_ID IN (${unitList})
),
shift_downtime AS (
  SELECT ss.SCHEDULE_KEY, ss.UNIT_KEY,
    COALESCE(SUM(GREATEST(0, DATEDIFF('second', GREATEST(de.DT_START, ss.SHIFT_START), LEAST(de.DT_END, ss.SHIFT_END)) / 60.0)), 0) AS TOTAL_DOWNTIME_MINS,
    COALESCE(SUM(IFF(de.CATEGORY_ID = uc.EXCLUDED_DOWNTIME_CATEGORY_ID, GREATEST(0, DATEDIFF('second', GREATEST(de.DT_START, ss.SHIFT_START), LEAST(de.DT_END, ss.SHIFT_END)) / 60.0), 0)), 0) AS EXCLUDED_DOWNTIME_MINS
  FROM shift_schedules ss
  JOIN unit_cfg uc ON ss.UNIT_KEY = uc.UNIT_KEY
  LEFT JOIN downtime_events de ON de.UNIT_KEY = ss.UNIT_KEY AND de.DT_START < ss.SHIFT_END AND de.DT_END > ss.SHIFT_START
  GROUP BY ss.SCHEDULE_KEY, ss.UNIT_KEY
)
SELECT
  ss.SCHEDULE_KEY,
  ss.UNIT_KEY,
  ss.SHIFT_DATE,
  ss.SHIFT_NAME,
  ss.PLANNED_TIME_MINS,
  ROUND(COALESCE(sd.TOTAL_DOWNTIME_MINS, 0)) AS TOTAL_DOWNTIME_MINS,
  ROUND(COALESCE(sd.EXCLUDED_DOWNTIME_MINS, 0)) AS EXCLUDED_DOWNTIME_MINS,
  ROUND(COALESCE(sd.TOTAL_DOWNTIME_MINS, 0) - COALESCE(sd.EXCLUDED_DOWNTIME_MINS, 0)) AS INCLUDED_DOWNTIME_MINS
FROM shift_schedules ss
LEFT JOIN shift_downtime sd ON ss.SCHEDULE_KEY = sd.SCHEDULE_KEY AND ss.UNIT_KEY = sd.UNIT_KEY
LIMIT 100`

  return {
    sql: q,
    projectedColumns: projected,
    sliceContract: `SHIFT_DATE = '${slice.shiftDate}' AND UNIT_KEY IN (${unitList})`,
    source: 'deterministic template validation query (shift-level downtime micro-slice)',
  }
}

function inferShiftSliceFromSqlAgentic2(sql: string): { shiftDate: string; unitKeys: string[] } | null {
  const mDate = sql.match(/SHIFT_DATE\s*=\s*'([^']+)'/i)
  const mUnits = sql.match(/UNIT_KEY\s+IN\s*\(([^)]+)\)/i)
  if (!mDate && !mUnits) return null
  const shiftDate = mDate?.[1] || '2024-06-01'
  const unitKeys = (mUnits?.[1] || '101,102')
    .split(',')
    .map((x) => x.trim().replace(/[^0-9-]/g, ''))
    .filter(Boolean)
    .slice(0, 2)
  return { shiftDate, unitKeys: unitKeys.length ? unitKeys : ['101', '102'] }
}

function parseSliceContractAgentic2(contract?: string): { shiftDate: string; unitKeys: string[] } | null {
  if (!contract) return null
  return inferShiftSliceFromSqlAgentic2(contract)
}

function inferSliceContractFromSqlAgentic2(sql: string): string {
  const s = inferShiftSliceFromSqlAgentic2(sql)
  if (!s) return ''
  return `SHIFT_DATE = '${s.shiftDate}' AND UNIT_KEY IN (${s.unitKeys.join(',')})`
}

function stripOuterLimitAgentic2(sql: string): string {
  return sql.replace(/\s+LIMIT\s+\d+\s*;?\s*$/i, '').trim()
}

function ensureTopLevelLimitAgentic2(sql: string, n: number): string {
  if (/\sLIMIT\s+\d+\s*;?\s*$/i.test(sql)) return sql
  return `${sql}
LIMIT ${n}`
}

function extractSelectAliases(sql: string): string[] {
  const selectList = extractFinalTopLevelSelectList(sql)
  if (!selectList) return []
  return splitTopLevelSqlList(selectList)
    .map((expr) => String(expr || '').trim())
    .filter(Boolean)
    .map((expr) => {
      const asMatch = expr.match(/\bas\s+("?)([A-Za-z_][\w$]*)\1\s*$/i)
      if (asMatch) return asMatch[2].toUpperCase()
      const bareAlias = expr.match(/\s+("?)([A-Za-z_][\w$]*)\1\s*$/)
      if (bareAlias && !/[)\]]\s*$/.test(expr.replace(bareAlias[0], ''))) return bareAlias[2].toUpperCase()
      const colRef = expr.match(/(?:^|\.)([A-Za-z_][\w$]*)\s*$/)
      return (colRef?.[1] || expr).replace(/"/g, '').toUpperCase()
    })
}

function extractFinalTopLevelSelectList(sql: string): string | null {
  const text = String(sql || '')
  const lower = text.toLowerCase()
  let depth = 0
  let inSingle = false
  let inDouble = false
  let inLine = false
  let inBlock = false
  let lastSelectStart = -1

  const isBoundary = (idx: number, len: number) => {
    const prev = idx > 0 ? text[idx - 1] : ' '
    const next = idx + len < text.length ? text[idx + len] : ' '
    return !/[A-Za-z0-9_$]/.test(prev) && !/[A-Za-z0-9_$]/.test(next)
  }

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    const next = text[i + 1]
    if (inLine) {
      if (ch === '\n') inLine = false
      continue
    }
    if (inBlock) {
      if (ch === '*' && next === '/') {
        inBlock = false
        i += 1
      }
      continue
    }
    if (inSingle) {
      if (ch === "'" && next === "'") i += 1
      else if (ch === "'") inSingle = false
      continue
    }
    if (inDouble) {
      if (ch === '"' && next === '"') i += 1
      else if (ch === '"') inDouble = false
      continue
    }
    if (ch === '-' && next === '-') {
      inLine = true
      i += 1
      continue
    }
    if (ch === '/' && next === '*') {
      inBlock = true
      i += 1
      continue
    }
    if (ch === "'") {
      inSingle = true
      continue
    }
    if (ch === '"') {
      inDouble = true
      continue
    }
    if (ch === '(') {
      depth += 1
      continue
    }
    if (ch === ')') {
      depth = Math.max(0, depth - 1)
      continue
    }
    if (depth === 0 && lower.startsWith('select', i) && isBoundary(i, 6)) {
      lastSelectStart = i + 6
      continue
    }
  }

  if (lastSelectStart < 0) return null

  // Find top-level FROM after the final top-level SELECT.
  depth = 0
  inSingle = false
  inDouble = false
  inLine = false
  inBlock = false
  for (let i = lastSelectStart; i < text.length; i += 1) {
    const ch = text[i]
    const next = text[i + 1]
    if (inLine) {
      if (ch === '\n') inLine = false
      continue
    }
    if (inBlock) {
      if (ch === '*' && next === '/') {
        inBlock = false
        i += 1
      }
      continue
    }
    if (inSingle) {
      if (ch === "'" && next === "'") i += 1
      else if (ch === "'") inSingle = false
      continue
    }
    if (inDouble) {
      if (ch === '"' && next === '"') i += 1
      else if (ch === '"') inDouble = false
      continue
    }
    if (ch === '-' && next === '-') {
      inLine = true
      i += 1
      continue
    }
    if (ch === '/' && next === '*') {
      inBlock = true
      i += 1
      continue
    }
    if (ch === "'") {
      inSingle = true
      continue
    }
    if (ch === '"') {
      inDouble = true
      continue
    }
    if (ch === '(') {
      depth += 1
      continue
    }
    if (ch === ')') {
      depth = Math.max(0, depth - 1)
      continue
    }
    if (depth === 0 && lower.startsWith('from', i) && isBoundary(i, 4)) {
      return text.slice(lastSelectStart, i).trim()
    }
  }

  return null
}

function splitTopLevelSqlList(listText: string): string[] {
  const parts: string[] = []
  let depth = 0
  let inSingle = false
  let inDouble = false
  let start = 0
  for (let i = 0; i < listText.length; i += 1) {
    const ch = listText[i]
    const next = listText[i + 1]
    if (inSingle) {
      if (ch === "'" && next === "'") i += 1
      else if (ch === "'") inSingle = false
      continue
    }
    if (inDouble) {
      if (ch === '"' && next === '"') i += 1
      else if (ch === '"') inDouble = false
      continue
    }
    if (ch === "'") {
      inSingle = true
      continue
    }
    if (ch === '"') {
      inDouble = true
      continue
    }
    if (ch === '(') {
      depth += 1
      continue
    }
    if (ch === ')') {
      depth = Math.max(0, depth - 1)
      continue
    }
    if (ch === ',' && depth === 0) {
      parts.push(listText.slice(start, i).trim())
      start = i + 1
    }
  }
  const tail = listText.slice(start).trim()
  if (tail) parts.push(tail)
  return parts
}

async function deriveValidationQueryWithLlm(args: {
  queryText: string
  role: 'original' | 'suggested'
  limit: number
  aggressive?: boolean
  failureHint?: string
  requiredColumns?: string[]
  sliceContract?: string
  referenceValidationSql?: string
  plannerToolContext?: ValidationPlannerToolContext
}): Promise<{ sql: string | null; source: string; projectedColumns?: string[]; sliceContract?: string }> {
  const aggressive = Boolean(args.aggressive)
  const aliasColumnHints = args.plannerToolContext?.aliasColumnHints || buildAliasColumnHints(args.queryText)
  const catalogColumnHints = args.plannerToolContext?.catalogColumnHints || ''
  const plannerTraceText = formatPlannerToolTraceForPrompt(args.plannerToolContext?.toolTrace || [])
  const detectedRiskTags = Array.from(getValidationRiskCoverageTags(args.queryText)).filter((t) => t !== 'downtime_path')
  const invalidIdentifierFromFailure = extractInvalidIdentifier(args.failureHint)
  const prompt = [
    'You are preparing a FAST read-only Snowflake validation query for semantic comparison.',
    `This is the ${args.role} query in an optimization workflow.`,
    'Return ONLY valid JSON with this schema:',
    '{',
    '  "validation_query": "full SQL text or null",',
    '  "projected_columns": ["COLUMN_A","COLUMN_B"],',
    '  "slice_contract": "short text describing exact deterministic micro-slice used",',
    '  "strategy": "short description of how you reduced the query",',
    '  "notes": ["optional caveats"]',
    '}',
    '',
    'Rules:',
    '- validation_query must be a SINGLE read-only SELECT statement (plain SELECT or WITH ... SELECT).',
    '- Do NOT return CREATE/INSERT/UPDATE/DELETE/MERGE/CALL/ALTER/DROP.',
    '- If input is CTAS/INSERT...SELECT, extract and convert the underlying SELECT into a read-only validation query.',
    '- Make it MUCH faster/smaller while preserving output semantics/shape as much as possible for comparison.',
    '- Do NOT invent source columns, join keys, or tables that are not present in the input SQL. If a metric needs unavailable lineage, omit the metric instead of guessing.',
    '- Reuse aliases consistently. Do not reference aliases that were not defined in your FROM/JOIN/CTE clauses.',
    '- ONLY reference source alias.column combinations that appear in the input SQL for retained source aliases/tables, unless the alias is a new alias you define for a derived subquery/CTE.',
    '- Prefer copying source join predicates from the input SQL (for retained tables) instead of inventing alternative joins.',
    '- Prefer deterministic reductions (time filters, narrower partitions, smaller unit subsets) over random sampling.',
    '- You may add LIMIT, but only after meaningful reduction/filtering.',
    '- NEVER fabricate placeholder metrics or constants (for example SUM(100.0), SUM(80.0), hardcoded outputs, or dummy rows). Use real source columns or omit the metric.',
    '- Prefer a compact validation projection (keys + a few representative computed metrics) over reproducing every output column.',
    ...(detectedRiskTags.length
      ? [
          `- IMPORTANT FOR THIS QUERY: detected changed-risk paths in source SQL: ${detectedRiskTags.join(', ')}.`,
          '- Your validation probe must include at least one representative metric/join path from those changed-risk paths (not only shift-level downtime overlap).',
        ]
      : []),
    '- If raw high-volume event/execution tables are used, you MUST first narrow to a micro-slice (e.g., 1 day or less AND 1-3 units/warehouses/keys) before joining them.',
    '- Avoid broad windows like 7/30 days for validation unless the query is already tiny.',
    '- Target runtime for validation query should be seconds, not minutes.',
    '- Do NOT use cartesian joins or placeholder joins (e.g. `JOIN ... ON 1=1`).',
    '- `projected_columns` must list the final SELECT output columns in order.',
    '- `slice_contract` must explicitly state the exact deterministic slice (date window + unit/warehouse/key filters) used.',
    ...(aggressive
      ? [
          '- AGGRESSIVE FAST MODE: prioritize speed over coverage.',
          '- Restrict to a deterministic micro-slice: at most 1 day (prefer 1 shift/date) and 1-2 units/entities.',
          '- It is acceptable to validate only a subset of output columns if that makes the query fast and comparable.',
          '- Avoid joining the heaviest raw tables unless absolutely necessary for a retained metric.',
          '- Include an INTERNAL top-level LIMIT (<= 100) in the final validation_query after filtering/slicing.',
        ]
      : []),
    ...(args.requiredColumns?.length
      ? [
          `- REQUIRED: The final SELECT must project EXACTLY these columns (same names and order): ${args.requiredColumns.join(', ')}`,
        ]
      : []),
    ...(args.sliceContract
      ? [
          `- REQUIRED: Use the same deterministic micro-slice as this contract: ${args.sliceContract}`,
        ]
      : []),
    ...(invalidIdentifierFromFailure
      ? [
          `- Previous attempt failed on invalid identifier ${invalidIdentifierFromFailure}. Do NOT reference that identifier.`,
        ]
      : []),
    '- IMPORTANT: Return the FULL executable SQL text. No placeholders such as "...", "same as before", or "unchanged CTEs".',
    '- If you cannot safely derive a read-only validation query, set validation_query to null and explain why in strategy.',
    '',
    `The executor may append/apply LIMIT ${args.limit} for comparison, but your SQL must be executable as a standalone top-level WITH ... SELECT or SELECT.`,
    ...(aliasColumnHints
      ? [
          '',
          'Observed source alias/table columns in the INPUT SQL (use as a schema hint; do not invent extra columns for these aliases):',
          aliasColumnHints,
        ]
      : []),
    ...(catalogColumnHints
      ? [
          '',
          'Schema inspection results from Snowflake (planner tool output; authoritative if present):',
          catalogColumnHints,
        ]
      : []),
    ...(plannerTraceText
      ? [
          '',
          'Planner tool trace (previous steps / failures / probes):',
          plannerTraceText,
        ]
      : []),
    ...(args.referenceValidationSql
      ? [
          '',
          'Reference validation SQL from the original statement (use as a shape/slice template for the suggested statement; keep output columns and slice aligned):',
          shortenForPrompt(args.referenceValidationSql, 8000),
        ]
      : []),
    ...(args.failureHint ? ['', `Previous validation failure to avoid: ${args.failureHint}`] : []),
    '',
    'Input SQL:',
    args.queryText,
  ].join('\n')

  const raw = await cortexCompleteText(prompt)
  const parsed = extractJsonObject(raw)
  if (!parsed) {
    return deriveValidationQueryFallback(args)
  }

  const strategy = String(parsed.strategy || '').trim()
  const projectedColumns = Array.isArray(parsed.projected_columns)
    ? parsed.projected_columns.map((v) => String(v || '').trim()).filter(Boolean)
    : undefined
  const sliceContract = typeof parsed.slice_contract === 'string' ? parsed.slice_contract.trim() : undefined
  const candidate = parsed.validation_query == null ? null : String(parsed.validation_query)
  if (!candidate) {
    return {
      sql: null,
      source: `LLM derivation unavailable (${args.role})${strategy ? `: ${strategy}` : ''}`,
      projectedColumns,
      sliceContract,
    }
  }

  ensureFullSqlReturned(candidate)
  let normalized = sanitizeSingleStatementForExplain(candidate)
  if (!/^(select|with)\b/i.test(normalized)) {
    const fb = deriveValidationQueryFallback({ ...args, requiredColumns: projectedColumns || args.requiredColumns, sliceContract: sliceContract || args.sliceContract });
    return fb.sql ? fb : {
      sql: null,
      source: `LLM returned non-read-only validation SQL (${args.role})${strategy ? `: ${strategy}` : ''}`,
      projectedColumns,
      sliceContract,
    }
  }

  if (looksTooExpensiveForValidation(normalized) && !hasLimitClause(normalized)) {
    normalized = appendInternalLimit(normalized, Math.min(Math.max(args.limit * 5, 50), 100))
  }

  const invalidReason = invalidValidationQueryReason(normalized)
  if (invalidReason) {
    // Try a targeted repair before falling back/rejecting when the candidate is close but lint-invalid.
    if (/undefined aliases|undefined cte|recursive cte|cartesian placeholder join|fabricated aggregate constants/i.test(invalidReason)) {
      const repaired = await repairValidationQueryWithLlm({
        queryText: args.queryText,
        role: args.role,
        limit: args.limit,
        brokenValidationSql: normalized,
        compilerFailure: `Static validation lint failed: ${invalidReason}`,
        requiredColumns: projectedColumns || args.requiredColumns,
        sliceContract: sliceContract || args.sliceContract,
        plannerToolContext: args.plannerToolContext,
      })
      if (repaired.sql) {
        return {
          sql: repaired.sql,
          source: `LLM-derived ${args.role} validation query repaired after lint failure${strategy ? ` | ${strategy}` : ''}`,
          projectedColumns: repaired.projectedColumns || projectedColumns,
          sliceContract: repaired.sliceContract || sliceContract,
        }
      }
    }
    const fb = deriveValidationQueryFallback({ ...args, requiredColumns: projectedColumns || args.requiredColumns, sliceContract: sliceContract || args.sliceContract })
    if (fb.sql) return fb
    return {
      sql: null,
      source: `LLM validation query rejected (${args.role}): ${invalidReason}${strategy ? ` | ${strategy}` : ''}`,
      projectedColumns,
      sliceContract,
    }
  }

  if (args.requiredColumns?.length && projectedColumns?.length) {
    const same =
      projectedColumns.length === args.requiredColumns.length &&
      projectedColumns.every((c, i) => c.toUpperCase() === String(args.requiredColumns?.[i] || '').toUpperCase())
    if (!same) {
      return {
        sql: null,
        source: `LLM validation query rejected (${args.role}): projected_columns do not match required columns`,
        projectedColumns,
        sliceContract,
      }
    }
  }

  return {
    sql: normalized,
    source: `LLM-derived ${args.role} validation query${aggressive ? ' [aggressive]' : ''}${strategy ? `: ${strategy}` : ''}`,
    projectedColumns,
    sliceContract,
  }
}

async function repairValidationQueryWithLlm(args: {
  queryText: string
  role: 'original' | 'suggested'
  limit: number
  brokenValidationSql: string
  compilerFailure: string
  validationExplainSummary?: string
  requiredColumns?: string[]
  sliceContract?: string
  plannerToolContext?: ValidationPlannerToolContext
}): Promise<{ sql: string | null; source: string; projectedColumns?: string[]; sliceContract?: string }> {
  const aliasColumnHints = args.plannerToolContext?.aliasColumnHints || buildAliasColumnHints(args.queryText)
  const catalogColumnHints = args.plannerToolContext?.catalogColumnHints || ''
  const plannerTraceText = formatPlannerToolTraceForPrompt(args.plannerToolContext?.toolTrace || [])
  const invalidIdentifierFromFailure = extractInvalidIdentifier(args.compilerFailure)
  const prompt = [
    'You are repairing a Snowflake read-only validation query that failed to compile.',
    `This is the ${args.role} validation query in an optimization workflow.`,
    'Return ONLY valid JSON with this schema:',
    '{',
    '  "validation_query": "full repaired SQL text or null",',
    '  "projected_columns": ["COLUMN_A","COLUMN_B"],',
    '  "slice_contract": "same deterministic micro-slice description",',
    '  "strategy": "what was repaired",',
    '}',
    '',
    'Repair goals:',
    '- Fix compile errors without expanding scope or making the query slower.',
    '- Preserve the existing output column shape and deterministic micro-slice.',
    '- Do not invent columns, aliases, join keys, or tables.',
    '- Keep this as a SINGLE top-level read-only SELECT / WITH...SELECT statement.',
    '- Keep or add a top-level LIMIT <= 100.',
    ...(args.requiredColumns?.length
      ? [`- REQUIRED output columns (same names/order): ${args.requiredColumns.join(', ')}`]
      : []),
    ...(args.sliceContract ? [`- REQUIRED slice contract: ${args.sliceContract}`] : []),
    ...(invalidIdentifierFromFailure
      ? [`- The last failure referenced invalid identifier: ${invalidIdentifierFromFailure}. Remove or correct it.`]
      : []),
    '',
    `Compiler failure: ${args.compilerFailure}`,
    ...(args.validationExplainSummary
      ? [
          '',
          'Validation query EXPLAIN heuristic summary (compile succeeded but plan may be too heavy):',
          args.validationExplainSummary,
        ]
      : []),
    '',
    'Broken validation SQL to repair:',
    shortenForPrompt(args.brokenValidationSql, 12000),
    ...(aliasColumnHints
      ? [
          '',
          'Observed source alias/table columns in the INPUT SQL:',
          aliasColumnHints,
        ]
      : []),
    ...(catalogColumnHints
      ? [
          '',
          'Schema inspection results from Snowflake (authoritative):',
          catalogColumnHints,
        ]
      : []),
    ...(plannerTraceText
      ? [
          '',
          'Planner tool trace (previous steps / failures / probes):',
          plannerTraceText,
        ]
      : []),
    '',
    'Input SQL (context):',
    shortenForPrompt(args.queryText, 12000),
  ].join('\n')

  const raw = await cortexCompleteText(prompt)
  const parsed = extractJsonObject(raw)
  if (!parsed) {
    return { sql: null, source: `LLM repair failed (${args.role}): invalid JSON response` }
  }

  const strategy = String(parsed.strategy || '').trim()
  const projectedColumns = Array.isArray(parsed.projected_columns)
    ? parsed.projected_columns.map((v) => String(v || '').trim()).filter(Boolean)
    : args.requiredColumns
  const sliceContract = typeof parsed.slice_contract === 'string' ? parsed.slice_contract.trim() : (args.sliceContract || '')
  const candidate = parsed.validation_query == null ? null : String(parsed.validation_query)
  if (!candidate) {
    return {
      sql: null,
      source: `LLM repair unavailable (${args.role})${strategy ? `: ${strategy}` : ''}`,
      projectedColumns,
      sliceContract,
    }
  }

  ensureFullSqlReturned(candidate)
  let normalized = sanitizeSingleStatementForExplain(candidate)
  if (!/^(select|with)\b/i.test(normalized)) {
    return {
      sql: null,
      source: `LLM repair returned non-read-only SQL (${args.role})${strategy ? `: ${strategy}` : ''}`,
      projectedColumns,
      sliceContract,
    }
  }
  if (!hasLimitClause(normalized)) {
    normalized = appendInternalLimit(normalized, Math.min(Math.max(args.limit * 5, 50), 100))
  }
  const invalidReason = invalidValidationQueryReason(normalized)
  if (invalidReason) {
    return {
      sql: null,
      source: `LLM repair rejected (${args.role}): ${invalidReason}${strategy ? ` | ${strategy}` : ''}`,
      projectedColumns,
      sliceContract,
    }
  }
  if (args.requiredColumns?.length && projectedColumns?.length) {
    const same =
      projectedColumns.length === args.requiredColumns.length &&
      projectedColumns.every((c, i) => c.toUpperCase() === String(args.requiredColumns?.[i] || '').toUpperCase())
    if (!same) {
      return {
        sql: null,
        source: `LLM repair rejected (${args.role}): projected_columns do not match required columns`,
        projectedColumns,
        sliceContract,
      }
    }
  }
  return {
    sql: normalized,
    source: `LLM repaired ${args.role} validation query${strategy ? `: ${strategy}` : ''}`,
    projectedColumns,
    sliceContract,
  }
}


function deriveValidationQueryFallback(args: {
  queryText: string
  role: 'original' | 'suggested'
  limit: number
  requiredColumns?: string[]
  sliceContract?: string
  referenceValidationSql?: string
}): { sql: string | null; source: string; projectedColumns?: string[]; sliceContract?: string } {
  const projectedColumns = args.requiredColumns && args.requiredColumns.length ? [...args.requiredColumns] : undefined
  const slice = parseSliceContractAgentic(args.sliceContract) || { shiftDate: '2024-06-01', unitKeys: [101, 102] }
  const sliceContract = `SHIFT_DATE = '${slice.shiftDate}' AND UNIT_KEY IN (${slice.unitKeys.join(',')})`

  const candidateSources = [args.referenceValidationSql, args.queryText].filter(Boolean) as string[]
  for (const src of candidateSources) {
    const extracted = extractReadOnlySelectBody(src)
    if (!extracted) continue
    const sql = wrapAsValidationSliceSelect(extracted, {
      requiredColumns: projectedColumns,
      shiftDate: slice.shiftDate,
      unitKeys: slice.unitKeys,
      limit: Math.min(Math.max(args.limit * 5, 50), 100),
    })
    const invalid = invalidValidationQueryReason(sql)
    if (!invalid) {
      return {
        sql,
        source: `Deterministic fallback validation query (${args.role}): wrapped extracted read-only SELECT and applied exact micro-slice filter on output columns`,
        projectedColumns,
        sliceContract,
      }
    }
  }

  return {
    sql: null,
    source: `Deterministic fallback unavailable (${args.role}): could not extract a safe read-only SELECT body`,
    projectedColumns,
    sliceContract,
  }
}

function parseSliceContractAgentic(sliceContract?: string): { shiftDate: string; unitKeys: number[] } | null {
  if (!sliceContract) return null
  const dateMatch = sliceContract.match(/SHIFT_DATE\s*=\s*''?([0-9]{4}-[0-9]{2}-[0-9]{2})''?/i)
  const unitsMatch = sliceContract.match(/UNIT_KEY\s+IN\s*\(([^)]+)\)/i)
  const shiftDate = dateMatch?.[1]
  const unitKeys = (unitsMatch?.[1] || '')
    .split(',')
    .map((x) => Number(String(x).trim().replace(/[^0-9-]/g, '')))
    .filter((n) => Number.isFinite(n))
  if (!shiftDate) return null
  return { shiftDate, unitKeys: unitKeys.length ? unitKeys : [101, 102] }
}

function extractReadOnlySelectBody(sql: string): string | null {
  const clean = stripTrailingSemicolon(String(sql || '').trim())
  if (!clean) return null
  if (/^(with|select)\b/i.test(clean)) return clean

  const ctasMatch = clean.match(/\bAS\s+(WITH\b[\s\S]*|SELECT\b[\s\S]*)$/i)
  if (ctasMatch) return ctasMatch[1].trim()

  const lower = clean.toLowerCase()
  const withIdx = lower.indexOf('with ')
  if (withIdx >= 0) return clean.slice(withIdx).trim()
  const selectIdx = lower.indexOf('select ')
  if (selectIdx >= 0) return clean.slice(selectIdx).trim()
  return null
}

function wrapAsValidationSliceSelect(
  selectBody: string,
  opts: { requiredColumns?: string[]; shiftDate: string; unitKeys: number[]; limit: number }
): string {
  const cols = opts.requiredColumns?.length ? opts.requiredColumns.map((c) => `b.${c}`).join(', ') : 'b.*'
  const unitList = opts.unitKeys.join(',')
  const body = stripTrailingSemicolon(selectBody)
  return [
    'WITH __base_validation AS (',
    body,
    ')',
    `SELECT ${cols}`,
    'FROM __base_validation b',
    `WHERE b.SHIFT_DATE = '${opts.shiftDate}' AND b.UNIT_KEY IN (${unitList})`,
    `LIMIT ${Math.max(1, Math.min(100, Math.floor(opts.limit)))}`,
  ].join('\n')
}

function invalidValidationQueryReason(sql: string): string | null {
  if (/^\s*select\s+\*\s+from\s*\(\s*with\b/i.test(sql)) {
    return 'uses invalid Snowflake wrapper `SELECT * FROM (WITH ... SELECT ...)`; return top-level WITH ... SELECT instead'
  }
  if (/\bon\s+1\s*=\s*1\b/i.test(sql)) {
    return 'contains cartesian placeholder join (ON 1=1)'
  }
  const undefinedAliases = findUndefinedShortAliases(sql)
  if (undefinedAliases.length > 0) {
    return `references undefined aliases: ${undefinedAliases.slice(0, 5).join(', ')}`
  }
  const undefinedCtes = findUndefinedCteReferences(sql)
  if (undefinedCtes.length > 0) {
    return `references undefined CTEs/subqueries: ${undefinedCtes.slice(0, 5).join(', ')}`
  }
  const recursiveCte = findSelfRecursiveCte(sql)
  if (recursiveCte) {
    return `appears to contain a recursive/self-referencing CTE without RECURSIVE: ${recursiveCte}`
  }
  if (/\b(sum|avg|min|max)\s*\(\s*[-+]?\d+(\.\d+)?\s*\)/i.test(sql)) {
    return 'contains fabricated aggregate constants (e.g., SUM(100.0))'
  }
  if (/\bselect\s+[-+]?\d+(\.\d+)?\s+as\s+/i.test(sql) && !/\bfrom\b/i.test(sql)) {
    return 'returns constant-only rows (no real source scan)'
  }
  if (/dateadd\s*\(\s*'day'\s*,\s*-\s*(7|[89]|\d{2,})/i.test(sql)) {
    return 'uses a broad day window for validation'
  }
  if (looksTooExpensiveForValidation(sql) && !hasLimitClause(sql)) {
    return 'looks too expensive for validation and lacks an internal LIMIT'
  }
  return null
}

function hasLimitClause(sql: string): boolean {
  return /\blimit\s+\d+\b/i.test(sql)
}

function appendInternalLimit(sql: string, limit: number): string {
  const clean = stripTrailingSemicolon(sql)
  const safeLimit = Math.max(1, Math.min(1000, Math.floor(limit)))
  return `${clean}\nLIMIT ${safeLimit}`
}

function looksTooExpensiveForValidation(sql: string): boolean {
  const txt = sql.toLowerCase()
  const heavyRefs = [
    'oig_liveo3db.dbo.timed_event_details',
    'oig_liveo3db.dbo.execution',
    'oig_liveo3db.dbo.waste_event_details',
    'snowflake.account_usage.query_history',
  ]
  const heavyHits = heavyRefs.filter((t) => txt.includes(t)).length
  const hasNarrowEntityFilter =
    /\b(unit_key|warehouse_name|pu_id|schedule_key)\b\s*(=|in)\b/i.test(sql) ||
    /\bqualify\s+row_number\s*\(/i.test(sql)
  const broadDayWindow = /dateadd\s*\(\s*'day'\s*,\s*-\s*(3|4|5|6|7|[89]|\d{2,})/i.test(sql)

  if (heavyHits >= 2 && !hasNarrowEntityFilter) return true
  if (heavyHits >= 1 && broadDayWindow) return true
  if (sql.length > 9000 && heavyHits >= 1) return true
  return false
}

function findUndefinedShortAliases(sql: string): string[] {
  const defined = new Set<string>()
  const keywordSet = new Set([
    'where', 'on', 'using', 'group', 'order', 'limit', 'qualify', 'having',
    'left', 'right', 'inner', 'outer', 'full', 'cross', 'union', 'select',
    'from', 'join', 'and', 'or', 'when', 'then', 'else', 'end',
  ])

  for (const m of sql.matchAll(/\bwith\s+([A-Za-z_][\w$]*)\s+as\b/gi)) defined.add(m[1].toLowerCase())
  for (const m of sql.matchAll(/,\s*([A-Za-z_][\w$]*)\s+as\b/gi)) defined.add(m[1].toLowerCase())
  for (const m of sql.matchAll(/\b(?:from|join)\s+(?:\([^)]*\)|[^\s,()]+)(?:\s+(?:as\s+)?)?([A-Za-z_][\w$]*)/gi)) {
    const alias = String(m[1] || '').toLowerCase()
    if (!alias || keywordSet.has(alias)) continue
    defined.add(alias)
  }

  const refs = new Set<string>()
  for (const m of sql.matchAll(/\b([a-z][a-z0-9_]*)\s*\./g)) {
    const ref = m[1].toLowerCase()
    if (keywordSet.has(ref)) continue
    if (ref.length > 6) continue // avoid database/schema prefixes like oig_liveo3db
    refs.add(ref)
  }

  return Array.from(refs).filter((r) => !defined.has(r)).sort()
}


function findUndefinedCteReferences(sql: string): string[] {
  const cteNames = new Set(getTopLevelCteNames(sql).map((n) => n.toLowerCase()))
  if (cteNames.size === 0) return []

  const builtins = new Set(['lateral', 'flatten', 'table', 'unnest', 'values'])
  const refs = new Set<string>()
  const aliasNames = new Set<string>()

  for (const m of sql.matchAll(/\b(?:from|join)\s+(?:\([^)]*\)|[^\s,()]+)(?:\s+(?:as\s+)?)?([A-Za-z_][\w$]*)/gi)) {
    const alias = String(m[1] || '').toLowerCase()
    if (!alias || builtins.has(alias)) continue
    aliasNames.add(alias)
  }

  for (const m of sql.matchAll(/\b(?:from|join)\s+([A-Za-z_][\w$]*)\b/gi)) {
    const src = String(m[1] || '').toLowerCase()
    if (!src || builtins.has(src)) continue
    const idx = Number(m.index ?? -1)
    if (idx >= 0) {
      const full = String(m[0] || '')
      const srcPosInMatch = full.toLowerCase().lastIndexOf(src)
      const nextCharInSql =
        srcPosInMatch >= 0 ? sql[idx + srcPosInMatch + src.length] : ''
      if (nextCharInSql === '.') continue // schema-qualified object (e.g. OIG_LIVEO3DB.DBO.EXECUTION), not a CTE
    }
    // If it's schema-qualified, this regex won't match because of dot; this branch is only bare identifiers.
    refs.add(src)
  }

  // Only flag things that look like internal CTE references (snake_case style) and are not declared.
  return Array.from(refs)
    .filter((r) => r.includes('_') && !cteNames.has(r) && !aliasNames.has(r))
    .sort()
}

function findSelfRecursiveCte(sql: string): string | null {
  const ctes = getTopLevelCteBodies(sql)
  for (const cte of ctes) {
    const name = cte.name.toLowerCase()
    const body = cte.body.toLowerCase()
    if (new RegExp(`\\b(?:from|join)\\s+${name}\\b`, 'i').test(body)) {
      if (!/\bwith\s+recursive\b/i.test(sql)) return cte.name
    }
  }
  return null
}

function getTopLevelCteNames(sql: string): string[] {
  return getTopLevelCteBodies(sql).map((c) => c.name)
}

function getTopLevelCteBodies(sql: string): Array<{ name: string; body: string }> {
  const out: Array<{ name: string; body: string }> = []
  const text = String(sql || '')
  const withIdx = text.search(/\bwith\b/i)
  if (withIdx < 0) return out
  let i = withIdx + (text.slice(withIdx).match(/\bwith\b/i)?.[0].length || 4)
  const n = text.length

  const skipWs = () => {
    while (i < n && /\s/.test(text[i])) i += 1
  }

  const readIdent = (): string => {
    const m = text.slice(i).match(/^([A-Za-z_][\w$]*)/)
    if (!m) return ''
    i += m[1].length
    return m[1]
  }

  const skipBalancedParens = () => {
    if (text[i] !== '(') return
    let depth = 0
    while (i < n) {
      const ch = text[i]
      if (ch === '(') depth += 1
      else if (ch === ')') {
        depth -= 1
        if (depth === 0) {
          i += 1
          break
        }
      }
      i += 1
    }
  }

  const readBalancedParenBody = (): string => {
    if (text[i] !== '(') return ''
    let depth = 0
    const start = i + 1
    let inSingle = false
    let inDouble = false
    let inLine = false
    let inBlock = false

    while (i < n) {
      const ch = text[i]
      const next = text[i + 1]

      if (inLine) {
        if (ch === '\n') inLine = false
        i += 1
        continue
      }
      if (inBlock) {
        if (ch === '*' && next === '/') {
          inBlock = false
          i += 2
          continue
        }
        i += 1
        continue
      }
      if (inSingle) {
        if (ch === "'" && next === "'") {
          i += 2
          continue
        }
        if (ch === "'") inSingle = false
        i += 1
        continue
      }
      if (inDouble) {
        if (ch === '"' && next === '"') {
          i += 2
          continue
        }
        if (ch === '"') inDouble = false
        i += 1
        continue
      }

      if (ch === '-' && next === '-') {
        inLine = true
        i += 2
        continue
      }
      if (ch === '/' && next === '*') {
        inBlock = true
        i += 2
        continue
      }
      if (ch === "'") {
        inSingle = true
        i += 1
        continue
      }
      if (ch === '"') {
        inDouble = true
        i += 1
        continue
      }
      if (ch === '(') {
        depth += 1
        i += 1
        continue
      }
      if (ch === ')') {
        depth -= 1
        if (depth === 0) {
          const body = text.slice(start, i)
          i += 1
          return body
        }
        i += 1
        continue
      }
      i += 1
    }
    return ''
  }

  skipWs()
  const rec = text.slice(i).match(/^recursive\b/i)
  if (rec) i += rec[0].length

  while (i < n) {
    skipWs()
    const name = readIdent()
    if (!name) break
    skipWs()
    if (text[i] === '(') {
      skipBalancedParens()
      skipWs()
    }
    const asMatch = text.slice(i).match(/^as\b/i)
    if (!asMatch) break
    i += asMatch[0].length
    skipWs()
    const body = readBalancedParenBody()
    if (!body) break
    out.push({ name, body })
    skipWs()
    if (text[i] === ',') {
      i += 1
      continue
    }
    break
  }

  return out
}

function extractInvalidIdentifier(failureHint?: string): string | null {
  if (!failureHint) return null
  const m = String(failureHint).match(/invalid identifier\s+'([^']+)'/i)
  return m ? m[1] : null
}

function buildAliasColumnHints(sql: string): string {
  const aliasTable = new Map<string, string>()
  const keywordSet = new Set([
    'where', 'on', 'using', 'group', 'order', 'limit', 'qualify', 'having',
    'left', 'right', 'inner', 'outer', 'full', 'cross', 'union', 'select',
    'from', 'join', 'and', 'or', 'when', 'then', 'else', 'end', 'as',
  ])

  for (const m of sql.matchAll(/\b(?:from|join)\s+([A-Za-z_][\w$.]*|\([^)]+\))\s+(?:as\s+)?([A-Za-z_][\w$]*)/gi)) {
    const source = String(m[1] || '')
    const alias = String(m[2] || '').toLowerCase()
    if (!alias || keywordSet.has(alias)) continue
    aliasTable.set(alias, source)
  }

  const aliasColumns = new Map<string, Set<string>>()
  for (const m of sql.matchAll(/\b([A-Za-z_][\w$]*)\.([A-Za-z_][\w$]*)\b/g)) {
    const alias = String(m[1] || '').toLowerCase()
    const col = String(m[2] || '').toUpperCase()
    if (!alias || !col) continue
    if (!aliasTable.has(alias)) continue
    if (!aliasColumns.has(alias)) aliasColumns.set(alias, new Set())
    aliasColumns.get(alias)!.add(col)
  }

  const lines = Array.from(aliasColumns.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 20)
    .map(([alias, cols]) => {
      const source = aliasTable.get(alias) || alias
      const colList = Array.from(cols).sort().slice(0, 24).join(', ')
      return `- ${alias} (${source}): ${colList}`
    })

  return lines.join('\n')
}

async function buildValidationPlannerToolContext(
  queryText: string,
  referenceValidationSql?: string
): Promise<ValidationPlannerToolContext> {
  const sourceObjects = discoverSourceObjectsFromSql([queryText, referenceValidationSql].filter(Boolean) as string[])
  const aliasToSourceObject = buildAliasToSourceObjectMap([queryText, referenceValidationSql].filter(Boolean) as string[])
  const inspected = await inspectObjectSchemasTool(sourceObjects.slice(0, 12))
  const toolTrace = [
    `[discover_sources] found ${sourceObjects.length} source object(s): ${sourceObjects.slice(0, 8).join(', ') || '(none)'}`,
    `[inspect_schema] inspected ${inspected.length}/${Math.min(sourceObjects.length, 12)} object(s)`,
  ]
  return {
    sourceObjects,
    aliasToSourceObject,
    inspectedSchemas: inspected,
    aliasColumnHints: buildAliasColumnHints(queryText),
    catalogColumnHints: formatInspectedSchemasForPrompt(inspected),
    toolTrace,
  }
}

function buildAliasToSourceObjectMap(sqls: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  const keywordSet = new Set([
    'where', 'on', 'using', 'group', 'order', 'limit', 'qualify', 'having',
    'left', 'right', 'inner', 'outer', 'full', 'cross', 'union', 'select',
    'from', 'join', 'and', 'or', 'when', 'then', 'else', 'end', 'as',
  ])

  for (const sql of sqls) {
    for (const m of String(sql || '').matchAll(/\b(?:from|join)\s+([A-Za-z_][\w$]*(?:\.[A-Za-z_][\w$]*){0,2})\s+(?:as\s+)?([A-Za-z_][\w$]*)\b/gi)) {
      const source = String(m[1] || '').trim()
      const alias = String(m[2] || '').trim().toLowerCase()
      if (!source || !alias || keywordSet.has(alias)) continue
      out[alias] = source
    }
  }

  return out
}

function discoverSourceObjectsFromSql(sqls: string[]): string[] {
  const out = new Set<string>()
  const cteNames = new Set<string>()

  for (const sql of sqls) {
    for (const cte of getTopLevelCteNames(sql)) cteNames.add(cte.toLowerCase())
  }

  for (const sql of sqls) {
    for (const m of String(sql || '').matchAll(/\b(?:from|join)\s+([A-Za-z_][\w$]*(?:\.[A-Za-z_][\w$]*){0,2})\b/gi)) {
      const raw = String(m[1] || '').trim()
      if (!raw || cteNames.has(raw.toLowerCase())) continue
      if (/^(table|lateral|flatten|values)$/i.test(raw)) continue
      // Prefer real object refs (schema-qualified) but keep bare refs too for same-schema objects.
      out.add(raw)
    }
  }

  return Array.from(out)
}

async function inspectObjectSchemasTool(objects: string[]): Promise<Array<{ objectName: string; columns: string[]; source: string }>> {
  const results: Array<{ objectName: string; columns: string[]; source: string }> = []
  for (const obj of objects) {
    try {
      const cols = await describeObjectColumnsSnowflake(obj)
      if (cols.length > 0) {
        results.push({ objectName: obj, columns: cols, source: 'snowflake_show_columns' })
      }
    } catch {
      // best effort only
    }
  }
  return results
}

function formatPlannerToolTraceForPrompt(trace: string[]): string {
  if (!trace.length) return ''
  return trace.slice(-14).map((line) => `- ${line}`).join('\n')
}

async function maybeAugmentPlannerContextFromCompileFailure(
  toolCtx: ValidationPlannerToolContext,
  candidateSql: string,
  compile: CompileValidationResult
): Promise<void> {
  if (compile.ok) return

  const raw = String(compile.reason || compile.rawMessage || '')
  const invalidIdentifier = extractInvalidIdentifier(raw)
  const aliasFromInvalid = invalidIdentifier && invalidIdentifier.includes('.')
    ? invalidIdentifier.split('.')[0].replace(/"/g, '').toLowerCase()
    : null

  const candidateAliases = buildAliasToSourceObjectMap([candidateSql])
  const probeObjects = new Set<string>()

  if (aliasFromInvalid) {
    const mapped = candidateAliases[aliasFromInvalid] || toolCtx.aliasToSourceObject[aliasFromInvalid]
    if (mapped) probeObjects.add(mapped)
    toolCtx.toolTrace.push(`[compile_error] invalid identifier ${invalidIdentifier}; alias=${aliasFromInvalid}${mapped ? ` -> ${mapped}` : ''}`)
  } else {
    toolCtx.toolTrace.push(`[compile_error] ${raw.slice(0, 240)}`)
  }

  for (const objName of extractObjectsFromCompileFailure(raw)) probeObjects.add(objName)

  const existing = new Set(toolCtx.inspectedSchemas.map((s) => s.objectName.toUpperCase()))
  const newObjects = Array.from(probeObjects)
    .filter(Boolean)
    .filter((o) => !existing.has(o.toUpperCase()))
    .slice(0, 4)

  if (newObjects.length === 0) return

  const inspected = await inspectObjectSchemasTool(newObjects)
  if (inspected.length > 0) {
    toolCtx.inspectedSchemas.push(...inspected)
    toolCtx.catalogColumnHints = formatInspectedSchemasForPrompt(toolCtx.inspectedSchemas)
    toolCtx.toolTrace.push(
      `[targeted_schema_probe] inspected ${inspected.length} object(s) after compile failure: ${inspected.map((i) => i.objectName).join(', ')}`
    )
  } else {
    toolCtx.toolTrace.push(`[targeted_schema_probe] no schema details retrieved for: ${newObjects.join(', ')}`)
  }
}

function extractObjectsFromCompileFailure(message: string): string[] {
  const out = new Set<string>()
  const text = String(message || '')
  for (const m of text.matchAll(/(?:object|table|view)\s+'([^']+)'/gi)) {
    const obj = String(m[1] || '').trim()
    if (obj) out.add(obj)
  }
  for (const m of text.matchAll(/\b([A-Za-z_][\w$]*(?:\.[A-Za-z_][\w$]*){1,2})\b/g)) {
    const obj = String(m[1] || '').trim()
    if (obj && !obj.includes('..')) out.add(obj)
  }
  return Array.from(out)
}

function assessValidationPlanCost(explainText: string): string | undefined {
  const txt = String(explainText || '')
  if (!txt) return undefined

  const bytes = Number((txt.match(/bytesAssigned=(\d+)/i)?.[1] || 0))
  const partitionsAssigned = Number((txt.match(/partitionsAssigned=(\d+)/i)?.[1] || 0))
  const partitionsTotal = Number((txt.match(/partitionsTotal=(\d+)/i)?.[1] || 0))
  const heavyTableHits = [
    'OIG_LIVEO3DB.DBO.TIMED_EVENT_DETAILS',
    'OIG_LIVEO3DB.DBO.EXECUTION',
    'OIG_LIVEO3DB.DBO.WASTE_EVENT_DETAILS',
    'SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY',
  ].filter((name) => txt.toUpperCase().includes(name.toUpperCase())).length
  const joinCount = (txt.match(/->(?:InnerJoin|LeftOuterJoin|RightOuterJoin|FullOuterJoin|CrossJoin)\b/g) || []).length

  const reasons: string[] = []
  if (bytes > 0 && bytes >= 300_000_000) reasons.push(`bytesAssigned=${bytes}`)
  if (partitionsAssigned > 0 && partitionsAssigned >= 120) {
    reasons.push(
      partitionsTotal > 0
        ? `partitionsAssigned=${partitionsAssigned}/${partitionsTotal}`
        : `partitionsAssigned=${partitionsAssigned}`
    )
  }
  if (heavyTableHits >= 2) reasons.push(`heavyTableScans=${heavyTableHits}`)
  if (heavyTableHits >= 1 && joinCount >= 8) reasons.push(`heavyTableScans=${heavyTableHits} with joins=${joinCount}`)

  return reasons.length ? reasons.join(', ') : undefined
}

function summarizeValidationExplainForPrompt(explainText: string): string {
  const txt = String(explainText || '')
  const lines = txt
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const stats = [
    lines.find((l) => /partitionsTotal=/i.test(l)),
    lines.find((l) => /partitionsAssigned=/i.test(l)),
    lines.find((l) => /bytesAssigned=/i.test(l)),
  ].filter(Boolean) as string[]
  const scans = lines.filter((l) => /->TableScan\b/i.test(l)).slice(0, 10)
  const joins = lines.filter((l) => /->(?:InnerJoin|LeftOuterJoin|RightOuterJoin|FullOuterJoin|CrossJoin)\b/i.test(l)).slice(0, 10)
  return [...stats, ...scans, ...joins].slice(0, 16).join('\n')
}

async function describeObjectColumnsSnowflake(objectName: string): Promise<string[]> {
  const candidates = [
    `SHOW COLUMNS IN TABLE ${objectName}`,
    `SHOW COLUMNS IN VIEW ${objectName}`,
    `SHOW COLUMNS IN MATERIALIZED VIEW ${objectName}`,
  ]
  for (const sql of candidates) {
    try {
      const rows = await executeQuery<Record<string, unknown>>(sql)
      const cols = rows
        .map((r) => String((r as any).column_name ?? (r as any).COLUMN_NAME ?? (r as any).name ?? '').trim())
        .filter(Boolean)
        .map((c) => c.toUpperCase())
      if (cols.length > 0) return Array.from(new Set(cols))
    } catch {
      // try next flavor
    }
  }
  return []
}

function formatInspectedSchemasForPrompt(items: Array<{ objectName: string; columns: string[]; source: string }>): string {
  if (!items.length) return ''
  return items
    .slice(0, 12)
    .map((it) => `- ${it.objectName} [${it.source}]: ${it.columns.slice(0, 40).join(', ')}`)
    .join('\n')
}

function formatCompileFailureForPrompt(error: unknown): string {
  const s = summarizeRouteError(error) as any
  const parts = [
    s?.message ? String(s.message) : '',
    s?.code ? `code=${String(s.code)}` : '',
    s?.sqlState ? `sqlState=${String(s.sqlState)}` : '',
  ].filter(Boolean)
  return parts.join(' | ') || 'compile failed'
}

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Date) out[k] = v.toISOString()
    else if (typeof v === 'bigint') out[k] = Number(v)
    else out[k] = v
  }
  return out
}

function normalizeRowsForJson(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(row).sort()) out[k] = row[k]
    return out
  })
}

function compareAsUnorderedSets(a: Record<string, unknown>[], b: Record<string, unknown>[]): boolean {
  if (a.length !== b.length) return false
  const sa = normalizeRowsForJson(a).map((r) => JSON.stringify(r)).sort()
  const sb = normalizeRowsForJson(b).map((r) => JSON.stringify(r)).sort()
  return JSON.stringify(sa) === JSON.stringify(sb)
}

function objectKeysSet(rows: Record<string, unknown>[]): Set<string> {
  const s = new Set<string>()
  for (const row of rows) for (const k of Object.keys(row)) s.add(k)
  return s
}

function setEquals<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}

function sanitizeSingleStatementForExplain(raw: string): string {
  const stripped = stripTrailingSemicolon(String(raw || '').trim())
  if (!stripped) return ''

  const noLeadComments = stripped.replace(/^\s*(?:--[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*/g, '').trim()

  if (hasTopLevelStatementDelimiter(noLeadComments)) {
    throw new Error('Multiple statements are not supported.')
  }

  return noLeadComments
}

function hasTopLevelStatementDelimiter(sql: string): boolean {
  let inSingle = false
  let inDouble = false
  let inLineComment = false
  let inBlockComment = false

  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i]
    const next = sql[i + 1]

    if (inLineComment) {
      if (ch === '\n') inLineComment = false
      continue
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false
        i += 1
      }
      continue
    }

    if (inSingle) {
      if (ch === "'" && next === "'") {
        i += 1
        continue
      }
      if (ch === "'") inSingle = false
      continue
    }

    if (inDouble) {
      if (ch === '"' && next === '"') {
        i += 1
        continue
      }
      if (ch === '"') inDouble = false
      continue
    }

    if (ch === '-' && next === '-') {
      inLineComment = true
      i += 1
      continue
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true
      i += 1
      continue
    }
    if (ch === "'") {
      inSingle = true
      continue
    }
    if (ch === '"') {
      inDouble = true
      continue
    }
    if (ch === ';') {
      return true
    }
  }

  return false
}

function stripTrailingSemicolon(sql: string): string {
  return sql.replace(/;\s*$/, '').trim()
}

function ensureFullSqlReturned(sql: string): void {
  const txt = String(sql || '').toLowerCase()
  const bannedPhrases = [
    'same as before',
    'unchanged cte',
    'unchanged ctes',
    'rest omitted',
    'omitted for brevity',
    'use previous query',
    'reuse the previous',
    'existing query remains the same',
  ]
  if (bannedPhrases.some((p) => txt.includes(p))) {
    throw new Error('AI returned an abbreviated SQL response. Full optimized SQL is required.')
  }
  if (/<[^>]*(omitted|same|rest|previous)[^>]*>/i.test(sql)) {
    throw new Error('AI returned placeholder text instead of full SQL.')
  }
}

function shortenForPrompt(text: string, maxChars: number): string {
  if (!text) return ''
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}\n...[truncated for summarization]`
}

async function cortexCompleteText(prompt: string): Promise<string> {
  const model =
    process.env.CORTEX_MODEL || process.env.SNOWFLAKE_CORTEX_MODEL || 'openai-gpt-5-chat'
  const mode = (process.env.CORTEX_MODE || 'focused').toLowerCase()
  const temperature = mode === 'balanced' ? 0.25 : 0.1

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
    // use raw fallback
  }
  return raw
}

function extractJsonObject(rawText: string): Record<string, unknown> | null {
  if (!rawText) return null
  const raw = String(rawText).trim()
  if (!raw) return null

  const candidates: string[] = []
  for (const m of raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) {
    const body = String(m[1] || '').trim()
    if (body) candidates.push(body)
  }
  candidates.push(raw)

  let depth = 0
  let start = -1
  let inStr = false
  let esc = false
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') {
      inStr = true
      continue
    }
    if (ch === '{') {
      if (depth === 0) start = i
      depth += 1
    } else if (ch === '}') {
      if (depth > 0) depth -= 1
      if (depth === 0 && start >= 0) {
        candidates.push(raw.slice(start, i + 1))
        start = -1
      }
    }
  }

  const seen = new Set<string>()
  for (const c0 of candidates) {
    const c = c0.trim()
    if (!c || seen.has(c)) continue
    seen.add(c)
    try {
      const parsed = JSON.parse(c)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    } catch {}
    try {
      const repaired = c.replace(/,\s*([}\]])/g, '$1')
      const parsed = JSON.parse(repaired)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    } catch {}
  }
  return null
}

function sqlQuote(value: string): string {
  return `'${String(value).replace(/'/g, "''")}'`
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

function userFacingOptimizerError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error || 'Failed to optimize query')
  if (msg.includes('SNOWFLAKE.CORTEX.COMPLETE')) {
    return 'Snowflake Cortex optimization call failed. Check Cortex model availability/privileges and retry.'
  }
  return msg
}
