'use client'

interface BadgeProps {
  count?: number
  label?: string
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'muted' | 'admin'
  className?: string
}

const variantClasses = {
  primary: 'bg-[#667eea] text-white',
  success: 'bg-[#48bb78] text-white',
  warning: 'bg-[#ed8936] text-white',
  error: 'bg-[#fc8181] text-white',
  muted: 'bg-[#e8ecf4] text-[#718096]',
  admin: 'bg-purple-100 text-purple-700',
}

export function Badge({ count, label, variant = 'primary', className = '' }: BadgeProps) {
  const text = label ?? (count !== undefined ? String(count) : '')
  if (!text) return null

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full text-[11px] font-semibold leading-none px-2 py-0.5 min-w-[20px] ${variantClasses[variant]} ${className}`}
    >
      {count !== undefined && count > 99 ? '99+' : text}
    </span>
  )
}
