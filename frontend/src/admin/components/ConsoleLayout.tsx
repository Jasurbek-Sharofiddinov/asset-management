import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Building2,
  LayoutDashboard,
  LogOut,
  Plus,
  ScrollText,
} from 'lucide-react'
import { usePlatformAuthStore } from '../stores/authStore'
import { useLanguageStore } from '../../stores/languageStore'
import { ThemeToggle } from '../../components/ui/ThemeToggle'

export function statusTone(status: string) {
  switch (status) {
    case 'pending_review':
      return 'bg-warn-soft text-warn'
    case 'trialing':
    case 'active':
      return 'bg-ok-soft text-ok'
    case 'past_due':
      return 'bg-warn-soft text-warn'
    case 'rejected':
    case 'suspended':
    case 'deleted':
      return 'bg-danger-soft text-danger'
    default:
      return 'bg-line-soft text-muted'
  }
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block shrink-0 text-[11px] px-2 py-1 rounded ${statusTone(status)}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export function formatDate(iso?: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

export default function ConsoleLayout() {
  const { admin, logout } = usePlatformAuthStore()
  const { t } = useLanguageStore()
  const navigate = useNavigate()

  const nav = [
    { to: '/', label: t('admin.overview'), icon: LayoutDashboard, end: true },
    { to: '/organizations', label: t('admin.organizations'), icon: Building2, end: false },
    { to: '/audit', label: t('admin.auditLog'), icon: ScrollText, end: false },
  ]

  return (
    <div className="min-h-screen bg-paper flex">
      <aside className="w-56 shrink-0 border-r border-line bg-vault-surface flex flex-col">
        <div className="px-5 h-14 flex items-center border-b border-line">
          <span
            className="text-[15px] font-semibold text-ink tracking-tight"
            style={{ fontFamily: "'Fraunces', Georgia, serif" }}
          >
            AssetVault
          </span>
        </div>
        <p className="px-5 pt-4 pb-2 text-[11px] uppercase tracking-wide text-muted">
          {t('admin.platformConsole')}
        </p>
        <nav className="px-3 flex flex-col gap-0.5">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2 px-2.5 py-2 rounded-md text-[13px] ${
                  isActive
                    ? 'bg-brand text-white'
                    : 'text-body hover:bg-paper hover:text-ink'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 mt-3">
          <button
            type="button"
            onClick={() => navigate('/organizations/new')}
            className="w-full flex items-center justify-center gap-1.5 h-9 rounded-md bg-brand text-white text-[13px] hover:bg-brand-hover"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('admin.newOrganization')}
          </button>
        </div>
        <div className="mt-auto border-t border-line px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] text-muted truncate">{admin?.email}</p>
            <ThemeToggle className="shrink-0" />
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="mt-2 flex items-center gap-1.5 text-[13px] text-body hover:text-ink"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t('admin.signOut')}
          </button>
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
