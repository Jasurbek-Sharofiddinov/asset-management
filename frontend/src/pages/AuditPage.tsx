import { useState, useCallback, Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Download,
  ChevronDown,
  ChevronRight,
  Filter,
  X,
} from 'lucide-react'
import { auditApi, type AuditParams } from '../lib/api'
import { Pagination } from '../components/ui/Pagination'
import { Button } from '../components/ui/Button'
import { ActionBadge } from '../components/ui/Badge'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { useToast } from '../components/ui/Toast'
import { useAuthStore } from '../stores/authStore'
import { useLanguageStore } from '../stores/languageStore'
import { formatDateTime } from '../lib/utils'

const entityTypes = ['ASSET', 'ASSIGNMENT', 'USER']
const actionTypes = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'STATUS_CHANGE',
  'ASSIGN',
  'RETURN',
]

export default function AuditPage() {
  const { user } = useAuthStore()
  const { t } = useLanguageStore()
  const toast = useToast()
  const [expandedRow, setExpandedRow] = useState<number | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const [selectedEntity, setSelectedEntity] = useState<string>('')
  const [selectedAction, setSelectedAction] = useState<string>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const queryParams: AuditParams = {
    page,
    size: 50,
    entity_type: selectedEntity || undefined,
    action: selectedAction || undefined,
    date_from: startDate || undefined,
    date_to: endDate || undefined,
  }

  const { data, isLoading } = useQuery({
    queryKey: ['audit', queryParams],
    queryFn: () => auditApi.getAuditLogs(queryParams),
  })

  const handleExportCSV = useCallback(async () => {
    try {
      const blob = await auditApi.exportAuditCSV()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`
      link.click()
      URL.revokeObjectURL(url)
      toast.success(t('audit.exportSuccess'))
    } catch {
      toast.error(t('audit.exportError'))
    }
  }, [toast, t])

  const clearFilters = () => {
    setSelectedEntity('')
    setSelectedAction('')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  const hasActiveFilters = selectedEntity || selectedAction || startDate || endDate
  const canExport = user?.role === 'ADMIN' || user?.role === 'AUDITOR'

  if (isLoading) return <PageLoader />

  const renderJsonDiff = (oldVal: Record<string, unknown> | undefined, newVal: Record<string, unknown> | undefined) => {
    if (!oldVal && !newVal) return null

    return (
      <div className="grid grid-cols-2 gap-4 mt-3">
        <div>
          <p className="text-xs font-medium text-vault-muted-text mb-2">{t('audit.oldValues')}</p>
          <div className="p-3 rounded-lg bg-vault-red/5 border border-vault-red/10">
            {oldVal ? (
              <pre className="text-xs font-[family-name:var(--font-mono)] text-vault-text whitespace-pre-wrap break-all">
                {JSON.stringify(oldVal, null, 2)}
              </pre>
            ) : (
              <p className="text-xs text-vault-muted-text">{t('audit.na')}</p>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-vault-muted-text mb-2">{t('audit.newValues')}</p>
          <div className="p-3 rounded-lg bg-vault-green/5 border border-vault-green/10">
            {newVal ? (
              <pre className="text-xs font-[family-name:var(--font-mono)] text-vault-text whitespace-pre-wrap break-all">
                {JSON.stringify(newVal, null, 2)}
              </pre>
            ) : (
              <p className="text-xs text-vault-muted-text">{t('audit.na')}</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant={showFilters ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
            {t('audit.filters')}
            {hasActiveFilters && (
              <span className="ml-1 w-2 h-2 rounded-full bg-vault-amber" />
            )}
          </Button>
        </div>
        {canExport && (
          <Button variant="secondary" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4" />
            {t('audit.exportCSV')}
          </Button>
        )}
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-vault-surface border border-vault-border rounded-xl p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-vault-text">{t('audit.filters')}</h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-vault-muted-text hover:text-vault-text transition-colors"
              >
                <X className="h-3 w-3" />
                {t('audit.clearAll')}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-vault-muted-text mb-1">{t('audit.entityType')}</label>
              <select
                value={selectedEntity}
                onChange={(e) => { setSelectedEntity(e.target.value); setPage(1) }}
                className="w-full px-3 py-2 bg-vault-black border border-vault-border rounded-lg text-sm text-vault-text appearance-none focus:outline-none focus:ring-2 focus:ring-vault-amber/40"
              >
                <option value="">{t('audit.all')}</option>
                {entityTypes.map((tp) => (
                  <option key={tp} value={tp}>{tp}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-vault-muted-text mb-1">{t('audit.action')}</label>
              <select
                value={selectedAction}
                onChange={(e) => { setSelectedAction(e.target.value); setPage(1) }}
                className="w-full px-3 py-2 bg-vault-black border border-vault-border rounded-lg text-sm text-vault-text appearance-none focus:outline-none focus:ring-2 focus:ring-vault-amber/40"
              >
                <option value="">{t('audit.all')}</option>
                {actionTypes.map((a) => (
                  <option key={a} value={a}>{a.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-vault-muted-text mb-1">{t('audit.startDate')}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
                className="w-full px-3 py-2 bg-vault-black border border-vault-border rounded-lg text-sm text-vault-text focus:outline-none focus:ring-2 focus:ring-vault-amber/40"
              />
            </div>
            <div>
              <label className="block text-xs text-vault-muted-text mb-1">{t('audit.endDate')}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
                className="w-full px-3 py-2 bg-vault-black border border-vault-border rounded-lg text-sm text-vault-text focus:outline-none focus:ring-2 focus:ring-vault-amber/40"
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* Audit Table */}
      <div className="w-full overflow-x-auto rounded-xl border border-vault-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-vault-muted/30 border-b border-vault-border">
              <th className="w-8 px-3 py-3" />
              <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                {t('audit.colTimestamp')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                {t('audit.colEntityType')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                {t('audit.colAction')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                {t('audit.colActor')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                {t('audit.colEntityId')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                {t('audit.colReason')}
              </th>
            </tr>
          </thead>
          <tbody>
            {data?.items && data.items.length > 0 ? (
              data.items.map((log, index) => (
                <Fragment key={log.id}>
                  <tr
                    className={`border-b border-vault-border/30 cursor-pointer transition-colors hover:bg-vault-amber/5 ${
                      index % 2 === 1 ? 'bg-vault-muted/5' : ''
                    }`}
                    onClick={() =>
                      setExpandedRow(expandedRow === log.id ? null : log.id)
                    }
                  >
                    <td className="px-3 py-3">
                      {expandedRow === log.id ? (
                        <ChevronDown className="h-4 w-4 text-vault-amber" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-vault-muted-text" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-vault-muted-text whitespace-nowrap">
                      {formatDateTime(log.occurred_at)}
                    </td>
                    <td className="px-4 py-3 text-vault-text">{log.entity_type}</td>
                    <td className="px-4 py-3">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="px-4 py-3 text-vault-text">
                      {log.actor_name || 'System'}
                    </td>
                    <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-[13px] text-vault-muted-text">
                      {String(log.entity_id).substring(0, 8)}...
                    </td>
                    <td className="px-4 py-3 text-vault-muted-text max-w-[200px] truncate">
                      {log.reason || '-'}
                    </td>
                  </tr>
                  <AnimatePresence>
                    {expandedRow === log.id && (
                      <tr key={`expand-${log.id}`}>
                        <td colSpan={7} className="px-4 pb-4">
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            {renderJsonDiff(log.old_value, log.new_value)}
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </Fragment>
              ))
            ) : (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-vault-muted-text"
                >
                  {t('audit.noLogs')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <Pagination
          currentPage={data.page}
          totalPages={data.pages}
          totalItems={data.total}
          pageSize={queryParams.size || 50}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}
