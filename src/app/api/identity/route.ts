import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt' // ✨ The Bouncer
import {
  getUsers,
  getUsersByRole,
  getAuthFailures,
  getMFAStatus,
  getRoleHierarchy,
  getInactiveUsers,
  getUsersWithoutMFA,
  getAuthMethodSuccess,
  getAccountAdminGrants,
  getAccountAdminNoMFA,
  getOldestPasswords,
  // 👇 Our 3 New Security Functions
  getIdentityRiskSummary,
  getAccountAdmins,
  getOverPrivilegedRoles,
} from '@/lib/snowflake/queries'
import type { APIResponse } from '@/types'

export async function GET(request: NextRequest) {
  try {
    // 🚨 1. THE BOUNCER CHECK 🚨
    // const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    
    // // Only allow Workspace Admins - Identity data is too sensitive for Developers
    // if (!token || token.role !== 'WORKSPACE_ADMIN') {
    //   return NextResponse.json<APIResponse<any>>(
    //     { 
    //       status: 'error', 
    //       error: { message: 'Forbidden: Admin access required', code: 'ACCESS_DENIED' }, 
    //       timestamp: new Date().toISOString() 
    //     },
    //     { status: 403 }
    //   )
    // }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'users'
    const role = searchParams.get('role') || 'ACCOUNTADMIN'
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0]
    const limit = parseInt(searchParams.get('limit') || '100', 10)

    let data

    switch (type) {
      // ✨ New Security Types
      case 'summary':
        data = await getIdentityRiskSummary()
        break
      case 'admins':
        data = await getAccountAdmins()
        break
      case 'risky_roles':
        data = await getOverPrivilegedRoles()
        break
      
      // Existing Functions
      case 'users':
        data = await getUsers()
        break
      case 'users_by_role':
        data = await getUsersByRole(role)
        break
      case 'auth_failures':
        data = await getAuthFailures(startDate, endDate, limit)
        break
      case 'mfa_status':
        data = await getMFAStatus()
        break
      case 'role_hierarchy':
        data = await getRoleHierarchy()
        break
      case 'inactive_users':
        data = await getInactiveUsers()
        break
      case 'users_without_mfa':
        data = await getUsersWithoutMFA()
        break
      case 'auth_method_success':
        data = await getAuthMethodSuccess(startDate, endDate)
        break
      case 'accountadmin_grants':
        data = await getAccountAdminGrants(startDate, endDate)
        break
      case 'accountadmin_no_mfa':
        data = await getAccountAdminNoMFA()
        break
      case 'oldest_passwords':
        data = await getOldestPasswords()
        break
      default:
        return NextResponse.json<APIResponse<any>>(
          { status: 'error', error: { message: 'Invalid identity type', code: 'INVALID_TYPE' }, timestamp: new Date().toISOString() },
          { status: 400 }
        )
    }

    return NextResponse.json<APIResponse<any>>(
      { status: 'success', data, timestamp: new Date().toISOString() },
      { status: 200 }
    )
  } catch (error) {
    console.error('Identity API error:', error)
    return NextResponse.json<APIResponse<any>>(
      {
        status: 'error',
        error: { message: error instanceof Error ? error.message : 'Internal server error', code: 'SERVER_ERROR' },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}