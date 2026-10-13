import { authService } from './authService'

export async function apiClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = authService.getToken()
  const headers = new Headers(options.headers || {})

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(endpoint, {
    ...options,
    headers
  })

  // Handle 401 Unauthorized by clearing session if expired
  if (response.status === 401) {
    authService.clearSession()
  }

  const json = await response.json()
  if (!response.ok || !json.success) {
    throw new Error(json.message || `Request failed with status ${response.status}`)
  }

  return json.data as T
}
