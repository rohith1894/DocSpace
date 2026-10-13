import React, { useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import { Avatar } from '@/components/common/Avatar'
import { Link2, Trash2, Check, UserPlus } from 'lucide-react'
import type { DocumentPermission, DocumentRole } from '@/types'

interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  documentTitle: string
  permissions: DocumentPermission[]
  onAddPermission: (email: string, role: DocumentRole) => Promise<void>
  onRemovePermission: (userId: string) => Promise<void>
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  documentTitle,
  permissions,
  onAddPermission,
  onRemovePermission
}) => {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<DocumentRole>('EDITOR')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid email address')
      return
    }
    setError(null)
    setIsLoading(true)
    try {
      await onAddPermission(email.trim(), role)
      setEmail('')
    } catch {
      setError('Failed to share document. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Share "${documentTitle}"`}>
      <div className="space-y-6">
        {/* Add people form */}
        <form onSubmit={handleShare} className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Add people by email (e.g. alex@example.com)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={error || undefined}
                disabled={isLoading}
              />
            </div>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as DocumentRole)}
              className="bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              <option value="EDITOR">Editor</option>
              <option value="VIEWER">Viewer</option>
            </select>
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading || !email.trim()}
              icon={<UserPlus className="w-4 h-4" />}
            >
              {isLoading ? 'Adding...' : 'Send'}
            </Button>
          </div>
        </form>

        {/* People with access list */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            People with access
          </h4>
          <div className="divide-y divide-gray-100 max-h-52 overflow-y-auto">
            {permissions.map((perm) => (
              <div key={perm.userId} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <Avatar name={perm.name || perm.email} size="sm" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {perm.name || perm.email}
                    </p>
                    <p className="text-xs text-gray-400">{perm.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      perm.role === 'OWNER'
                        ? 'bg-blue-50 text-blue-700'
                        : perm.role === 'EDITOR'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {perm.role.charAt(0) + perm.role.slice(1).toLowerCase()}
                  </span>

                  {perm.role !== 'OWNER' && (
                    <button
                      onClick={() => onRemovePermission(perm.userId)}
                      className="p-1 text-gray-400 hover:text-red-600 rounded-md transition-colors"
                      title="Remove access"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer with copy link */}
        <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            icon={copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Link2 className="w-4 h-4" />}
          >
            {copied ? 'Link copied!' : 'Copy link'}
          </Button>

          <Button type="button" variant="primary" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  )
}
