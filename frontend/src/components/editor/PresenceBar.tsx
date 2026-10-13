import React from 'react'
import { Avatar } from '@/components/common/Avatar'
import type { PresenceCollaborator } from '@/types'

interface PresenceBarProps {
  collaborators: PresenceCollaborator[]
}

export const PresenceBar: React.FC<PresenceBarProps> = ({ collaborators }) => {
  if (!collaborators || collaborators.length === 0) return null

  return (
    <div className="flex items-center -space-x-1.5 overflow-hidden py-1">
      {collaborators.map((user) => (
        <Avatar
          key={user.userId}
          name={user.name}
          color={user.color}
          size="sm"
          isCurrent={user.isCurrent}
          title={`${user.name} (${user.email})${user.isCurrent ? ' - Active' : ''}`}
          className="hover:scale-110 hover:z-10 transition-transform cursor-pointer"
        />
      ))}
      <div className="pl-3 text-xs text-gray-500 font-medium">
        {collaborators.length} online
      </div>
    </div>
  )
}
