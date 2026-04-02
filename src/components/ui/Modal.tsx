'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  className?: string
}

export function Modal({ open, onClose, title, description, children, className }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={v => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            'fixed z-50 bg-zinc-900 border border-zinc-800',
            'bottom-0 left-0 right-0 sm:bottom-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2',
            'w-full sm:max-w-md',
            'rounded-t-3xl sm:rounded-2xl',
            'max-h-[90dvh] overflow-y-auto',
            'p-6',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:slide-out-to-bottom sm:data-[state=closed]:slide-out-to-left-1/2',
            'data-[state=open]:slide-in-from-bottom sm:data-[state=open]:slide-in-from-left-1/2',
            className
          )}
        >
          {title && (
            <div className="flex items-center justify-between mb-5">
              <Dialog.Title className="text-lg font-bold text-white">{title}</Dialog.Title>
              <Dialog.Close className="text-zinc-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-zinc-800" aria-label="Close">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Dialog.Close>
            </div>
          )}
          {description && (
            <Dialog.Description className="text-sm text-zinc-400 mb-4">{description}</Dialog.Description>
          )}
          {!title && <Dialog.Title className="sr-only">Dialog</Dialog.Title>}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
