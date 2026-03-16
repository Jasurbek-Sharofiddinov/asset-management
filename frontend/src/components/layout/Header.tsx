import { useLocation } from 'react-router-dom'
import { Search, Bell } from 'lucide-react'
import { useState } from 'react'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/assets': 'Asset Registry',
  '/analytics': 'Analytics',
  '/audit': 'Audit Log',
  '/scanner': 'QR Scanner',
  '/settings': 'Settings',
}

const pageBreadcrumbs: Record<string, string[]> = {
  '/dashboard': ['Home', 'Dashboard'],
  '/assets': ['Home', 'Assets'],
  '/analytics': ['Home', 'Analytics'],
  '/audit': ['Home', 'Audit Log'],
  '/scanner': ['Home', 'QR Scanner'],
  '/settings': ['Home', 'Settings'],
}

export function Header() {
  const location = useLocation()
  const [searchQuery, setSearchQuery] = useState('')

  const basePath = '/' + location.pathname.split('/').filter(Boolean)[0]
  const title = pageTitles[basePath] || 'AssetVault'
  const breadcrumbs = pageBreadcrumbs[basePath] || ['Home']

  // If asset detail page
  const isAssetDetail = location.pathname.match(/^\/assets\/\d+/)

  return (
    <header className="sticky top-0 z-30 bg-vault-black/80 backdrop-blur-md border-b border-vault-border">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-vault-muted-text mb-1">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && <span className="text-vault-border">/</span>}
                <span className={i === breadcrumbs.length - 1 ? 'text-vault-text' : ''}>
                  {crumb}
                </span>
              </span>
            ))}
            {isAssetDetail && (
              <>
                <span className="text-vault-border">/</span>
                <span className="text-vault-text">Asset Detail</span>
              </>
            )}
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-xl font-bold text-vault-text">
            {isAssetDetail ? 'Asset Detail' : title}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-vault-muted-text" />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 pl-9 pr-4 py-2 bg-vault-surface border border-vault-border rounded-lg text-sm text-vault-text placeholder:text-vault-muted-text/50 focus:outline-none focus:ring-2 focus:ring-vault-amber/30 focus:border-vault-amber/40 transition-all"
            />
          </div>

          {/* Notifications */}
          <button className="relative p-2 rounded-lg text-vault-muted-text hover:text-vault-text hover:bg-vault-muted/30 transition-colors">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-vault-amber" />
          </button>
        </div>
      </div>
    </header>
  )
}
