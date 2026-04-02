import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number // 0–100
  label?: string
  sublabel?: string
  color?: 'orange' | 'green'
  className?: string
}

export function ProgressBar({ value, label, sublabel, color = 'orange', className }: ProgressBarProps) {
  const fill = color === 'green' ? 'bg-green-500' : 'bg-orange-500'
  return (
    <div className={cn('w-full', className)}>
      {(label || sublabel) && (
        <div className="flex justify-between items-baseline mb-1.5">
          {label    && <span className="text-sm font-medium text-zinc-300">{label}</span>}
          {sublabel && <span className="text-xs text-zinc-500">{sublabel}</span>}
        </div>
      )}
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', fill)}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  )
}
