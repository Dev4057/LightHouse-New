'use client'

import useFetch from '@/hooks/useApi'
import { Loader, AlertCircle } from 'lucide-react'
import type { Grant } from '@/types'

export default function RoleHierarchyTab() {
  const { data, isLoading, error } = useFetch<Grant[]>(['role-hierarchy'], '/api/identity?type=role_hierarchy')

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
          <p className="font-semibold text-red-200">Error loading role hierarchy</p>
          <p className="text-sm text-red-300">{error.message}</p>
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">No role hierarchy data available</p>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold text-white">Role Hierarchy and Privileges</h3>
        <p className="text-sm text-slate-400 mt-1">{data.length} grants</p>
      </div>

      <div className="card-body">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-4 font-semibold text-slate-300">Grantee</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-300">Role</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-300">Granted By</th>
              </tr>
            </thead>
            <tbody>
              {data.map((grant, idx) => (
                <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="py-3 px-4 text-slate-300">{grant.GRANTEE_NAME || '-'}</td>
                  <td className="py-3 px-4 text-slate-300">{grant.ROLE || '-'}</td>
                  <td className="py-3 px-4 text-slate-400 text-xs">{grant.GRANTED_BY || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

