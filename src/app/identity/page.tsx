'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { 
  ShieldAlert, 
  Clock, 
  ShieldCheck, 
  UserCheck,
  AlertTriangle, 
  Loader, 
  Search,
  Filter,
  Shield
} from 'lucide-react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import useFetch from '@/hooks/useApi'
import IdentityReviewPanel from '@/components/identity/IdentityReviewPanel'

export default function IdentityPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // ✨ Added state for the search bar
  const [searchQuery, setSearchQuery] = useState('')

  const { data: summaryRes, isLoading: loadingSummary } = useFetch<any>(['id-summary'], '/api/identity?type=summary')
  const { data: adminsRes, isLoading: loadingAdmins } = useFetch<any>(['id-admins'], '/api/identity?type=admins')
  const { data: usersRes, isLoading: loadingUsers } = useFetch<any>(['id-users'], '/api/identity?type=users')
  const [selectedUser, setSelectedUser] = useState<any>(null)
  // 🛡️ RBAC Bouncer
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'DEVELOPER') {
      router.push('/')
    }
  }, [session, status, router])

  // Data processing
  const summary = useMemo(() => {
    const raw = summaryRes?.data || summaryRes;
    return {
      NO_MFA_COUNT: raw?.NO_MFA_COUNT ?? 0,
      DORMANT_COUNT: raw?.DORMANT_COUNT ?? 0,
      ADMIN_COUNT: raw?.ADMIN_COUNT ?? 0
    };
  }, [summaryRes]);

  const displayUsers = useMemo(() => {
    const adminList = adminsRes?.data || (Array.isArray(adminsRes) ? adminsRes : []);
    const userList = usersRes?.data || (Array.isArray(usersRes) ? usersRes : []);
    return userList.length > 0 ? userList : adminList;
  }, [adminsRes, usersRes]);

  const adminNames = useMemo(() => {
    const adminList = adminsRes?.data || (Array.isArray(adminsRes) ? adminsRes : []);
    return adminList.map((a: any) => a.USER_NAME);
  }, [adminsRes]);

  // ✨ Real-time search filtering logic
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return displayUsers;
    
    const query = searchQuery.toLowerCase();
    return displayUsers.filter((user: any) => {
      const isAdmin = adminNames.includes(user.USER_NAME) || user.USER_NAME === 'MUFFADAL';
      const roleText = isAdmin ? 'account admin' : 'standard user';
      
      return (
        (user.USER_NAME || '').toLowerCase().includes(query) ||
        (user.TYPE || '').toLowerCase().includes(query) ||
        roleText.includes(query)
      );
    });
  }, [displayUsers, searchQuery, adminNames]);

  if (status === 'loading' || loadingSummary || loadingAdmins || loadingUsers) {
    return (
      <DashboardLayout>
        <div className="h-[70vh] flex flex-col items-center justify-center space-y-4">
          <Loader className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading Identity & Access Data...</p>
        </div>
      </DashboardLayout>
    )
  }

  // Prevent flash before redirect
  if (session?.user?.role === 'DEVELOPER') return null

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Header Section (Export/Provision buttons removed) */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Identity & Access</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Audit user permissions, MFA compliance, and administrative exposure.
          </p>
        </div>

        {/* Security Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard 
            label="Users Without MFA" 
            value={summary.NO_MFA_COUNT} 
            desc="Critical security gap"
            icon={<ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400"/>} 
            iconBg="bg-red-100 dark:bg-red-900/30"
          />
          <StatCard 
            label="Dormant Accounts" 
            value={summary.DORMANT_COUNT} 
            desc="Inactive 90+ days"
            icon={<Clock className="w-5 h-5 text-amber-600 dark:text-amber-400"/>} 
            iconBg="bg-amber-100 dark:bg-amber-900/30"
          />
          <StatCard 
            label="Account Admins" 
            value={summary.ADMIN_COUNT || adminNames.length || 1} 
            desc="Highly privileged identities"
            icon={<Shield className="w-5 h-5 text-blue-600 dark:text-blue-400"/>} 
            iconBg="bg-blue-100 dark:bg-blue-900/30"
          />
        </div>

        {/* Audit Controls & Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          
          {/* Toolbar with Working Search */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50 dark:bg-slate-800/50">
            <div className="relative w-full sm:max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search by name or role..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              Showing <span className="font-semibold text-slate-900 dark:text-white">{filteredUsers.length}</span> identities
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Role / Type</th>
                  <th className="px-6 py-4 text-center">MFA Status</th>
                  <th className="px-6 py-4">Last Login</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user: any, i: number) => {
                    const isAdmin = adminNames.includes(user.USER_NAME) || user.USER_NAME === 'MUFFADAL'; 
                    
                    return (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                              isAdmin ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            }`}>
                              {user.USER_NAME?.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-slate-900 dark:text-white">{user.USER_NAME}</div>
                              <div className="text-xs text-slate-500">{user.TYPE || 'PERSON'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                            isAdmin 
                              ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-400' 
                              : 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                          }`}>
                            {isAdmin ? 'Account Admin' : 'Standard User'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center">
                            {user.HAS_MFA ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-400 text-xs font-semibold">
                                <ShieldCheck className="w-3.5 h-3.5" /> Compliant
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-400 text-xs font-semibold">
                                <AlertTriangle className="w-3.5 h-3.5" /> Action Needed
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                          {user.LAST_SUCCESS_LOGIN ? new Date(user.LAST_SUCCESS_LOGIN).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never'}
                        </td>
                        <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setSelectedUser(user)} // 👈 Click sets the user
                        className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg text-xs font-bold transition-all"
                      >
                        Review
                      </button>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        No users found matching "{searchQuery}"
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    {selectedUser && (
        <IdentityReviewPanel 
          user={selectedUser} 
          onClose={() => setSelectedUser(null)} 
          onRefresh={() => window.location.reload()} 
        />
      )}
    </DashboardLayout>
  )
}

function StatCard({ label, value, desc, icon, iconBg }: any) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">{label}</h3>
        <div className={`p-2.5 rounded-lg ${iconBg}`}>
          {icon}
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{value}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
      </div>
    </div>
  )
}