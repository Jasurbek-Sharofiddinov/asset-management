import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { usePlatformAuthStore } from '../stores/authStore'
import { useLanguageStore } from '../../stores/languageStore'
import { ThemeToggle } from '../../components/ui/ThemeToggle'

/**
 * Where tenant users belong. Resolved locally rather than importing the tenant
 * config module, so the console keeps a standalone module graph.
 */
const TENANT_APP_URL = (() => {
  const explicit = (
    import.meta.env.VITE_TENANT_APP_URL as string | undefined
  )?.trim()
  if (explicit) return explicit
  if (import.meta.env.DEV) return 'http://localhost:5173'
  const domain =
    (import.meta.env.VITE_BASE_DOMAIN as string | undefined)?.trim() ||
    'assetvault.uz'
  const subdomain =
    (import.meta.env.VITE_APP_SUBDOMAIN as string | undefined)?.trim() ||
    'asset'
  return `https://${subdomain}.${domain}`
})()

const TENANT_APP_LABEL = TENANT_APP_URL.replace(/^https?:\/\//, '')

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, isLoading, error, clearError, accessToken } =
    usePlatformAuthStore()
  const { t } = useLanguageStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  if (accessToken) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch {
      // error in store
    }
  }

  return (
    <div className="relative min-h-screen bg-paper flex items-center justify-center px-6 py-12">
      <div className="absolute top-5 right-5">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-line bg-vault-surface overflow-hidden shadow-sm">
          {/* Dark operations band — the tenant app never shows this. */}
          <div className="bg-brand px-7 py-6 text-white">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-white/70" />
              <p
                className="text-[11px] tracking-[0.16em] uppercase text-white/70"
                style={{ fontFamily: "'DM Mono', monospace" }}
              >
                {t('admin.platformOps')}
              </p>
            </div>
            <h1
              className="mt-3 text-[26px] leading-tight tracking-[-0.02em]"
              style={{ fontFamily: "'Fraunces', Georgia, serif" }}
            >
              {t('admin.consoleTitle')}
            </h1>
            <p className="mt-1.5 text-[13px] text-white/60">
              {t('admin.consoleSubtitle')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-7 py-7 space-y-4">
            <div>
              <label
                className="block text-[13px] text-muted mb-1.5"
                htmlFor="email"
              >
                {t('admin.operatorEmail')}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-3 rounded-md border border-line bg-vault-surface text-ink text-[14px] outline-none focus:border-brand"
              />
            </div>
            <div>
              <label
                className="block text-[13px] text-muted mb-1.5"
                htmlFor="password"
              >
                {t('admin.password')}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 px-3 pr-10 rounded-md border border-line bg-vault-surface text-ink text-[14px] outline-none focus:border-brand"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="text-[13px] bg-danger-soft border border-danger/15 px-3 py-2.5 rounded-md space-y-1"
              >
                <p className="text-danger">{error}</p>
                <p className="text-body">
                  {t('admin.onlyOperators')}{' '}
                  <a
                    href={TENANT_APP_URL}
                    className="text-brand font-medium hover:underline"
                  >
                    {TENANT_APP_LABEL}
                  </a>
                  .
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 rounded-md bg-brand text-white text-[14px] font-medium hover:bg-brand-hover disabled:opacity-60"
            >
              {isLoading ? t('admin.signingIn') : t('admin.signIn')}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-[12.5px] text-muted">
          {t('admin.lookingForApp')}{' '}
          <a
            href={TENANT_APP_URL}
            className="text-brand hover:underline"
          >
            {TENANT_APP_LABEL}
          </a>
          .
        </p>
      </div>
    </div>
  )
}
