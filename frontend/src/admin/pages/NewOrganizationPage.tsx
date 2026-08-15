import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import {
  apiErrorDetail,
  createOrganization,
  ORGANIZATION_PLANS,
} from '../lib/api'

export default function NewOrganizationPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [plan, setPlan] = useState('starter')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mut = useMutation({
    mutationFn: () =>
      createOrganization({
        name,
        slug: slug.trim() || undefined,
        contact_email: contactEmail.trim() || undefined,
        plan,
        notes: notes.trim() || undefined,
      }),
    onSuccess: (org) => {
      navigate(`/organizations/${org.id}`, { replace: true })
    },
    onError: (err) => {
      setError(apiErrorDetail(err, 'Could not create organization'))
    },
  })

  return (
    <main className="px-8 py-8 max-w-xl">
      <h1
        className="text-[28px] tracking-[-0.02em] text-ink"
        style={{ fontFamily: "'Fraunces', Georgia, serif" }}
      >
        New organization
      </h1>
      <p className="mt-1 text-[14px] text-body">
        Creates a pending organization. Activate it from the detail page to start
        the trial and issue admin credentials.
      </p>

      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          mut.mutate()
        }}
      >
        <div>
          <label className="block text-[12px] text-muted mb-1" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-line text-[14px]"
          />
        </div>
        <div>
          <label className="block text-[12px] text-muted mb-1" htmlFor="slug">
            Slug (optional)
          </label>
          <input
            id="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder="Derived from name if left blank"
            className="w-full h-10 px-3 rounded-md border border-line text-[14px]"
          />
        </div>
        <div>
          <label className="block text-[12px] text-muted mb-1" htmlFor="email">
            Contact email (optional)
          </label>
          <input
            id="email"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-line text-[14px]"
          />
        </div>
        <div>
          <label className="block text-[12px] text-muted mb-1" htmlFor="plan">
            Plan
          </label>
          <select
            id="plan"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-line text-[14px] bg-vault-surface"
          >
            {ORGANIZATION_PLANS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[12px] text-muted mb-1" htmlFor="notes">
            Notes
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-md border border-line text-[14px]"
          />
        </div>
        {error && (
          <p className="text-[13px] text-danger bg-danger-soft px-3 py-2 rounded-md">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={mut.isPending || !name.trim()}
          className="h-10 px-4 rounded-md bg-brand text-white text-[14px] hover:bg-brand-hover disabled:opacity-60"
        >
          {mut.isPending ? 'Creating…' : 'Create organization'}
        </button>
      </form>
    </main>
  )
}
