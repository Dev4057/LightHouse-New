import axios from 'axios'
import type { APIResponse } from '@/types'

function resolveApiBaseUrl() {
  const envUrl = (process.env.NEXT_PUBLIC_API_URL || '').trim()
  if (typeof window === 'undefined') {
    return envUrl || '/api'
  }

  if (!envUrl) {
    return '/api'
  }

  try {
    const parsed = new URL(envUrl, window.location.origin)
    const localHosts = new Set(['localhost', '127.0.0.1', '::1'])
    const envIsAbsolute = /^https?:\/\//i.test(envUrl)
    const envIsLocalhost = localHosts.has(parsed.hostname.toLowerCase())
    const pageIsLocalhost = localHosts.has(window.location.hostname.toLowerCase())

    // When the app is accessed via a public domain/tunnel, avoid hardcoded localhost API calls.
    if (envIsAbsolute && envIsLocalhost && !pageIsLocalhost) {
      return '/api'
    }

    // If the env points to the same origin, keep only the pathname to stay same-origin.
    if (envIsAbsolute && parsed.origin === window.location.origin) {
      return parsed.pathname || '/api'
    }
  } catch {
    return '/api'
  }

  return envUrl
}

const API_URL = resolveApiBaseUrl()

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

function normalizeApiUrl(url?: string, baseURL?: string) {
  if (!url || !baseURL) return url
  if (/^https?:\/\//i.test(url)) return url

  const normalizedBase = baseURL.replace(/\/+$/, '')
  const normalizedUrl = url.startsWith('/') ? url : `/${url}`

  if (normalizedBase.endsWith('/api') && normalizedUrl.startsWith('/api/')) {
    return normalizedUrl.replace(/^\/api/, '')
  }

  return normalizedUrl
}

// Add request interceptor
apiClient.interceptors.request.use(
  (config) => {
    config.url = normalizeApiUrl(config.url, config.baseURL)
    // Add any auth tokens here if needed
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Add response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error?.message || error.message || 'An error occurred'
    return Promise.reject(new Error(message))
  }
)

export async function get<T>(url: string, config = {}): Promise<APIResponse<T>> {
  const response = await apiClient.get<APIResponse<T>>(url, config)
  return response.data
}

export async function post<T>(url: string, data: unknown, config = {}): Promise<APIResponse<T>> {
  const response = await apiClient.post<APIResponse<T>>(url, data, config)
  return response.data
}

export async function put<T>(url: string, data: unknown, config = {}): Promise<APIResponse<T>> {
  const response = await apiClient.put<APIResponse<T>>(url, data, config)
  return response.data
}

export async function patch<T>(url: string, data: unknown, config = {}): Promise<APIResponse<T>> {
  const response = await apiClient.patch<APIResponse<T>>(url, data, config)
  return response.data
}

export async function deleteFn<T>(url: string, config = {}): Promise<APIResponse<T>> {
  const response = await apiClient.delete<APIResponse<T>>(url, config)
  return response.data
}

export default apiClient
