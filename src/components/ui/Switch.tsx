'use client'

import { useId } from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
  id?: string
}

export function Switch({ checked, onCheckedChange, label, description, disabled, id }: SwitchProps) {
  const generatedId = useId()
  const switchId = id ?? generatedId
  return (
    <div className="flex items-center justify-between gap-3">
      {(label || description) && (
        <div className="flex-1 min-w-0">
          {label && (
            <label htmlFor={switchId} className="block text-sm font-medium text-white cursor-pointer">
              {label}
            </label>
          )}
          {description && (
            <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
          )}
        </div>
      )}
      <SwitchPrimitive.Root
        id={switchId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
          'transition-colors duration-200 ease-in-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-orange-500' : 'bg-zinc-700'
        )}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg',
            'transition-transform duration-200 ease-in-out',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </SwitchPrimitive.Root>
    </div>
  )
}
