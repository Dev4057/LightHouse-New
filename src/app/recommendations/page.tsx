'use client'

import { useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import EvidencePanel from '@/components/recommendations/EvidencePanel' // 👈 Add this line
import { 
  Lightbulb, 
  TrendingDown, 
  ShieldAlert, 
  Database, 
  Server, 
  CheckCircle2,
  ChevronRight,
  Loader,
  Filter
} from 'lucide-react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import useFetch from '@/hooks/useApi'

export default function RecommendationsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  // State for the slide-out panel (we will build the content for this next)
  const [selectedFinding, setSelectedFinding] = useState<any | null>(null)

  // Fetch the recommendations using your API's default 'list' type
  const { data: recsRes, isLoading } = useFetch<any>(['recommendations'], '/api/recommendations?type=list')

  // Safely map the data
  const recommendations = useMemo(() => {
    const raw = recsRes?.data || (Array.isArray(recsRes) ? recsRes : [])
    // Filter out dismissed or accepted items so the inbox stays clean
    return raw.filter((r: any) => 
      r.CURRENT_STATUS !== 'dismissed' && 
      r.CURRENT_STATUS !== 'accepted' &&
      r.CURRENT_STATUS !== 'snoozed'
    )
  }, [recsRes])

  // Calculate Total Savings
  const totalSavings = useMemo(() => {
    return recommendations.reduce((acc: number, curr: any) => {
      return acc + (Number(curr.EST_CREDITS_SAVED_MONTHLY) || 0)
    }, 0)
  }, [recommendations])

  if (status === 'loading' || isLoading) {
    return (
      <DashboardLayout>
        <div className="h-[70vh] flex flex-col items-center justify-center space-y-4">
          <Loader className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm text-slate-500 font-medium animate-pulse">Analyzing Optimization Engine...</p>
        </div>
      </DashboardLayout>
    )
  }

  const getCategoryIcon = (category: string) => {
    switch (category?.toUpperCase()) {
      case 'WAREHOUSE': return <Server className="w-5 h-5 text-purple-500" />
      case 'STORAGE': return <Database className="w-5 h-5 text-blue-500" />
      case 'SECURITY': return <ShieldAlert className="w-5 h-5 text-red-500" />
      default: return <Lightbulb className="w-5 h-5 text-amber-500" />
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto pb-12">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">AI Recommendations</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
              Automated insights to optimize Snowflake costs, performance, and security. Review and apply configurations.
            </p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 px-6 py-4 rounded-xl flex items-center gap-4 shrink-0">
            <div className="p-2.5 bg-emerald-100 dark:bg-emerald-800/50 rounded-lg">
              <TrendingDown className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-0.5">Monthly Savings Found</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">
                {totalSavings > 0 ? `${totalSavings.toFixed(1)} Credits` : 'Fully Optimized'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Inbox */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
            <h3 className="font-semibold text-slate-900 dark:text-white">Action Inbox ({recommendations.length})</h3>
            <button className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
              <Filter className="w-4 h-4" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recommendations.length > 0 ? (
              recommendations.map((rec: any, i: number) => (
                <div 
                  key={i} 
                  onClick={() => setSelectedFinding(rec)}
                  className="p-6 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group flex flex-col md:flex-row gap-6 md:items-center justify-between"
                >
                  <div className="flex items-start gap-4 flex-1">
                    <div className="mt-1 bg-slate-100 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                      {getCategoryIcon(rec.CATEGORY)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                          rec.PRIORITY_SCORE > 80 ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400' :
                          rec.PRIORITY_SCORE > 50 ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400' :
                          'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400'
                        }`}>
                          {rec.PRIORITY_SCORE > 80 ? 'High Priority' : rec.PRIORITY_SCORE > 50 ? 'Medium Priority' : 'Low Priority'}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">ID: {rec.FINDING_ID?.split('-')[0] || 'OPT'}</span>
                      </div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {rec.TITLE || rec.FINDING_TYPE || 'Optimization Opportunity'}
                      </h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                        {rec.DESCRIPTION || 'Review this asset for potential configuration improvements.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 md:ml-auto pl-14 md:pl-0">
                    {Number(rec.EST_CREDITS_SAVED_MONTHLY) > 0 && (
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Impact</p>
                        <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                          -{Number(rec.EST_CREDITS_SAVED_MONTHLY).toFixed(1)} cr/mo
                        </p>
                      </div>
                    )}
                    <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center group-hover:border-blue-300 dark:group-hover:border-blue-700 transition-colors">
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-16 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Zero Findings</h3>
                <p className="text-slate-500 max-w-sm">Your Snowflake environment is running perfectly. No optimization opportunities detected right now.</p>
              </div>
            )}
            {selectedFinding && (
          <EvidencePanel 
            finding={selectedFinding} 
            onClose={() => setSelectedFinding(null)} 
            // This forces the useFetch hook to reload the data when a status changes
            onRefresh={() => window.location.reload()} 
          />
        )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}