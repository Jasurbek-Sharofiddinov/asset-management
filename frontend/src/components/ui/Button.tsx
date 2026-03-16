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
      'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-vault-black disabled:opacity-50 disabled:cursor-not-allowed'

    const variants = {
      primary:
        'bg-vault-amber text-vault-black hover:bg-amber-400 focus:ring-vault-amber shadow-[0_0_0_1px_rgba(245,158,11,0.3)]',
      secondary:
        'bg-vault-muted text-vault-text hover:bg-vault-border border border-vault-border focus:ring-vault-muted',
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
