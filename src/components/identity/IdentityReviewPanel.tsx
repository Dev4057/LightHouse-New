'use client'

import { useMemo, useState } from 'react'
import { 
  X, ShieldAlert, ShieldCheck, Clock, Key, AlertTriangle, 
  Terminal, UserMinus, Shield, Activity, Copy, CheckCircle2 
} from 'lucide-react'
import useFetch from '@/hooks/useApi'
import { formatNumber } from '@/lib/formatting'

interface IdentityReviewPanelProps {
  user: any
  onClose: () => void
  onRefresh: () => void
}

export default function IdentityReviewPanel({ user, onClose, onRefresh }: IdentityReviewPanelProps) {
  const [copiedSql, setCopiedSql] = useState<string | null>(null)

  // 1. Calculate a 30-day window for fetching real security logs
  const endDate = new Date().toISOString().split('T')[0]
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // 2. Fetch the REAL data using your existing API endpoints
  const { data: rawRoles, isLoading: loadingRoles } = useFetch<any[] | { data: any[] }>(['role-hierarchy'], '/api/identity?type=role_hierarchy')
  const { data: rawFailures, isLoading: loadingFailures } = useFetch<any[] | { data: any[] }>(['auth-failures', startDate, endDate], `/api/identity?type=auth_failures&startDate=${startDate}&endDate=${endDate}`)

  // 3. Filter the global real data down to ONLY this specific user
  const userRoles = useMemo(() => {
    const roles = Array.isArray(rawRoles) ? rawRoles : (rawRoles?.data || [])
    return roles.filter((r: any) => r.GRANTEE_NAME === user.USER_NAME)
  }, [rawRoles, user.USER_NAME])

  const userFailures = useMemo(() => {
    const failures = Array.isArray(rawFailures) ? rawFailures : (rawFailures?.data || [])
    return failures.filter((f: any) => f.USER_NAME === user.USER_NAME)
  }, [rawFailures, user.USER_NAME])

  // Helpers
  const isCompliant = user.HAS_MFA === true || user.HAS_MFA === 'true'
  const isDormant = !user.LAST_SUCCESS_LOGIN || new Date(user.LAST_SUCCESS_LOGIN).getTime() < Date.now() - 90 * 24 * 60 * 60 * 1000
  const riskLevel = !isCompliant ? 'CRITICAL' : isDormant ? 'MEDIUM' : 'LOW'
  const totalFailures = userFailures.reduce((sum: number, f: any) => sum + Number(f.FAILURE_COUNT || 0), 0)

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedSql(id)
    setTimeout(() => setCopiedSql(null), 2000)
  }

  // The generated SQL remediation scripts
  const sqlDropUser = `DROP USER IF EXISTS "${user.USER_NAME}";`
  const sqlEnforceMfa = `ALTER USER "${user.USER_NAME}" SET MINS_TO_BYPASS_MFA = 0;`
  const sqlResetPass = `ALTER USER "${user.USER_NAME}" RESET PASSWORD;`

  return (
    <div className="fixed inset-0 z-[200] flex justify-end bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
      
      {/* Invisible backdrop click layer to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* The Slide-Out Drawer */}
      <div className="relative w-full max-w-lg h-full bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col animate-in slide-in-from-right duration-300 ease-out">
        
        {/* ── HEADER ── */}
        <div className="flex items-start justify-between p-6 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black shadow-inner border ${
              riskLevel === 'CRITICAL' ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400' :
              'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400'
            }`}>
              {user.USER_NAME?.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-none">{user.USER_NAME}</h2>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{user.TYPE || 'PERSON'}</span>
                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                  riskLevel === 'CRITICAL' ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400' :
                  riskLevel === 'MEDIUM' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400' :
                  'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400'
                }`}>
                  {riskLevel} RISK
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── SCROLLABLE CONTENT ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          
          {/* Security Posture Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm">
              <div className="flex items-center gap-2 mb-2 text-slate-500 dark:text-slate-400">
                <Key className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">MFA Status</span>
              </div>
              {isCompliant ? (
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                  <span className="font-semibold text-sm">Enabled & Verified</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <ShieldAlert className="w-5 h-5" />
                  <span className="font-semibold text-sm">Not Configured</span>
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm">
              <div className="flex items-center gap-2 mb-2 text-slate-500 dark:text-slate-400">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Last Login</span>
              </div>
              <div className={`font-semibold text-sm ${isDormant ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                {user.LAST_SUCCESS_LOGIN ? new Date(user.LAST_SUCCESS_LOGIN).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never Logged In'}
              </div>
              {isDormant && <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-0.5 font-medium">Over 90 days inactive</p>}
            </div>
          </div>

          {/* Real Role Entitlements */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-500" /> Active Role Grants
            </h3>
            {loadingRoles ? (
              <div className="h-20 flex items-center justify-center border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                <span className="text-xs text-slate-400 animate-pulse">Loading privileges...</span>
              </div>
            ) : userRoles.length > 0 ? (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="max-h-48 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 sticky top-0">
                      <tr>
                        <th className="py-2 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs">Role Name</th>
                        <th className="py-2 px-4 font-semibold text-slate-600 dark:text-slate-300 text-xs text-right">Granted By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900/50">
                      {userRoles.map((role: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-2 px-4 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">{role.ROLE}</td>
                          <td className="py-2 px-4 text-xs text-slate-500 text-right">{role.GRANTED_BY || 'SYSTEM'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-sm text-slate-500 text-center">
                No roles directly assigned to this user.
              </div>
            )}
          </div>

          {/* Real Authentication Failures */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-red-500" /> Recent Auth Failures
            </h3>
            {loadingFailures ? (
              <div className="h-20 flex items-center justify-center border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                <span className="text-xs text-slate-400 animate-pulse">Scanning logs...</span>
              </div>
            ) : userFailures.length > 0 ? (
              <div className="border border-red-200 dark:border-red-900/30 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-red-50 dark:bg-red-900/20 px-4 py-2 border-b border-red-200 dark:border-red-900/30 flex justify-between items-center">
                  <span className="text-xs font-bold text-red-700 dark:text-red-400">Total Failed Attempts</span>
                  <span className="text-sm font-black text-red-700 dark:text-red-400">{formatNumber(totalFailures)}</span>
                </div>
                <div className="max-h-40 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-sm bg-white dark:bg-slate-900/50">
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {userFailures.map((fail: any, idx: number) => (
                        <tr key={idx}>
                          <td className="py-2.5 px-4 text-xs text-slate-700 dark:text-slate-300 font-medium" title={fail.ERROR_MESSAGE}>
                            {fail.ERROR_MESSAGE?.length > 40 ? `${fail.ERROR_MESSAGE.substring(0, 40)}...` : fail.ERROR_MESSAGE}
                          </td>
                          <td className="py-2.5 px-4 text-xs font-bold text-red-600 text-right">{fail.FAILURE_COUNT}x</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-4 border border-emerald-200 dark:border-emerald-900/30 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2 justify-center font-medium">
                <ShieldCheck className="w-4 h-4" /> Zero failed logins in the last 30 days.
              </div>
            )}
          </div>
        </div>

        {/* ── REMEDIATION FOOTER ── */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Remediation Scripts</h3>
          <div className="space-y-2">
            
            {/* Script 1: Enforce MFA */}
            {!isCompliant && (
              <div className="flex items-center justify-between p-2.5 bg-slate-900 dark:bg-black rounded-lg border border-slate-700 group">
                <div className="flex items-center gap-3 overflow-hidden">
                  <Terminal className="w-4 h-4 text-emerald-400 shrink-0" />
                  <code className="text-xs text-slate-300 font-mono truncate">{sqlEnforceMfa}</code>
                </div>
                <button onClick={() => copyToClipboard(sqlEnforceMfa, 'mfa')} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors shrink-0">
                  {copiedSql === 'mfa' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            )}

            {/* Script 2: Reset Password */}
            {userFailures.length > 0 && (
              <div className="flex items-center justify-between p-2.5 bg-slate-900 dark:bg-black rounded-lg border border-slate-700 group">
                <div className="flex items-center gap-3 overflow-hidden">
                  <Terminal className="w-4 h-4 text-amber-400 shrink-0" />
                  <code className="text-xs text-slate-300 font-mono truncate">{sqlResetPass}</code>
                </div>
                <button onClick={() => copyToClipboard(sqlResetPass, 'reset')} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors shrink-0">
                  {copiedSql === 'reset' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            )}

            {/* Script 3: Drop User */}
            {(isDormant || riskLevel === 'CRITICAL') && (
              <div className="flex items-center justify-between p-2.5 bg-slate-900 dark:bg-black rounded-lg border border-slate-700 group">
                <div className="flex items-center gap-3 overflow-hidden">
                  <Terminal className="w-4 h-4 text-red-400 shrink-0" />
                  <code className="text-xs text-slate-300 font-mono truncate">{sqlDropUser}</code>
                </div>
                <button onClick={() => copyToClipboard(sqlDropUser, 'drop')} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors shrink-0">
                  {copiedSql === 'drop' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            )}

            {isCompliant && !isDormant && userFailures.length === 0 && (
               <p className="text-xs text-slate-500 text-center py-2">No immediate remediation required.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}