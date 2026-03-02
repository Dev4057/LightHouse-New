import { NextRequest, NextResponse } from 'next/server'

// In production, you'd fetch these from a database
const notifications = [
  {
    id: '1',
    category: 'performance',
    level: 'error', // 'error' | 'warning' | 'info'
    title: 'Warehouse Performance',
    message: 'Query queue ratio exceeded 0.8 on COMPUTE_WH',
    ago: '2 minutes ago',
  },
  {
    id: '2',
    category: 'storage',
    level: 'warning',
    title: 'Storage Alert',
    message: 'Database storage growing at 15GB/day',
    ago: '15 minutes ago',
  },
  {
    id: '3',
    category: 'system',
    level: 'info',
    title: 'System Update',
    message: 'Snowflake connection optimized',
    ago: '1 hour ago',
  },
]

export async function GET(request: NextRequest) {
  // Simulate an API/database call. In production, replace with real logic
  return NextResponse.json(notifications)
}