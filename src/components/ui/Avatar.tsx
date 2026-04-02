import { cn } from '@/lib/utils'

interface AvatarProps {
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizes = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-14 h-14 text-xl',
  xl: 'w-20 h-20 text-2xl',
}

/** Deterministic color from name string. */
function colorFromName(name: string): string {
  const colors = [
    'bg-orange-500', 'bg-amber-500', 'bg-green-500', 'bg-teal-500',
    'bg-blue-500',   'bg-violet-500', 'bg-pink-500',  'bg-red-500',
  ]
  const hash = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return colors[hash % colors.length]
}

/** Initials from F3 name (up to 2 chars). */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-bold text-white shrink-0',
        colorFromName(name),
        sizes[size],
        className
      )}
      aria-label={name}
    >
      {initials(name)}
    </div>
  )
}
