import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import type { APIResponse } from '@/types'

// Fetch hook
export function useFetch<T>(
  key: string | string[],
  url: string,
  options?: {
    enabled?: boolean
    staleTime?: number
    gcTime?: number
  }
) {
  return useQuery<T, Error>({
    queryKey: typeof key === 'string' ? [key] : key,
    queryFn: async () => {
      const response = await apiClient.get<APIResponse<T>>(url)
      const payload = response.data

      if (!payload) throw new Error('No response returned')
      if (payload.status === 'error') {
        throw new Error(payload.error?.message || 'API request failed')
      }
      if (typeof payload.data === 'undefined') {
        throw new Error('No data returned')
      }

      return payload.data
    },
    staleTime: options?.staleTime || 1000 * 60,
    gcTime: options?.gcTime || 1000 * 60 * 5,
    enabled: options?.enabled ?? true,
  })
}

// Mutation hook
export function useMutate<TData, TVariables>(
  mutationFn: (data: TVariables) => Promise<TData>,
  options?: {
    onSuccess?: (data: TData) => void
    onError?: (error: Error) => void
  }
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      queryClient.invalidateQueries()
      options?.onSuccess?.(data)
    },
    onError: (error) => {
      options?.onError?.(error)
    },
  })
}

export default useFetch
