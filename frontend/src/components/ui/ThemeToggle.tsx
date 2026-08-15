import { Moon, Sun } from 'lucide-react'
import { useLanguageStore } from '../../stores/languageStore'
import { useThemeStore } from '../../stores/themeStore'
import { cn } from '../../lib/utils'

export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useLanguageStore()
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? t('theme.toLight') : t('theme.toDark')}
      className={cn(
        'p-2 rounded-[10px] text-vault-muted-text hover:text-vault-text hover:bg-vault-muted/20 transition-colors',
        className,
      )}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
