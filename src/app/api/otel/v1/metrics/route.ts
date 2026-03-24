import { NextResponse } from 'next/server';

// Global cache to hold OTel data in memory so your dashboard loads instantly
const globalForCache = global as unknown as { otelKpiCache: any, otelTrendCache: any };
globalForCache.otelKpiCache = globalForCache.otelKpiCache || {
  TOTAL_CREDITS_USED: 0,
  TOTAL_QUERIES_EXECUTED: 0,
  AVERAGE_QUERY_TIME: 0,
  FAILED_QUERY_COUNT: 0,
};
globalForCache.otelTrendCache = globalForCache.otelTrendCache || [];

// 1. OTel uses POST to push data to us every 10 minutes
export async function POST(req: Request) {
  try {
    const otlpData = await req.json();
    const resourceMetrics = otlpData.resourceMetrics || [];
    
    for (const rm of resourceMetrics) {
      for (const sm of rm.scopeMetrics || []) {
        for (const metric of sm.metrics || []) {
          const name = metric.name;
          const dataPoints = metric.gauge?.dataPoints || [];
          
          if (dataPoints.length > 0) {
            // -- Handle KPI Cards --
            if (name.startsWith('lighthouse.kpi.')) {
              const val = dataPoints[0].asDouble ?? dataPoints[0].asInt ?? 0;
              if (name === 'lighthouse.kpi.total_credits') globalForCache.otelKpiCache.TOTAL_CREDITS_USED = val;
              if (name === 'lighthouse.kpi.total_queries') globalForCache.otelKpiCache.TOTAL_QUERIES_EXECUTED = val;
              if (name === 'lighthouse.kpi.avg_query_time') globalForCache.otelKpiCache.AVERAGE_QUERY_TIME = val;
              if (name === 'lighthouse.kpi.failed_queries') globalForCache.otelKpiCache.FAILED_QUERY_COUNT = val;
            }
            // (Trend and Chart parsing will go here next!)
          }
        }
      }
    }
    console.log("✅ Successfully caught OTel data batch!");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ OTel Parsing Error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// 2. Your Dashboard uses GET to retrieve the fast cached data
export async function GET() {
  return NextResponse.json({
    status: 'success',
    data: globalForCache.otelKpiCache,
    source: 'opentelemetry_cache' // A fun flag to prove it's working!
  });
}