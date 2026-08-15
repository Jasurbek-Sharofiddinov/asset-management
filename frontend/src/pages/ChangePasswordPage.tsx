import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'
import { authApi } from '../lib/api'
import { useAuthStore } from '../stores/authStore'

export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const { user, setUser, logout } = useAuthStore()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (next !== confirm) {
      setError('New passwords do not match.')
      return
    }
    if (next === current) {
      setError('New password must be different from the current password.')
      return
    }
    setSubmitting(true)
    try {
      await authApi.changePassword(current, next)
      if (user) {
        setUser({ ...user, must_change_password: false })
      }
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response
        ?.data?.detail
      setError(
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map((d: { msg?: string }) => d.msg || String(d)).join(', ')
            : 'Could not update password.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <h1 className="font-serif text-[28px] tracking-[-0.02em] text-ink">
          Change your password
        </h1>
        <p className="mt-2 text-[14px] text-body">
          Your administrator set a temporary password. Choose a new one before
          continuing.
        </p>

        {error && (
          <div className="mt-5 p-3 rounded-lg bg-danger-soft border border-danger/15">
            <p className="text-[13px] text-danger">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="current" className="block text-[13px] font-medium text-ink mb-1.5">
              Current password
            </label>
            <div className="relative">
              <input
                id="current"
                type={show ? 'text' : 'password'}
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="w-full px-3.5 py-2.5 pr-10 bg-vault-surface border border-line rounded-lg text-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                aria-label={show ? 'Hide password' : 'Show password'}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="next" className="block text-[13px] font-medium text-ink mb-1.5">
              New password
            </label>
            <input
              id="next"
              type={show ? 'text' : 'password'}
              required
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-vault-surface border border-line rounded-lg text-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40"
            />
            <p className="mt-1 text-[12px] text-muted">
              At least 8 characters, with uppercase, lowercase, and a number.
            </p>
          </div>
          <div>
            <label htmlFor="confirm" className="block text-[13px] font-medium text-ink mb-1.5">
              Confirm new password
            </label>
            <input
              id="confirm"
              type={show ? 'text' : 'password'}
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-vault-surface border border-line rounded-lg text-ink text-[14px] focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-[14px] font-medium text-white bg-brand rounded-lg hover:bg-brand-hover disabled:opacity-60"
          >
            {submitting ? 'Updating…' : 'Update password'}
            {!submitting && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>
        <button
          type="button"
          onClick={() => logout()}
          className="mt-5 w-full text-center text-[13px] text-muted hover:text-ink"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
