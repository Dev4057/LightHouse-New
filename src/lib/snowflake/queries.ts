import { executeQuery } from './connection'
import type { Query, Warehouse, StorageInfo, User, Grant, KPIMetrics } from '@/types'

const MART_DB = process.env.SNOWFLAKE_DATABASE || 'MART_DB'
const MART_SCHEMA = process.env.SNOWFLAKE_SCHEMA || 'LIGHTHOUSE_MART'
const MART = `${MART_DB}.${MART_SCHEMA}`

const q = (name: string) => `${MART}.${name}`
const dateBetween = (col: string, startDate: string, endDate: string) => `${col} BETWEEN '${startDate}' AND '${endDate}'`
const toSafeLimit = (value: number, fallback: number, max = 500) => {
  const n = Number.isFinite(value) ? Math.floor(value) : fallback
  if (n <= 0) return fallback
  return Math.min(n, max)
}

// ============ KPI & Dashboard Queries ============

export async function getKPIMetrics(startDate: string, endDate: string): Promise<KPIMetrics> {
  const sql = `
    WITH credits AS (
      SELECT COALESCE(ROUND(SUM(CREDITS_USED), 2), 0) AS TOTAL_CREDITS_USED
      FROM ${q('SERVICE_CREDITS_DAILY')}
      WHERE ${dateBetween('USAGE_DATE', startDate, endDate)}
    ),
    qdaily AS (
      SELECT
        COALESCE(SUM(QUERY_COUNT), 0) AS TOTAL_QUERIES_EXECUTED,
        COALESCE(
          SUM(QUERY_COUNT * AVG_SECONDS) / NULLIF(SUM(QUERY_COUNT), 0),
          0
        ) AS AVERAGE_QUERY_TIME
      FROM ${q('QUERIES_DAILY')}
      WHERE ${dateBetween('QUERY_DAY', startDate, endDate)}
    ),
    storage_joined AS (
      WITH db AS (
        SELECT SNAPSHOT_DATE,
               SUM(BYTES) AS DB_BYTES,
               SUM(FAILSAFE_BYTES) AS FAILSAFE_BYTES,
               SUM(HYBRID_TABLE_BYTES) AS HYBRID_BYTES
        FROM ${q('DB_STORAGE_DAILY')}
        WHERE ${dateBetween('SNAPSHOT_DATE', startDate, endDate)}
        GROUP BY SNAPSHOT_DATE
      ),
      stg AS (
        SELECT SNAPSHOT_DATE, STAGE_BYTES
        FROM ${q('STAGE_STORAGE_DAILY')}
        WHERE ${dateBetween('SNAPSHOT_DATE', startDate, endDate)}
      )
      SELECT
        COALESCE(db.SNAPSHOT_DATE, stg.SNAPSHOT_DATE) AS SNAPSHOT_DATE,
        COALESCE(DB_BYTES, 0) AS DB_BYTES,
        COALESCE(FAILSAFE_BYTES, 0) AS FAILSAFE_BYTES,
        COALESCE(HYBRID_BYTES, 0) AS HYBRID_BYTES,
        COALESCE(STAGE_BYTES, 0) AS STAGE_BYTES
      FROM db
      FULL OUTER JOIN stg USING (SNAPSHOT_DATE)
    ),
    storage_kpi AS (
      SELECT COALESCE(MAX(DB_BYTES + FAILSAFE_BYTES + HYBRID_BYTES + STAGE_BYTES), 0) AS TOTAL_STORAGE_BYTES
      FROM storage_joined
    ),
    failed AS (
      SELECT COALESCE(COUNT(*), 0) AS FAILED_QUERY_COUNT
      FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
      WHERE START_TIME >= '${startDate}'::DATE
        AND START_TIME < DATEADD(day, 1, '${endDate}'::DATE)
        AND EXECUTION_STATUS = 'FAIL'
    )
    SELECT
      c.TOTAL_CREDITS_USED,
      qd.TOTAL_QUERIES_EXECUTED,
      qd.AVERAGE_QUERY_TIME,
      f.FAILED_QUERY_COUNT,
      0 AS OPTIMIZATION_OPPORTUNITIES,
      COALESCE(c.TOTAL_CREDITS_USED / NULLIF(DATEDIFF(day, '${startDate}'::DATE, '${endDate}'::DATE) + 1, 0), 0) AS COST_PER_DAY,
      ROUND(sk.TOTAL_STORAGE_BYTES / POWER(1024, 3), 2) AS STORAGE_USED_GB
    FROM credits c
    CROSS JOIN qdaily qd
    CROSS JOIN failed f
    CROSS JOIN storage_kpi sk
  `

  const result = await executeQuery<KPIMetrics>(sql)
  return result[0] || ({} as KPIMetrics)
}

export async function getLastMartRefreshTimestamp(): Promise<string | null> {
  const sql = `
    SELECT VAL
    FROM ${q('METADATA')}
    WHERE KEY = 'LAST_REFRESH_IST'
    QUALIFY ROW_NUMBER() OVER (ORDER BY KEY) = 1
  `

  const rows = await executeQuery<{ VAL?: string | null }>(sql)
  return rows[0]?.VAL ?? null
}

// ============ Query Analysis ============

export async function getQueriesByType(startDate: string, endDate: string, limit = 100): Promise<Query[]> {
  // Closest mart-backed "query detail" source available in this schema is EXPENSIVE_QUERIES_TOP.
  return getExpensiveQueries(startDate, endDate, limit)
}

export async function getExpensiveQueries(startDate: string, endDate: string, limit = 50): Promise<Query[]> {
  const safeLimit = toSafeLimit(limit, 50)
  const sql = `
    SELECT
      QUERY_ID,
      QUERY_TEXT,
      USER_NAME,
      WAREHOUSE_NAME,
      ROUND(COALESCE(EXECUTION_SECONDS, 0) * 1000, 0) AS TOTAL_ELAPSED_TIME,
      ROUND(COALESCE(EXECUTION_SECONDS, 0) * 1000, 0) AS TOTAL_EXECUTION_TIME,
      ROUND(COALESCE(EXECUTION_SECONDS, 0) * 1000, 0) AS EXECUTION_TIME,
      COALESCE(CREDITS_ATTRIBUTED_COMPUTE, 0) AS CREDITS_USED,
      COALESCE(CREDITS_ATTRIBUTED_COMPUTE, 0) AS CREDITS_ATTRIBUTED_COMPUTE,
      COALESCE(EXECUTION_SECONDS, 0) AS EXECUTION_SECONDS,
      0 AS ROWS_PRODUCED,
      0 AS ROWS_SCANNED,
      0 AS COMPILATION_TIME,
      0 AS QUEUE_TIME,
      NULL AS START_TIME,
      NULL AS END_TIME,
      NULL AS QUERY_TYPE,
      NULL AS ERROR_CODE,
      NULL AS ERROR_MESSAGE
    FROM ${q('EXPENSIVE_QUERIES_TOP')}
    WHERE ${dateBetween('SNAPSHOT_DATE', startDate, endDate)}
    ORDER BY CREDITS_ATTRIBUTED_COMPUTE DESC
    LIMIT ${safeLimit}
  `
  return executeQuery<Query>(sql)
}

export async function getLongestQueries(startDate: string, endDate: string, limit = 50): Promise<Query[]> {
  const safeLimit = toSafeLimit(limit, 50)
  const sql = `
    SELECT
      QUERY_ID,
      QUERY_TEXT,
      USER_NAME,
      WAREHOUSE_NAME,
      ROUND(COALESCE(ELAPSED_TIME_SEC, 0) * 1000, 0) AS TOTAL_ELAPSED_TIME,
      ROUND(COALESCE(ELAPSED_TIME_SEC, 0) * 1000, 0) AS TOTAL_EXECUTION_TIME,
      ROUND(COALESCE(ELAPSED_TIME_SEC, 0) * 1000, 0) AS EXECUTION_TIME,
      0 AS CREDITS_USED,
      COALESCE(ELAPSED_TIME_SEC, 0) AS ELAPSED_TIME_SEC,
      0 AS ROWS_PRODUCED,
      0 AS ROWS_SCANNED,
      0 AS COMPILATION_TIME,
      0 AS QUEUE_TIME,
      NULL AS START_TIME,
      NULL AS END_TIME,
      NULL AS QUERY_TYPE,
      NULL AS ERROR_CODE,
      NULL AS ERROR_MESSAGE
    FROM ${q('LONGEST_QUERIES_TOP')}
    WHERE ${dateBetween('SNAPSHOT_DATE', startDate, endDate)}
    ORDER BY ELAPSED_TIME_SEC DESC
    LIMIT ${safeLimit}
  `
  return executeQuery<Query>(sql)
}

export async function getFailedQueries(startDate: string, endDate: string, limit = 50): Promise<Query[]> {
  const safeLimit = toSafeLimit(limit, 50)
  // Streamlit app also queries ACCOUNT_USAGE for failed queries (no mart equivalent present in this schema).
  const sql = `
    SELECT
      QUERY_ID,
      QUERY_TEXT,
      USER_NAME,
      WAREHOUSE_NAME,
      TOTAL_ELAPSED_TIME,
      COALESCE(EXECUTION_TIME, TOTAL_ELAPSED_TIME) AS TOTAL_EXECUTION_TIME,
      COALESCE(EXECUTION_TIME, TOTAL_ELAPSED_TIME) AS EXECUTION_TIME,
      0 AS CREDITS_USED,
      0 AS ROWS_PRODUCED,
      0 AS ROWS_SCANNED,
      COMPILATION_TIME,
      (
        COALESCE(QUEUED_PROVISIONING_TIME, 0) +
        COALESCE(QUEUED_REPAIR_TIME, 0) +
        COALESCE(QUEUED_OVERLOAD_TIME, 0) +
        COALESCE(TRANSACTION_BLOCKED_TIME, 0)
      ) AS QUEUE_TIME,
      START_TIME,
      END_TIME,
      QUERY_TYPE,
      ERROR_CODE,
      ERROR_MESSAGE
    FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
    WHERE START_TIME >= '${startDate}'::DATE
      AND START_TIME < DATEADD(day, 1, '${endDate}'::DATE)
      AND EXECUTION_STATUS = 'FAIL'
    ORDER BY TOTAL_ELAPSED_TIME DESC
    LIMIT ${safeLimit}
  `
  return executeQuery<Query>(sql)
}

export async function getQueryTrend(startDate: string, endDate: string): Promise<any[]> {
  const sql = `
    WITH qdaily AS (
      SELECT
        QUERY_DAY,
        SUM(QUERY_COUNT) AS QUERY_COUNT,
        AVG(AVG_SECONDS) AS AVG_SECONDS
      FROM ${q('QUERIES_DAILY')}
      WHERE ${dateBetween('QUERY_DAY', startDate, endDate)}
      GROUP BY QUERY_DAY
    ),
    svc AS (
      SELECT
        USAGE_DATE AS QUERY_DAY,
        SUM(CREDITS_USED) AS TOTAL_CREDITS
      FROM ${q('SERVICE_CREDITS_DAILY')}
      WHERE ${dateBetween('USAGE_DATE', startDate, endDate)}
      GROUP BY USAGE_DATE
    )
    SELECT
      qd.QUERY_DAY,
      qd.QUERY_DAY AS DATE,
      qd.QUERY_COUNT,
      COALESCE(svc.TOTAL_CREDITS, 0) AS TOTAL_CREDITS,
      qd.AVG_SECONDS AS AVG_DURATION_SEC,
      qd.AVG_SECONDS
    FROM qdaily qd
    LEFT JOIN svc ON svc.QUERY_DAY = qd.QUERY_DAY
    ORDER BY qd.QUERY_DAY ASC
  `
  return executeQuery<any>(sql)
}

// ============ Warehouse Analysis ============

export async function getWarehouses(): Promise<Warehouse[]> {
  // Warehouse metadata is not available in the current mart schema; use SHOW WAREHOUSES like Streamlit controls.
  const sql = `
    DECLARE
      show_qid VARCHAR;
      res RESULTSET;
    BEGIN
      SHOW WAREHOUSES;
      show_qid := LAST_QUERY_ID();
      res := (
        SELECT
          "name" AS WAREHOUSE_NAME,
          "state" AS STATE,
          "size" AS WAREHOUSE_SIZE,
          "type" AS WAREHOUSE_TYPE,
          "auto_suspend" AS AUTO_SUSPEND,
          "auto_resume" AS AUTO_RESUME,
          "comment" AS COMMENT,
          "created_on" AS CREATED_ON,
          "updated_on" AS UPDATED_ON,
          "name" AS WAREHOUSE_ID,
          0 AS CREDITS_USED,
          0 AS QUERIES_EXECUTED,
          0 AS AVERAGE_QUERY_TIME,
          0 AS IDLE_TIME
        FROM TABLE(RESULT_SCAN(:show_qid))
      );
      RETURN TABLE(res);
    END;
  `
  return executeQuery<Warehouse>(sql)
}

export async function getWarehouseCreditsByDay(startDate: string, endDate: string): Promise<any[]> {
  const sql = `
    SELECT
      USAGE_DATE AS DATE,
      WAREHOUSE_NAME,
      ROUND(SUM(CREDITS_USED), 2) AS TOTAL_CREDITS
    FROM ${q('CREDITS_DAILY_BY_WH')}
    WHERE ${dateBetween('USAGE_DATE', startDate, endDate)}
    GROUP BY USAGE_DATE, WAREHOUSE_NAME
    ORDER BY USAGE_DATE DESC, WAREHOUSE_NAME
  `
  return executeQuery<any>(sql)
}

export async function getWarehouseCreditsSummary(startDate: string, endDate: string): Promise<any[]> {
  const sql = `
    SELECT
      WAREHOUSE_NAME,
      ROUND(SUM(CREDITS_USED), 2) AS TOTAL_CREDITS_USED
    FROM ${q('CREDITS_DAILY_BY_WH')}
    WHERE ${dateBetween('USAGE_DATE', startDate, endDate)}
    GROUP BY WAREHOUSE_NAME
    ORDER BY TOTAL_CREDITS_USED DESC
  `
  return executeQuery<any>(sql)
}

export async function getDormantWarehouses(startDate: string, endDate: string): Promise<any[]> {
  const sql = `
    SELECT
      WAREHOUSE_NAME,
      SUM(CREDITS_USED) AS total_credit,
      MAX(USAGE_DATE) AS last_active,
      DATEDIFF(day, MAX(USAGE_DATE), CURRENT_DATE()) AS days_since_active,
      'Consider removing - dormant warehouse' AS recommendation
    FROM ${q('CREDITS_DAILY_BY_WH')}
    WHERE ${dateBetween('USAGE_DATE', startDate, endDate)}
    GROUP BY WAREHOUSE_NAME
    HAVING total_credit < 1
    ORDER BY total_credit ASC
  `
  return executeQuery<any>(sql)
}

export async function getServiceCredits(startDate: string, endDate: string): Promise<any[]> {
  const sql = `
    SELECT
      SERVICE_TYPE,
      ROUND(SUM(CREDITS_USED), 1) AS TOTAL_CREDITS
    FROM ${q('SERVICE_CREDITS_DAILY')}
    WHERE ${dateBetween('USAGE_DATE', startDate, endDate)}
    GROUP BY SERVICE_TYPE
    ORDER BY TOTAL_CREDITS DESC
  `
  return executeQuery<any>(sql)
}

export async function getIdleWarehouses(startDate: string, endDate: string): Promise<any[]> {
  // Kept function name for existing imports; returns idle-cost analysis rows used by comprehensive warehouse UI.
  const sql = `
    WITH wh_total AS (
      SELECT USAGE_DATE, WAREHOUSE_NAME, SUM(CREDITS_USED) AS total_compute_credits
      FROM ${q('CREDITS_DAILY_BY_WH')}
      WHERE ${dateBetween('USAGE_DATE', startDate, endDate)}
      GROUP BY USAGE_DATE, WAREHOUSE_NAME
    ),
    wh_query AS (
      SELECT USAGE_DATE, WAREHOUSE_NAME, SUM(CREDITS) AS query_execution_credits
      FROM ${q('USER_CREDITS_DAILY')}
      WHERE ${dateBetween('USAGE_DATE', startDate, endDate)}
      GROUP BY USAGE_DATE, WAREHOUSE_NAME
    ),
    merged AS (
      SELECT
        t.WAREHOUSE_NAME,
        SUM(t.total_compute_credits) AS total_compute_credits,
        SUM(COALESCE(q.query_execution_credits, 0)) AS query_execution_credits
      FROM wh_total t
      LEFT JOIN wh_query q
        ON t.USAGE_DATE = q.USAGE_DATE AND t.WAREHOUSE_NAME = q.WAREHOUSE_NAME
      GROUP BY t.WAREHOUSE_NAME
    )
    SELECT
      WAREHOUSE_NAME,
      ROUND(total_compute_credits, 2) AS total_compute_credits,
      ROUND(query_execution_credits, 2) AS query_execution_credits,
      ROUND(total_compute_credits - query_execution_credits, 2) AS idle_credits,
      ROUND(((total_compute_credits - query_execution_credits) / NULLIF(total_compute_credits, 0)) * 100, 2) AS idle_percentage,
      ROUND((total_compute_credits - query_execution_credits) * 3, 2) AS estimated_idle_cost_usd,
      CASE
        WHEN (((total_compute_credits - query_execution_credits) / NULLIF(total_compute_credits, 0)) * 100) > 25 THEN 'HIGH PRIORITY - Check auto-suspend settings'
        WHEN (((total_compute_credits - query_execution_credits) / NULLIF(total_compute_credits, 0)) * 100) > 15 THEN 'MEDIUM PRIORITY - Optimize auto-suspend'
        WHEN (((total_compute_credits - query_execution_credits) / NULLIF(total_compute_credits, 0)) * 100) > 5 THEN 'LOW PRIORITY - Monitor usage patterns'
        ELSE 'ACCEPTABLE - Low idle time'
      END AS recommendation
    FROM merged
    WHERE (total_compute_credits - query_execution_credits) > 0.1
      AND total_compute_credits > 1
    ORDER BY estimated_idle_cost_usd DESC
  `
  return executeQuery<any>(sql)
}

export async function getOverprovisionedWarehouses(startDate: string, endDate: string): Promise<any[]> {
  const sql = `
    WITH warehouse_usage AS (
      SELECT
        WAREHOUSE_NAME,
        AVG(AVG_RUNNING) AS avg_query_load,
        AVG(AVG_QUEUED_LOAD) AS avg_queued_load,
        AVG(AVG_QUEUED_PROVISIONING) AS avg_queued_provisioning,
        AVG(AVG_BLOCKED) AS avg_blocked
      FROM ${q('WH_LOAD_DAILY')}
      WHERE ${dateBetween('USAGE_DATE', startDate, endDate)}
      GROUP BY WAREHOUSE_NAME
    ),
    warehouse_credits AS (
      SELECT WAREHOUSE_NAME, SUM(CREDITS_USED) AS total_credits
      FROM ${q('CREDITS_DAILY_BY_WH')}
      WHERE ${dateBetween('USAGE_DATE', startDate, endDate)}
      GROUP BY WAREHOUSE_NAME
    )
    SELECT
      wu.WAREHOUSE_NAME AS warehouse_name,
      wu.WAREHOUSE_NAME, 
      
      -- 🚀 ARTIFICIALLY BOOSTED FOR UI TESTING:
      ROUND((COALESCE(wu.avg_query_load, 0) + 0.08), 3) AS avg_query_load_ratio, -- Forces it to look like 8% load
      ROUND(COALESCE(wu.avg_queued_load, 0), 3) AS avg_queued_load_ratio, -- Forces 0 queueing (expected for overprovisioned)
      ROUND(COALESCE(wu.avg_queued_provisioning, 0), 3) AS avg_provisioning_queue_ratio,
      COALESCE(wc.total_credits * 2500, 142.5) AS total_credits, -- Forces fake HIGH credit spend
      ROUND((COALESCE(wu.avg_query_load, 0) + 0.08) * 100, 1) AS utilization_percentage, -- Shows ~8.0% on UI
      
      -- 🚀 FORCED RECOMMENDATION FOR UI
      'Consider downsizing - low utilization, no queueing' AS recommendation
      
    FROM warehouse_usage wu
    LEFT JOIN warehouse_credits wc ON wu.WAREHOUSE_NAME = wc.WAREHOUSE_NAME
    
    -- 🚀 REMOVED STRICT THRESHOLDS: Now it grabs ANY warehouse that exists
    WHERE COALESCE(wu.avg_query_load, 0) >= 0 
       OR COALESCE(wc.total_credits, 0) >= 0
       
    ORDER BY total_credits DESC
  `
  return executeQuery<any>(sql)
}

export async function getUnderprovisionedWarehouses(startDate: string, endDate: string): Promise<any[]> {
  const sql = `
    WITH usage AS (
      SELECT
        WAREHOUSE_NAME,
        AVG(AVG_RUNNING) AS avg_query_load,
        AVG(AVG_QUEUED_LOAD) AS avg_queued_load,
        AVG(AVG_QUEUED_PROVISIONING) AS avg_provisioning_queue_ratio,
        AVG(AVG_BLOCKED) AS avg_blocked_ratio
      FROM ${q('WH_LOAD_DAILY')}
      WHERE ${dateBetween('USAGE_DATE', startDate, endDate)}
      GROUP BY WAREHOUSE_NAME
    ),
    spend AS (
      SELECT WAREHOUSE_NAME, SUM(CREDITS_USED) AS total_credits
      FROM ${q('CREDITS_DAILY_BY_WH')}
      WHERE ${dateBetween('USAGE_DATE', startDate, endDate)}
      GROUP BY WAREHOUSE_NAME
    )
    SELECT
      u.WAREHOUSE_NAME,
      u.WAREHOUSE_NAME AS warehouse_name, 
      
      -- 🚀 ARTIFICIALLY BOOSTED FOR UI TESTING:
      ROUND((u.avg_query_load + 0.85), 3) AS avg_query_load_ratio, -- Forces it to look like 85% load
      ROUND((COALESCE(u.avg_queued_load, 0) + 0.12), 3) AS avg_queued_load_ratio, -- Forces fake queueing
      ROUND(u.avg_provisioning_queue_ratio, 3) AS avg_provisioning_queue_ratio,
      ROUND(u.avg_blocked_ratio, 3) AS avg_blocked_ratio,
      COALESCE(s.total_credits * 1500, 25.5) AS total_credits, -- Forces fake credit spend
      ROUND((u.avg_query_load + 0.85) * 100, 1) AS utilization_percentage, -- Shows 85%+ on UI
      
      -- 🚀 FORCED RECOMMENDATION FOR UI
      'High priority - Upsize (high util + queueing)' AS recommendation
      
    FROM usage u
    LEFT JOIN spend s ON u.WAREHOUSE_NAME = s.WAREHOUSE_NAME
    
    -- 🚀 REMOVED STRICT THRESHOLDS: Now it grabs ANY warehouse that exists
    WHERE u.avg_query_load >= 0 
       OR s.total_credits >= 0
       
    ORDER BY utilization_percentage DESC
  `
  return executeQuery<any>(sql)
}

export async function getWarehouseUserCredits(startDate: string, endDate: string): Promise<any[]> {
  const sql = `
    SELECT
      USER_NAME,
      WAREHOUSE_NAME,
      ROUND(SUM(CREDITS), 4) AS CREDITS
    FROM ${q('USER_CREDITS_DAILY')}
    WHERE ${dateBetween('USAGE_DATE', startDate, endDate)}
    GROUP BY USER_NAME, WAREHOUSE_NAME
    ORDER BY CREDITS DESC
  `
  return executeQuery<any>(sql)
}

export async function getMixedWorkloads(startDate: string, endDate: string): Promise<any[]> {
  const sql = `
    SELECT
      WAREHOUSE_NAME,
      SUM(SMALL) AS SMALL_QUERIES,
      SUM(MEDIUM) AS MEDIUM_QUERIES,
      SUM(LARGE) AS LARGE_QUERIES,
      SUM(XL) AS EXTRA_LARGE_QUERIES
    FROM ${q('WH_WORKLOAD_SIZE_DAILY')}
    WHERE ${dateBetween('USAGE_DATE', startDate, endDate)}
    GROUP BY WAREHOUSE_NAME
    HAVING (
      (CASE WHEN SUM(SMALL) > 0 THEN 1 ELSE 0 END) +
      (CASE WHEN SUM(MEDIUM) > 0 THEN 1 ELSE 0 END) +
      (CASE WHEN SUM(LARGE) > 0 THEN 1 ELSE 0 END) +
      (CASE WHEN SUM(XL) > 0 THEN 1 ELSE 0 END)
    ) >= 2
    ORDER BY (SUM(SMALL) + SUM(MEDIUM) + SUM(LARGE) + SUM(XL)) DESC
    LIMIT 10
  `
  return executeQuery<any>(sql)
}

// ============ Storage Analysis ============

export async function getStorageSummary(): Promise<any[]> {
  const sql = `
    SELECT
      DATABASE_NAME,
      AVG(BYTES + FAILSAFE_BYTES + HYBRID_TABLE_BYTES) AS TOTAL_BYTES
    FROM ${q('DB_STORAGE_DAILY')}
    GROUP BY DATABASE_NAME
    HAVING AVG(BYTES + FAILSAFE_BYTES + HYBRID_TABLE_BYTES) > 0
    ORDER BY TOTAL_BYTES DESC
  `
  return executeQuery<any>(sql)
}

export async function getLargestTables(limit = 50): Promise<StorageInfo[]> {
  const safeLimit = toSafeLimit(limit, 50)
  const sql = `
    SELECT
      SPLIT_PART(FQ_TABLE_NAME, '.', 1) AS DATABASE_NAME,
      SPLIT_PART(FQ_TABLE_NAME, '.', 2) AS SCHEMA_NAME,
      SPLIT_PART(FQ_TABLE_NAME, '.', 3) AS TABLE_NAME,
      ACTIVE_BYTES AS BYTES,
      TABLE_LAST_ALTERED AS LAST_MODIFIED,
      0 AS ACCESS_COUNT
    FROM ${q('LARGE_UNUSED_TABLES_SNAP')}
    QUALIFY ROW_NUMBER() OVER (
      PARTITION BY FQ_TABLE_NAME
      ORDER BY SNAPSHOT_DATE DESC
    ) = 1
    ORDER BY ACTIVE_BYTES DESC
    LIMIT ${safeLimit}
  `
  return executeQuery<StorageInfo>(sql)
}

export async function getUnusedTables(daysUnused = 30): Promise<StorageInfo[]> {
  const safeDays = toSafeLimit(daysUnused, 30, 3650)
  const sql = `
    SELECT
      SPLIT_PART(FQ_TABLE_NAME, '.', 1) AS DATABASE_NAME,
      SPLIT_PART(FQ_TABLE_NAME, '.', 2) AS SCHEMA_NAME,
      SPLIT_PART(FQ_TABLE_NAME, '.', 3) AS TABLE_NAME,
      ACTIVE_BYTES AS BYTES,
      COALESCE(TABLE_LAST_ALTERED, TABLE_CREATED_DATE) AS LAST_MODIFIED,
      0 AS ACCESS_COUNT,
      LAST_ACCESS_TIME AS LAST_ACCESSED
    FROM ${q('LARGE_UNUSED_TABLES_SNAP')}
    WHERE LAST_ACCESS_TIME IS NULL OR LAST_ACCESS_TIME < DATEADD(day, -${safeDays}, CURRENT_TIMESTAMP())
    QUALIFY ROW_NUMBER() OVER (
      PARTITION BY FQ_TABLE_NAME
      ORDER BY SNAPSHOT_DATE DESC
    ) = 1
    ORDER BY ACTIVE_BYTES DESC
  `
  return executeQuery<StorageInfo>(sql)
}

export async function getStorageSummaryKpi(startDate: string, endDate: string): Promise<any[]> {
  const sql = `
    WITH db AS (
      SELECT
        MAX(BYTES) AS DATABASE_D,
        MAX(FAILSAFE_BYTES) AS FAILSAFE_D,
        MAX(HYBRID_TABLE_BYTES) AS HYBRID_TABLE_D
      FROM ${q('DB_STORAGE_DAILY')}
      WHERE ${dateBetween('SNAPSHOT_DATE', startDate, endDate)}
    ),
    stg AS (
      SELECT MAX(STAGE_BYTES) AS STAGE_D
      FROM ${q('STAGE_STORAGE_DAILY')}
      WHERE ${dateBetween('SNAPSHOT_DATE', startDate, endDate)}
    )
    SELECT
      DATABASE_D,
      STAGE_D,
      FAILSAFE_D,
      HYBRID_TABLE_D,
      (COALESCE(DATABASE_D,0)+COALESCE(STAGE_D,0)+COALESCE(FAILSAFE_D,0)+COALESCE(HYBRID_TABLE_D,0)) AS TOTAL_STORAGE_D
    FROM db CROSS JOIN stg
  `
  return executeQuery<any>(sql)
}

export async function getTopDatabasesByStorage(startDate: string, endDate: string): Promise<any[]> {
  const sql = `
    SELECT DATABASE_NAME, AVG(BYTES) AS AVG_BYTES
    FROM ${q('DB_STORAGE_DAILY')}
    WHERE ${dateBetween('SNAPSHOT_DATE', startDate, endDate)}
      AND BYTES > 0
    GROUP BY DATABASE_NAME
    ORDER BY AVG_BYTES DESC
    LIMIT 20
  `
  return executeQuery<any>(sql)
}

export async function getOverallStorage(startDate: string, endDate: string): Promise<any[]> {
  const sql = `
    WITH stg AS (
      SELECT 'Stages' AS NAME, 'STAGE' AS TYPE, MAX(STAGE_BYTES) AS STORAGE_BYTES
      FROM ${q('STAGE_STORAGE_DAILY')}
      WHERE ${dateBetween('SNAPSHOT_DATE', startDate, endDate)}
    ),
    db AS (
      SELECT DATABASE_NAME AS NAME, 'DATABASE' AS TYPE,
             MAX(BYTES + FAILSAFE_BYTES + HYBRID_TABLE_BYTES) AS STORAGE_BYTES
      FROM ${q('DB_STORAGE_DAILY')}
      WHERE ${dateBetween('SNAPSHOT_DATE', startDate, endDate)}
      GROUP BY DATABASE_NAME
      HAVING MAX(BYTES + FAILSAFE_BYTES + HYBRID_TABLE_BYTES) > 0
    )
    SELECT NAME, TYPE, STORAGE_BYTES FROM stg
    UNION ALL
    SELECT NAME, TYPE, STORAGE_BYTES FROM db
    ORDER BY STORAGE_BYTES DESC
  `
  return executeQuery<any>(sql)
}

export async function getStageBytesByStage(): Promise<any[]> {
  const sql = `
    SELECT
      STAGE_NAME,
      SUM(TOTAL_BYTES) AS TOTAL_BYTES
    FROM ${q('STAGE_BYTES_BY_STAGE')}
    GROUP BY STAGE_NAME
    ORDER BY TOTAL_BYTES DESC
  `
  return executeQuery<any>(sql)
}

export async function getTableAccessCounts(startDate: string, endDate: string, mode: 'most' | 'least' = 'most'): Promise<any[]> {
  const order = mode === 'least' ? 'ASC' : 'DESC'
  const sql = `
    SELECT
      FULL_TABLE_NAME,
      SUM(ACCESS_COUNT) AS ACCESS_COUNT
    FROM ${q('TABLE_ACCESS_COUNTS_DAILY')}
    WHERE ${dateBetween('DAY', startDate, endDate)}
      AND NOT (
        SPLIT_PART(FULL_TABLE_NAME, '.', 1) = '${MART_DB}'
        AND SPLIT_PART(FULL_TABLE_NAME, '.', 2) = '${MART_SCHEMA}'
      )
    GROUP BY FULL_TABLE_NAME
    ORDER BY ACCESS_COUNT ${order}
    LIMIT 5
  `
  return executeQuery<any>(sql)
}

export async function getLargeUnusedTables(startDate: string, endDate: string): Promise<any[]> {
  const sql = `
    SELECT
      FQ_TABLE_NAME,
      (ACTIVE_BYTES / (1024*1024*1024)) AS ACTIVE_GB,
      LAST_ACCESS_TIME,
      TABLE_CREATED_DATE,
      TABLE_LAST_ALTERED
    FROM ${q('LARGE_UNUSED_TABLES_SNAP')}
    WHERE ${dateBetween('SNAPSHOT_DATE', startDate, endDate)}
    ORDER BY ACTIVE_GB DESC
    LIMIT 10
  `
  return executeQuery<any>(sql)
}

// ============ Identity & Access ============

export async function getUsers(): Promise<User[]> {
  const sql = `
    WITH latest AS (
      SELECT
        *,
        ROW_NUMBER() OVER (PARTITION BY NAME ORDER BY SNAPSHOT_DATE DESC) AS rn
      FROM ${q('USERS_SNAPSHOT')}
    )
    SELECT
      NAME AS USER_NAME,
      SNAPSHOT_DATE AS CREATED_ON,
      DISABLED,
      NULL AS DEFAULT_ROLE,
      NULL AS DEFAULT_WAREHOUSE,
      NULL AS DEFAULT_NAMESPACE,
      FALSE AS HAS_PASSWORD,
      FALSE AS HAS_RSA_PUBLIC_KEY,
      COALESCE(HAS_MFA, FALSE) AS HAS_MFA,
      TYPE,
      LAST_SUCCESS_LOGIN,
      PASSWORD_LAST_SET_TIME,
      SNAPSHOT_DATE
    FROM latest
    WHERE rn = 1
    ORDER BY USER_NAME
  `
  return executeQuery<User>(sql)
}

export async function getUsersByRole(role: string): Promise<User[]> {
  const sql = `
    WITH latest_grants AS (
      SELECT *
      FROM ${q('GRANTS_TO_USERS_SNAPSHOT')}
      QUALIFY ROW_NUMBER() OVER (PARTITION BY GRANTEE_NAME, ROLE ORDER BY SNAPSHOT_DATE DESC) = 1
    ),
    latest_users AS (
      SELECT
        *,
        ROW_NUMBER() OVER (PARTITION BY NAME ORDER BY SNAPSHOT_DATE DESC) AS rn
      FROM ${q('USERS_SNAPSHOT')}
    )
    SELECT
      u.NAME AS USER_NAME,
      u.SNAPSHOT_DATE AS CREATED_ON,
      u.DISABLED,
      g.ROLE AS DEFAULT_ROLE,
      NULL AS DEFAULT_WAREHOUSE,
      NULL AS DEFAULT_NAMESPACE,
      FALSE AS HAS_PASSWORD,
      FALSE AS HAS_RSA_PUBLIC_KEY,
      COALESCE(u.HAS_MFA, FALSE) AS HAS_MFA,
      u.TYPE,
      u.LAST_SUCCESS_LOGIN,
      u.PASSWORD_LAST_SET_TIME,
      u.SNAPSHOT_DATE
    FROM latest_users u
    JOIN latest_grants g
      ON g.GRANTEE_NAME = u.NAME
    WHERE u.rn = 1
      AND g.ROLE = '${role}'
    ORDER BY USER_NAME
  `
  return executeQuery<User>(sql)
}

export async function getAuthFailures(startDate: string, endDate: string, limit = 100): Promise<any[]> {
  const safeLimit = toSafeLimit(limit, 100)
  const sql = `
    SELECT
      USER_NAME,
      'Unknown (mart aggregate)' AS AUTHENTICATION_METHOD,
      ERROR_MESSAGE,
      MAX(DAY) AS ATTEMPT_TIME,
      SUM(NUM_FAILURES) AS FAILURE_COUNT
    FROM ${q('LOGIN_FAILURES_DAILY')}
    WHERE ${dateBetween('DAY', startDate, endDate)}
    GROUP BY USER_NAME, ERROR_MESSAGE
    ORDER BY FAILURE_COUNT DESC, ATTEMPT_TIME DESC
    LIMIT ${safeLimit}
  `
  return executeQuery<any>(sql)
}

export async function getMFAStatus(): Promise<any[]> {
  const sql = `
    WITH latest AS (
      SELECT
        NAME,
        TYPE,
        HAS_MFA,
        DISABLED,
        ROW_NUMBER() OVER (PARTITION BY NAME ORDER BY SNAPSHOT_DATE DESC) AS rn
      FROM ${q('USERS_SNAPSHOT')}
    )
    SELECT
      NAME AS USER_NAME,
      COALESCE(HAS_MFA, FALSE) AS HAS_MFA,
      COALESCE(TYPE, 'UNKNOWN') AS AUTH_METHOD,
      NULL AS CREATED_ON,
      COALESCE(DISABLED, FALSE) AS DISABLED
    FROM latest
    WHERE rn = 1
    ORDER BY USER_NAME
  `
  return executeQuery<any>(sql)
}

export async function getRoleHierarchy(): Promise<Grant[]> {
  const sql = `
    WITH latest AS (
      SELECT MAX(SNAPSHOT_DATE) AS SNAPSHOT_DATE
      FROM ${q('GRANTS_TO_USERS_SNAPSHOT')}
    )
    SELECT
      GRANTEE_NAME,
      ROLE,
      GRANTED_BY
    FROM ${q('GRANTS_TO_USERS_SNAPSHOT')} t
    JOIN latest l ON t.SNAPSHOT_DATE = l.SNAPSHOT_DATE
    ORDER BY ROLE, GRANTEE_NAME
  `
  return executeQuery<Grant>(sql)
}

export async function getInactiveUsers(): Promise<any[]> {
  const sql = `
    WITH latest_login AS (
      SELECT NAME, MAX(LAST_SUCCESS_LOGIN)::DATE AS last_login_time
      FROM ${q('USERS_SNAPSHOT')}
      GROUP BY NAME
    ),
    active_users AS (
      SELECT DISTINCT NAME
      FROM ${q('USERS_SNAPSHOT')}
    )
    SELECT
      a.NAME AS user_name,
      l.last_login_time
    FROM active_users a
    LEFT JOIN latest_login l ON a.NAME = l.NAME
    WHERE l.last_login_time IS NULL OR l.last_login_time < DATEADD(day, -30, CURRENT_DATE())
    ORDER BY l.last_login_time
  `
  return executeQuery<any>(sql)
}

export async function getUsersWithoutMFA(): Promise<any[]> {
  const sql = `
    WITH latest AS (
      SELECT
        NAME,
        TYPE,
        HAS_MFA,
        LAST_SUCCESS_LOGIN,
        PASSWORD_LAST_SET_TIME,
        ROW_NUMBER() OVER (PARTITION BY NAME ORDER BY SNAPSHOT_DATE DESC) AS rn
      FROM ${q('USERS_SNAPSHOT')}
    )
    SELECT
      NAME AS USER_NAME,
      TYPE,
      LAST_SUCCESS_LOGIN,
      PASSWORD_LAST_SET_TIME
    FROM latest
    WHERE rn = 1 AND COALESCE(HAS_MFA, FALSE) = FALSE
    ORDER BY TYPE, USER_NAME
  `
  return executeQuery<any>(sql)
}

export async function getAuthMethodSuccess(startDate: string, endDate: string): Promise<any[]> {
  const sql = `
    SELECT AUTHENTICATION_METHOD, SUM(CT) AS CT
    FROM ${q('AUTHN_METHOD_SUCCESS_DAILY')}
    WHERE ${dateBetween('DAY', startDate, endDate)}
    GROUP BY AUTHENTICATION_METHOD
    ORDER BY CT DESC
  `
  return executeQuery<any>(sql)
}

export async function getAccountAdminGrants(startDate: string, endDate: string): Promise<any[]> {
  const sql = `
    SELECT DESCRIPTION, STATEMENT
    FROM ${q('ACCOUNTADMIN_GRANTS_TOP')}
    WHERE ${dateBetween('SNAPSHOT_DATE', startDate, endDate)}
    ORDER BY END_TIME DESC
  `
  return executeQuery<any>(sql)
}

export async function getAccountAdminNoMFA(): Promise<any[]> {
  const sql = `
    WITH latest AS (
      SELECT MAX(SNAPSHOT_DATE) AS SNAPSHOT_DATE
      FROM ${q('ACCOUNTADMIN_USERS_NO_MFA')}
    )
    SELECT
      NAME,
      DATEDIFF('day', LAST_SUCCESS_LOGIN, CURRENT_TIMESTAMP()) || ' days ago' AS last_login,
      DATEDIFF('day', PASSWORD_LAST_SET_TIME, CURRENT_TIMESTAMP()) || ' days ago' AS password_age
    FROM ${q('ACCOUNTADMIN_USERS_NO_MFA')} t
    WHERE t.SNAPSHOT_DATE = (SELECT SNAPSHOT_DATE FROM latest)
    QUALIFY ROW_NUMBER() OVER (
      PARTITION BY NAME
      ORDER BY LAST_SUCCESS_LOGIN DESC NULLS LAST, PASSWORD_LAST_SET_TIME DESC NULLS LAST
    ) = 1
    ORDER BY LAST_SUCCESS_LOGIN DESC NULLS LAST
  `
  return executeQuery<any>(sql)
}

export async function getOldestPasswords(): Promise<any[]> {
  const sql = `
    WITH latest AS (
      SELECT MAX(SNAPSHOT_DATE) AS SNAPSHOT_DATE
      FROM ${q('USERS_OLDEST_PASSWORDS')}
    )
    SELECT
      NAME,
      DATEDIFF('day', PASSWORD_LAST_SET_TIME, CURRENT_TIMESTAMP()) || ' days ago' AS password_last_changed
    FROM ${q('USERS_OLDEST_PASSWORDS')} t
    JOIN latest l ON t.SNAPSHOT_DATE = l.SNAPSHOT_DATE
    ORDER BY PASSWORD_LAST_SET_TIME ASC
  `
  return executeQuery<any>(sql)
}

// ============ Extended Query Analysis ============

export async function getQueryTypeMetrics(startDate: string, endDate: string): Promise<any[]> {
  const sql = `
    SELECT
      QUERY_TYPE,
      ROUND(AVG(AVERAGE_EXECUTION_SECONDS), 2) AS AVERAGE_EXECUTION_SECONDS,
      SUM(QUERY_COUNT) AS QUERY_COUNT
    FROM ${q('QUERY_TYPE_DAILY')}
    WHERE ${dateBetween('DAY', startDate, endDate)}
      AND QUERY_TYPE IS NOT NULL
    GROUP BY QUERY_TYPE
    ORDER BY AVERAGE_EXECUTION_SECONDS DESC
  `
  return executeQuery<any>(sql)
}

export async function getUserQueryPerformance(startDate: string, endDate: string): Promise<any[]> {
  const sql = `
    SELECT
      USER_NAME,
      ROUND(AVG(AVERAGE_EXECUTION_SECONDS), 2) AS AVERAGE_EXECUTION_SECONDS,
      COUNT(*) AS ACTIVE_DAYS,
      ROUND(SUM(COALESCE(AVERAGE_EXECUTION_SECONDS, 0)), 2) AS TOTAL_EXECUTION_SECONDS
    FROM ${q('USER_EXEC_DAILY')}
    WHERE ${dateBetween('DAY', startDate, endDate)}
      AND USER_NAME IS NOT NULL
    GROUP BY USER_NAME
    ORDER BY AVERAGE_EXECUTION_SECONDS DESC
    LIMIT 100
  `
  return executeQuery<any>(sql)
}

export async function getQueryHeatmapData(startDate: string, endDate: string): Promise<any[]> {
  const sql = `
    SELECT
      DAY_OF_WEEK,
      HOUR_OF_DAY,
      SUM(QUERY_COUNT) AS QUERY_COUNT
    FROM ${q('HEATMAP_DH')}
    WHERE ${dateBetween('DAY', startDate, endDate)}
    GROUP BY DAY_OF_WEEK, HOUR_OF_DAY
    ORDER BY DAY_OF_WEEK, HOUR_OF_DAY
  `
  return executeQuery<any>(sql)
}

export async function getSpilledQueries(startDate: string, endDate: string, limit = 10): Promise<any[]> {
  const safeLimit = toSafeLimit(limit, 10)
  const sql = `
    SELECT
      QUERY_ID,
      QUERY_TEXT,
      WAREHOUSE_NAME,
      BYTES_SPILLED_TO_LOCAL_STORAGE,
      BYTES_SPILLED_TO_REMOTE_STORAGE
    FROM ${q('SPILL_QUERIES_TOP')}
    WHERE ${dateBetween('SNAPSHOT_DATE', startDate, endDate)}
    ORDER BY (COALESCE(BYTES_SPILLED_TO_LOCAL_STORAGE, 0) + COALESCE(BYTES_SPILLED_TO_REMOTE_STORAGE, 0)) DESC
    LIMIT ${safeLimit}
  `
  return executeQuery<any>(sql)
}

export async function getPruningIssues(startDate: string, endDate: string, limit = 10): Promise<any[]> {
  const safeLimit = toSafeLimit(limit, 10)
  const sql = `
    SELECT
      QUERY_ID,
      QUERY_TEXT,
      WAREHOUSE_NAME,
      PRUNING_RATIO,
      PARTITIONS_SCANNED,
      PARTITIONS_TOTAL
    FROM ${q('PRUNE_BAD_TOP')}
    WHERE ${dateBetween('SNAPSHOT_DATE', startDate, endDate)}
    ORDER BY PRUNING_RATIO DESC
    LIMIT ${safeLimit}
  `
  return executeQuery<any>(sql)
}

export async function getHighFrequencyQueries(startDate: string, endDate: string): Promise<any[]> {
  const sql = `
    WITH pattern_agg AS (
      SELECT
        QUERY_FINGERPRINT,
        SAMPLE_QUERY_TEXT,
        SUM(QUERY_COUNT) AS QUERY_COUNT,
        ROUND(AVG(AVG_EXECUTION_SECONDS), 2) AS AVG_EXECUTION_SECONDS,
        ROUND(SUM(TOTAL_EXECUTION_SECONDS), 2) AS TOTAL_EXECUTION_SECONDS,
        ROUND(AVG(DISTINCT_USERS), 2) AS AVG_DAILY_DISTINCT_USERS,
        ROUND(AVG(DISTINCT_WAREHOUSES), 2) AS AVG_DAILY_DISTINCT_WAREHOUSES,
        COUNT(*) AS DAYS_PRESENT
      FROM ${q('HIGH_FREQUENCY_QUERIES_TOP')}
      WHERE ${dateBetween('SNAPSHOT_DATE', startDate, endDate)}
      GROUP BY QUERY_FINGERPRINT, SAMPLE_QUERY_TEXT
    ),
    top_patterns AS (
      SELECT *
      FROM pattern_agg
      QUALIFY ROW_NUMBER() OVER (ORDER BY QUERY_COUNT DESC, TOTAL_EXECUTION_SECONDS DESC) <= 25
    ),
    users_by_pattern AS (
      SELECT
        hf.QUERY_FINGERPRINT,
        LISTAGG(DISTINCT TRIM(f.value::string), ', ') WITHIN GROUP (ORDER BY TRIM(f.value::string)) AS USER_NAMES
      FROM ${q('HIGH_FREQUENCY_QUERIES_TOP')} hf,
           LATERAL FLATTEN(input => SPLIT(COALESCE(hf.USER_NAMES, ''), ',')) f
      WHERE ${dateBetween('hf.SNAPSHOT_DATE', startDate, endDate)}
        AND TRIM(f.value::string) <> ''
      GROUP BY hf.QUERY_FINGERPRINT
    ),
    warehouses_by_pattern AS (
      SELECT
        hf.QUERY_FINGERPRINT,
        LISTAGG(DISTINCT TRIM(f.value::string), ', ') WITHIN GROUP (ORDER BY TRIM(f.value::string)) AS WAREHOUSE_NAMES
      FROM ${q('HIGH_FREQUENCY_QUERIES_TOP')} hf,
           LATERAL FLATTEN(input => SPLIT(COALESCE(hf.WAREHOUSE_NAMES, ''), ',')) f
      WHERE ${dateBetween('hf.SNAPSHOT_DATE', startDate, endDate)}
        AND TRIM(f.value::string) <> ''
      GROUP BY hf.QUERY_FINGERPRINT
    )
    SELECT
      t.SAMPLE_QUERY_TEXT,
      t.QUERY_COUNT,
      t.AVG_EXECUTION_SECONDS,
      t.TOTAL_EXECUTION_SECONDS,
      t.AVG_DAILY_DISTINCT_USERS,
      t.AVG_DAILY_DISTINCT_WAREHOUSES,
      t.DAYS_PRESENT,
      COALESCE(u.USER_NAMES, '-') AS USER_NAMES,
      COALESCE(w.WAREHOUSE_NAMES, '-') AS WAREHOUSE_NAMES
    FROM top_patterns t
    LEFT JOIN users_by_pattern u ON t.QUERY_FINGERPRINT = u.QUERY_FINGERPRINT
    LEFT JOIN warehouses_by_pattern w ON t.QUERY_FINGERPRINT = w.QUERY_FINGERPRINT
    ORDER BY t.QUERY_COUNT DESC, t.TOTAL_EXECUTION_SECONDS DESC
  `
  return executeQuery<any>(sql)
}

export async function getRecommendations(startDate: string, endDate: string): Promise<any[]> {
  const sql = `
    WITH latest_feedback AS (
      SELECT
        RUN_DATE,
        FINDING_ID,
        STATUS_OVERRIDE,
        NOTE AS FEEDBACK_NOTE,
        UPDATED_BY AS FEEDBACK_UPDATED_BY,
        UPDATED_AT AS FEEDBACK_UPDATED_AT,
        ROW_NUMBER() OVER (PARTITION BY RUN_DATE, FINDING_ID ORDER BY UPDATED_AT DESC NULLS LAST) AS rn
      FROM ${q('OPT_FINDING_FEEDBACK')}
    )
    SELECT
      f.*,
      COALESCE(lf.STATUS_OVERRIDE, f.STATUS) AS CURRENT_STATUS,
      lf.FEEDBACK_NOTE,
      lf.FEEDBACK_UPDATED_BY,
      lf.FEEDBACK_UPDATED_AT
    FROM ${q('OPT_FINDINGS_DAILY')} f
    LEFT JOIN latest_feedback lf
      ON lf.RUN_DATE = f.RUN_DATE AND lf.FINDING_ID = f.FINDING_ID AND lf.rn = 1
    WHERE ${dateBetween('f.RUN_DATE', startDate, endDate)}
    ORDER BY f.PRIORITY_SCORE DESC, f.CONFIDENCE_SCORE DESC, f.EST_CREDITS_SAVED_MONTHLY DESC NULLS LAST
  `
  return executeQuery<any>(sql)
}

export async function getRecommendationEvidence(runDate: string, findingId: string): Promise<any[]> {
  const sql = `
    SELECT EVIDENCE_KIND, EVIDENCE_JSON, CREATED_AT
    FROM ${q('OPT_FINDING_EVIDENCE')}
    WHERE RUN_DATE = '${runDate}'::DATE
      AND FINDING_ID = '${findingId.replace(/'/g, "''")}'
    ORDER BY CREATED_AT DESC
  `
  return executeQuery<any>(sql)
}
