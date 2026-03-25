import { useLocation } from 'react-router-dom'
import { Search, Bell } from 'lucide-react'
import { useState } from 'react'
import { useLanguageStore } from '../../stores/languageStore'
import type { TranslationKey } from '../../i18n/translations'
import { useLayoutStore } from '../../stores/layoutStore'
import { cn } from '../../lib/utils'

const pageTitleKeys: Record<string, TranslationKey> = {
  '/dashboard': 'header.dashboard',
  '/assets': 'header.assetRegistry',
  '/analytics': 'header.analytics',
  '/audit': 'header.auditLog',
  '/scanner': 'header.qrScanner',
  '/settings': 'header.settings',
}

export function Header() {
  const location = useLocation()
  const { t, locale, setLocale } = useLanguageStore()
  const [searchQuery, setSearchQuery] = useState('')
  const basePath = '/' + location.pathname.split('/').filter(Boolean)[0]
  const titleKey = pageTitleKeys[basePath]
  const title = titleKey ? t(titleKey) : 'AssetVault'
  const isDetail = location.pathname.match(/^\/assets\/[a-zA-Z0-9-]+$/)
  const { sidebarOpen } = useLayoutStore()

  return (
    <header className="sticky top-0 z-30 bg-vault-black/80 backdrop-blur-xl border-b border-vault-border/40" style={{ height: 56 }}>
      <div className="flex items-center justify-between px-6 h-full">
        <h1 className={cn("text-[15px] font-semibold text-vault-text", !sidebarOpen ? 'ml-8' : '')}>{isDetail ? t('header.assetDetail') : title}</h1>
        <div className="flex items-center gap-2.5">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-vault-disabled" />
            <input type="text" placeholder={t('header.searchPlaceholder')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-52 pl-9 pr-4 py-1.5 bg-vault-input border border-vault-border rounded-[10px] text-[12px] text-vault-text placeholder:text-vault-disabled focus:outline-none focus:border-vault-border-focus transition-colors" />
          </div>
          {/* Language switcher */}
          <div className="flex items-center bg-vault-surface border border-vault-border rounded-[10px] overflow-hidden">
            {(['en', 'ru', 'uz'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setLocale(lang)}
                className={`px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  locale === lang
                    ? 'bg-vault-amber/15 text-vault-amber'
                    : 'text-vault-muted-text hover:text-vault-text hover:bg-vault-muted/20'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>

          <button className="relative p-2 rounded-[10px] text-vault-muted-text hover:text-vault-text hover:bg-vault-muted/20 transition-colors">
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-vault-amber" />
          </button>
        </div>
      </div>
    </header>
  )
}
