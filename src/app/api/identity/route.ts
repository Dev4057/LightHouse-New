import { NextRequest, NextResponse } from 'next/server'
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
} from '@/lib/snowflake/queries'
import type { APIResponse } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'users'
    const role = searchParams.get('role') || 'ACCOUNTADMIN'
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0]
    const limit = parseInt(searchParams.get('limit') || '100', 10)

    let data

    switch (type) {
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
