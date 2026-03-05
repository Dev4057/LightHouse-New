'use client'

import { useEffect, useState } from 'react'
import useFetch from '@/hooks/useApi'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader, AlertCircle, Shield, Users, Key, AlertTriangle, UserX, Activity, Lock, FileText } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { formatNumber, shortenText } from '@/lib/formatting'
import WidgetAIInsight from '@/components/ai/WidgetAIInsight'
import { useTheme } from 'next-themes'

// ── GLASSMORPHISM TAILWIND CLASSES (Customized to 900/40 opacity) ────────────
const glassCard = "bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl dark:shadow-2xl min-w-0 overflow-hidden transition-all duration-300"
const glassHeader = "px-6 py-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-slate-50/40 dark:bg-slate-800/40 backdrop-blur-md"
const glassTableHead = "bg-slate-100/60 dark:bg-slate-950/60 backdrop-blur-xl sticky top-0 z-10 border-b border-slate-200/50 dark:border-slate-700/50"
const glassRow = "border-b border-slate-200/50 dark:border-slate-800/50 hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors group"

// ── Reusable Components ──────────────────────────────────────────────────────

const EmptyState = ({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center w-full min-w-0">
    <div className="w-12 h-12 rounded-full bg-slate-500/10 flex items-center justify-center mb-4 border border-slate-500/20 backdrop-blur-sm">
      <Icon className="w-6 h-6 text-slate-500" />
    </div>
    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h4>
    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">{desc}</p>
  </div>
)

const TableScroll = ({ children, maxHeight }: { children: React.ReactNode, maxHeight?: string }) => (
  <div
    className="w-full max-w-full overflow-x-auto scrollbar-thin"
    style={{ maxHeight: maxHeight ?? 'none', overflowY: maxHeight ? 'auto' : 'visible' }}
  >
    {children}
  </div>
)

// ── Main Component ───────────────────────────────────────────────────────────

export default function ComprehensiveIdentityTab({ dateRange }: { dateRange: { start: Date; end: Date } }) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => setMounted(true), [])

  const start = dateRange.start.toISOString().split('T')[0]
  const end = dateRange.end.toISOString().split('T')[0]

  const { data: users, isLoading: l1 } = useFetch<any[]>(['id-users'], '/api/identity?type=users')
  const { data: mfa, isLoading: l2 } = useFetch<any[]>(['id-mfa'], '/api/identity?type=mfa_status')
  const { data: inactiveUsers, isLoading: l3 } = useFetch<any[]>(['id-inactive'], '/api/identity?type=inactive_users')
  const { data: usersWithoutMfa, isLoading: l4 } = useFetch<any[]>(['id-no-mfa-users'], '/api/identity?type=users_without_mfa')
  const { data: authFailures, isLoading: l5 } = useFetch<any[]>(['id-auth-fails', start, end], `/api/identity?type=auth_failures&startDate=${start}&endDate=${end}`)
  const { data: authMethods, isLoading: l6 } = useFetch<any[]>(['id-auth-methods', start, end], `/api/identity?type=auth_method_success&startDate=${start}&endDate=${end}`)
  const { data: roleHierarchy, isLoading: l7 } = useFetch<any[]>(['id-role-hierarchy'], '/api/identity?type=role_hierarchy')
  const { data: accountAdminGrants, isLoading: l8 } = useFetch<any[]>(['id-aa-grants', start, end], `/api/identity?type=accountadmin_grants&startDate=${start}&endDate=${end}`)
  const { data: accountAdminNoMfa, isLoading: l9 } = useFetch<any[]>(['id-aa-no-mfa'], '/api/identity?type=accountadmin_no_mfa')
  const { data: oldestPasswords, isLoading: l10 } = useFetch<any[]>(['id-oldest-passwords'], '/api/identity?type=oldest_passwords')

  const isLoading = l1 || l2 || l3 || l4 || l5 || l6 || l7 || l8 || l9 || l10

  // Chart Configuration based on theme
  const isDark = resolvedTheme === 'dark'
  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
  const axisColor = isDark ? '#64748b' : '#94a3b8'

  const glassTooltip = {
    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.75)' : 'rgba(255, 255, 255, 0.75)',
    backdropFilter: 'blur(16px)',
    border: `1px solid ${isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.8)'}`,
    borderRadius: '12px',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
    color: isDark ? '#f8fafc' : '#0f172a',
    fontSize: '12px'
  }

  if (isLoading || !mounted) {
    return <div className="flex items-center justify-center py-24 w-full min-w-0"><Loader className="w-10 h-10 text-blue-500 animate-spin" /></div>
  }

  if (!(users?.length || mfa?.length || roleHierarchy?.length)) {
    return <EmptyState icon={Shield} title="No Identity Data" desc="Identity and access metrics are not available." />
  }

  const mfaEnabled = (mfa || []).filter((u) => u.HAS_MFA).length
  const mfaDisabled = (mfa || []).length - mfaEnabled
  const totalFailures = (authFailures || []).reduce((s, r) => s + Number(r.FAILURE_COUNT || 0), 0)

  const thClass = "py-3 px-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap"
  const tdClass = "py-3 px-4 text-xs"

  return (
    <div className="space-y-8 w-full min-w-0 overflow-hidden px-1">
      
      {/* ── KPI GRID ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 min-w-0">
        {[
          { label: 'Total Users', val: users?.length || 0, icon: Users, color: 'text-blue-500' },
          { label: 'MFA Enabled', val: mfaEnabled, icon: Shield, color: 'text-emerald-500' },
          { label: 'No MFA', val: mfaDisabled, icon: AlertTriangle, color: 'text-amber-500' },
          { label: 'Inactive (30d+)', val: inactiveUsers?.length || 0, icon: UserX, color: 'text-orange-500' },
          { label: 'Auth Failures', val: totalFailures, icon: Key, color: 'text-red-500' },
        ].map((item) => (
          <Card key={item.label} className={`${glassCard} p-5 hover:-translate-y-1 flex flex-col justify-center`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg bg-slate-500/10 border border-slate-500/20 backdrop-blur-sm`}>
                <item.icon className={`w-4 h-4 ${item.color}`} />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">{item.label}</p>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white truncate">{formatNumber(Number(item.val || 0))}</p>
          </Card>
        ))}
      </div>

      {/* ── AUTHENTICATION METRICS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
        
        {/* Auth Methods Chart */}
        <Card className={glassCard}>
          <CardHeader className={glassHeader}>
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider border-l-2 border-blue-500 pl-3">
              Authentication Methods
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 pl-3.5 mt-1">
              Successful authentications by method
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 flex-1 flex flex-col min-w-0">
            {authMethods && authMethods.length > 0 ? (
              <div className="w-full h-[320px] overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={authMethods} margin={{ bottom: 40, top: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="AUTHENTICATION_METHOD" stroke={axisColor} angle={-30} textAnchor="end" tick={{ fontSize: 10 }} dy={10} tickFormatter={(val) => shortenText(val, 15)} />
                    <YAxis stroke={axisColor} tick={{ fontSize: 10 }} width={45} />
                    <Tooltip contentStyle={glassTooltip} cursor={{ fill: gridColor }} />
{/* We moved fill="url(#authGradient)" directly to the Bar and removed the Cell */}
<Bar dataKey="CT" name="Success Count" radius={[4, 4, 0, 0]} maxBarSize={40} fill="url(#authGradient)" />
<defs>
                      <linearGradient id="authGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#1e3a8a" stopOpacity={0.4} />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyState icon={Activity} title="No Data" desc="No successful authentications recorded." />}
            <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
               <WidgetAIInsight title="Authentication Breakdown" widgetType="user_access" dateRange={dateRange} widgetId="id_auth_method_breakdown" widgetKind="chart" templateKey="auth_methods" dataSample={authMethods?.slice(0, 30) ?? []} />
            </div>
          </CardContent>
        </Card>

        {/* Auth Failures Table */}
        <Card className={glassCard}>
          <CardHeader className={glassHeader}>
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider border-l-2 border-red-500 pl-3">
              Authentication Failures
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 pl-3.5 mt-1">
              Top failed login attempts and reasons
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 min-w-0">
            {authFailures && authFailures.length > 0 ? (
              <TableScroll maxHeight="320px">
                <table className="w-full text-sm text-left">
                  <thead className={glassTableHead}>
                    <tr><th className={thClass}>User</th><th className={thClass}>Reason</th><th className={`${thClass} text-right`}>Failures</th></tr>
                  </thead>
                  <tbody>
                    {authFailures.map((r, i) => (
                      <tr key={i} className={glassRow}>
                        <td className={`${tdClass} font-medium text-slate-700 dark:text-slate-300`}>{shortenText(r.USER_NAME, 20)}</td>
                        <td className={`${tdClass} text-slate-600 dark:text-slate-400`} title={r.ERROR_MESSAGE}>{shortenText(r.ERROR_MESSAGE, 30)}</td>
                        <td className={`${tdClass} text-right font-bold text-red-600 dark:text-red-400`}>{formatNumber(r.FAILURE_COUNT)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            ) : <EmptyState icon={Shield} title="Secure" desc="No authentication failures detected." />}
            <div className="p-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-500/5 backdrop-blur-md">
              <WidgetAIInsight title="Authentication Failures" widgetType="user_access" dateRange={dateRange} widgetId="id_auth_failures" widgetKind="table" templateKey="auth_failures" dataSample={authFailures?.slice(0, 40) ?? []} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── USER RISK: MFA & INACTIVE ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
        
        {/* No MFA */}
        <Card className={glassCard}>
          <CardHeader className={glassHeader}>
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider border-l-2 border-amber-500 pl-3">
              Users without MFA
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 min-w-0">
            {usersWithoutMfa && usersWithoutMfa.length > 0 ? (
              <TableScroll maxHeight="320px">
                <table className="w-full text-sm text-left">
                  <thead className={glassTableHead}>
                    <tr><th className={thClass}>User</th><th className={thClass}>Type</th><th className={`${thClass} text-right`}>Last Login</th></tr>
                  </thead>
                  <tbody>
                    {usersWithoutMfa.map((r, i) => (
                      <tr key={i} className={glassRow}>
                        <td className={`${tdClass} font-medium text-slate-700 dark:text-slate-300`}>{r.USER_NAME}</td>
                        <td className={`${tdClass} text-slate-600 dark:text-slate-400`}>{r.TYPE}</td>
                        <td className={`${tdClass} text-right text-slate-500 dark:text-slate-400`}>{r.LAST_SUCCESS_LOGIN ? new Date(r.LAST_SUCCESS_LOGIN).toLocaleDateString() : 'Never'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            ) : <EmptyState icon={Lock} title="Fully Secured" desc="All users have MFA enabled." />}
            <div className="p-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-500/5 backdrop-blur-md">
              <WidgetAIInsight title="MFA Risk" widgetType="user_access" dateRange={dateRange} widgetId="id_users_without_mfa" widgetKind="table" templateKey="mfa_risk" dataSample={usersWithoutMfa?.slice(0, 40) ?? []} />
            </div>
          </CardContent>
        </Card>

        {/* Inactive Users */}
        <Card className={glassCard}>
          <CardHeader className={glassHeader}>
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider border-l-2 border-orange-500 pl-3">
              Inactive Users (30+ Days)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 min-w-0">
            {inactiveUsers && inactiveUsers.length > 0 ? (
              <TableScroll maxHeight="320px">
                <table className="w-full text-sm text-left">
                  <thead className={glassTableHead}>
                    <tr><th className={thClass}>User</th><th className={`${thClass} text-right`}>Last Login</th></tr>
                  </thead>
                  <tbody>
                    {inactiveUsers.map((r, i) => (
                      <tr key={i} className={glassRow}>
                        <td className={`${tdClass} font-medium text-slate-700 dark:text-slate-300`}>{r.user_name}</td>
                        <td className={`${tdClass} text-right text-slate-500 dark:text-slate-400`}>{r.last_login_time ? new Date(r.last_login_time).toLocaleDateString() : 'Never'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            ) : <EmptyState icon={Activity} title="Active Workforce" desc="No dormant users found." />}
            <div className="p-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-500/5 backdrop-blur-md">
              <WidgetAIInsight title="Inactive User Audit" widgetType="user_access" dateRange={dateRange} widgetId="id_inactive_users" widgetKind="table" templateKey="mfa_risk" dataSample={inactiveUsers?.slice(0, 40) ?? []} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── PRIVILEGED ACCESS: ROLES & GRANTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
        
        {/* Role Hierarchy */}
        <Card className={glassCard}>
          <CardHeader className={glassHeader}>
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider border-l-2 border-purple-500 pl-3">
              Users Under Role
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 pl-3.5 mt-1">
              Active role grants matrix
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 min-w-0">
            {roleHierarchy && roleHierarchy.length > 0 ? (
              <TableScroll maxHeight="400px">
                <table className="w-full text-sm text-left">
                  <thead className={glassTableHead}>
                    <tr><th className={thClass}>User</th><th className={thClass}>Role</th><th className={thClass}>Granted By</th></tr>
                  </thead>
                  <tbody>
                    {roleHierarchy.map((r, i) => (
                      <tr key={i} className={glassRow}>
                        <td className={`${tdClass} font-medium text-slate-700 dark:text-slate-300`}>{shortenText(r.GRANTEE_NAME, 20)}</td>
                        <td className={`${tdClass} font-bold text-slate-900 dark:text-slate-100`}>{shortenText(r.ROLE, 20)}</td>
                        <td className={`${tdClass} text-slate-500 dark:text-slate-400`}>{r.GRANTED_BY}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            ) : <EmptyState icon={Users} title="No Roles" desc="Hierarchy data not loaded." />}
            <div className="p-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-500/5 backdrop-blur-md">
              <WidgetAIInsight title="Role Entitlements" widgetType="user_access" dateRange={dateRange} widgetId="id_users_under_role" widgetKind="table" templateKey="access_risk" dataSample={roleHierarchy?.slice(0, 40) ?? []} />
            </div>
          </CardContent>
        </Card>

        {/* ACCOUNTADMIN Grants */}
        <Card className={glassCard}>
          <CardHeader className={glassHeader}>
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider border-l-2 border-red-600 pl-3">
              ACCOUNTADMIN Grants
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 pl-3.5 mt-1">
              High-privilege capability assignments
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 min-w-0">
            {accountAdminGrants && accountAdminGrants.length > 0 ? (
              <TableScroll maxHeight="400px">
                <table className="w-full text-sm text-left">
                  <thead className={glassTableHead}>
                    <tr><th className={thClass}>Description</th><th className={thClass}>Statement</th></tr>
                  </thead>
                  <tbody>
                    {accountAdminGrants.map((r, i) => (
                      <tr key={i} className={glassRow}>
                        <td className={`${tdClass} text-slate-700 dark:text-slate-300`}>{shortenText(r.DESCRIPTION, 30)}</td>
                        <td className={`${tdClass} text-slate-500 dark:text-slate-400 font-mono`}>{shortenText(r.STATEMENT, 40)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            ) : <EmptyState icon={Shield} title="No Escallations" desc="No ACCOUNTADMIN grants in this period." />}
            <div className="p-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-500/5 backdrop-blur-md">
              <WidgetAIInsight title="Privilege Escalation Review" widgetType="user_access" dateRange={dateRange} widgetId="id_accountadmin_grants" widgetKind="table" templateKey="access_risk" dataSample={accountAdminGrants?.slice(0, 25) ?? []} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── SECURITY AUDIT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
        
        {/* AA No MFA */}
        <Card className={glassCard}>
          <CardHeader className={glassHeader}>
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider border-l-2 border-red-500 pl-3">
              ACCOUNTADMINs Without MFA
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 min-w-0">
            {accountAdminNoMfa && accountAdminNoMfa.length > 0 ? (
              <TableScroll maxHeight="300px">
                <table className="w-full text-sm text-left">
                  <thead className={glassTableHead}>
                    <tr><th className={thClass}>Name</th><th className={`${thClass} text-right`}>Last Login</th><th className={`${thClass} text-right`}>Password Age</th></tr>
                  </thead>
                  <tbody>
                    {accountAdminNoMfa.map((r, i) => (
                      <tr key={i} className={glassRow}>
                        <td className={`${tdClass} font-bold text-red-600 dark:text-red-400`}>{r.NAME}</td>
                        <td className={`${tdClass} text-right text-slate-600 dark:text-slate-400`}>{r.last_login}</td>
                        <td className={`${tdClass} text-right text-slate-600 dark:text-slate-400`}>{r.password_age}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            ) : <EmptyState icon={Shield} title="No Critical Risk" desc="All admins use MFA." />}
            <div className="p-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-500/5 backdrop-blur-md">
              <WidgetAIInsight title="Admin Security Check" widgetType="user_access" dateRange={dateRange} widgetId="id_accountadmin_no_mfa" widgetKind="table" templateKey="mfa_risk" dataSample={accountAdminNoMfa?.slice(0, 25) ?? []} />
            </div>
          </CardContent>
        </Card>

        {/* Oldest Passwords */}
        <Card className={glassCard}>
          <CardHeader className={glassHeader}>
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider border-l-2 border-amber-500 pl-3">
              Oldest Passwords
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 min-w-0">
            {oldestPasswords && oldestPasswords.length > 0 ? (
              <TableScroll maxHeight="300px">
                <table className="w-full text-sm text-left">
                  <thead className={glassTableHead}>
                    <tr><th className={thClass}>Name</th><th className={`${thClass} text-right`}>Last Changed</th></tr>
                  </thead>
                  <tbody>
                    {oldestPasswords.map((r, i) => (
                      <tr key={i} className={glassRow}>
                        <td className={`${tdClass} font-medium text-slate-700 dark:text-slate-300`}>{r.NAME}</td>
                        <td className={`${tdClass} text-right font-mono text-slate-500 dark:text-slate-400`}>{r.password_last_changed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            ) : <EmptyState icon={FileText} title="Healthy Rotation" desc="No excessively old passwords." />}
            <div className="p-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-500/5 backdrop-blur-md">
              <WidgetAIInsight title="Password Rotation Audit" widgetType="user_access" dateRange={dateRange} widgetId="id_oldest_passwords" widgetKind="table" templateKey="mfa_risk" dataSample={oldestPasswords?.slice(0, 25) ?? []} />
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  )
}