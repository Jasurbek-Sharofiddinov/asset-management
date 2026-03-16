import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'
import { ChevronDown } from 'lucide-react'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-vault-text mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              'w-full px-3 py-2 bg-vault-black border rounded-lg text-vault-text text-sm appearance-none',
              'focus:outline-none focus:ring-2 focus:ring-vault-amber/40 focus:border-vault-amber/50',
              'transition-all duration-200',
              error
                ? 'border-vault-red/50'
                : 'border-vault-border hover:border-vault-muted',
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" className="text-vault-muted-text">
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-vault-surface">
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-vault-muted-text pointer-events-none" />
        </div>
        {error && <p className="mt-1 text-xs text-vault-red">{error}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'
export { Select }
