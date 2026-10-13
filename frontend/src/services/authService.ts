import type { User } from '@/types'

const TOKEN_KEY = 'docspace_jwt_token'
const USER_KEY = 'docspace_current_user'
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8080' : '')).replace(/\/$/, '')

export interface AuthResponseData {
  token: string
  user: {
    id: string
    email: string
    name: string
  }
}

export class AuthService {
  getToken(): string | null {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token && token.startsWith('mock-jwt-')) {
      this.clearSession()
      return null
    }
    return token
  }

  getCurrentUser(): User | null {
    const token = this.getToken()
    if (!token) return null
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  saveSession(token: string, user: { id: string; email: string; name: string }): void {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(
      USER_KEY,
      JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.name
      })
    )
  }

  clearSession(): void {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  async register(email: string, name: string, password: string): Promise<User> {
    const url = `${API_BASE_URL}/api/auth/register`
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password })
      })
    } catch (err: any) {
      throw new Error(`Failed to connect to backend at ${url}: ${err.message}. Ensure backend is running.`)
    }

    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      throw new Error(`Backend unavailable at ${url} (HTTP ${res.status})`)
    }

    const body = await res.json()
    if (!res.ok || !body.success) {
      throw new Error(body.message || 'Registration failed')
    }

    const data: AuthResponseData = body.data
    this.saveSession(data.token, data.user)
    return data.user
  }

  async login(email: string, password: string): Promise<User> {
    const url = `${API_BASE_URL}/api/auth/login`
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
    } catch (err: any) {
      throw new Error(`Failed to connect to backend at ${url}: ${err.message}. Ensure backend is running.`)
    }

    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      throw new Error(`Backend unavailable at ${url} (HTTP ${res.status})`)
    }

    const body = await res.json()
    if (!res.ok || !body.success) {
      throw new Error(body.message || 'Invalid email or password')
    }

    const data: AuthResponseData = body.data
    this.saveSession(data.token, data.user)
    return data.user
  }
}

export const authService = new AuthService()
