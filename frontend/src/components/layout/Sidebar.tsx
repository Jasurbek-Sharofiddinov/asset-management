import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Package, BarChart3, ScrollText,
  ScanLine, Settings, LogOut, Hexagon, Menu, X,
} from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { cn } from '../../lib/utils'
import { useState } from 'react'

const navGroups = [
  { label: 'Home', items: [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ]},
  { label: 'Assets', items: [
    { path: '/assets', label: 'Asset List', icon: Package },
  ]},
  { label: 'Operations', items: [
    { path: '/scanner', label: 'QR Scanner', icon: ScanLine },
  ]},
  { label: 'Reporting', items: [
    { path: '/analytics', label: 'Analytics', icon: BarChart3 },
    { path: '/audit', label: 'Audit Log', icon: ScrollText, roles: ['ADMIN', 'AUDITOR', 'MANAGER'] },
  ]},
  { label: 'System', items: [
    { path: '/settings', label: 'Settings', icon: Settings, roles: ['ADMIN', 'MANAGER'] },
  ]},
]

export function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const handleLogout = async () => { await logout(); navigate('/login') }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-vault-border/50">
        <div className="flex items-center gap-2.5">
          <Hexagon className="h-5 w-5 text-vault-amber" strokeWidth={2.5} />
          <span className="text-[15px] font-bold text-vault-text tracking-tight">
            Asset<span className="text-vault-amber">Vault</span>
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !('roles' in item) || !item.roles || (user?.role && item.roles.includes(user.role))
          )
          if (!visibleItems.length) return null
          return (
            <div key={group.label}>
              <p className="px-3 mb-1 text-[9px] font-bold uppercase tracking-[2px] text-vault-disabled">{group.label}</p>
              {visibleItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileOpen(false)}
                  className={({ isActive }) => cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[14px] font-medium transition-all duration-150 relative',
                    isActive
                      ? 'text-vault-text bg-vault-muted/40'
                      : 'text-vault-muted-text hover:text-vault-text hover:bg-vault-muted/20'
                  )}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-active"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r-full bg-vault-amber"
                          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        />
                      )}
                      <item.icon className="h-[16px] w-[16px]" />
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-vault-border/50">
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-vault-amber" style={{ background: 'rgba(245,166,35,0.12)' }}>
            {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-vault-text truncate">{user?.full_name || 'User'}</p>
            <p className="text-[9px] font-bold uppercase tracking-[1.5px] text-vault-muted-text">{user?.role}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-[12px] text-vault-muted-text hover:text-vault-red hover:bg-vault-red/[0.06] transition-all">
          <LogOut className="h-3.5 w-3.5" /><span>Sign Out</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      <button onClick={() => setIsMobileOpen(true)} className="fixed top-3 left-3 z-50 p-2 rounded-lg bg-vault-surface border border-vault-border text-vault-text lg:hidden">
        <Menu className="h-5 w-5" />
      </button>
      {isMobileOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileOpen(false)} />
      )}
      <motion.aside initial={false} animate={{ x: isMobileOpen ? 0 : '-100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-y-0 left-0 z-50 w-[220px] bg-vault-surface border-r border-vault-border lg:hidden">
        <button onClick={() => setIsMobileOpen(false)} className="absolute top-4 right-3 p-1 text-vault-muted-text hover:text-vault-text"><X className="h-4 w-4" /></button>
        {sidebarContent}
      </motion.aside>
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-[220px] bg-vault-surface border-r border-vault-border/50">
        {sidebarContent}
      </aside>
    </>
  )
}
