import type { User } from '@/types'
import { API_BASE_URL } from './config'

const TOKEN_KEY = 'docspace_jwt_token'
const USER_KEY = 'docspace_current_user'

interface AuthResponseData {
  token: string
  user: User
}

export class AuthService {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY)
  }

  getCurrentUser(): User | null {
    if (!this.getToken()) return null
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as User
    } catch {
      return null
    }
  }

  clearSession(): void {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  register(email: string, name: string, password: string): Promise<User> {
    return this.authenticate('/api/auth/register', { email, name, password }, 'Registration failed')
  }

  login(email: string, password: string): Promise<User> {
    return this.authenticate('/api/auth/login', { email, password }, 'Invalid email or password')
  }

  private async authenticate(endpoint: string, body: object, fallbackError: string): Promise<User> {
    let res: Response
    try {
      res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
    } catch (err) {
      throw new Error(`Cannot reach the server: ${(err as Error).message}`)
    }

    if (!(res.headers.get('content-type') ?? '').includes('application/json')) {
      throw new Error(`Server unavailable (HTTP ${res.status})`)
    }
    const json = await res.json()
    if (!res.ok || !json.success) {
      throw new Error(json.message || fallbackError)
    }

    const data: AuthResponseData = json.data
    const user: User = { id: data.user.id, email: data.user.email, name: data.user.name }
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    return user
  }
}

export const authService = new AuthService()
