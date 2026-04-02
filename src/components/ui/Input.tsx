import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const baseClasses =
  'bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 rounded-xl ' +
  'px-4 py-3 text-sm w-full transition-colors ' +
  'focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">{label}</label>
      )}
      <input ref={ref} className={cn(baseClasses, error && 'border-red-500', className)} {...props} />
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  )
)
Input.displayName = 'Input'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">{label}</label>
      )}
      <textarea
        ref={ref}
        className={cn(baseClasses, 'resize-none', error && 'border-red-500', className)}
        {...props}
      />
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  )
)
Textarea.displayName = 'Textarea'
