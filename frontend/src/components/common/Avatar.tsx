import React from 'react'
import { cn } from '@/utils/cn'

export interface AvatarProps {
  name: string
  color?: string
  size?: 'sm' | 'md' | 'lg'
  isCurrent?: boolean
  className?: string
  title?: string
}

const DEFAULT_COLORS = [
  '#EA4335', // Red
  '#4285F4', // Blue
  '#34A853', // Green
  '#FBBC05', // Yellow
  '#8E24AA', // Purple
  '#00897B', // Teal
  '#F4511E'  // Deep Orange
]

function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

function getColorFromName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % DEFAULT_COLORS.length
  return DEFAULT_COLORS[index]
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  color,
  size = 'md',
  isCurrent,
  className,
  title
}) => {
  const bg = color || getColorFromName(name)
  const initials = getInitials(name)

  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-xs font-semibold',
    lg: 'w-10 h-10 text-sm font-bold'
  }

  return (
    <div
      title={title || name}
      style={{ backgroundColor: bg }}
      className={cn(
        'relative inline-flex items-center justify-center rounded-full text-white shadow-xs shrink-0 select-none ring-2 ring-white',
        sizeClasses[size],
        className
      )}
    >
      <span>{initials}</span>
      {isCurrent && (
        <span
          title="Active now"
          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white"
        />
      )}
    </div>
  )
}
