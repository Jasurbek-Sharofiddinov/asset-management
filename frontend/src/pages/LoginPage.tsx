import { useEffect, useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight, Check } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useLanguageStore } from '../stores/languageStore'
import { cn } from '../lib/utils'
import { authApi } from '../lib/api'
import {
  APP_HOST,
  APP_ORIGIN,
  BASE_DOMAIN,
  TRIAL_LENGTH_DAYS,
  isDemoHost,
  loginMode,
  tenantLoginUrl,
  tenantSlugFromHost,
} from '../lib/config'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import type { Locale } from '../i18n/translations'

const locales: { code: Locale; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'ru', label: 'RU' },
  { code: 'uz', label: 'UZ' },
]

function Mark({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="2.5" y="4" width="19" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2.5 9.5h19" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="14.5" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 12.1v-.01M14.4 14.5h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function parseWorkspaceSlug(raw: string): string {
  let value = raw.trim().toLowerCase()
  value = value.replace(/^https?:\/\//, '')
  value = value.split('/')[0] ?? value
  const suffix = `.${BASE_DOMAIN}`
  if (value.endsWith(suffix)) {
    value = value.slice(0, -suffix.length)
  }
  return (value.split('.')[0] ?? '').replace(/[^a-z0-9-]/g, '')
}

const inputClass =
  'w-full px-3.5 py-2.5 bg-vault-surface border border-line rounded-lg text-ink text-[14px] placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40 transition-shadow'

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login, isLoading, error, clearError } = useAuthStore()
  const { t, locale, setLocale } = useLanguageStore()
  const mode = loginMode()
  const boundSlug = tenantSlugFromHost()
  const demoHost = isDemoHost()
  const [email, setEmail] = useState(() => searchParams.get('email') || '')
  const [password, setPassword] = useState('')
  const [organizationSlug, setOrganizationSlug] = useState('')
  const [showSlug, setShowSlug] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [workspaceInput, setWorkspaceInput] = useState('')
  const [findEmail, setFindEmail] = useState('')
  const [foundWorkspaces, setFoundWorkspaces] = useState<{ slug: string; name: string }[]>([])
  const [finderError, setFinderError] = useState<string | null>(null)
  const [finderBusy, setFinderBusy] = useState(false)
  const [tenantState, setTenantState] = useState<'loading' | 'ok' | 'missing'>(
    mode === 'tenant' ? 'loading' : 'ok',
  )
  const [tenantName, setTenantName] = useState<string | null>(null)

  useEffect(() => {
    if (mode !== 'tenant' || !boundSlug) return
    let cancelled = false
    authApi
      .getTenant()
      .then((data) => {
        if (cancelled) return
        setTenantName(data.name)
        setTenantState('ok')
      })
      .catch(() => {
        if (!cancelled) setTenantState('missing')
      })
    return () => {
      cancelled = true
    }
  }, [mode, boundSlug])

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    try {
      const slug =
        mode === 'tenant' && boundSlug
          ? boundSlug
          : organizationSlug.trim() || undefined
      await login(email, password, slug)
      const mustChange = useAuthStore.getState().user?.must_change_password
      navigate(mustChange ? '/change-password' : '/dashboard')
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      const message = typeof detail === 'string' ? detail : ''
      if (mode === 'dev' && message.includes('organization_slug')) {
        setShowSlug(true)
      }
    }
  }

  const goToWorkspace = (slug: string, prefillEmail?: string) => {
    const normalized = parseWorkspaceSlug(slug)
    if (!normalized) {
      setFinderError('Enter your workspace name.')
      return
    }
    window.location.assign(tenantLoginUrl(normalized, prefillEmail))
  }

  const handleFinderSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFinderError(null)
    goToWorkspace(workspaceInput)
  }

  const handleFindByEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setFinderError(null)
    setFoundWorkspaces([])
    setFinderBusy(true)
    try {
      const { items } = await authApi.lookupWorkspaces(findEmail.trim())
      setFoundWorkspaces(items)
      if (items.length === 1) {
        goToWorkspace(items[0].slug, findEmail.trim())
        return
      }
      if (items.length === 0) {
        setFinderError('No workspace found for that email.')
      }
    } catch {
      setFinderError('Could not look up workspaces. Try again.')
    } finally {
      setFinderBusy(false)
    }
  }

  const prompt =
    mode === 'finder'
      ? 'Enter your workspace to continue.'
      : demoHost
        ? 'This is the shared demo workspace.'
        : tenantName
          ? `Sign in to ${tenantName}`
          : t('login.signInPrompt')

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-paper">
      <aside className="relative hidden lg:flex flex-col justify-between bg-brand text-white p-12 overflow-hidden">
        <div className="flex items-center gap-2">
          <Mark className="h-5 w-5" />
          <span className="text-[15px] font-semibold tracking-tight">AssetVault</span>
        </div>

        <div className="max-w-sm">
          <h2 className="font-serif text-[38px] leading-[1.08] tracking-[-0.02em]">
            {t('login.headline')}
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-white/65">
            {t('login.leftBody')}
          </p>
          <ul className="mt-8 space-y-3">
            {([t('login.feature1'), t('login.feature2'), t('login.feature3')] as const).map(
              (f) => (
                <li key={f} className="flex items-center gap-3 text-[13.5px] text-white/80">
                  <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </span>
                  {f}
                </li>
              ),
            )}
          </ul>
        </div>

        <p className="text-[12px] text-white/40 font-mono">
          {mode === 'tenant' && boundSlug ? `${boundSlug}.${BASE_DOMAIN}` : APP_HOST}
        </p>
      </aside>

      <main className="relative flex items-center justify-center px-6 py-12">
        <div className="absolute top-5 right-5 flex items-center gap-1">
          <ThemeToggle className="text-muted hover:text-ink hover:bg-line-soft" />
          {locales.map((loc) => (
            <button
              key={loc.code}
              onClick={() => setLocale(loc.code)}
              className={cn(
                'px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-colors',
                locale === loc.code ? 'bg-brand/10 text-brand' : 'text-muted hover:text-ink',
              )}
            >
              {loc.label}
            </button>
          ))}
        </div>

        <div className="w-full max-w-sm">
          <div className="flex lg:hidden items-center gap-2 text-ink mb-8">
            <Mark className="h-5 w-5 text-brand" />
            <span className="text-[15px] font-semibold tracking-tight">AssetVault</span>
          </div>

          <h1 className="font-serif text-[28px] leading-tight tracking-[-0.02em] text-ink">
            {mode === 'finder' ? 'Find your workspace' : t('login.welcomeBack')}
          </h1>
          <p className="mt-1.5 text-[14px] text-body">{prompt}</p>

          {mode === 'tenant' && tenantState === 'loading' && (
            <p className="mt-6 text-[14px] text-muted">Loading workspace…</p>
          )}

          {mode === 'tenant' && tenantState === 'missing' && (
            <div className="mt-6 space-y-4">
              <div className="p-3 rounded-lg bg-danger-soft border border-danger/15">
                <p className="text-[13px] text-danger">This workspace does not exist.</p>
              </div>
              <a href={`${APP_ORIGIN}/login`} className="text-brand font-medium hover:underline text-[14px]">
                Find your workspace
              </a>
            </div>
          )}

          {mode === 'finder' && (
            <div className="mt-6 space-y-6">
              {finderError && (
                <div className="p-3 rounded-lg bg-danger-soft border border-danger/15">
                  <p className="text-[13px] text-danger">{finderError}</p>
                </div>
              )}
              <form onSubmit={handleFinderSubmit} className="space-y-4">
                <div>
                  <label htmlFor="workspace" className="block text-[13px] font-medium text-ink mb-1.5">
                    Workspace
                  </label>
                  <input
                    id="workspace"
                    value={workspaceInput}
                    onChange={(e) => setWorkspaceInput(e.target.value)}
                    placeholder={`yourorg.${BASE_DOMAIN}`}
                    required
                    className={inputClass}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-[14px] font-medium text-white bg-brand rounded-lg hover:bg-brand-hover transition-colors"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              <form onSubmit={handleFindByEmail} className="space-y-4 pt-2 border-t border-line">
                <p className="text-[13px] text-muted pt-4">Or find workspaces by email</p>
                <div>
                  <label htmlFor="find-email" className="block text-[13px] font-medium text-ink mb-1.5">
                    {t('login.emailLabel')}
                  </label>
                  <input
                    id="find-email"
                    type="email"
                    value={findEmail}
                    onChange={(e) => setFindEmail(e.target.value)}
                    placeholder={t('login.emailPlaceholder')}
                    required
                    className={inputClass}
                  />
                </div>
                <button
                  type="submit"
                  disabled={finderBusy}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-[14px] font-medium text-ink bg-vault-surface border border-line rounded-lg hover:bg-paper disabled:opacity-60 transition-colors"
                >
                  {finderBusy ? 'Looking up…' : 'Find workspace'}
                </button>
                {foundWorkspaces.length > 1 && (
                  <ul className="space-y-2">
                    {foundWorkspaces.map((ws) => (
                      <li key={ws.slug}>
                        <button
                          type="button"
                          onClick={() => goToWorkspace(ws.slug, findEmail.trim())}
                          className="w-full text-left px-3 py-2 rounded-lg border border-line hover:border-brand/40 text-[14px]"
                        >
                          <span className="font-medium text-ink">{ws.name}</span>
                          <span className="block text-[12px] text-muted font-mono">
                            {ws.slug}.{BASE_DOMAIN}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </form>
            </div>
          )}

          {(mode === 'dev' || (mode === 'tenant' && tenantState === 'ok')) && (
            <>
              {error && (
                <div className="mt-5 p-3 rounded-lg bg-danger-soft border border-danger/15">
                  <p className="text-[13px] text-danger">{error}</p>
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="email" className="block text-[13px] font-medium text-ink mb-1.5">
                    {t('login.emailLabel')}
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('login.emailPlaceholder')}
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-[13px] font-medium text-ink mb-1.5">
                    {t('login.passwordLabel')}
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('login.passwordPlaceholder')}
                      required
                      className={`${inputClass} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {showSlug && mode === 'dev' && (
                  <div>
                    <label htmlFor="organization-slug" className="block text-[13px] font-medium text-ink mb-1.5">
                      {t('login.orgSlugLabel')}
                    </label>
                    <input
                      id="organization-slug"
                      type="text"
                      value={organizationSlug}
                      onChange={(e) => setOrganizationSlug(e.target.value)}
                      placeholder={t('login.orgSlugPlaceholder')}
                      autoComplete="organization"
                      className={inputClass}
                    />
                    <p className="mt-1.5 text-[12px] text-muted">{t('login.orgSlugHint')}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-[14px] font-medium text-white bg-brand rounded-lg hover:bg-brand-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? t('login.signingIn') : t('login.signIn')}
                  {!isLoading && <ArrowRight className="h-4 w-4" />}
                </button>
              </form>
            </>
          )}

          {mode !== 'tenant' && (
            <p className="mt-6 text-center text-[13px] text-body">
              {t('login.needAccount')}{' '}
              <Link to="/signup" className="text-brand font-medium hover:underline">
                {t('login.requestTrial').replace('{days}', String(TRIAL_LENGTH_DAYS))}
              </Link>
              .
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
