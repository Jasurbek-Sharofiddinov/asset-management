import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  activateOrganization,
  apiErrorDetail,
  getOrganization,
  ORGANIZATION_PLANS,
  patchOrganization,
  reactivateOrganization,
  rejectOrganization,
  suspendOrganization,
} from '../lib/api'
import { formatDate, StatusBadge } from '../components/ConsoleLayout'
import { tenantOrigin } from '../../lib/config'

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-[12px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-[14px] text-ink break-words">{value || '—'}</dd>
    </div>
  )
}

function toDatetimeLocal(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function OrgDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const { data: org, isLoading, error } = useQuery({
    queryKey: ['platform-org', id],
    queryFn: () => getOrganization(id!),
    enabled: !!id,
  })

  const [slug, setSlug] = useState('')
  const [plan, setPlan] = useState('starter')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminName, setAdminName] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [suspendReason, setSuspendReason] = useState('')
  const [editName, setEditName] = useState('')
  const [editPlan, setEditPlan] = useState('starter')
  const [editNotes, setEditNotes] = useState('')
  const [trialEnds, setTrialEnds] = useState('')
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [activatedWithoutToken, setActivatedWithoutToken] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionOk, setActionOk] = useState<string | null>(null)

  useEffect(() => {
    if (org) {
      setSlug(org.slug)
      setPlan(org.plan || 'starter')
      setAdminEmail(org.contact_email || '')
      setEditName(org.name)
      setEditPlan(org.plan || 'starter')
      setEditNotes(org.notes || '')
      setTrialEnds(toDatetimeLocal(org.trial_ends_at))
    }
  }, [org])

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['platform-org', id] })
    queryClient.invalidateQueries({ queryKey: ['platform-orgs'] })
    queryClient.invalidateQueries({ queryKey: ['platform-stats'] })
    queryClient.invalidateQueries({ queryKey: ['platform-audit'] })
  }

  function onActionError(err: unknown, fallback: string) {
    setActionError(apiErrorDetail(err, fallback))
    setActionOk(null)
  }

  const activateMut = useMutation({
    mutationFn: () =>
      activateOrganization(id!, {
        slug: slug || org!.slug,
        plan,
        admin_email: adminEmail || undefined,
        admin_full_name: adminName || undefined,
      }),
    onSuccess: (res) => {
      setActionError(null)
      if (res.invite_token) {
        setInviteToken(res.invite_token)
        setActivatedWithoutToken(false)
      } else {
        setInviteToken(null)
        setActivatedWithoutToken(true)
      }
      invalidate()
    },
    onError: (err) => onActionError(err, 'Activation failed'),
  })

  const rejectMut = useMutation({
    mutationFn: () => rejectOrganization(id!, rejectReason),
    onSuccess: () => {
      setActionError(null)
      setActionOk('Organization rejected.')
      invalidate()
    },
    onError: (err) => onActionError(err, 'Rejection failed'),
  })

  const suspendMut = useMutation({
    mutationFn: () => suspendOrganization(id!, suspendReason || undefined),
    onSuccess: () => {
      setActionError(null)
      setActionOk('Organization suspended.')
      invalidate()
    },
    onError: (err) => onActionError(err, 'Suspend failed'),
  })

  const reactivateMut = useMutation({
    mutationFn: () => reactivateOrganization(id!),
    onSuccess: () => {
      setActionError(null)
      setActionOk('Organization reactivated.')
      invalidate()
    },
    onError: (err) => onActionError(err, 'Reactivate failed'),
  })

  const patchMut = useMutation({
    mutationFn: (body: {
      name?: string
      plan?: string
      notes?: string
      trial_ends_at?: string
    }) => patchOrganization(id!, body),
    onSuccess: () => {
      setActionError(null)
      setActionOk('Organization updated.')
      invalidate()
    },
    onError: (err) => onActionError(err, 'Update failed'),
  })

  if (isLoading) {
    return <p className="p-10 text-muted text-[14px]">Loading…</p>
  }
  if (error || !org) {
    return (
      <div className="p-10">
        <p className="text-danger text-[14px]">Organization not found.</p>
        <Link to="/organizations" className="text-[13px] text-brand mt-4 inline-block">
          ← Back to organizations
        </Link>
      </div>
    )
  }

  const canReview = org.status === 'pending_review'
  const canSuspend = ['trialing', 'active', 'past_due'].includes(org.status)
  const canReactivate = org.status === 'suspended' || org.status === 'past_due'
  const canEdit = org.status !== 'deleted'
  const canExtendTrial =
    org.status === 'trialing' || org.status === 'past_due' || org.status === 'active'

  return (
    <main className="px-8 py-8 max-w-3xl space-y-8">
      <div>
        <Link to="/organizations" className="text-[13px] text-muted hover:text-ink">
          ← Organizations
        </Link>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <h1
              className="text-[28px] tracking-[-0.02em] text-ink"
              style={{ fontFamily: "'Fraunces', Georgia, serif" }}
            >
              {org.name}
            </h1>
            <p className="mt-1 text-[14px] text-muted flex items-center gap-2">
              <StatusBadge status={org.status} />
              <span className="capitalize">{org.plan}</span>
            </p>
          </div>
        </div>
      </div>

      <dl className="grid sm:grid-cols-2 gap-6 border border-line rounded-lg bg-white p-6">
        <Field label="Slug" value={org.slug} />
        <Field label="Workspace URL" value={tenantOrigin(org.slug)} />
        <Field label="Contact email" value={org.contact_email} />
        <Field label="Contact phone" value={org.contact_phone} />
        <Field label="Website" value={org.website} />
        <Field label="Country" value={org.country} />
        <Field label="Institution type" value={org.institution_type} />
        <Field label="Created" value={formatDate(org.created_at)} />
        <Field label="Updated" value={formatDate(org.updated_at)} />
        <Field label="Trial ends" value={formatDate(org.trial_ends_at)} />
        <Field label="Reviewed at" value={formatDate(org.reviewed_at)} />
        <Field label="Reviewed by" value={org.reviewed_by} />
        <Field label="Signup IP" value={org.signup_ip} />
        <div className="sm:col-span-2">
          <Field label="User agent" value={org.signup_user_agent} />
        </div>
        <div className="sm:col-span-2">
          <Field label="Use case" value={org.use_case} />
        </div>
        {org.rejection_reason && (
          <div className="sm:col-span-2">
            <Field label="Rejection reason" value={org.rejection_reason} />
          </div>
        )}
        {org.notes && (
          <div className="sm:col-span-2">
            <Field label="Notes" value={org.notes} />
          </div>
        )}
      </dl>

      {inviteToken && (
        <div className="border border-ok rounded-lg bg-ok-soft p-5 space-y-2">
          <p className="text-[14px] font-medium text-ok">
            Activated — convey this one-time invite token out of band
          </p>
          <p className="text-[12px] text-body">
            Initial login password for the org admin. Shown once; not stored in plaintext.
            Workspace: <span className="font-mono">{tenantOrigin(org.slug)}/login</span>
          </p>
          <code
            className="block mt-2 p-3 bg-white border border-line rounded text-[13px] break-all"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {inviteToken}
          </code>
        </div>
      )}

      {activatedWithoutToken && !inviteToken && (
        <div className="border border-ok rounded-lg bg-ok-soft p-5">
          <p className="text-[14px] font-medium text-ok">Organization activated</p>
          <p className="mt-1 text-[13px] text-body">
            The applicant already set a password at signup. They can sign in at{' '}
            <span className="font-mono">{tenantOrigin(org.slug)}/login</span>
            {' '}with that password now — no invite token to hand over.
          </p>
        </div>
      )}

      {actionOk && (
        <p className="text-[13px] text-ok bg-ok-soft px-3 py-2 rounded-md">{actionOk}</p>
      )}
      {actionError && (
        <p className="text-[13px] text-danger bg-danger-soft px-3 py-2 rounded-md">
          {actionError}
        </p>
      )}

      {canReview && !inviteToken && !activatedWithoutToken && (
        <div className="grid gap-8">
          <section className="border border-line rounded-lg bg-white p-6 space-y-4">
            <h2 className="text-[16px] font-medium text-ink">Activate</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] text-muted mb-1">Confirm slug</label>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  className="w-full h-10 px-3 rounded-md border border-line text-[14px]"
                />
              </div>
              <div>
                <label className="block text-[12px] text-muted mb-1">Plan</label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-line text-[14px] bg-white"
                >
                  {ORGANIZATION_PLANS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] text-muted mb-1">Admin email</label>
                <input
                  type="email"
                  placeholder={org.contact_email || 'admin@example.com'}
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-line text-[14px]"
                />
              </div>
              <div>
                <label className="block text-[12px] text-muted mb-1">
                  Admin full name
                </label>
                <input
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder={`${org.name} Admin`}
                  className="w-full h-10 px-3 rounded-md border border-line text-[14px]"
                />
              </div>
            </div>
            <button
              type="button"
              disabled={activateMut.isPending}
              onClick={() => activateMut.mutate()}
              className="h-10 px-4 rounded-md bg-brand text-white text-[14px] hover:bg-brand-hover disabled:opacity-60"
            >
              {activateMut.isPending ? 'Activating…' : 'Activate organization'}
            </button>
          </section>

          <section className="border border-line rounded-lg bg-white p-6 space-y-4">
            <h2 className="text-[16px] font-medium text-ink">Reject</h2>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Reason (required)"
              className="w-full px-3 py-2 rounded-md border border-line text-[14px]"
            />
            <button
              type="button"
              disabled={rejectMut.isPending || !rejectReason.trim()}
              onClick={() => rejectMut.mutate()}
              className="h-10 px-4 rounded-md bg-danger text-white text-[14px] disabled:opacity-60"
            >
              {rejectMut.isPending ? 'Rejecting…' : 'Reject organization'}
            </button>
          </section>
        </div>
      )}

      {canSuspend && (
        <section className="border border-line rounded-lg bg-white p-6 space-y-4">
          <h2 className="text-[16px] font-medium text-ink">Suspend</h2>
          <textarea
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            rows={2}
            placeholder="Reason (optional)"
            className="w-full px-3 py-2 rounded-md border border-line text-[14px]"
          />
          <button
            type="button"
            disabled={suspendMut.isPending}
            onClick={() => suspendMut.mutate()}
            className="h-10 px-4 rounded-md bg-danger text-white text-[14px] disabled:opacity-60"
          >
            {suspendMut.isPending ? 'Suspending…' : 'Suspend organization'}
          </button>
        </section>
      )}

      {canReactivate && (
        <section className="border border-line rounded-lg bg-white p-6 space-y-3">
          <h2 className="text-[16px] font-medium text-ink">Reactivate</h2>
          <p className="text-[13px] text-body">
            Restore this organization to active status.
          </p>
          <button
            type="button"
            disabled={reactivateMut.isPending}
            onClick={() => reactivateMut.mutate()}
            className="h-10 px-4 rounded-md bg-brand text-white text-[14px] hover:bg-brand-hover disabled:opacity-60"
          >
            {reactivateMut.isPending ? 'Reactivating…' : 'Reactivate organization'}
          </button>
        </section>
      )}

      {canEdit && (
        <section className="border border-line rounded-lg bg-white p-6 space-y-4">
          <h2 className="text-[16px] font-medium text-ink">Edit</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] text-muted mb-1">Name</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-line text-[14px]"
              />
            </div>
            <div>
              <label className="block text-[12px] text-muted mb-1">Plan</label>
              <select
                value={editPlan}
                onChange={(e) => setEditPlan(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-line text-[14px] bg-white"
              >
                {ORGANIZATION_PLANS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[12px] text-muted mb-1">Notes</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-md border border-line text-[14px]"
              />
            </div>
          </div>
          <button
            type="button"
            disabled={patchMut.isPending || !editName.trim()}
            onClick={() =>
              patchMut.mutate({
                name: editName.trim(),
                plan: editPlan,
                notes: editNotes,
              })
            }
            className="h-10 px-4 rounded-md bg-brand text-white text-[14px] hover:bg-brand-hover disabled:opacity-60"
          >
            {patchMut.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </section>
      )}

      {canExtendTrial && (
        <section className="border border-line rounded-lg bg-white p-6 space-y-4">
          <h2 className="text-[16px] font-medium text-ink">Extend trial</h2>
          <input
            type="datetime-local"
            value={trialEnds}
            onChange={(e) => setTrialEnds(e.target.value)}
            className="h-10 px-3 rounded-md border border-line text-[14px]"
          />
          <button
            type="button"
            disabled={patchMut.isPending || !trialEnds}
            onClick={() =>
              patchMut.mutate({
                trial_ends_at: new Date(trialEnds).toISOString(),
              })
            }
            className="h-10 px-4 rounded-md border border-line text-[14px] hover:border-brand/40 disabled:opacity-60"
          >
            Update trial end
          </button>
        </section>
      )}
    </main>
  )
}
