'use client'

import useFetch from '@/hooks/useApi'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader, AlertCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatNumber } from '@/lib/formatting'
import WidgetAIInsight from '@/components/ai/WidgetAIInsight'

export default function ComprehensiveIdentityTab({ dateRange }: { dateRange: { start: Date; end: Date } }) {
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
  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader className="w-8 h-8 text-blue-400 animate-spin" /></div>

  if (!(users?.length || mfa?.length || roleHierarchy?.length)) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
        <p className="text-slate-400">No identity data available</p>
      </div>
    )
  }

  const mfaEnabled = (mfa || []).filter((u) => u.HAS_MFA).length
  const mfaDisabled = (mfa || []).length - mfaEnabled
  const totalFailures = (authFailures || []).reduce((s, r) => s + Number(r.FAILURE_COUNT || 0), 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          ['Users', users?.length || 0],
          ['MFA Enabled', mfaEnabled],
          ['No MFA', mfaDisabled],
          ['Inactive (30d+)', inactiveUsers?.length || 0],
          ['Auth Failures', totalFailures],
        ].map(([label, value]) => (
          <Card key={String(label)} className="bg-slate-900 border-slate-700">
            <CardContent className="pt-6">
              <p className="text-xs text-slate-400">{label}</p>
              <p className="text-2xl font-semibold text-white mt-1">{formatNumber(Number(value))}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-base">Authentication Breakdown by Method (Success)</CardTitle>
            <CardDescription>Mart `AUTHN_METHOD_SUCCESS_DAILY` aggregated by date range</CardDescription>
          </CardHeader>
          <CardContent>
            {authMethods && authMethods.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={authMethods}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="AUTHENTICATION_METHOD" angle={-30} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="CT" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-72 flex items-center justify-center text-slate-400">No auth method data</div>}
            <WidgetAIInsight
              title="Authentication Breakdown by Method (Success)"
              widgetType="user_access"
              dateRange={dateRange}
              widgetId="id_auth_method_breakdown"
              widgetKind="chart"
              templateKey="auth_methods"
              dataSample={authMethods?.slice(0, 30) ?? []}
            />
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-base">Authentication Failures by User & Reason</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs lh-dark-table">
                <thead><tr className="border-b border-slate-700"><th className="text-left py-2 px-2">User</th><th className="text-left py-2 px-2">Reason</th><th className="text-right py-2 px-2">Failures</th></tr></thead>
                <tbody>
                  {(authFailures || []).map((r, i) => (
                    <tr key={i} className="border-b border-slate-800">
                      <td className="py-2 px-2 text-slate-300">{r.USER_NAME}</td>
                      <td className="py-2 px-2 text-slate-400">{r.ERROR_MESSAGE}</td>
                      <td className="py-2 px-2 text-right text-red-300">{formatNumber(r.FAILURE_COUNT)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <WidgetAIInsight
              title="Authentication Failures by User & Reason"
              widgetType="user_access"
              dateRange={dateRange}
              widgetId="id_auth_failures"
              widgetKind="table"
              templateKey="auth_failures"
              dataSample={authFailures?.slice(0, 40) ?? []}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader><CardTitle className="text-base">Users without MFA</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs lh-dark-table">
                <thead><tr className="border-b border-slate-700"><th className="text-left py-2 px-2">User</th><th className="text-left py-2 px-2">Type</th><th className="text-left py-2 px-2">Last Login</th></tr></thead>
                <tbody>
                  {(usersWithoutMfa || []).map((r, i) => (
                    <tr key={i} className="border-b border-slate-800">
                      <td className="py-2 px-2 text-slate-300">{r.USER_NAME}</td>
                      <td className="py-2 px-2 text-slate-400">{r.TYPE}</td>
                      <td className="py-2 px-2 text-slate-400">{r.LAST_SUCCESS_LOGIN ? new Date(r.LAST_SUCCESS_LOGIN).toLocaleString() : 'Never'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <WidgetAIInsight
              title="Users without MFA"
              widgetType="user_access"
              dateRange={dateRange}
              widgetId="id_users_without_mfa"
              widgetKind="table"
              templateKey="mfa_risk"
              dataSample={usersWithoutMfa?.slice(0, 40) ?? []}
            />
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader><CardTitle className="text-base">Inactive Users (30+ days)</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs lh-dark-table">
                <thead><tr className="border-b border-slate-700"><th className="text-left py-2 px-2">User</th><th className="text-left py-2 px-2">Last Login</th></tr></thead>
                <tbody>
                  {(inactiveUsers || []).map((r, i) => (
                    <tr key={i} className="border-b border-slate-800">
                      <td className="py-2 px-2 text-slate-300">{r.user_name}</td>
                      <td className="py-2 px-2 text-slate-400">{r.last_login_time ? new Date(r.last_login_time).toLocaleDateString() : 'Never'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <WidgetAIInsight
              title="Inactive Users (30+ days)"
              widgetType="user_access"
              dateRange={dateRange}
              widgetId="id_inactive_users"
              widgetKind="table"
              templateKey="mfa_risk"
              dataSample={inactiveUsers?.slice(0, 40) ?? []}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader><CardTitle className="text-base">Users Under Role (Active Grants)</CardTitle><CardDescription>{roleHierarchy?.length || 0} grants</CardDescription></CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs lh-dark-table">
                <thead><tr className="border-b border-slate-700"><th className="text-left py-2 px-2">User</th><th className="text-left py-2 px-2">Role</th><th className="text-left py-2 px-2">Granted By</th></tr></thead>
                <tbody>
                  {(roleHierarchy || []).map((r, i) => (
                    <tr key={i} className="border-b border-slate-800">
                      <td className="py-2 px-2 text-slate-300">{r.GRANTEE_NAME}</td>
                      <td className="py-2 px-2 text-slate-200">{r.ROLE}</td>
                      <td className="py-2 px-2 text-slate-400">{r.GRANTED_BY}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <WidgetAIInsight
              title="Users Under Role (Active Grants)"
              widgetType="user_access"
              dateRange={dateRange}
              widgetId="id_users_under_role"
              widgetKind="table"
              templateKey="access_risk"
              dataSample={roleHierarchy?.slice(0, 40) ?? []}
            />
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader><CardTitle className="text-base">ACCOUNTADMIN Grants (Successful)</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs lh-dark-table">
                <thead><tr className="border-b border-slate-700"><th className="text-left py-2 px-2">Description</th><th className="text-left py-2 px-2">Statement</th></tr></thead>
                <tbody>
                  {(accountAdminGrants || []).map((r, i) => (
                    <tr key={i} className="border-b border-slate-800">
                      <td className="py-2 px-2 text-slate-300">{r.DESCRIPTION}</td>
                      <td className="py-2 px-2 text-slate-400 font-mono">{r.STATEMENT}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <WidgetAIInsight
              title="ACCOUNTADMIN Grants (Successful)"
              widgetType="user_access"
              dateRange={dateRange}
              widgetId="id_accountadmin_grants"
              widgetKind="table"
              templateKey="access_risk"
              dataSample={accountAdminGrants?.slice(0, 25) ?? []}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader><CardTitle className="text-base">ACCOUNTADMIN Users Without MFA</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs lh-dark-table">
                <thead><tr className="border-b border-slate-700"><th className="text-left py-2 px-2">Name</th><th className="text-left py-2 px-2">Last Login</th><th className="text-left py-2 px-2">Password Age</th></tr></thead>
                <tbody>
                  {(accountAdminNoMfa || []).map((r, i) => (
                    <tr key={i} className="border-b border-slate-800">
                      <td className="py-2 px-2 text-slate-300">{r.NAME}</td>
                      <td className="py-2 px-2 text-slate-400">{r.last_login}</td>
                      <td className="py-2 px-2 text-slate-400">{r.password_age}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <WidgetAIInsight
              title="ACCOUNTADMIN Users Without MFA"
              widgetType="user_access"
              dateRange={dateRange}
              widgetId="id_accountadmin_no_mfa"
              widgetKind="table"
              templateKey="mfa_risk"
              dataSample={accountAdminNoMfa?.slice(0, 25) ?? []}
            />
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader><CardTitle className="text-base">Users by Oldest Passwords</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs lh-dark-table">
                <thead><tr className="border-b border-slate-700"><th className="text-left py-2 px-2">Name</th><th className="text-left py-2 px-2">Password Last Changed</th></tr></thead>
                <tbody>
                  {(oldestPasswords || []).map((r, i) => (
                    <tr key={i} className="border-b border-slate-800">
                      <td className="py-2 px-2 text-slate-300">{r.NAME}</td>
                      <td className="py-2 px-2 text-slate-400">{r.password_last_changed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <WidgetAIInsight
              title="Users by Oldest Passwords"
              widgetType="user_access"
              dateRange={dateRange}
              widgetId="id_oldest_passwords"
              widgetKind="table"
              templateKey="mfa_risk"
              dataSample={oldestPasswords?.slice(0, 25) ?? []}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
