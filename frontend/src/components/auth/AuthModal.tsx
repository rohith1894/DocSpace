import React, { useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import { authService } from '@/services/authService'
import { LogIn, UserPlus, Sparkles, AlertCircle } from 'lucide-react'
import type { User } from '@/types'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onAuthSuccess: (user: User) => void
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      let user: User
      if (isRegister) {
        user = await authService.register(email.trim(), name.trim(), password)
      } else {
        user = await authService.login(email.trim(), password)
      }
      onAuthSuccess(user)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Authentication failed')
    } finally {
      setIsLoading(false)
    }
  }

  // Quick 1-click login for easy multi-tab collaboration testing
  const handleQuickLogin = async (demoEmail: string, demoName: string) => {
    setError(null)
    setIsLoading(true)
    try {
      let user: User
      try {
        user = await authService.login(demoEmail, 'password123')
      } catch {
        // If demo user does not exist yet, register automatically
        user = await authService.register(demoEmail, demoName, 'password123')
      }
      onAuthSuccess(user)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed quick login')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isRegister ? 'Create your DocSpace Account' : 'Sign in to DocSpace'}
    >
      <div className="space-y-5">
        {/* Quick Demo Login Preset Buttons */}
        <div className="bg-blue-50/60 border border-blue-200/60 rounded-lg p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-800 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>1-Click Test Users (Great for Multi-Tab Collaboration)</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => handleQuickLogin('alice@docspace.io', 'Alice Cooper')}
              className="bg-white hover:bg-blue-50 text-xs py-1.5 border-blue-200"
            >
              👤 Alice (User 1)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => handleQuickLogin('bob@docspace.io', 'Bob Marley')}
              className="bg-white hover:bg-blue-50 text-xs py-1.5 border-blue-200"
            >
              👥 Bob (User 2)
            </Button>
          </div>
        </div>

        <div className="relative flex py-1 items-center">
          <div className="grow border-t border-gray-200"></div>
          <span className="shrink mx-3 text-xs text-gray-400">or use your email</span>
          <div className="grow border-t border-gray-200"></div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {isRegister && (
            <Input
              label="Full Name"
              type="text"
              placeholder="e.g. Ada Lovelace"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isLoading}
            />
          )}

          <Input
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            disabled={isLoading}
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2"
            disabled={isLoading}
            icon={isRegister ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
          >
            {isLoading ? 'Processing...' : isRegister ? 'Create Account' : 'Sign In'}
          </Button>
        </form>

        <div className="text-center pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister)
              setError(null)
            }}
            className="text-xs text-blue-600 hover:underline font-medium"
          >
            {isRegister
              ? 'Already have an account? Sign in instead'
              : "Don't have an account? Create one"}
          </button>
        </div>
      </div>
    </Modal>
  )
}
