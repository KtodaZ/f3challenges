'use client'

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const DropdownMenu      = DropdownMenuPrimitive.Root
export const DropdownTrigger   = DropdownMenuPrimitive.Trigger
export const DropdownPortal    = DropdownMenuPrimitive.Portal
export const DropdownSeparator = DropdownMenuPrimitive.Separator

export function DropdownContent({
  children,
  className,
  align = 'end',
  ...props
}: DropdownMenuPrimitive.DropdownMenuContentProps) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        align={align}
        sideOffset={6}
        className={cn(
          'z-50 min-w-[160px] overflow-hidden rounded-xl bg-zinc-800 border border-zinc-700 p-1 shadow-xl',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          className
        )}
        {...props}
      >
        {children}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  )
}

interface DropdownItemProps extends DropdownMenuPrimitive.DropdownMenuItemProps {
  destructive?: boolean
  icon?: ReactNode
}

export function DropdownItem({ destructive, icon, children, className, ...props }: DropdownItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg cursor-pointer select-none outline-none transition-colors',
        destructive
          ? 'text-red-400 focus:bg-red-500/10 focus:text-red-300'
          : 'text-zinc-200 focus:bg-zinc-700 focus:text-white',
        className
      )}
      {...props}
    >
      {icon && <span className="shrink-0 w-4 h-4">{icon}</span>}
      {children}
    </DropdownMenuPrimitive.Item>
  )
}
