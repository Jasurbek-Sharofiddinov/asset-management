import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useLanguageStore } from '../stores/languageStore'
import { authApi } from '../lib/api'
import { Button } from '../components/ui/Button'
import { cn } from '../lib/utils'
import type { Locale } from '../i18n/translations'

const locales: { code: Locale; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'ru', label: 'RU' },
  { code: 'uz', label: 'UZ' },
]

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
    <div className="min-h-screen bg-vault-black flex items-center justify-center p-4 relative">
      {/* Language Switcher */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1">
        {locales.map((loc) => (
          <button
            key={loc.code}
            onClick={() => setLocale(loc.code)}
            className={cn(
              'px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all',
              locale === loc.code
                ? 'bg-vault-amber/15 text-vault-amber border border-vault-amber/30'
                : 'text-vault-muted-text hover:text-vault-text hover:bg-vault-muted/20 border border-transparent'
            )}
          >
            {loc.label}
          </button>
        ))}
      </div>

      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-vault-amber/[0.03] blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md relative"
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-vault-amber/10 border border-vault-amber/20 mb-4">
            <Shield className="h-8 w-8 text-vault-amber" />
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-vault-text">
            Asset<span className="text-vault-amber">Vault</span>
          </h1>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="bg-vault-surface border border-vault-border rounded-2xl p-8 shadow-[0_0_0_1px_rgba(245,158,11,0.08),0_4px_24px_rgba(0,0,0,0.6)]"
        >
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-vault-text mb-1">
            {t('register.title')}
          </h2>
          <p className="text-sm text-vault-muted-text mb-6">{t('register.subtitle')}</p>

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-4 p-3 rounded-lg bg-vault-red/10 border border-vault-red/20"
            >
              <p className="text-sm text-vault-red">{error}</p>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-vault-text mb-1.5">
                {t('register.fullNameLabel')}
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('register.fullNamePlaceholder')}
                required
                className="w-full px-3 py-2.5 bg-vault-black border border-vault-border rounded-lg text-vault-text text-sm placeholder:text-vault-muted-text/50 focus:outline-none focus:ring-2 focus:ring-vault-amber/40 focus:border-vault-amber/50 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-vault-text mb-1.5">
                {t('register.emailLabel')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('register.emailPlaceholder')}
                required
                className="w-full px-3 py-2.5 bg-vault-black border border-vault-border rounded-lg text-vault-text text-sm placeholder:text-vault-muted-text/50 focus:outline-none focus:ring-2 focus:ring-vault-amber/40 focus:border-vault-amber/50 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-vault-text mb-1.5">
                {t('register.passwordLabel')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('register.passwordPlaceholder')}
                  required
                  minLength={6}
                  className="w-full px-3 py-2.5 pr-10 bg-vault-black border border-vault-border rounded-lg text-vault-text text-sm placeholder:text-vault-muted-text/50 focus:outline-none focus:ring-2 focus:ring-vault-amber/40 focus:border-vault-amber/50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-vault-muted-text hover:text-vault-text transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-vault-text mb-1.5">
                {t('register.confirmPasswordLabel')}
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('register.confirmPasswordPlaceholder')}
                  required
                  className="w-full px-3 py-2.5 pr-10 bg-vault-black border border-vault-border rounded-lg text-vault-text text-sm placeholder:text-vault-muted-text/50 focus:outline-none focus:ring-2 focus:ring-vault-amber/40 focus:border-vault-amber/50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-vault-muted-text hover:text-vault-text transition-colors"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-vault-muted-text leading-relaxed">
              {t('register.viewerNote')}
            </p>

            <Button type="submit" isLoading={isLoading} className="w-full py-2.5" size="lg">
              {t('register.submit')}
            </Button>
          </form>

          <p className="text-center text-sm text-vault-muted-text mt-5">
            {t('register.haveAccount')}{' '}
            <Link to="/login" className="text-vault-amber hover:text-vault-amber/80 font-medium transition-colors">
              {t('register.signIn')}
            </Link>
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}
