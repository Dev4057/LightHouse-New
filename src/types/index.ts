// ============================================
// BASE TYPES
// ============================================

// API Response wrapper
export interface APIResponse<T> {
  status: 'success' | 'error'
  data?: T
  error?: {
    message: string
    code: string
  }
  timestamp: string
}

// Date range for queries
export interface DateRange {
  start_date: string
  end_date: string
}

// ============================================
// QUERY DETAILS
// ============================================

export interface Query {
  QUERY_ID: string
  QUERY_TEXT: string
  USER_NAME: string
  WAREHOUSE_NAME: string
  TOTAL_ELAPSED_TIME: number
  TOTAL_EXECUTION_TIME: number
  EXECUTION_TIME: number
  CREDITS_USED: number
  ROWS_PRODUCED: number
  ROWS_SCANNED: number
  COMPILATION_TIME: number
  QUEUE_TIME: number
  START_TIME: string
  END_TIME: string
  QUERY_TYPE: string
  ERROR_CODE?: number
  ERROR_MESSAGE?: string
}

export interface QueryType {
  QUERY_TYPE: string
  AVERAGE_EXECUTION_SECONDS: number
  QUERY_COUNT: number
}

export interface QueryUser {
  USER_NAME: string
  AVERAGE_EXECUTION_SECONDS: number
}

export interface ExpensiveQuery {
  QUERY_TEXT: string
  USER_NAME: string
  WAREHOUSE_NAME: string
  CREDITS_ATTRIBUTED_COMPUTE: number
  EXECUTION_SECONDS: number
}

export interface LongestQuery {
  QUERY_ID: string
  QUERY_TEXT: string
  USER_NAME: string
  WAREHOUSE_NAME: string
  ELAPSED_TIME_SEC: number
}

export interface HighFrequencyQuery {
  SAMPLE_QUERY_TEXT: string
  QUERY_COUNT: number
  AVG_EXECUTION_SECONDS: number
  TOTAL_EXECUTION_SECONDS: number
  AVG_DAILY_DISTINCT_USERS: number
  AVG_DAILY_DISTINCT_WAREHOUSES: number
  DAYS_PRESENT: number
  USER_NAMES: string
  WAREHOUSE_NAMES: string
}

export interface QueryTrend {
  QUERY_DAY: string
  QUERY_COUNT: number
  AVG_SECONDS: number
}

export interface HeatmapData {
  DAY_OF_WEEK: number
  HOUR_OF_DAY: number
  QUERY_COUNT: number
}

export interface SpillQuery {
  QUERY_ID: string
  QUERY_TEXT: string
  WAREHOUSE_NAME: string
  BYTES_SPILLED_TO_LOCAL_STORAGE: number
  BYTES_SPILLED_TO_REMOTE_STORAGE: number
}

export interface PartitionPruningQuery {
  QUERY_ID: string
  QUERY_TEXT: string
  WAREHOUSE_NAME: string
  PRUNING_RATIO: number
  PARTITIONS_SCANNED: number
  PARTITIONS_TOTAL: number
}

// ============================================
// WAREHOUSE DATA
// ============================================

export interface Warehouse {
  WAREHOUSE_ID: string
  WAREHOUSE_NAME: string
  STATE: 'RUNNING' | 'SUSPENDED' | 'RESIZING'
  WAREHOUSE_SIZE: string
  WAREHOUSE_TYPE: string
  AUTO_SUSPEND: number
  AUTO_RESUME: boolean
  COMMENT: string
  CREATED_ON: string
  UPDATED_ON: string
  CREDITS_USED?: number
  QUERIES_EXECUTED?: number
  AVERAGE_QUERY_TIME?: number
  IDLE_TIME?: number
}

export interface WarehouseCredit {
  WAREHOUSE_NAME: string
  TOTAL_CREDITS_USED: number
}

export interface WarehouseUser {
  USER_NAME: string
  WAREHOUSE_NAME: string
  CREDITS: number
}

export interface DormantWarehouse {
  WAREHOUSE_NAME: string
  total_credit: number
  last_active: string
  days_since_active: number
  recommendation: string
}

export interface ServiceCredit {
  SERVICE_TYPE: string
  TOTAL_CREDITS: number
}

export interface MixedWorkload {
  WAREHOUSE_NAME: string
  SMALL_QUERIES: number
  MEDIUM_QUERIES: number
  LARGE_QUERIES: number
  EXTRA_LARGE_QUERIES: number
}

export interface IdleCost {
  WAREHOUSE_NAME: string
  total_compute_credits: number
  query_execution_credits: number
  idle_credits: number
  idle_percentage: number
  estimated_idle_cost_usd: number
  recommendation: string
}

export interface OverprovisionedWH {
  warehouse_name: string
  avg_query_load_ratio: number
  avg_queued_load_ratio: number
  avg_provisioning_queue_ratio: number
  total_credits: number
  utilization_percentage: number
  recommendation: string
}

export interface UnderprovisionedWH {
  WAREHOUSE_NAME: string
  avg_query_load_ratio: number
  avg_queued_load_ratio: number
  avg_provisioning_queue_ratio: number
  avg_blocked_ratio: number
  total_credits: number
  utilization_percentage: number
  recommendation: string
}

// ============================================
// STORAGE DATA
// ============================================

export interface StorageInfo {
  DATABASE_NAME: string
  SCHEMA_NAME: string
  TABLE_NAME: string
  BYTES: number
  STAGE_SIZE?: number
  LAST_MODIFIED: string
  ACCESS_COUNT: number
  LAST_ACCESSED?: string
}

export interface StorageSummary {
  DATABASE_D: number
  STAGE_D: number
  FAILSAFE_D: number
  HYBRID_TABLE_D: number
  TOTAL_STORAGE_D: number
}

export interface TopDatabase {
  DATABASE_NAME: string
  AVG_BYTES: number
}

export interface OverallStorage {
  NAME: string
  TYPE: 'DATABASE' | 'STAGE'
  STORAGE_BYTES: number
}

export interface StageBytesInfo {
  STAGE_NAME: string
  TOTAL_BYTES: number
}

export interface TableAccess {
  FULL_TABLE_NAME: string
  ACCESS_COUNT: number
}

export interface LargeUnusedTable {
  FQ_TABLE_NAME: string
  ACTIVE_GB: number
  LAST_ACCESS_TIME: string | null
  TABLE_CREATED_DATE: string
  TABLE_LAST_ALTERED: string
}

// ============================================
// IDENTITY & SECURITY
// ============================================

export interface User {
  USER_ID?: number
  USER_NAME: string
  NAME?: string
  CREATED_ON: string
  DISABLED: boolean
  COMMENT?: string
  DEFAULT_ROLE?: string
  DEFAULT_WAREHOUSE?: string
  DEFAULT_NAMESPACE?: string
  HAS_PASSWORD: boolean
  HAS_RSA_PUBLIC_KEY: boolean
  HAS_MFA: boolean
  TYPE?: string
  LAST_SUCCESS_LOGIN?: string
  PASSWORD_LAST_SET_TIME?: string
  LOCKED_UNTIL_TIME?: string
  OWNER?: string
  SNAPSHOT_DATE?: string
}

export interface Grant {
  GRANTEE_NAME?: string
  ROLE?: string
  GRANTED_BY?: string
  USER?: string
  PRIVILEGE?: string
  GRANTED_ON?: string
  NAME?: string
  GRANT_OPTION?: boolean
}


export interface MFAStatus {
  TYPE: string
  USER_COUNT: number
  MFA_TRUE_COUNT: number
  MFA_FALSE_COUNT: number
}

export interface InactiveUser {
  user_name: string
  last_login_time: string | null
}

export interface AuthFailure {
  USER_NAME: string
  ERROR_MESSAGE: string
  NUM_OF_FAILURES: number
}

export interface AuthMethodSuccess {
  AUTHENTICATION_METHOD: string
  CT: number
}

export interface AccountAdminGrant {
  Description: string
  Statement: string
}

export interface AccountAdminNoMFA {
  NAME: string
  last_login: string
  password_age: string
}

export interface OldestPassword {
  NAME: string
  password_last_changed: string
}

// ============================================
// RECOMMENDATIONS
// ============================================

export type RecommendationStatus = 'open' | 'in_progress' | 'accepted' | 'done' | 'snoozed' | 'dismissed'
export type RecommendationCategory = 'pattern' | 'query' | 'warehouse' | 'storage' | 'other'

export interface Recommendation {
  FINDING_ID: string
  RUN_DATE: string
  TITLE: string
  SUMMARY?: string
  CATEGORY: RecommendationCategory
  SUBTYPE: string
  ENTITY_NAME: string
  STATUS?: string
  CURRENT_STATUS: RecommendationStatus
  PRIORITY_SCORE: number
  CONFIDENCE_SCORE: number
  EST_CREDITS_SAVED_MONTHLY?: number
  EST_STORAGE_BYTES_SAVED?: number
  EST_COST_SAVED_MONTHLY_USD?: number
  OWNER_HINT?: string
  EVIDENCE_JSON?: Record<string, any>
  FEEDBACK_NOTE?: string
  FEEDBACK_UPDATED_BY?: string
  FEEDBACK_UPDATED_AT?: string
}

export interface RecommendationDetail extends Recommendation {
  EVIDENCE_PARSED?: Record<string, any>
  TARGET_DISPLAY: string
  OWNER_DISPLAY: string
  RAW_OWNER_HINT?: string
  RAW_ENTITY_NAME?: string
  QUERY_TEXT_AVAILABLE: boolean
  QUERY_FINGERPRINT: string
  IS_SHARED_PATTERN: boolean
}

// ============================================
// KPI METRICS
// ============================================

export interface KPIMetrics {
  TOTAL_CREDITS_USED: number|null
  TOTAL_QUERIES_EXECUTED: number
  AVERAGE_QUERY_TIME: number
  FAILED_QUERY_COUNT: number
  OPTIMIZATION_OPPORTUNITIES: number
  COST_PER_DAY: number
  STORAGE_USED_GB: number
}

export interface DashboardKPI {
  label: string
  value: string | number
  icon?: string
  trend?: number
  trendLabel?: string
}

// ============================================
// AI INSIGHTS
// ============================================

export interface AIInsight {
  INSIGHT_ID: string
  CATEGORY: string
  SEVERITY: 'low' | 'medium' | 'high' | 'critical'
  TITLE: string
  DESCRIPTION: string
  RECOMMENDATION: string
  ESTIMATED_SAVINGS?: {
    AMOUNT: number
    CURRENCY: 'USD' | 'CREDITS'
    PERIOD: 'day' | 'month' | 'year'
  }
  CONFIDENCE: number
  ACTION_ITEMS: string[]
  GENERATED_AT: string
}

// ============================================
// DASHBOARD STATE
// ============================================

export interface DashboardState {
  timeRange: DateRange
  warehouse?: string
  user?: string
  activeTab: 'dashboard' | 'queries' | 'warehouses' | 'storage' | 'identity' | 'insights'
  isLoading: boolean
  error?: string
}
