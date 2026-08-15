import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listOrganizations, ORGANIZATION_STATUSES } from '../lib/api'
import { formatDate, StatusBadge } from '../components/ConsoleLayout'
import { useLanguageStore } from '../../stores/languageStore'

const PAGE_SIZE = 20

export default function OrganizationsPage() {
  const { t } = useLanguageStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const status = searchParams.get('status') || ''
  const qParam = searchParams.get('q') || ''
  const page = Math.max(1, Number(searchParams.get('page') || '1') || 1)
  const [qDraft, setQDraft] = useState(qParam)

  const query = useQuery({
    queryKey: ['platform-orgs', status, qParam, page],
    queryFn: () =>
      listOrganizations({
        status: status || undefined,
        q: qParam || undefined,
        page,
        size: PAGE_SIZE,
      }),
  })

  const tabs = useMemo(
    () => [{ value: '', label: t('admin.all') }, ...ORGANIZATION_STATUSES.map((s) => ({
      value: s,
      label: s.replace(/_/g, ' '),
    }))],
    [t],
  )

  function setFilter(next: { status?: string; q?: string; page?: number }) {
    const params = new URLSearchParams()
    const nextStatus = next.status !== undefined ? next.status : status
    const nextQ = next.q !== undefined ? next.q : qParam
    const nextPage = next.page !== undefined ? next.page : 1
    if (nextStatus) params.set('status', nextStatus)
    if (nextQ) params.set('q', nextQ)
    if (nextPage > 1) params.set('page', String(nextPage))
    setSearchParams(params)
  }

  const data = query.data

  return (
    <main className="px-8 py-8 max-w-6xl">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1
            className="text-[28px] tracking-[-0.02em] text-ink"
            style={{ fontFamily: "'Fraunces', Georgia, serif" }}
          >
            {t('admin.organizations')}
          </h1>
          <p className="mt-1 text-[14px] text-body">
            {t('admin.orgsSubtitle')}
          </p>
        </div>
        <Link
          to="/organizations/new"
          className="h-10 px-4 rounded-md bg-brand text-white text-[14px] hover:bg-brand-hover inline-flex items-center"
        >
          {t('admin.newOrganization')}
        </Link>
      </div>

      <form
        className="mb-4"
        onSubmit={(e) => {
          e.preventDefault()
          setFilter({ q: qDraft.trim(), page: 1 })
        }}
      >
        <input
          value={qDraft}
          onChange={(e) => setQDraft(e.target.value)}
          placeholder={t('admin.searchPlaceholder')}
          className="w-full max-w-md h-10 px-3 rounded-md border border-line text-[14px] bg-white"
        />
      </form>

      <div className="flex flex-wrap gap-1.5 mb-5">
        {tabs.map((tab) => (
          <button
            key={tab.value || 'all'}
            type="button"
            onClick={() => {
              setQDraft(qParam)
              setFilter({ status: tab.value, page: 1 })
            }}
            className={`px-3 py-1.5 rounded-md text-[12px] capitalize ${
              status === tab.value
                ? 'bg-brand text-white'
                : 'bg-white border border-line text-body hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {query.isLoading && <p className="text-[14px] text-muted">Loading…</p>}
      {query.error && (
        <p className="text-[13px] text-danger">Failed to load organizations.</p>
      )}

      {data && data.items.length === 0 && (
        <p className="text-[14px] text-muted py-12 border border-dashed border-line rounded-lg text-center">
          No organizations match this filter.
        </p>
      )}

      {data && data.items.length > 0 && (
        <div className="border border-line rounded-lg bg-white overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-line bg-paper/60 text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Slug</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Plan</th>
                <th className="px-4 py-2.5 font-medium">Contact</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
                <th className="px-4 py-2.5 font-medium">Trial end</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.items.map((org) => (
                <tr key={org.id} className="hover:bg-paper/70">
                  <td className="px-4 py-3">
                    <Link
                      to={`/organizations/${org.id}`}
                      className="font-medium text-ink hover:text-brand"
                    >
                      {org.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted font-mono text-[12px]">
                    {org.slug}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={org.status} />
                  </td>
                  <td className="px-4 py-3 capitalize text-body">{org.plan}</td>
                  <td className="px-4 py-3 text-body">{org.contact_email || '—'}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(org.created_at)}</td>
                  <td className="px-4 py-3 text-muted">
                    {formatDate(org.trial_ends_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.pages > 1 && (
        <div className="mt-4 flex items-center gap-3 text-[13px]">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setFilter({ page: page - 1 })}
            className="h-8 px-3 rounded-md border border-line bg-white disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-muted">
            Page {data.page} of {data.pages} · {data.total} total
          </span>
          <button
            type="button"
            disabled={page >= data.pages}
            onClick={() => setFilter({ page: page + 1 })}
            className="h-8 px-3 rounded-md border border-line bg-white disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </main>
  )
}
