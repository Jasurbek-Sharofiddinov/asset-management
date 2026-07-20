import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'
import { Loader2 } from 'lucide-react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-vault-black disabled:opacity-50 disabled:cursor-not-allowed'

    const variants = {
      primary:
        'bg-vault-amber text-white hover:bg-vault-amber-dim focus:ring-vault-amber',
      secondary:
        'bg-white text-vault-text hover:bg-vault-muted border border-vault-border focus:ring-vault-border',
      danger:
        'bg-vault-red/10 text-vault-red hover:bg-vault-red/20 border border-vault-red/30 focus:ring-vault-red',
      ghost:
        'text-vault-muted-text hover:text-vault-text hover:bg-vault-muted/50 focus:ring-vault-muted',
    }

    const sizes = {
      sm: 'text-xs px-3 py-1.5 gap-1.5',
      md: 'text-sm px-4 py-2 gap-2',
      lg: 'text-base px-6 py-3 gap-2',
    }

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
export { Button }
