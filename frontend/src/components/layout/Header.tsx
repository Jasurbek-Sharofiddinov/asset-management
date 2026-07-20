import { useLocation, useNavigate } from 'react-router-dom'
import { Search, Bell, AlertTriangle, X } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '../../lib/api'
import { useLanguageStore } from '../../stores/languageStore'
import type { TranslationKey } from '../../i18n/translations'
import { useLayoutStore } from '../../stores/layoutStore'
import { formatDate } from '../../lib/utils'
import { cn } from '../../lib/utils'

const pageTitleKeys: Record<string, TranslationKey> = {
  '/dashboard': 'header.dashboard',
  '/assets': 'header.assetRegistry',
  '/analytics': 'header.analytics',
  '/audit': 'header.auditLog',
  '/scanner': 'header.qrScanner',
  '/settings': 'header.settings',
}

interface WarrantyAlert {
  id: string
  name: string
  serial_number: string
  days_remaining: number
  warranty_expiry: string
}

export function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const { t, locale, setLocale } = useLanguageStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const basePath = '/' + location.pathname.split('/').filter(Boolean)[0]
  const titleKey = pageTitleKeys[basePath]
  const title = titleKey ? t(titleKey) : 'AssetVault'
  const isDetail = location.pathname.match(/^\/assets\/[a-zA-Z0-9-]+$/)
  const { sidebarOpen } = useLayoutStore()

  const { data: warranty } = useQuery({
    queryKey: ['analytics', 'warranty-expiring'],
    queryFn: analyticsApi.getWarrantyExpiring,
    staleTime: 5 * 60 * 1000,
  })
  const alerts = ((warranty as unknown as WarrantyAlert[]) || [])
    .slice()
    .sort((a, b) => a.days_remaining - b.days_remaining)
  const count = alerts.length

  // Close notifications on outside click / Escape
  useEffect(() => {
    if (!notifOpen) return
    const onDown = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setNotifOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [notifOpen])

  const runSearch = () => {
    const q = searchQuery.trim()
    if (q) navigate(`/assets?search=${encodeURIComponent(q)}`)
  }

  const openAsset = (id: string) => {
    setNotifOpen(false)
    navigate(`/assets/${id}`)
  }

  return (
    <header className="sticky top-0 z-30 bg-vault-black/90 backdrop-blur-md border-b border-vault-border" style={{ height: 56 }}>
      <div className="flex items-center justify-between px-6 h-full">
        <h1 className={cn('text-[15px] font-semibold text-vault-text', !sidebarOpen ? 'ml-8' : '')}>{isDetail ? t('header.assetDetail') : title}</h1>
        <div className="flex items-center gap-2.5">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-vault-disabled" />
            <input
              type="text"
              placeholder={t('header.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runSearch() }}
              className="w-52 pl-9 pr-4 py-1.5 bg-vault-input border border-vault-border rounded-[10px] text-[12px] text-vault-text placeholder:text-vault-disabled focus:outline-none focus:border-vault-border-focus transition-colors"
            />
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

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen((o) => !o)}
              aria-label="Notifications"
              className="relative p-2 rounded-[10px] text-vault-muted-text hover:text-vault-text hover:bg-vault-muted/20 transition-colors"
            >
              <Bell className="h-4 w-4" />
              {count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-vault-red text-white text-[9px] font-bold flex items-center justify-center">
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-vault-surface border border-vault-border rounded-xl shadow-[0_12px_32px_-12px_rgba(16,24,40,0.25)] overflow-hidden z-40">
                <div className="flex items-center justify-between px-4 h-11 border-b border-vault-border">
                  <span className="text-[13px] font-semibold text-vault-text">Notifications</span>
                  <button onClick={() => setNotifOpen(false)} aria-label="Close" className="text-vault-muted-text hover:text-vault-text">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {count > 0 ? (
                  <>
                    <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-[1.5px] text-vault-muted-text bg-vault-muted/40">
                      Warranties expiring soon
                    </div>
                    <ul className="max-h-80 overflow-y-auto">
                      {alerts.slice(0, 8).map((a) => {
                        const urgent = a.days_remaining <= 14
                        return (
                          <li key={a.id}>
                            <button
                              onClick={() => openAsset(a.id)}
                              className="w-full flex items-start gap-3 px-4 py-2.5 text-left border-b border-vault-border/60 last:border-0 hover:bg-vault-muted/40 transition-colors"
                            >
                              <AlertTriangle className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', urgent ? 'text-vault-red' : 'text-vault-orange')} />
                              <div className="min-w-0 flex-1">
                                <p className="text-[12.5px] font-medium text-vault-text truncate">{a.name}</p>
                                <p className="text-[11px] text-vault-muted-text">
                                  Warranty expires {formatDate(a.warranty_expiry)}
                                </p>
                              </div>
                              <span className={cn('shrink-0 text-[11px] font-semibold tabular-nums', urgent ? 'text-vault-red' : 'text-vault-orange')}>
                                {a.days_remaining}d
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                    <button
                      onClick={() => { setNotifOpen(false); navigate('/analytics') }}
                      className="w-full px-4 py-2.5 text-[12px] font-medium text-vault-amber hover:bg-vault-muted/40 transition-colors border-t border-vault-border"
                    >
                      View all in Analytics
                    </button>
                  </>
                ) : (
                  <div className="px-4 py-10 text-center">
                    <Bell className="h-6 w-6 text-vault-disabled mx-auto mb-2" />
                    <p className="text-[13px] text-vault-muted-text">You're all caught up</p>
                    <p className="text-[11px] text-vault-disabled mt-0.5">No warranties expiring soon</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
