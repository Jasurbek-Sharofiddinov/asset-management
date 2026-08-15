import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { listAudit } from '../lib/api'
import { formatDate } from '../components/ConsoleLayout'

export default function AuditPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading, error } = useQuery({
    queryKey: ['platform-audit', page],
    queryFn: () => listAudit({ page, size: 25 }),
  })

  return (
    <main className="px-8 py-8 max-w-6xl">
      <h1
        className="text-[28px] tracking-[-0.02em] text-ink"
        style={{ fontFamily: "'Fraunces', Georgia, serif" }}
      >
        Audit log
      </h1>
      <p className="mt-1 text-[14px] text-body">
        Append-only record of platform actions across organizations.
      </p>

      {isLoading && <p className="mt-8 text-[14px] text-muted">Loading…</p>}
      {error && (
        <p className="mt-8 text-[13px] text-danger">Failed to load audit log.</p>
      )}

      {data && data.items.length === 0 && (
        <p className="mt-8 text-[14px] text-muted py-12 border border-dashed border-line rounded-lg text-center">
          No platform audit entries yet.
        </p>
      )}

      {data && data.items.length > 0 && (
        <div className="mt-6 border border-line rounded-lg bg-vault-surface overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-line bg-paper/60 text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 font-medium">Actor</th>
                <th className="px-4 py-2.5 font-medium">Action</th>
                <th className="px-4 py-2.5 font-medium">Target</th>
                <th className="px-4 py-2.5 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.items.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">
                    {formatDate(row.occurred_at)}
                  </td>
                  <td className="px-4 py-3">{row.actor_email}</td>
                  <td className="px-4 py-3 font-mono text-[12px]">{row.action}</td>
                  <td className="px-4 py-3">
                    {row.target_organization_id ? (
                      <Link
                        to={`/organizations/${row.target_organization_id}`}
                        className="text-brand hover:underline font-mono text-[12px]"
                      >
                        {row.target_organization_id.slice(0, 8)}…
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-body max-w-xs truncate">
                    {row.reason || '—'}
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
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="h-8 px-3 rounded-md border border-line bg-vault-surface disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-muted">
            Page {data.page} of {data.pages} · {data.total} total
          </span>
          <button
            type="button"
            disabled={page >= data.pages}
            onClick={() => setPage((p) => p + 1)}
            className="h-8 px-3 rounded-md border border-line bg-vault-surface disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </main>
  )
}
