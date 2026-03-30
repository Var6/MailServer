import { senderInitial } from '../../lib/utils'

interface AvatarProps {
  name: string
  color?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
}

export function Avatar({ name, color = '#667eea', size = 'md', className = '' }: AvatarProps) {
  return (
    <div
      className={`rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0 select-none ${sizeClasses[size]} ${className}`}
      style={{ backgroundColor: color }}
      aria-label={name}
    >
      {senderInitial(name)}
    </div>
  )
}
