'use client'

import useFetch from '@/hooks/useApi'
import { Loader, AlertCircle, User as UserIcon } from 'lucide-react'
import type { User } from '@/types'

export default function UsersTab() {
  const { data, isLoading, error } = useFetch<User[]>(['users'], '/api/identity?type=users')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
        <div>
          <p className="font-semibold text-red-200">Error loading users</p>
          <p className="text-sm text-red-300">{error.message}</p>
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">No users found</p>
      </div>
    )
  }

  const activeUsers = data.filter((u) => !u.DISABLED)
  const disabledUsers = data.filter((u) => u.DISABLED)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <div className="card-body text-center">
            <p className="text-slate-400">Total Users</p>
            <p className="text-3xl font-bold text-blue-400 mt-2">{data.length}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center">
            <p className="text-slate-400">Active Users</p>
            <p className="text-3xl font-bold text-green-400 mt-2">{activeUsers.length}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center">
            <p className="text-slate-400">Disabled Users</p>
            <p className="text-3xl font-bold text-yellow-400 mt-2">{disabledUsers.length}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-white">User Directory</h3>
        </div>

        <div className="card-body overflow-x-auto">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-cell">User Name</th>
                <th className="table-cell">Default Role</th>
                <th className="table-cell">Default Warehouse</th>
                <th className="table-cell">Auth Method</th>
                <th className="table-cell">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((user, idx) => (
                <tr key={idx} className="table-row">
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-600/30 flex items-center justify-center">
                        <UserIcon className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-100">{user.USER_NAME}</p>
                        <p className="text-xs text-slate-400">
                          Created: {new Date(user.CREATED_ON).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell text-slate-300">{user.DEFAULT_ROLE || '—'}</td>
                  <td className="table-cell text-slate-300">{user.DEFAULT_WAREHOUSE || '—'}</td>
                  <td className="table-cell">
                    <div className="text-xs space-y-1">
                      {user.HAS_PASSWORD && <span className="badge badge-primary">Password</span>}
                      {user.HAS_RSA_PUBLIC_KEY && <span className="badge badge-primary">RSA Key</span>}
                      {user.HAS_MFA && <span className="badge badge-success">MFA</span>}
                    </div>
                  </td>
                  <td className="table-cell">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        user.DISABLED ? 'bg-red-900/30 text-red-200' : 'bg-green-900/30 text-green-200'
                      }`}
                    >
                      {user.DISABLED ? 'Disabled' : 'Active'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
