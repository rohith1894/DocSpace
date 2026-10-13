import React from 'react'
import { Avatar } from '@/components/common/Avatar'
import type { Collaborator } from '@/types'

interface PresenceBarProps {
  collaborators: Collaborator[]
}

export const PresenceBar: React.FC<PresenceBarProps> = ({ collaborators }) => {
  if (collaborators.length === 0) return null

  return (
    <div className="flex items-center -space-x-1.5 py-1" data-testid="presence-bar">
      {collaborators.slice(0, 4).map((user) => (
        <Avatar
          key={user.userId}
          name={user.name}
          size="sm"
          isCurrent={user.isCurrent}
          title={`${user.name}${user.isCurrent ? ' (you)' : ''}${user.connections > 1 ? ` · ${user.connections} devices` : ''}`}
        />
      ))}
      <div className="pl-3 text-xs text-gray-500 font-medium whitespace-nowrap hidden sm:block">
        {collaborators.length} online
      </div>
    </div>
  )
}
