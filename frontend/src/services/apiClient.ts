import { authService } from './authService'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8080' : '')).replace(/\/$/, '')

export async function apiClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = authService.getToken()
  const headers = new Headers(options.headers || {})

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    if (token.startsWith('mock-jwt-')) {
      authService.clearSession()
    } else {
      headers.set('Authorization', `Bearer ${token}`)
    }
  }

  // Ensure strict zero-cache policy on mobile browsers and edge proxies
  headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
  headers.set('Pragma', 'no-cache')
  headers.set('Expires', '0')

  const method = (options.method || 'GET').toUpperCase()
  let url = `${API_BASE_URL}${endpoint}`
  if (method === 'GET' || method === 'HEAD') {
    const separator = url.includes('?') ? '&' : '?'
    url = `${url}${separator}_t=${Date.now()}`
  }

  let response: Response
  try {
    response = await fetch(url, {
      cache: 'no-store',
      ...options,
      headers
    })
  } catch (err: any) {
    throw new Error(`Network error connecting to backend: ${err.message}`)
  }

  if (response.status === 401) {
    authService.clearSession()
  }

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new Error(`Backend endpoint ${endpoint} unavailable (HTTP ${response.status})`)
  }

  const json = await response.json()
  if (!response.ok || !json.success) {
    throw new Error(json.message || `Request failed with status ${response.status}`)
  }

  return json.data as T
}
