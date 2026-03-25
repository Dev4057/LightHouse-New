import { Database } from 'duckdb-async';
import duckdb from 'duckdb'; // We need this to get the OPEN_READONLY constant
import path from 'path';

// Point to the .duckdb file we generated with Python
// Adjust this path based on where your Next.js app is relative to the output folder
const dbPath = 'C:\\Users\\DevangGandhi\\tulapi\\Lighthouse-OT\\output\\lighthouse.duckdb';
let dbInstance: Database | null = null;

async function getDb() {
  if (!dbInstance) {
    // ✨ CRITICAL FIX: OPEN_READONLY ensures Next.js doesn't lock the file!
    // This allows your Python script to keep writing new data in the background.
    dbInstance = await Database.create(dbPath, duckdb.OPEN_READONLY); 
  }
  return dbInstance;
}

// ==========================================
// 1. KPI DASHBOARD QUERIES
// ==========================================

export async function getDuckDbKPIs(startDate: string, endDate: string) {
  const db = await getDb();
  
  const sql = `
    SELECT 
      SUM(CASE 
        WHEN metric_name = 'snowflake.database.query.count' 
        THEN metric_value ELSE 0 
      END) AS TOTAL_QUERIES_EXECUTED,
      
      SUM(CASE 
        WHEN metric_name = 'snowflake.database.query.count' 
         AND execution_status = 'FAIL' 
        THEN metric_value ELSE 0 
      END) AS FAILED_QUERY_COUNT
      
    FROM lighthouse_telemetry
    WHERE timestamp >= ?::TIMESTAMP 
      -- ✨ FIX: DuckDB loves plain english intervals!
      AND timestamp <= ?::TIMESTAMP + INTERVAL 1 DAY - INTERVAL 1 SECOND
  `;

  // Execute the query passing the dates as safe parameters
  const rows = await db.all(sql, startDate, endDate);
  
  // Return the first row, or default to 0 if the database is empty
  return rows[0] || { TOTAL_QUERIES_EXECUTED: 0, FAILED_QUERY_COUNT: 0 };
}
// ==========================================
// 2. ALERT PANEL QUERIES
// ==========================================

export async function getDuckDBFailedQueries(limit = 50) {
  const db = await getDb();
  
  const sql = `
    SELECT 
        warehouse_name,
        error_message,
        COUNT(*) as failure_count,
        MAX(timestamp) as last_failed_at
    FROM lighthouse_telemetry
    WHERE execution_status = 'FAIL'
      AND error_message != ''
    GROUP BY warehouse_name, error_message
    ORDER BY failure_count DESC
    LIMIT ?
  `;

  // Execute the query
  const rows = await db.all(sql, limit);
  return rows;
}
// ==========================================
// 3. QUERY ANALYSIS TAB QUERIES
// ==========================================

export async function getDuckDBQueryTypeMetrics(startDate: string, endDate: string) {
  const db = await getDb();
  
  const sql = `
    SELECT 
      query_type AS QUERY_TYPE,
      SUM(metric_value) AS QUERY_COUNT,
      0 AS AVERAGE_EXECUTION_SECONDS -- OTel doesn't track exact seconds here, so we stub it for the UI
    FROM lighthouse_telemetry
    WHERE metric_name = 'snowflake.database.query.count'
      AND query_type != ''
      AND timestamp >= ?::TIMESTAMP 
      AND timestamp <= ?::TIMESTAMP + INTERVAL 1 DAY - INTERVAL 1 SECOND
    GROUP BY query_type
    ORDER BY QUERY_COUNT DESC
  `;

  return await db.all(sql, startDate, endDate);
}

export async function getDuckDBQueryHeatmap(startDate: string, endDate: string) {
  const db = await getDb();
  
  // ✨ FIX: We use standard EXTRACT and cast everything to ::INTEGER 
  // This prevents Next.js from crashing when trying to convert BigInts to JSON
  const sql = `
    SELECT 
      EXTRACT('dow' FROM timestamp)::INTEGER AS DAY_OF_WEEK,
      EXTRACT('hour' FROM timestamp)::INTEGER AS HOUR_OF_DAY,
      SUM(metric_value)::INTEGER AS QUERY_COUNT
    FROM lighthouse_telemetry
    WHERE metric_name = 'snowflake.database.query.count'
      AND timestamp >= ?::TIMESTAMP 
      AND timestamp <= ?::TIMESTAMP + INTERVAL 1 DAY - INTERVAL 1 SECOND
    GROUP BY DAY_OF_WEEK, HOUR_OF_DAY
    ORDER BY DAY_OF_WEEK, HOUR_OF_DAY
  `;

  return await db.all(sql, startDate, endDate);
}