import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getStats, ORGANIZATION_STATUSES } from '../lib/api'
import { formatDate, StatusBadge } from '../components/ConsoleLayout'

export default function OverviewPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: getStats,
  })

  return (
    <main className="px-8 py-8 max-w-5xl">
      <h1
        className="text-[28px] tracking-[-0.02em] text-ink"
        style={{ fontFamily: "'Fraunces', Georgia, serif" }}
      >
        Overview
      </h1>
      <p className="mt-1 text-[14px] text-body">
        Organizations across every status, plus trials ending in the next 7 days.
      </p>

      {isLoading && <p className="mt-8 text-[14px] text-muted">Loading…</p>}
      {error && (
        <p className="mt-8 text-[13px] text-danger">Failed to load stats.</p>
      )}

      {data && (
        <>
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="border border-line rounded-lg bg-white p-4">
              <p className="text-[12px] uppercase tracking-wide text-muted">Total</p>
              <p className="mt-1 text-[24px] font-semibold text-ink">{data.total}</p>
            </div>
            <Link
              to="/organizations?status=pending_review"
              className="border border-line rounded-lg bg-white p-4 hover:border-brand/40 transition-colors"
            >
              <p className="text-[12px] uppercase tracking-wide text-muted">
                Pending review
              </p>
              <p className="mt-1 text-[24px] font-semibold text-ink">
                {data.pending_review}
              </p>
            </Link>
            {ORGANIZATION_STATUSES.filter((s) => s !== 'pending_review').map(
              (status) => (
                <Link
                  key={status}
                  to={`/organizations?status=${status}`}
                  className="border border-line rounded-lg bg-white p-4 hover:border-brand/40 transition-colors"
                >
                  <p className="text-[12px] uppercase tracking-wide text-muted">
                    {status.replace(/_/g, ' ')}
                  </p>
                  <p className="mt-1 text-[24px] font-semibold text-ink">
                    {data.by_status[status] ?? 0}
                  </p>
                </Link>
              ),
            )}
          </div>

          <section className="mt-10">
            <div className="flex items-end justify-between mb-4">
              <h2 className="text-[16px] font-medium text-ink">
                Trials ending soon
              </h2>
              <Link
                to="/organizations?status=trialing"
                className="text-[13px] text-brand hover:underline"
              >
                View all trialing
              </Link>
            </div>
            {data.trials_expiring_soon.length === 0 ? (
              <p className="text-[14px] text-muted py-8 border border-dashed border-line rounded-lg text-center">
                No trials ending in the next 7 days.
              </p>
            ) : (
              <ul className="divide-y divide-line border border-line rounded-lg bg-white overflow-hidden">
                {data.trials_expiring_soon.map((org) => (
                  <li key={org.id}>
                    <Link
                      to={`/organizations/${org.id}`}
                      className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-paper"
                    >
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-ink truncate">
                          {org.name}
                        </p>
                        <p className="text-[12px] text-muted">
                          Ends {formatDate(org.trial_ends_at)}
                        </p>
                      </div>
                      <StatusBadge status={org.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  )
}
