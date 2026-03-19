import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Package,
  UserCheck,
  Wrench,
  AlertTriangle,
  XCircle,
  ArrowUpRight,
  Sparkles,
  ShieldAlert,
  Lightbulb,
  TrendingUp,
  ChevronRight,
  RefreshCw,
  Brain,
  ShoppingCart,
  Calendar,
  DollarSign,
} from 'lucide-react'
import {
  PieChart, Pie, Cell,
  ResponsiveContainer,
} from 'recharts'
import { analyticsApi, auditApi, aiApi, referenceApi } from '../lib/api'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { ActionBadge } from '../components/ui/Badge'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { formatCurrency, formatDateTime } from '../lib/utils'
import { useEffect, useState, useRef } from 'react'

/* ── Colors ── */
const STATUS_COLORS: Record<string, string> = {
  REGISTERED: '#8E8EA8', ASSIGNED: '#22C55E', IN_REPAIR: '#F97316',
  LOST: '#EF4444', WRITTEN_OFF: '#4B5563',
}
const STATUS_LABELS: Record<string, string> = {
  REGISTERED: 'Registered', ASSIGNED: 'Assigned', IN_REPAIR: 'In Repair',
  LOST: 'Lost', WRITTEN_OFF: 'Written Off',
}
const CAT_COLORS = ['#F5A623', '#22C55E', '#3B82F6', '#F87171', '#A78BFA', '#EC4899', '#2DD4BF', '#FB923C', '#94A3B8']
const DEPT_COLORS: Record<string, string> = {
  Operations: '#F5A623', Management: '#22C55E', HR: '#3B82F6', IT: '#F87171',
  'Customer Service': '#A78BFA', Finance: '#2DD4BF', Security: '#FB923C', Legal: '#EC4899',
}

/* ── Animated counter ── */
function Counter({ target, duration = 1100 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0)
  const raf = useRef<number | null>(null)
  useEffect(() => {
    if (target === 0) { setCount(0); return }
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1)
      setCount(Math.round((1 - Math.pow(1 - p, 4)) * target))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [target, duration])
  return <>{count.toLocaleString()}</>
}

function RelativeTime({ date }: { date: string }) {
  const ms = Date.now() - new Date(date).getTime()
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24)
  if (m < 1) return <span>just now</span>
  if (m < 60) return <span>{m}m ago</span>
  if (h < 24) return <span>{h}h ago</span>
  if (d < 30) return <span>{d}d ago</span>
  return <span>{formatDateTime(date)}</span>
}

const stagger = {
  container: { show: { transition: { staggerChildren: 0.05 } } },
  item: { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } },
}

/* ── Squarified treemap layout algorithm ── */
interface TreemapRect { x: number; y: number; w: number; h: number; item: { name: string; count: number }; idx: number }

function squarify(items: { name: string; count: number }[], W: number, H: number): TreemapRect[] {
  if (!items.length) return []
  const totalVal = items.reduce((s, d) => s + d.count, 0)
  if (totalVal === 0) return []

  // Normalize areas to total pixel area
  const totalArea = W * H
  const data = items.map((d, i) => ({ ...d, area: (d.count / totalVal) * totalArea, idx: i }))

  const rects: TreemapRect[] = []
  let x = 0, y = 0, w = W, h = H

  function layoutRow(row: typeof data, rowArea: number, isHorizontal: boolean) {
    if (isHorizontal) {
      const rowW = rowArea / h
      let cy = y
      for (const d of row) {
        const dh = d.area / rowW
        rects.push({ x, y: cy, w: rowW, h: dh, item: d, idx: d.idx })
        cy += dh
      }
      x += rowW; w -= rowW
    } else {
      const rowH = rowArea / w
      let cx = x
      for (const d of row) {
        const dw = d.area / rowH
        rects.push({ x: cx, y, w: dw, h: rowH, item: d, idx: d.idx })
        cx += dw
      }
      y += rowH; h -= rowH
    }
  }

  function worstRatio(row: typeof data, side: number): number {
    const rowArea = row.reduce((s, d) => s + d.area, 0)
    let worst = 0
    for (const d of row) {
      const rowLen = rowArea / side
      const itemLen = d.area / rowLen
      const ratio = Math.max(rowLen / itemLen, itemLen / rowLen)
      worst = Math.max(worst, ratio)
    }
    return worst
  }

  let remaining = [...data]
  while (remaining.length > 0) {
    const isHorizontal = w < h
    const side = isHorizontal ? h : w
    const row = [remaining[0]]
    remaining = remaining.slice(1)

    while (remaining.length > 0) {
      const candidate = [...row, remaining[0]]
      if (worstRatio(candidate, side) <= worstRatio(row, side)) {
        row.push(remaining[0])
        remaining = remaining.slice(1)
      } else break
    }

    const rowArea = row.reduce((s, d) => s + d.area, 0)
    layoutRow(row, rowArea, isHorizontal)
  }

  return rects
}

function SquarifiedTreemap({ data, total }: { data: { name: string; count: number }[]; total: number }) {
  const W = 600, H = 220
  const GAP = 3
  const rects = squarify(data, W, H)
  const catTotal = data.reduce((s, c) => s + c.count, 0)

  return (
    <div className="relative w-full" style={{ paddingBottom: `${(H / W) * 100}%` }}>
      <div className="absolute inset-0">
        {rects.map((r, i) => {
          const pctX = (r.x / W) * 100, pctY = (r.y / H) * 100
          const pctW = (r.w / W) * 100, pctH = (r.h / H) * 100
          const color = CAT_COLORS[r.idx % CAT_COLORS.length]
          const pctVal = catTotal > 0 ? (r.item.count / catTotal) * 100 : 0
          const isLarge = pctW > 15 && pctH > 30

          return (
            <motion.div
              key={r.item.name}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
              className="absolute group cursor-default overflow-hidden"
              style={{
                left: `calc(${pctX}% + ${GAP / 2}px)`,
                top: `calc(${pctY}% + ${GAP / 2}px)`,
                width: `calc(${pctW}% - ${GAP}px)`,
                height: `calc(${pctH}% - ${GAP}px)`,
                backgroundColor: color,
                borderRadius: 8,
              }}
            >
              {/* Overlay for depth */}
              <div className="absolute inset-0 bg-black/25 group-hover:bg-black/10 transition-all duration-200" />

              {/* Content */}
              <div className="relative h-full flex flex-col justify-between p-2.5">
                <span className="text-[10px] font-bold text-white/85 uppercase tracking-[1.5px] leading-tight">
                  {r.item.name}
                </span>
                {isLarge ? (
                  <div>
                    <span className="text-[28px] font-medium text-white leading-none block"
                      style={{ fontFamily: "'DM Mono', 'JetBrains Mono', monospace" }}>
                      {r.item.count}
                    </span>
                    <span className="text-[12px] text-white/50 font-medium"
                      style={{ fontFamily: "'DM Mono', 'JetBrains Mono', monospace" }}>
                      {pctVal.toFixed(0)}%
                    </span>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[18px] font-medium text-white leading-none"
                      style={{ fontFamily: "'DM Mono', 'JetBrains Mono', monospace" }}>
                      {r.item.count}
                    </span>
                    <span className="text-[10px] text-white/50"
                      style={{ fontFamily: "'DM Mono', 'JetBrains Mono', monospace" }}>
                      {pctVal.toFixed(0)}%
                    </span>
                  </div>
                )}

                {/* Bottom progress bar */}
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/20">
                  <div className="h-full bg-white/30 rounded-full" style={{ width: `${pctVal}%` }} />
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [selectedBranchId, setSelectedBranchId] = useState<string>('')

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: referenceApi.getBranches,
  })

  const branchParams = selectedBranchId ? { branch_id: selectedBranchId } : undefined
  const { data: overview, isLoading } = useQuery({ queryKey: ['analytics', 'overview', selectedBranchId], queryFn: () => analyticsApi.getOverview(branchParams) })
  const { data: recentAudit } = useQuery({ queryKey: ['audit', 'recent'], queryFn: () => auditApi.getAuditLogs({ page: 1, size: 8 }), refetchInterval: 30000 })
  const { data: departmentData } = useQuery({ queryKey: ['analytics', 'departments', selectedBranchId], queryFn: () => analyticsApi.getDepartmentAllocation(branchParams) })
  const { data: insights, isLoading: insightsLoading, refetch: refetchInsights } = useQuery({
    queryKey: ['ai', 'insights'], queryFn: aiApi.getInsights, retry: false, staleTime: 5 * 60 * 1000,
    enabled: false, // manual trigger
  })
  const { data: predictions, isLoading: predictionsLoading, refetch: refetchPredictions } = useQuery({
    queryKey: ['ai', 'predictions'], queryFn: aiApi.getPredictions, retry: false, staleTime: 5 * 60 * 1000,
    enabled: false, // manual trigger
  })

  if (isLoading) return <PageLoader />

  const s = (overview as any)?.by_status || {}
  const cat = (overview as any)?.by_category || {}
  const total = (overview as any)?.total_assets || 0
  const totalVal = (overview as any)?.total_value || 0
  const assigned = s['ASSIGNED'] || 0
  const pct = total > 0 ? Math.round((assigned / total) * 100) : 0

  const kpis = [
    { label: 'Total Assets', value: total, sub: formatCurrency(totalVal), icon: Package, color: '#F5A623', bg: 'rgba(245,166,35,0.12)' },
    { label: 'Assigned', value: assigned, sub: `${pct}% utilization`, icon: UserCheck, color: '#22C55E', bg: 'rgba(34,197,94,0.12)', trend: pct },
    { label: 'In Repair', value: s['IN_REPAIR'] || 0, sub: 'Pending service', icon: Wrench, color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
    { label: 'Lost', value: s['LOST'] || 0, sub: 'Under investigation', icon: AlertTriangle, color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
    { label: 'Written Off', value: s['WRITTEN_OFF'] || 0, sub: 'Decommissioned', icon: XCircle, color: '#4B5563', bg: 'rgba(75,85,99,0.12)' },
  ]

  const statusData = Object.entries(s).filter(([, v]) => (v as number) > 0)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .map(([k, v]) => ({ name: k, label: STATUS_LABELS[k] || k, value: v as number, color: STATUS_COLORS[k] || '#4B5563', pct: total > 0 ? Math.round(((v as number) / total) * 100) : 0 }))

  const catData = Object.entries(cat).map(([k, v]) => ({ name: k, count: v as number })).sort((a, b) => b.count - a.count)
  const depts = ((departmentData as any[]) || []).sort((a: any, b: any) => (b.asset_count || 0) - (a.asset_count || 0))
  const maxDept = Math.max(...depts.map((d: any) => d.asset_count || 0), 1)

  return (
    <motion.div className="space-y-5" variants={stagger.container} initial="hidden" animate="show">

      {/* ── Branch Filter ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-vault-text" style={{ fontFamily: "'Syne', sans-serif" }}>Dashboard</h1>
        <select
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          className="px-3 py-1.5 bg-vault-surface border border-vault-border rounded-lg text-xs text-vault-text focus:outline-none focus:ring-2 focus:ring-vault-amber/30 focus:border-vault-amber/40 transition-all"
        >
          <option value="">All Branches</option>
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
          <motion.div key={k.label} variants={stagger.item}>
            <Card hover className="h-full">
              <div className="flex items-start justify-between mb-4">
                <span className="text-[10px] font-semibold uppercase tracking-[1.5px] text-vault-muted-text">{k.label}</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: k.bg }}>
                  <k.icon className="h-4 w-4" style={{ color: k.color }} />
                </div>
              </div>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-[40px] leading-[1] font-medium tracking-tight" style={{ fontFamily: "'DM Mono', 'JetBrains Mono', monospace", color: k.color, fontWeight: 500 }}>
                  <Counter target={k.value} />
                </span>
                {k.trend !== undefined && (
                  <span className="flex items-center gap-0.5 text-[12px] font-semibold text-vault-green mb-2">
                    <ArrowUpRight className="h-3 w-3" />{k.trend}%
                  </span>
                )}
              </div>
              <p className="text-[12px] text-vault-muted-text">{k.sub}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Status Distribution */}
        <motion.div variants={stagger.item} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader><CardTitle>Status Distribution</CardTitle>
              <span className="text-[18px] font-medium text-vault-amber" style={{ fontFamily: "'DM Mono', 'JetBrains Mono', monospace" }}>{total}</span>
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
                    <span className="text-[9px] text-vault-muted-text uppercase tracking-[1.5px]">Active</span>
                    <span className="text-base font-semibold text-vault-text" style={{ fontFamily: "'DM Mono', 'JetBrains Mono', monospace" }}>{pct}%</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2.5">
                  {statusData.map((item) => (
                    <div key={item.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: item.color }} />
                          <span className="text-[12px] text-vault-muted-text">{item.label}</span>
                        </div>
                        <span className="text-[12px] font-medium text-vault-text tabular-nums" style={{ fontFamily: "'DM Mono', 'JetBrains Mono', monospace" }}>{item.value}</span>
                      </div>
                      <div className="h-[3px] bg-vault-muted/30 rounded-full overflow-hidden">
                        <motion.div className="h-full rounded-full" style={{ backgroundColor: item.color }}
                          initial={{ width: 0 }} animate={{ width: `${item.pct}%` }}
                          transition={{ duration: 0.7, delay: 0.2 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Category Breakdown — Squarified Treemap */}
        <motion.div variants={stagger.item} className="lg:col-span-3">
          <Card className="h-full">
            <CardHeader><CardTitle>Asset Categories</CardTitle>
              <span className="text-[11px] text-vault-muted-text">{Object.keys(cat).length} categories &middot; {total} assets</span>
            </CardHeader>
            {catData.length > 0 && <SquarifiedTreemap data={catData} total={total} />}
          </Card>
        </motion.div>
      </div>

      {/* ── AI Panels Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* AI Insights */}
        <motion.div variants={stagger.item}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle><div className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-vault-amber" />AI Insights</div></CardTitle>
              <button onClick={() => refetchInsights()} className="text-[10px] uppercase tracking-wider text-vault-muted-text hover:text-vault-amber transition-colors flex items-center gap-1">
                <RefreshCw className={`h-3 w-3 ${insightsLoading ? 'animate-spin' : ''}`} />Generate
              </button>
            </CardHeader>

            {insights && !insights.error ? (
              <div className="space-y-4">
                <p className="text-[13px] text-vault-text leading-relaxed">{insights.summary}</p>

                {insights.highlights?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <TrendingUp className="h-3 w-3 text-vault-green" />
                      <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-vault-muted-text">Highlights</span>
                    </div>
                    <div className="space-y-1.5">
                      {insights.highlights.map((h: string, i: number) => (
                        <div key={i} className="flex gap-2 text-[12px] text-vault-muted-text">
                          <ChevronRight className="h-3 w-3 mt-0.5 text-vault-green flex-shrink-0" />
                          <span>{h}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {insights.risks?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <ShieldAlert className="h-3 w-3 text-vault-red" />
                      <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-vault-muted-text">Risks</span>
                    </div>
                    <div className="space-y-1.5">
                      {insights.risks.map((r: string, i: number) => (
                        <div key={i} className="flex gap-2 text-[12px] text-vault-muted-text">
                          <ChevronRight className="h-3 w-3 mt-0.5 text-vault-red flex-shrink-0" />
                          <span>{r}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {insights.recommendations?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Lightbulb className="h-3 w-3 text-vault-amber" />
                      <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-vault-muted-text">Actions</span>
                    </div>
                    <div className="space-y-1.5">
                      {insights.recommendations.map((r: string, i: number) => (
                        <div key={i} className="flex gap-2 text-[12px] text-vault-muted-text">
                          <ChevronRight className="h-3 w-3 mt-0.5 text-vault-amber flex-shrink-0" />
                          <span>{r}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : insights?.error ? (
              <div className="py-8 text-center">
                <p className="text-[12px] text-vault-red mb-1">Could not generate insights</p>
                <p className="text-[11px] text-vault-muted-text">Check your Grok API key in backend .env</p>
              </div>
            ) : (
              <div className="py-10 text-center">
                <Sparkles className="h-8 w-8 text-vault-amber/20 mx-auto mb-3" />
                <p className="text-[13px] text-vault-muted-text mb-1">AI-powered portfolio analysis</p>
                <p className="text-[11px] text-vault-disabled">Click "Generate" to analyze your asset data</p>
              </div>
            )}
          </Card>
        </motion.div>

        {/* AI Predictions */}
        <motion.div variants={stagger.item}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle><div className="flex items-center gap-1.5"><Brain className="h-3.5 w-3.5 text-purple-400" />AI Predictions</div></CardTitle>
              <button onClick={() => refetchPredictions()} className="text-[10px] uppercase tracking-wider text-vault-muted-text hover:text-purple-400 transition-colors flex items-center gap-1">
                <RefreshCw className={`h-3 w-3 ${predictionsLoading ? 'animate-spin' : ''}`} />Generate
              </button>
            </CardHeader>

            {predictions && !predictions.error ? (
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {/* Predicted Purchases */}
                {predictions.predicted_purchases?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <ShoppingCart className="h-3 w-3 text-vault-amber" />
                      <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-vault-muted-text">Predicted Purchases</span>
                    </div>
                    <div className="space-y-2">
                      {predictions.predicted_purchases.map((p, i) => {
                        const urgencyColor = p.urgency === 'high' ? '#EF4444' : p.urgency === 'medium' ? '#F97316' : '#22C55E'
                        return (
                          <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-vault-muted/10 border border-vault-border/50">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[12px] font-medium text-vault-text">{p.category}</span>
                                <span
                                  className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                                  style={{ color: urgencyColor, background: `${urgencyColor}18`, border: `1px solid ${urgencyColor}30` }}
                                >
                                  {p.urgency}
                                </span>
                              </div>
                              <p className="text-[11px] text-vault-muted-text truncate">{p.reason}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className="block text-[14px] font-medium text-vault-text" style={{ fontFamily: "'DM Mono', 'JetBrains Mono', monospace" }}>
                                x{p.quantity}
                              </span>
                              <span className="block text-[10px] text-vault-muted-text" style={{ fontFamily: "'DM Mono', 'JetBrains Mono', monospace" }}>
                                {formatCurrency(p.estimated_budget)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Maintenance Forecast */}
                {predictions.maintenance_forecast?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Calendar className="h-3 w-3 text-vault-blue" />
                      <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-vault-muted-text">Maintenance Forecast</span>
                    </div>
                    <div className="space-y-1.5">
                      {predictions.maintenance_forecast.map((m, i) => (
                        <div key={i} className="flex gap-2 text-[12px] text-vault-muted-text px-3 py-2 rounded-lg bg-vault-muted/10 border border-vault-border/50">
                          <Wrench className="h-3 w-3 mt-0.5 text-vault-blue flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-vault-text">{m.description}</span>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-[10px] text-vault-muted-text">{m.timeline}</span>
                              <span className="text-[10px] text-vault-muted-text" style={{ fontFamily: "'DM Mono', 'JetBrains Mono', monospace" }}>{m.affected_count} assets</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Budget Outlook */}
                {predictions.budget_outlook && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <DollarSign className="h-3 w-3 text-vault-green" />
                      <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-vault-muted-text">Budget Outlook</span>
                    </div>
                    <p className="text-[12px] text-vault-muted-text leading-relaxed px-3 py-2 rounded-lg bg-vault-muted/10 border border-vault-border/50">
                      {predictions.budget_outlook}
                    </p>
                  </div>
                )}
              </div>
            ) : predictions?.error ? (
              <div className="py-8 text-center">
                <p className="text-[12px] text-vault-red mb-1">Could not generate predictions</p>
                <p className="text-[11px] text-vault-muted-text">Check your Grok API key in backend .env</p>
              </div>
            ) : (
              <div className="py-10 text-center">
                <Brain className="h-8 w-8 text-purple-400/20 mx-auto mb-3" />
                <p className="text-[13px] text-vault-muted-text mb-1">AI-powered asset predictions</p>
                <p className="text-[11px] text-vault-disabled">Click "Generate" to forecast purchases & maintenance</p>
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* ── Activity + Departments ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Recent Activity */}
        <motion.div variants={stagger.item}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Live Activity</CardTitle>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-vault-green opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-vault-green" /></span>
                <span className="text-[9px] text-vault-muted-text uppercase tracking-[1.5px]">Real-time</span>
              </div>
            </CardHeader>
            <div className="space-y-0.5 max-h-[340px] overflow-y-auto">
              {recentAudit?.items?.length ? recentAudit.items.map((log, i) => (
                <div key={log.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-vault-muted/20 transition-colors group">
                  <div className="flex flex-col items-center self-stretch py-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-vault-muted-text/30 group-hover:bg-vault-amber transition-colors" />
                    {i < recentAudit.items.length - 1 && <div className="flex-1 w-px bg-vault-border/50 mt-1" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><ActionBadge action={log.action} /><span className="text-[9px] text-vault-muted-text uppercase tracking-wider">{log.entity_type}</span></div>
                    <p className="text-[13px] text-vault-text mt-0.5">{log.actor_name || 'System'}</p>
                  </div>
                  <span className="text-[10px] text-vault-muted-text tabular-nums whitespace-nowrap"><RelativeTime date={log.occurred_at} /></span>
                </div>
              )) : (
                <div className="py-12 text-center text-[13px] text-vault-muted-text">No recent activity</div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Departments */}
        <motion.div variants={stagger.item}>
          <Card className="h-full">
            <CardHeader><CardTitle>Departments</CardTitle><span className="text-[11px] text-vault-muted-text">{depts.length} active</span></CardHeader>
            <div className="space-y-3 max-h-[340px] overflow-y-auto">
              {depts.map((d: any, i: number) => {
                const p = Math.round(((d.asset_count || 0) / maxDept) * 100)
                const c = DEPT_COLORS[d.department] || CAT_COLORS[i % CAT_COLORS.length]
                return (
                  <div key={d.department}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[13px] font-medium text-vault-text">{d.department}</span>
                      <span className="text-[16px] font-medium tabular-nums" style={{ fontFamily: "'DM Mono', 'JetBrains Mono', monospace", color: c }}>{d.asset_count || 0}</span>
                    </div>
                    <div className="h-[4px] bg-vault-muted/20 rounded-full overflow-hidden">
                      <motion.div className="h-full rounded-full" style={{ backgroundColor: c, opacity: 0.75 }}
                        initial={{ width: 0 }} animate={{ width: `${p}%` }} transition={{ duration: 0.6, delay: 0.3 + i * 0.04 }} />
                    </div>
                    <p className="text-[10px] text-vault-muted-text mt-1 tabular-nums">{formatCurrency(d.total_value || 0)}</p>
                  </div>
                )
              })}
            </div>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  )
}
