import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Eye, EyeOff } from 'lucide-react'
import { authApi } from '../lib/api'
import { APP_HOST, SALES_TELEGRAM_HANDLE, SALES_TELEGRAM_URL, TRIAL_LENGTH_DAYS } from '../lib/config'
import axios from 'axios'

const INSTITUTION_TYPES = [
  'Bank',
  'Microfinance',
  'Insurance',
  'Corporate',
  'Government',
  'Other',
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

function errorMessage(err: unknown): string {
  if (!axios.isAxiosError(err)) return 'Could not submit your application. Please try again.'
  if (err.response?.status === 429) {
    const retryAfter = Number(err.response.headers?.['retry-after'])
    return Number.isFinite(retryAfter) && retryAfter > 0
      ? `Too many attempts. Try again in ${retryAfter}s.`
      : 'Too many attempts. Try again later.'
  }
  const detail = err.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map((d: { msg?: string }) => d.msg || String(d)).join(', ')
  }
  return 'Could not submit your application. Please try again.'
}

export default function SignupPage() {
  const [organizationName, setOrganizationName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [adminFullName, setAdminFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [country, setCountry] = useState('')
  const [institutionType, setInstitutionType] = useState('')
  const [useCase, setUseCase] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      await authApi.signup({
        organization_name: organizationName,
        contact_email: contactEmail,
        admin_full_name: adminFullName,
        password,
        contact_phone: phone.trim() || undefined,
        website: website.trim() || undefined,
        country: country.trim() || undefined,
        institution_type: institutionType || undefined,
        use_case: useCase.trim() || undefined,
      })
      setSubmitted(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-xl border border-line bg-white p-8">
          <div className="flex items-center gap-2 text-ink mb-6">
            <Mark className="h-5 w-5 text-brand" />
            <span className="text-[15px] font-semibold tracking-tight">AssetVault</span>
          </div>
          <h1 className="font-serif text-[26px] tracking-[-0.02em] text-ink">
            Application received
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-body">
            We’ll review your organization and activate the {TRIAL_LENGTH_DAYS}-day trial.
            When it’s approved, sign in with the email and password you just chose.
            You won’t be able to sign in until then.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-[14px] font-medium text-white bg-brand rounded-lg hover:bg-brand-hover"
          >
            Go to sign in
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-paper">
      <aside className="relative hidden lg:flex flex-col justify-between bg-brand text-white p-12 overflow-hidden">
        <div className="flex items-center gap-2">
          <Mark className="h-5 w-5" />
          <span className="text-[15px] font-semibold tracking-tight">AssetVault</span>
        </div>
        <div className="max-w-sm">
          <h2 className="font-serif text-[38px] leading-[1.08] tracking-[-0.02em]">
            Start a {TRIAL_LENGTH_DAYS}-day trial.
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-white/65">
            Apply here. We review each organization before activation so every
            workspace stays isolated and accounted for.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              'You choose the password now',
              'We activate after a short review',
              'Then you sign in to your workspace',
            ].map((f) => (
              <li key={f} className="flex items-center gap-3 text-[13.5px] text-white/80">
                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
                  <Check className="w-3 h-3" />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[12px] text-white/40 font-mono">{APP_HOST}</p>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="flex lg:hidden items-center gap-2 text-ink mb-8">
            <Mark className="h-5 w-5 text-brand" />
            <span className="text-[15px] font-semibold tracking-tight">AssetVault</span>
          </div>
          <h1 className="font-serif text-[28px] leading-tight tracking-[-0.02em] text-ink">
            Request a trial
          </h1>
          <p className="mt-1.5 text-[14px] text-body">
            Already have an account?{' '}
            <Link to="/login" className="text-brand font-medium hover:underline">
              Sign in
            </Link>
          </p>

          {error && (
            <div className="mt-5 p-3 rounded-lg bg-danger-soft border border-danger/15">
              <p className="text-[13px] text-danger">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-3.5">
            <div>
              <label htmlFor="org" className="block text-[13px] font-medium text-ink mb-1.5">
                Organization name
              </label>
              <input
                id="org"
                required
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-line rounded-lg text-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40"
              />
            </div>
            <div>
              <label htmlFor="name" className="block text-[13px] font-medium text-ink mb-1.5">
                Your full name
              </label>
              <input
                id="name"
                required
                value={adminFullName}
                onChange={(e) => setAdminFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-line rounded-lg text-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-[13px] font-medium text-ink mb-1.5">
                Work email
              </label>
              <input
                id="email"
                type="email"
                required
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-line rounded-lg text-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-[13px] font-medium text-ink mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 pr-10 bg-white border border-line rounded-lg text-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-[12px] text-muted">
                At least 8 characters, with uppercase, lowercase, and a number.
              </p>
            </div>
            <div>
              <label htmlFor="confirm" className="block text-[13px] font-medium text-ink mb-1.5">
                Confirm password
              </label>
              <input
                id="confirm"
                type={showPassword ? 'text' : 'password'}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-line rounded-lg text-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3.5">
              <div>
                <label htmlFor="phone" className="block text-[13px] font-medium text-ink mb-1.5">
                  Phone
                </label>
                <input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-line rounded-lg text-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40"
                />
              </div>
              <div>
                <label htmlFor="country" className="block text-[13px] font-medium text-ink mb-1.5">
                  Country
                </label>
                <input
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-line rounded-lg text-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40"
                />
              </div>
            </div>
            <div>
              <label htmlFor="website" className="block text-[13px] font-medium text-ink mb-1.5">
                Website
              </label>
              <input
                id="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-line rounded-lg text-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40"
              />
            </div>
            <div>
              <label htmlFor="type" className="block text-[13px] font-medium text-ink mb-1.5">
                Institution type
              </label>
              <select
                id="type"
                value={institutionType}
                onChange={(e) => setInstitutionType(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-line rounded-lg text-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40"
              >
                <option value="">Select…</option>
                {INSTITUTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="use" className="block text-[13px] font-medium text-ink mb-1.5">
                What will you track?
              </label>
              <textarea
                id="use"
                value={useCase}
                onChange={(e) => setUseCase(e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2.5 bg-white border border-line rounded-lg text-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-[14px] font-medium text-white bg-brand rounded-lg hover:bg-brand-hover disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : `Request ${TRIAL_LENGTH_DAYS}-day trial`}
              {!submitting && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          <p className="mt-6 text-center text-[13px] text-body">
            Questions?{' '}
            <a
              href={SALES_TELEGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="text-brand font-medium hover:underline"
            >
              Telegram {SALES_TELEGRAM_HANDLE}
            </a>
          </p>
        </div>
      </main>
    </div>
  )
}
