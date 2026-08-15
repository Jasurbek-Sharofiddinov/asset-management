import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Package,
  UserCheck,
  Wrench,
  AlertTriangle,
  XCircle,
  LayoutGrid,
  List,
  Wand2,
  Loader2,
} from 'lucide-react'
import {
  PieChart, Pie, Cell,
  ResponsiveContainer,
} from 'recharts'
import { analyticsApi, auditApi, referenceApi, aiApi } from '../lib/api'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { ActionBadge } from '../components/ui/Badge'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { formatCurrency, formatDateTime } from '../lib/utils'
import { useState } from 'react'
import { useLanguageStore } from '../stores/languageStore'
import { useAuthStore } from '../stores/authStore'

/* ── Status colors (tuned for light) ── */
const STATUS_COLORS: Record<string, string> = {
  REGISTERED: '#6B7280', ASSIGNED: '#16A34A', IN_REPAIR: '#EA580C',
  LOST: '#DC2626', WRITTEN_OFF: '#9CA3AF',
}

/* Single neutral slate accent for bars */
const SLATE = '#17233D'

function RelativeTime({ date }: { date: string }) {
  const ms = Date.now() - new Date(date).getTime()
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24)
  if (m < 1) return <span>just now</span>
  if (m < 60) return <span>{m}m ago</span>
  if (h < 24) return <span>{h}h ago</span>
  if (d < 30) return <span>{d}d ago</span>
  return <span>{formatDateTime(date)}</span>
}

/* ── Neutral category breakdown: grid / list toggle ── */
function CategoryBreakdown({
  data,
  onSelect,
  title,
  headerLabel,
}: {
  data: { name: string; count: number }[]
  onSelect: (name: string) => void
  title: string
  headerLabel: string
}) {
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const catTotal = data.reduce((s, c) => s + c.count, 0)

  return (
    <>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-vault-muted-text">{headerLabel}</span>
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-vault-muted">
            <button
              onClick={() => setView('grid')}
              aria-label="Grid view"
              aria-pressed={view === 'grid'}
              className={`p-1 rounded-md transition-colors ${view === 'grid' ? 'bg-vault-surface text-vault-text shadow-sm' : 'text-vault-muted-text hover:text-vault-text'}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setView('list')}
              aria-label="List view"
              aria-pressed={view === 'list'}
              className={`p-1 rounded-md transition-colors ${view === 'list' ? 'bg-vault-surface text-vault-text shadow-sm' : 'text-vault-muted-text hover:text-vault-text'}`}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </CardHeader>
      {view === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
          {data.map((c) => {
            const pct = catTotal > 0 ? (c.count / catTotal) * 100 : 0
            return (
              <button
                key={c.name}
                onClick={() => onSelect(c.name)}
                className="text-left p-3 rounded-lg bg-vault-black border border-vault-border hover:border-vault-border-focus hover:bg-white transition-colors"
              >
                <span className="block text-[11px] font-medium text-vault-muted-text uppercase tracking-wide truncate">
                  {c.name}
                </span>
                <span className="block text-[22px] font-medium text-vault-text font-mono leading-tight mt-1">
                  {c.count}
                </span>
                <div className="h-[3px] bg-vault-muted rounded-full overflow-hidden mt-2">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: SLATE }} />
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="space-y-2.5">
          {data.map((c) => {
            const pct = catTotal > 0 ? (c.count / catTotal) * 100 : 0
            return (
              <button
                key={c.name}
                onClick={() => onSelect(c.name)}
                className="w-full flex items-center gap-3 group text-left"
              >
                <span className="text-[13px] text-vault-text w-28 flex-shrink-0 truncate group-hover:text-vault-amber transition-colors">
                  {c.name}
                </span>
                <div className="flex-1 h-[6px] bg-vault-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: SLATE }} />
                </div>
                <span className="text-[13px] font-medium text-vault-text font-mono tabular-nums w-8 text-right">
                  {c.count}
                </span>
                <span className="text-[11px] text-vault-muted-text font-mono tabular-nums w-9 text-right">
                  {pct.toFixed(0)}%
                </span>
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}

export default function DashboardPage() {
  const { t } = useLanguageStore()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [selectedBranchId, setSelectedBranchId] = useState<string>('')
  const canViewAudit = user?.role === 'ADMIN' || user?.role === 'AUDITOR'
  const canUseAi = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: referenceApi.getBranches,
  })

  const branchParams = selectedBranchId ? { branch_id: selectedBranchId } : undefined
  const { data: overview, isLoading } = useQuery({ queryKey: ['analytics', 'overview', selectedBranchId], queryFn: () => analyticsApi.getOverview(branchParams) })
  const { data: recentAudit } = useQuery({
    queryKey: ['audit', 'recent'],
    queryFn: () => auditApi.getAuditLogs({ page: 1, size: 8 }),
    // Stop polling once it fails (e.g. 403 for a suspended organization)
    // so a permanent denial does not become a background request loop.
    refetchInterval: (query) => (query.state.error ? false : 30000),
    enabled: canViewAudit,
  })
  const { data: departmentData } = useQuery({ queryKey: ['analytics', 'departments', selectedBranchId], queryFn: () => analyticsApi.getDepartmentAllocation(branchParams) })
  const { data: insights, refetch: refetchInsights, isFetching: insightsFetching } = useQuery({
    queryKey: ['ai', 'insights'],
    queryFn: aiApi.getInsights,
    enabled: false,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) return <PageLoader />

  const s = (overview as any)?.by_status || {}
  const cat = (overview as any)?.by_category || {}
  const total = (overview as any)?.total_assets || 0
  const totalVal = (overview as any)?.total_value || 0
  const assigned = s['ASSIGNED'] || 0
  const pct = total > 0 ? Math.round((assigned / total) * 100) : 0

  const STATUS_LABELS: Record<string, string> = {
    REGISTERED: t('status.registered'), ASSIGNED: t('status.assigned'), IN_REPAIR: t('status.inRepair'),
    LOST: t('status.lost'), WRITTEN_OFF: t('status.writtenOff'),
  }

  const kpis = [
    { label: t('kpi.totalAssets'), value: total, sub: formatCurrency(totalVal), icon: Package, color: '#6B7280', to: '/assets' },
    { label: t('kpi.assigned'), value: assigned, sub: `${pct}% ${t('kpi.utilization')}`, icon: UserCheck, color: '#16A34A', to: '/assets?status=ASSIGNED' },
    { label: t('kpi.inRepair'), value: s['IN_REPAIR'] || 0, sub: t('kpi.pendingService'), icon: Wrench, color: '#EA580C', to: '/assets?status=IN_REPAIR' },
    { label: t('kpi.lost'), value: s['LOST'] || 0, sub: t('kpi.underInvestigation'), icon: AlertTriangle, color: '#DC2626', to: '/assets?status=LOST' },
    { label: t('kpi.writtenOff'), value: s['WRITTEN_OFF'] || 0, sub: t('kpi.decommissioned'), icon: XCircle, color: '#9CA3AF', to: '/assets?status=WRITTEN_OFF' },
  ]

  const statusData = Object.entries(s).filter(([, v]) => (v as number) > 0)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .map(([k, v]) => ({ name: k, label: STATUS_LABELS[k] || k, value: v as number, color: STATUS_COLORS[k] || '#6B7280', pct: total > 0 ? Math.round(((v as number) / total) * 100) : 0 }))

  const catData = Object.entries(cat).map(([k, v]) => ({ name: k, count: v as number })).sort((a, b) => b.count - a.count)
  const depts = ((departmentData as any[]) || []).sort((a: any, b: any) => (b.asset_count || 0) - (a.asset_count || 0))
  const maxDept = Math.max(...depts.map((d: any) => d.asset_count || 0), 1)

  return (
    <div className="space-y-5">

      {/* ── Toolbar: branch filter only (Header shows the page name) ── */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-vault-muted-text">{t('dashboard.title')}</p>
        <select
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          className="px-3 py-1.5 bg-vault-surface border border-vault-border rounded-lg text-xs text-vault-text focus:outline-none focus:ring-2 focus:ring-vault-amber/20 focus:border-vault-border-focus transition-all"
        >
          <option value="">{t('dashboard.allBranches')}</option>
          {branches?.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map((k) => (
          <button
            key={k.label}
            onClick={() => navigate(k.to)}
            className="text-left bg-vault-surface border border-vault-border rounded-[14px] p-6 hover:border-vault-border-focus hover:shadow-sm transition-[border-color,box-shadow] duration-150 focus:outline-none focus:ring-2 focus:ring-vault-amber/20"
          >
            <div className="flex items-start justify-between mb-4">
              <span className="text-[10px] font-semibold uppercase tracking-[1.5px] text-vault-muted-text">{k.label}</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-vault-muted">
                <k.icon className="h-4 w-4" style={{ color: k.color }} />
              </div>
            </div>
            <div className="mb-1">
              <span className="text-[40px] leading-[1] font-medium tracking-tight font-mono text-vault-text">
                {k.value.toLocaleString()}
              </span>
            </div>
            <p className="text-[12px] text-vault-muted-text">{k.sub}</p>
          </button>
        ))}
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Status Distribution */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader><CardTitle>{t('dashboard.statusDistribution')}</CardTitle>
              <span className="text-[18px] font-medium text-vault-text font-mono">{total}</span>
            </CardHeader>
            {statusData.length > 0 && (
              <div className="flex items-center gap-5">
                <div className="w-[160px] h-[160px] flex-shrink-0 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart><Pie data={statusData} cx="50%" cy="50%" innerRadius={48} outerRadius={74} paddingAngle={3} dataKey="value" stroke="none" cornerRadius={3}>
                      {statusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie></PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[9px] text-vault-muted-text uppercase tracking-[1.5px]">{t('dashboard.active')}</span>
                    <span className="text-base font-semibold text-vault-text font-mono">{pct}%</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2.5">
                  {statusData.map((item) => (
                    <button
                      key={item.name}
                      onClick={() => navigate(`/assets?status=${item.name}`)}
                      className="w-full text-left group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: item.color }} />
                          <span className="text-[12px] text-vault-muted-text group-hover:text-vault-text transition-colors">{item.label}</span>
                        </div>
                        <span className="text-[12px] font-medium text-vault-text tabular-nums font-mono">{item.value}</span>
                      </div>
                      <div className="h-[3px] bg-vault-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ backgroundColor: item.color, width: `${item.pct}%` }} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Category Breakdown — neutral grid / list */}
        <div className="lg:col-span-3">
          <Card className="h-full">
            {catData.length > 0 && (
              <CategoryBreakdown
                data={catData}
                title={t('dashboard.assetCategories')}
                headerLabel={`${Object.keys(cat).length} ${t('dashboard.categories')}`}
                onSelect={(name) => navigate(`/assets?category=${name}`)}
              />
            )}
          </Card>
        </div>
      </div>

      {/* ── AI Insights ── */}
      {canUseAi && (
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              AI Insights
              <span className="text-[9px] font-semibold uppercase tracking-wider text-vault-amber bg-vault-amber/10 px-1.5 py-0.5 rounded">Beta</span>
            </span>
          </CardTitle>
          <button
            onClick={() => refetchInsights()}
            disabled={insightsFetching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-vault-amber text-white hover:bg-vault-amber-dim disabled:opacity-60 transition-colors"
          >
            {insightsFetching
              ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" />Analyzing…</>)
              : (<><Wand2 className="h-3.5 w-3.5" />{insights ? 'Regenerate' : 'Generate'}</>)}
          </button>
        </CardHeader>

        {insights && !insights.error ? (
          <div className="space-y-4">
            <p className="text-[13.5px] leading-relaxed text-vault-text">{insights.summary}</p>
            <div className="grid sm:grid-cols-3 gap-5">
              {[
                { title: 'Highlights', items: insights.highlights, dot: '#16A34A' },
                { title: 'Risks', items: insights.risks, dot: '#DC2626' },
                { title: 'Recommended actions', items: insights.recommendations, dot: '#17233D' },
              ].map((col) => (col.items?.length ? (
                <div key={col.title}>
                  <p className="text-[10px] font-semibold uppercase tracking-[1.5px] text-vault-muted-text mb-2">{col.title}</p>
                  <ul className="space-y-2">
                    {col.items.map((it, i) => (
                      <li key={i} className="flex gap-2 text-[12.5px] leading-snug text-vault-muted-text">
                        <span className="mt-[5px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: col.dot }} />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null))}
            </div>
          </div>
        ) : insights?.error ? (
          <div className="py-6 text-center">
            <p className="text-[12px] text-vault-red">Couldn't generate insights right now.</p>
            <p className="text-[11px] text-vault-muted-text mt-0.5">The AI service may be unavailable — try again.</p>
          </div>
        ) : (
          <div className="py-8 text-center max-w-md mx-auto">
            <p className="text-[13px] text-vault-muted-text">
              Generate an AI summary of your current portfolio — key highlights, risks, and recommended actions, based on live data.
            </p>
            <button
              onClick={() => refetchInsights()}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium bg-vault-amber text-white hover:bg-vault-amber-dim transition-colors"
            >
              <Wand2 className="h-4 w-4" />Generate insights
            </button>
          </div>
        )}
      </Card>
      )}

      {/* ── Activity + Departments ── */}
      <div className={`grid grid-cols-1 gap-4 ${canViewAudit ? 'lg:grid-cols-2' : ''}`}>

        {/* Recent Activity */}
        {canViewAudit && (
        <div>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>{t('dashboard.liveActivity')}</CardTitle>
              <span className="text-[9px] text-vault-muted-text uppercase tracking-[1.5px]">Recent</span>
            </CardHeader>
            <div className="space-y-0.5 max-h-[340px] overflow-y-auto">
              {recentAudit?.items?.length ? recentAudit.items.map((log, i) => (
                <div key={log.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-vault-muted transition-colors group">
                  <div className="flex flex-col items-center self-stretch py-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-vault-muted-text/30 group-hover:bg-vault-amber transition-colors" />
                    {i < recentAudit.items.length - 1 && <div className="flex-1 w-px bg-vault-border mt-1" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><ActionBadge action={log.action} /><span className="text-[9px] text-vault-muted-text uppercase tracking-wider">{log.entity_type}</span></div>
                    <p className="text-[13px] text-vault-text mt-0.5">{log.actor_name || 'System'}</p>
                  </div>
                  <span className="text-[10px] text-vault-muted-text tabular-nums whitespace-nowrap"><RelativeTime date={log.occurred_at} /></span>
                </div>
              )) : (
                <div className="py-12 text-center text-[13px] text-vault-muted-text">{t('dashboard.noRecentActivity')}</div>
              )}
            </div>
          </Card>
        </div>
        )}

        {/* Departments */}
        <div>
          <Card className="h-full">
            <CardHeader><CardTitle>{t('dashboard.departments')}</CardTitle><span className="text-[11px] text-vault-muted-text">{depts.length} {t('dashboard.activeDepartments')}</span></CardHeader>
            <div className="space-y-3 max-h-[340px] overflow-y-auto">
              {depts.map((d: any) => {
                const p = Math.round(((d.asset_count || 0) / maxDept) * 100)
                return (
                  <div key={d.department}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[13px] font-medium text-vault-text">{d.department}</span>
                      <span className="text-[16px] font-medium tabular-nums font-mono text-vault-text">{d.asset_count || 0}</span>
                    </div>
                    <div className="h-[4px] bg-vault-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ backgroundColor: SLATE, width: `${p}%` }} />
                    </div>
                    <p className="text-[10px] text-vault-muted-text mt-1 tabular-nums">{formatCurrency(d.total_value || 0)}</p>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
