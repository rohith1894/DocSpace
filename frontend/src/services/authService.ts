import type { User } from '@/types'

const TOKEN_KEY = 'docspace_jwt_token'
const USER_KEY = 'docspace_current_user'

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
    return localStorage.getItem(TOKEN_KEY)
  }

  getCurrentUser(): User | null {
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
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, password })
    })

    const body = await res.json()
    if (!res.ok || !body.success) {
      throw new Error(body.message || 'Registration failed')
    }

    const data: AuthResponseData = body.data
    this.saveSession(data.token, data.user)
    return data.user
  }

  async login(email: string, password: string): Promise<User> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })

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
