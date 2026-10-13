import { authService } from './authService'
import { API_BASE_URL } from './config'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function apiClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const token = authService.getToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, { cache: 'no-store', ...options, headers })
  } catch (err) {
    throw new ApiError(`Cannot reach the server: ${(err as Error).message}`, 0)
  }

  if (response.status === 401) {
    authService.clearSession()
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new ApiError(`Server unavailable (HTTP ${response.status})`, response.status)
  }

  const json = await response.json()
  if (!response.ok || !json.success) {
    throw new ApiError(json.message || `Request failed with status ${response.status}`, response.status)
  }
  return json.data as T
}
