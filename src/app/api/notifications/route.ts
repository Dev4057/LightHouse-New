import { NextRequest, NextResponse } from 'next/server'
import { getRecommendations, getUnderprovisionedWarehouses } from '@/lib/snowflake/queries'

export async function GET(request: NextRequest) {
  try {
    // 1. ✨ FIX: Look back 7 days instead of just "today" to guarantee we find data
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 7) 
    
    const startDate = start.toISOString().split('T')[0]
    const endDate = end.toISOString().split('T')[0]

    const notifications = []

    // 2. Fetch live underprovisioned warehouses (Performance Alerts)
    const rawUnderprov : any = await getUnderprovisionedWarehouses(startDate, endDate)
    
    // ✨ FIX: Safely extract the array, just like we did on the frontend
    const underprov = Array.isArray(rawUnderprov) ? rawUnderprov : (rawUnderprov?.data || [])

    if (underprov && underprov.length > 0) {
      underprov.forEach((wh: any) => {
        // ✨ FIX: Check both lowercase and UPPERCASE keys for Snowflake compatibility
        const queueRatio = Number(wh.avg_queued_load_ratio || wh.AVG_QUEUED_LOAD_RATIO || 0)
        const whName = wh.warehouse_name || wh.WAREHOUSE_NAME || 'Unknown WH'

        if (queueRatio > 0.05) { // Lowered threshold slightly to ensure it catches something
          notifications.push({
            id: `perf-${whName}`,
            category: 'performance',
            level: 'error',
            title: 'Warehouse Queueing',
            message: `High queue ratio (${(queueRatio * 100).toFixed(1)}%) on ${whName}`,
            ago: 'Recent',
          })
        }
      })
    }

    // 3. Fetch High-Priority AI Recommendations (System Alerts)
    const rawRecs: any = await getRecommendations(startDate, endDate)
    const recs = Array.isArray(rawRecs) ? rawRecs : (rawRecs?.data || [])

    if (recs && recs.length > 0) {
      recs.forEach((rec: any) => {
        // Only alert for active, high-priority items
        const priority = Number(rec.PRIORITY_SCORE || 0)
        const status = (rec.CURRENT_STATUS || '').toLowerCase()
        
        if (priority > 50 && status !== 'dismissed' && status !== 'resolved') {
          notifications.push({
            id: `rec-${rec.FINDING_ID}`,
            category: 'system',
            level: 'warning',
            title: 'Optimization Finding',
            message: `${rec.TITLE || rec.FINDING_TYPE} - Save ${Number(rec.EST_CREDITS_SAVED_MONTHLY || 0).toFixed(1)} credits/mo`,
            ago: 'Recent',
          })
        }
      })
    }

    // 4. Fallback if everything is perfect
    if (notifications.length === 0) {
      notifications.push({
        id: 'all-clear',
        category: 'system',
        level: 'info',
        title: 'System Optimal',
        message: 'No active alerts. Snowflake environments are running efficiently.',
        ago: 'Just now',
      })
    }

    return NextResponse.json(notifications)
  } catch (error) {
    // ✨ THE MOST IMPORTANT PART: Log the exact error to your VS Code terminal
    console.error('🚨 NOTIFICATIONS API ERROR 🚨:', error)
    
    return NextResponse.json([{
      id: 'error',
      category: 'system',
      level: 'error',
      title: 'API Error',
      message: 'Check your VS Code terminal for the exact error.',
      ago: 'Just now'
    }])
  }
}