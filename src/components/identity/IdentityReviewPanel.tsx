'use client'

import { X, ShieldAlert, Terminal, UserMinus, ShieldCheck, Loader, Mail, Clock, Shield } from 'lucide-react'
import { useState } from 'react'

export default function IdentityReviewPanel({ user, onClose, onRefresh }: any) {
  const [loading, setLoading] = useState(false)

  const handleDisableUser = async () => {
    if (!confirm(`Are you sure you want to disable ${user.USER_NAME}? This will revoke all active sessions.`)) return
    setLoading(true)
    try {
      const res = await fetch('/api/identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable_user', userName: user.USER_NAME })
      })
      if (res.ok) {
        onRefresh()
        onClose()
      }
    } catch (err) {
      console.error("Failed to disable user", err)
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <>
      {/* ── BACKDROP ── */}
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[60] transition-opacity animate-in fade-in" onClick={onClose} />

      {/* ── DRAWER ── */}
      <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white dark:bg-[#0f172a] shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] z-[70] flex flex-col border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-300 ease-out">
        
        {/* Header: High Contrast Security Branding */}
        <div className="px-6 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/50 dark:to-[#0f172a]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-500/10 rounded-lg">
              <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-500" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white leading-tight">Identity Audit</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wide">SEC-RISK-ASSESSMENT</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all text-slate-400 hover:text-slate-900 dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 p-6 space-y-8 overflow-y-auto">
          
{/* 1. User Profile Card (FULLY DYNAMIC) */}
          <div className="relative overflow-hidden p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm">
             <div className="flex items-center gap-4 relative z-10">
                {/* Dynamic Initial and Gradient */}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-blue-500/20">
                  {user.USER_NAME ? user.USER_NAME[0].toUpperCase() : '?'}
                </div>
                <div className="min-w-0 flex-1">
                  {/* Real Username */}
                  <p className="text-lg font-black text-slate-900 dark:text-white truncate" title={user.USER_NAME}>
                    {user.USER_NAME}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Mail className="w-3 h-3 text-slate-400" />
                    {/* Real Email or Fallback */}
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {user.EMAIL && user.EMAIL !== 'null' ? user.EMAIL : 'system-account@snowflake.local'}
                    </span>
                  </div>
                </div>
             </div>
          </div>

          {/* 2. Security Insight Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">MFA Status</p>
              <div className="flex items-center gap-2">
                {user.HAS_MFA === 'true' ? (
                   <><ShieldCheck className="w-4 h-4 text-emerald-500" /><span className="text-sm font-bold text-emerald-600">Active</span></>
                ) : (
                   <><ShieldAlert className="w-4 h-4 text-red-500" /><span className="text-sm font-bold text-red-600">Disabled</span></>
                )}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Activity</p>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  {user.IS_STALE === 'true' ? 'Dormant' : 'Active'}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Findings & Evidence */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
              Critical Findings
            </h4>
            <div className="space-y-3">
               {user.HAS_MFA !== 'true' && (
                 <div className="p-4 rounded-xl border border-red-100 dark:border-red-900/30 bg-red-50/30 dark:bg-red-900/10 flex gap-3">
                    <ShieldAlert className="w-5 h-5 text-red-500 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-red-900 dark:text-red-300">Unprotected Admin Access</p>
                      <p className="text-xs text-red-700/70 dark:text-red-400/70 mt-0.5">This user has administrative roles but lacks multi-factor authentication.</p>
                    </div>
                 </div>
               )}
            </div>
          </div>

          {/* 4. Remediation Terminal */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
              <Terminal className="w-4 h-4" /> Recommended Action
            </h4>
            <div className="group relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
              <div className="relative bg-[#0a0e1a] rounded-xl p-5 border border-slate-800 font-mono shadow-2xl">
                <div className="flex items-center gap-2 mb-3 border-b border-slate-800 pb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/50" />
                  <span className="ml-2 text-[10px] text-slate-600 font-bold uppercase tracking-widest">Remediation SQL</span>
                </div>
                <code className="text-xs text-blue-400 block whitespace-pre-wrap leading-relaxed">
                  {`ALTER USER "${user.USER_NAME}"\nSET DISABLED = TRUE;`}
                </code>
              </div>
            </div>
          </div>

        </div>

        {/* Action Footer: High Stakes Buttons */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0f172a] space-y-3">
          <button 
            onClick={handleDisableUser}
            disabled={loading}
            className="w-full py-4 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white rounded-xl font-bold shadow-lg shadow-red-500/20 flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? <Loader className="w-5 h-5 animate-spin" /> : <UserMinus className="w-5 h-5" />}
            Disable User Account
          </button>
          <button 
            onClick={onClose}
            className="w-full py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold transition-all text-sm"
          >
            Cancel Review
          </button>
        </div>
      </div>
    </>
  )
}