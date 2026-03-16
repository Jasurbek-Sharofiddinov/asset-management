import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-vault-text mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full px-3 py-2 bg-vault-black border rounded-lg text-vault-text text-sm',
            'placeholder:text-vault-muted-text/50',
            'focus:outline-none focus:ring-2 focus:ring-vault-amber/40 focus:border-vault-amber/50',
            'transition-all duration-200',
            error
              ? 'border-vault-red/50 focus:ring-vault-red/40 focus:border-vault-red/50'
              : 'border-vault-border hover:border-vault-muted',
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-vault-red">{error}</p>}
        {hint && !error && <p className="mt-1 text-xs text-vault-muted-text">{hint}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
export { Input }
