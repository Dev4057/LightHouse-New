'use client'

import { useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import DateRangeSelector from '@/components/dashboard/DateRangeSelector'
import ComprehensiveIdentityTab from '@/components/pages/identity/ComprehensiveIdentityTab'

export default function IdentityPage() {
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date(),
  })

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Identity, Auth & Risk</h1>
            <p className="text-slate-400 mt-1">Users, MFA posture, auth failures, privileged access, and password hygiene</p>
          </div>
          <DateRangeSelector value={dateRange} onChange={setDateRange} />
        </div>

        <ComprehensiveIdentityTab dateRange={dateRange} />
      </div>
    </DashboardLayout>
  )
}
