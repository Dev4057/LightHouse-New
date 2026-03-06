'use client'

import { useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import DateRangeSelector from '@/components/dashboard/DateRangeSelector'
import ComprehensiveStorageTab from '@/components/pages/storage/ComprehensiveStorageTab'

export default function StoragePage() {
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date(),
  })

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Footprint & Optimization</h1>
            <p className="text-slate-400 mt-1">Full storage footprint, stage usage, access patterns, and cleanup opportunities</p>
          </div>
          <DateRangeSelector value={dateRange} onChange={setDateRange} />
        </div>

        <ComprehensiveStorageTab dateRange={dateRange} />
      </div>
    </DashboardLayout>
  )
}
