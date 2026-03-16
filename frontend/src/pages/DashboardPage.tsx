import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Package,
  UserCheck,
  Wrench,
  AlertTriangle,
  XCircle,
  Clock,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { analyticsApi, auditApi } from '../lib/api'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { ActionBadge } from '../components/ui/Badge'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { formatCurrency, formatDateTime } from '../lib/utils'
import { useEffect, useState, useRef } from 'react'

const STATUS_COLORS: Record<string, string> = {
  REGISTERED: '#6B7280',
  ASSIGNED: '#10B981',
  IN_REPAIR: '#FBBF24',
  LOST: '#EF4444',
  WRITTEN_OFF: '#4B5563',
}

const CATEGORY_COLORS = [
  '#F59E0B', '#3B82F6', '#10B981', '#EF4444',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1',
]

function AnimatedCounter({ target, duration = 1000 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0)
  const ref = useRef<number | null>(null)

  useEffect(() => {
    if (target === 0) { setCount(0); return }
    const startTime = performance.now()
    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * target))
      if (progress < 1) {
        ref.current = requestAnimationFrame(animate)
      }
    }
    ref.current = requestAnimationFrame(animate)
    return () => { if (ref.current) cancelAnimationFrame(ref.current) }
  }, [target, duration])

  return <>{count.toLocaleString()}</>
}

export default function DashboardPage() {
  // Overview: { total_assets, by_status, by_category, total_value }
  const { data: overview, isLoading } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: analyticsApi.getOverview,
  })

  const { data: recentAudit } = useQuery({
    queryKey: ['audit', 'recent'],
    queryFn: () => auditApi.getAuditLogs({ page: 1, size: 10 }),
    refetchInterval: 30000,
  })

  // department-allocation: [{ department, asset_count, total_value }]
  const { data: departmentData } = useQuery({
    queryKey: ['analytics', 'departments'],
    queryFn: analyticsApi.getDepartmentAllocation,
  })

  if (isLoading) return <PageLoader />

  const byStatus = (overview as any)?.by_status || {}
  const byCategory = (overview as any)?.by_category || {}
  const totalAssets = (overview as any)?.total_assets || 0
  const totalValue = (overview as any)?.total_value || 0

  const assignedCount = byStatus['ASSIGNED'] || 0
  const inRepairCount = byStatus['IN_REPAIR'] || 0
  const lostCount = byStatus['LOST'] || 0
  const writtenOffCount = byStatus['WRITTEN_OFF'] || 0
  const registeredCount = byStatus['REGISTERED'] || 0
  const assignedPct = totalAssets > 0 ? Math.round((assignedCount / totalAssets) * 100) : 0

  const kpis = [
    {
      label: 'Total Assets',
      value: totalAssets,
      subtitle: formatCurrency(totalValue),
      icon: Package,
      color: 'text-vault-amber',
      bgColor: 'bg-vault-amber/10',
      borderColor: 'border-vault-amber/20',
    },
    {
      label: 'Assigned',
      value: assignedCount,
      subtitle: `${assignedPct}% utilization`,
      icon: UserCheck,
      color: 'text-vault-green',
      bgColor: 'bg-vault-green/10',
      borderColor: 'border-vault-green/20',
    },
    {
      label: 'In Repair',
      value: inRepairCount,
      subtitle: 'Pending service',
      icon: Wrench,
      color: 'text-vault-yellow',
      bgColor: 'bg-vault-yellow/10',
      borderColor: 'border-vault-yellow/20',
    },
    {
      label: 'Lost',
      value: lostCount,
      subtitle: 'Under investigation',
      icon: AlertTriangle,
      color: 'text-vault-red',
      bgColor: 'bg-vault-red/10',
      borderColor: 'border-vault-red/20',
    },
    {
      label: 'Written Off',
      value: writtenOffCount,
      subtitle: 'Decommissioned',
      icon: XCircle,
      color: 'text-vault-gray',
      bgColor: 'bg-vault-muted/30',
      borderColor: 'border-vault-border',
    },
  ]

  const statusChartData = Object.entries(byStatus)
    .filter(([, v]) => (v as number) > 0)
    .map(([name, value]) => ({
      name: name.replace('_', ' '),
      value: value as number,
      color: STATUS_COLORS[name] || '#6B7280',
    }))

  const categoryChartData = Object.entries(byCategory)
    .map(([name, value]) => ({ name, count: value as number }))
    .sort((a, b) => b.count - a.count)

  // Department data: map actual response fields
  const deptItems = (departmentData as any[]) || []

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.35 }}
          >
            <Card className="relative overflow-hidden group">
              <div className="flex items-start justify-between mb-3">
                <p className="text-[11px] font-semibold text-vault-muted-text uppercase tracking-[0.08em]">
                  {kpi.label}
                </p>
                <div className={`p-2 rounded-lg ${kpi.bgColor} border ${kpi.borderColor}`}>
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
              </div>
              <p
                className={`text-[40px] leading-none font-bold tracking-tight ${kpi.color}`}
                style={{ fontFamily: "'Syne', sans-serif" }}
              >
                <AnimatedCounter target={kpi.value} />
              </p>
              <p className="text-xs text-vault-muted-text mt-2">{kpi.subtitle}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution Donut */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.35 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Status Distribution</CardTitle>
              <span className="text-xs text-vault-muted-text">{totalAssets} total</span>
            </CardHeader>
            {statusChartData.length > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="60%" height={240}>
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#12121A',
                        border: '1px solid #1E1E2E',
                        borderRadius: '8px',
                        color: '#E5E7EB',
                        fontSize: '12px',
                      }}
                      formatter={(value: number) => [`${value} assets`, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2.5">
                  {statusChartData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-xs text-vault-muted-text capitalize">{item.name.toLowerCase()}</span>
                      </div>
                      <span className="text-xs font-medium text-vault-text">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-vault-muted-text text-sm">
                No data available
              </div>
            )}
          </Card>
        </motion.div>

        {/* Category Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.35 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Category Breakdown</CardTitle>
              <span className="text-xs text-vault-muted-text">{Object.keys(byCategory).length} categories</span>
            </CardHeader>
            {categoryChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={categoryChartData} layout="vertical" margin={{ left: 4, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" horizontal={false} />
                  <XAxis type="number" stroke="#4B5563" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#6B7280"
                    fontSize={11}
                    width={90}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#12121A',
                      border: '1px solid #1E1E2E',
                      borderRadius: '8px',
                      color: '#E5E7EB',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [`${value} assets`, '']}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                    {categoryChartData.map((_, index) => (
                      <Cell key={index} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-vault-muted-text text-sm">
                No data available
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.35 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <div className="flex items-center gap-1.5 text-xs text-vault-muted-text">
                <Clock className="h-3 w-3" />
                Auto-refreshes every 30s
              </div>
            </CardHeader>
            <div className="space-y-1 max-h-[380px] overflow-y-auto">
              {recentAudit?.items && recentAudit.items.length > 0 ? (
                recentAudit.items.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-vault-muted/20 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <ActionBadge action={log.action} />
                        <span className="text-[11px] text-vault-muted-text uppercase tracking-wide">
                          {log.entity_type}
                        </span>
                      </div>
                      <p className="text-sm text-vault-text">
                        <span className="font-medium">{log.actor_name || 'System'}</span>
                      </p>
                    </div>
                    <span className="text-[11px] text-vault-muted-text whitespace-nowrap">
                      {formatDateTime(log.occurred_at)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-vault-muted-text text-sm">
                  No recent activity
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Department Utilization */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.35 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Department Utilization</CardTitle>
              <span className="text-xs text-vault-muted-text">{deptItems.length} departments</span>
            </CardHeader>
            <div className="space-y-2 max-h-[380px] overflow-y-auto">
              {deptItems.length > 0 ? (
                deptItems
                  .sort((a: any, b: any) => (b.asset_count || 0) - (a.asset_count || 0))
                  .map((dept: any) => {
                    const maxCount = Math.max(...deptItems.map((d: any) => d.asset_count || 0), 1)
                    const pct = Math.round(((dept.asset_count || 0) / maxCount) * 100)
                    return (
                      <div
                        key={dept.department}
                        className="px-3 py-2.5 rounded-lg hover:bg-vault-muted/20 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-vault-text">{dept.department}</span>
                          <div className="flex items-baseline gap-1.5">
                            <span
                              className="text-lg font-bold text-vault-amber"
                              style={{ fontFamily: "'Syne', sans-serif" }}
                            >
                              {dept.asset_count || 0}
                            </span>
                            <span className="text-[11px] text-vault-muted-text">assets</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-vault-muted/30 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-vault-amber/60 rounded-full transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {(dept.total_value || 0) > 0 && (
                          <p className="text-[11px] text-vault-muted-text mt-1">
                            {formatCurrency(dept.total_value)}
                          </p>
                        )}
                      </div>
                    )
                  })
              ) : (
                <div className="text-center py-12 text-vault-muted-text text-sm">
                  No department data
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
