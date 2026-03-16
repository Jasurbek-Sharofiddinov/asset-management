import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Package,
  BarChart3,
  ScrollText,
  ScanLine,
  Settings,
  LogOut,
  Shield,
  Menu,
  X,
} from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { cn } from '../../lib/utils'
import { useState } from 'react'

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/assets', label: 'Assets', icon: Package },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/audit', label: 'Audit Log', icon: ScrollText, roles: ['ADMIN', 'AUDITOR', 'MANAGER'] },
  { path: '/scanner', label: 'QR Scanner', icon: ScanLine },
  { path: '/settings', label: 'Settings', icon: Settings, roles: ['ADMIN', 'MANAGER'] },
]

export function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const filteredNav = navItems.filter(
    (item) => !item.roles || (user?.role && item.roles.includes(user.role))
  )

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-vault-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-vault-amber/10 border border-vault-amber/20">
            <Shield className="h-5 w-5 text-vault-amber" />
          </div>
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-lg font-bold text-vault-text">
              Asset<span className="text-vault-amber">Vault</span>
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-vault-muted-text">
              Management System
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filteredNav.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => setIsMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-vault-amber/10 text-vault-amber border-l-2 border-vault-amber ml-0'
                  : 'text-vault-muted-text hover:text-vault-text hover:bg-vault-muted/30'
              )
            }
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User Info */}
      <div className="px-4 py-4 border-t border-vault-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-vault-amber/10 text-vault-amber font-semibold text-sm">
            {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-vault-text truncate">
              {user?.full_name || 'User'}
            </p>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-vault-amber/10 text-vault-amber">
              {user?.role || 'VIEWER'}
            </span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-vault-muted-text hover:text-vault-red hover:bg-vault-red/10 transition-all duration-200"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-vault-surface border border-vault-border text-vault-text lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <motion.aside
        initial={false}
        animate={{ x: isMobileOpen ? 0 : '-100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-y-0 left-0 z-50 w-[260px] bg-vault-surface border-r border-vault-border lg:hidden"
      >
        <button
          onClick={() => setIsMobileOpen(false)}
          className="absolute top-4 right-4 p-1 rounded text-vault-muted-text hover:text-vault-text"
        >
          <X className="h-5 w-5" />
        </button>
        {sidebarContent}
      </motion.aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-[260px] bg-vault-surface border-r border-vault-border">
        {sidebarContent}
      </aside>
    </>
  )
}
