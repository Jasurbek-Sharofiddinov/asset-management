import { useLocation } from 'react-router-dom'
import { Search, Bell } from 'lucide-react'
import { useState } from 'react'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard', '/assets': 'Asset Registry', '/analytics': 'Analytics',
  '/audit': 'Audit Log', '/scanner': 'QR Scanner', '/settings': 'Settings',
}

export function Header() {
  const location = useLocation()
  const [searchQuery, setSearchQuery] = useState('')
  const basePath = '/' + location.pathname.split('/').filter(Boolean)[0]
  const title = pageTitles[basePath] || 'AssetVault'
  const isDetail = location.pathname.match(/^\/assets\/[a-zA-Z0-9-]+$/)

  return (
    <header className="sticky top-0 z-30 bg-vault-black/80 backdrop-blur-xl border-b border-vault-border/40" style={{ height: 56 }}>
      <div className="flex items-center justify-between px-6 h-full">
        <h1 className="text-[15px] font-semibold text-vault-text">{isDetail ? 'Asset Detail' : title}</h1>
        <div className="flex items-center gap-2.5">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-vault-disabled" />
            <input type="text" placeholder="Search assets..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-52 pl-9 pr-4 py-1.5 bg-vault-input border border-vault-border rounded-[10px] text-[12px] text-vault-text placeholder:text-vault-disabled focus:outline-none focus:border-vault-border-focus transition-colors" />
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
