import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight, Check } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useLanguageStore } from '../stores/languageStore'
import { authApi } from '../lib/api'
import { cn } from '../lib/utils'
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

export default function RegisterPage() {
  const navigate = useNavigate()
  const { t, locale, setLocale } = useLanguageStore()
  const { setUser } = useAuthStore()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError(t('register.passwordMismatch'))
      return
    }

    setIsLoading(true)
    try {
      const response = await authApi.register(fullName, email, password)
      const token = response.access_token
      const user = {
        id: response.user_id,
        email,
        full_name: response.full_name,
        role: response.role,
        is_active: true,
      }
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      setUser(user)
      // Manually set isAuthenticated via login-like approach
      useAuthStore.setState({ token, user, isAuthenticated: true })
      navigate('/dashboard')
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Registration failed'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-paper">
      {/* ── Left: brand panel ── */}
      <aside className="relative hidden lg:flex flex-col justify-between bg-brand text-white p-12 overflow-hidden">
        <div className="flex items-center gap-2">
          <Mark className="h-5 w-5" />
          <span className="text-[15px] font-semibold tracking-tight">AssetVault</span>
        </div>

        <div className="max-w-sm">
          <h2 className="font-serif text-[38px] leading-[1.08] tracking-[-0.02em]">
            Every asset,<br />accounted for.
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-white/65">
            One system of record for equipment across every location — with role-based access
            and a tamper-proof audit trail.
          </p>
          <ul className="mt-8 space-y-3">
            {['Role-based access control', 'Append-only audit trail', 'QR tracking on every asset'].map((f) => (
              <li key={f} className="flex items-center gap-3 text-[13.5px] text-white/80">
                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
                  <Check className="w-3 h-3" />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[12px] text-white/40 font-mono">asset.datamou.uz</p>
      </aside>

      {/* ── Right: form ── */}
      <main className="relative flex items-center justify-center px-6 py-12">
        {/* Language switcher */}
        <div className="absolute top-5 right-5 flex items-center gap-1">
          {locales.map((loc) => (
            <button
              key={loc.code}
              onClick={() => setLocale(loc.code)}
              className={cn(
                'px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-colors',
                locale === loc.code
                  ? 'bg-brand/10 text-brand'
                  : 'text-muted hover:text-ink'
              )}
            >
              {loc.label}
            </button>
          ))}
        </div>

        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 text-ink mb-8">
            <Mark className="h-5 w-5 text-brand" />
            <span className="text-[15px] font-semibold tracking-tight">AssetVault</span>
          </div>

          <h1 className="font-serif text-[28px] leading-tight tracking-[-0.02em] text-ink">
            {t('register.title')}
          </h1>
          <p className="mt-1.5 text-[14px] text-body">
            {t('register.subtitle')}
          </p>

          {error && (
            <div className="mt-5 p-3 rounded-lg bg-danger-soft border border-danger/15">
              <p className="text-[13px] text-danger">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-[13px] font-medium text-ink mb-1.5">
                {t('register.fullNameLabel')}
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('register.fullNamePlaceholder')}
                required
                className="w-full px-3.5 py-2.5 bg-white border border-line rounded-lg text-ink text-[14px] placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40 transition-shadow"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-[13px] font-medium text-ink mb-1.5">
                {t('register.emailLabel')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('register.emailPlaceholder')}
                required
                className="w-full px-3.5 py-2.5 bg-white border border-line rounded-lg text-ink text-[14px] placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40 transition-shadow"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-[13px] font-medium text-ink mb-1.5">
                {t('register.passwordLabel')}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('register.passwordPlaceholder')}
                  required
                  minLength={6}
                  className="w-full px-3.5 py-2.5 pr-10 bg-white border border-line rounded-lg text-ink text-[14px] placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40 transition-shadow"
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

            <div>
              <label htmlFor="confirmPassword" className="block text-[13px] font-medium text-ink mb-1.5">
                {t('register.confirmPasswordLabel')}
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('register.confirmPasswordPlaceholder')}
                  required
                  className="w-full px-3.5 py-2.5 pr-10 bg-white border border-line rounded-lg text-ink text-[14px] placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40 transition-shadow"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <p className="text-[12px] text-muted leading-relaxed">
              {t('register.viewerNote')}
            </p>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-[14px] font-medium text-white bg-brand rounded-lg hover:bg-brand-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Creating account…' : t('register.submit')}
              {!isLoading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          <p className="mt-6 text-center text-[13px] text-body">
            {t('register.haveAccount')}{' '}
            <Link to="/login" className="text-brand font-medium hover:text-brand-hover transition-colors">
              {t('register.signIn')}
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
