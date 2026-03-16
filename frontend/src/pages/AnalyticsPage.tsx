import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts'
import { AlertTriangle, Clock, Wrench } from 'lucide-react'
import { analyticsApi } from '../lib/api'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { formatCurrency, formatDate } from '../lib/utils'

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

const tooltipStyle = {
  backgroundColor: '#12121A',
  border: '1px solid #1E1E2E',
  borderRadius: '8px',
  color: '#E5E7EB',
  fontSize: '12px',
}

export default function AnalyticsPage() {
  const { data: valueOverTime, isLoading: l1 } = useQuery({
    queryKey: ['analytics', 'value-over-time'],
    queryFn: analyticsApi.getValueOverTime,
  })

  const { data: rawStatusOverTime, isLoading: l2 } = useQuery({
    queryKey: ['analytics', 'status-over-time'],
    queryFn: analyticsApi.getStatusOverTime,
  })

  const { data: rawDeptAllocation, isLoading: l3 } = useQuery({
    queryKey: ['analytics', 'department-allocation'],
    queryFn: analyticsApi.getDepartmentAllocation,
  })

  const { data: rawAgeDistribution, isLoading: l4 } = useQuery({
    queryKey: ['analytics', 'age-distribution'],
    queryFn: analyticsApi.getAgeDistribution,
  })

  const { data: rawRepairFrequency, isLoading: l5 } = useQuery({
    queryKey: ['analytics', 'repair-frequency'],
    queryFn: analyticsApi.getRepairFrequency,
  })

  const { data: rawWarrantyExpiring, isLoading: l6 } = useQuery({
    queryKey: ['analytics', 'warranty-expiring'],
    queryFn: analyticsApi.getWarrantyExpiring,
  })

  if (l1 && l2 && l3 && l4 && l5 && l6) return <PageLoader />

  // Transform status-over-time: backend returns { date, statuses: { ASSIGNED: n, ... } }
  // Flatten to { date, ASSIGNED: n, IN_REPAIR: n, ... }
  const statusOverTime = ((rawStatusOverTime as any[]) || []).map((item: any) => ({
    date: item.date,
    ...(item.statuses || {}),
  }))

  // Transform department-allocation: backend returns { department, asset_count, total_value }
  const deptAllocation = ((rawDeptAllocation as any[]) || []).map((d: any) => ({
    department: d.department,
    assets: d.asset_count || 0,
    value: d.total_value || 0,
  }))

  // Transform age-distribution: backend returns { age_group, count }
  const ageOrder = ['< 1 year', '1-2 years', '2-3 years', '3-5 years', '5+ years', 'Unknown']
  const ageDistribution = ((rawAgeDistribution as any[]) || [])
    .map((d: any) => ({ range: d.age_group, count: d.count }))
    .sort((a, b) => ageOrder.indexOf(a.range) - ageOrder.indexOf(b.range))

  // Repair frequency: backend returns { name, serial_number, category, repair_count }
  const repairFrequency = ((rawRepairFrequency as any[]) || []).slice(0, 10)

  // Warranty expiring: backend returns { id, name, serial_number, category, warranty_expiry, days_remaining, status }
  const warrantyExpiring = (rawWarrantyExpiring as any[]) || []

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 [&>div>div]:h-full">
        {/* 1. Asset Value Over Time */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0, duration: 0.35 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Asset Value Over Time</CardTitle>
            </CardHeader>
            {valueOverTime && (valueOverTime as any[]).length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={valueOverTime as any[]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" />
                  <XAxis dataKey="date" stroke="#4B5563" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#4B5563"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: any) => [formatCurrency(Number(value)), 'Total Value']}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#F59E0B', stroke: '#0A0A0F', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-vault-muted-text text-sm">
                No data available
              </div>
            )}
          </Card>
        </motion.div>

        {/* 2. Status Breakdown Over Time */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.35 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Status Breakdown Over Time</CardTitle>
            </CardHeader>
            {statusOverTime.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={statusOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" />
                  <XAxis dataKey="date" stroke="#4B5563" fontSize={11} tickLine={false} />
                  <YAxis stroke="#4B5563" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend
                    verticalAlign="bottom"
                    formatter={(value: string) => (
                      <span style={{ color: '#9CA3AF', fontSize: '11px' }}>
                        {value.replace('_', ' ')}
                      </span>
                    )}
                  />
                  {Object.entries(STATUS_COLORS).map(([key, color]) => (
                    <Area
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stackId="1"
                      stroke={color}
                      fill={color}
                      fillOpacity={0.4}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-vault-muted-text text-sm">
                No data available
              </div>
            )}
          </Card>
        </motion.div>

        {/* 3. Department Allocation */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.35 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Department Allocation</CardTitle>
            </CardHeader>
            {deptAllocation.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={deptAllocation} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" horizontal={false} />
                  <XAxis type="number" stroke="#4B5563" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="department"
                    stroke="#6B7280"
                    fontSize={11}
                    width={100}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: any) => [`${value} assets`, 'Assigned']}
                  />
                  <Bar dataKey="assets" radius={[0, 4, 4, 0]} barSize={20}>
                    {deptAllocation.map((_: any, index: number) => (
                      <Cell key={index} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-vault-muted-text text-sm">
                No data available
              </div>
            )}
          </Card>
        </motion.div>

        {/* 4. Age Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24, duration: 0.35 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Age Distribution</CardTitle>
            </CardHeader>
            {ageDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={ageDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" />
                  <XAxis dataKey="range" stroke="#4B5563" fontSize={11} tickLine={false} />
                  <YAxis stroke="#4B5563" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: any) => [`${value} assets`, 'Count']}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40}>
                    {ageDistribution.map((_, index) => (
                      <Cell key={index} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-vault-muted-text text-sm">
                No data available
              </div>
            )}
          </Card>
        </motion.div>

        {/* 5. Repair Frequency */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, duration: 0.35 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-vault-yellow" />
                  Repair Frequency
                </div>
              </CardTitle>
              <span className="text-xs text-vault-muted-text">Top 10</span>
            </CardHeader>
            {repairFrequency.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-vault-border">
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-vault-muted-text uppercase tracking-wider">
                        Asset
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-vault-muted-text uppercase tracking-wider">
                        Serial
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-vault-muted-text uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-vault-muted-text uppercase tracking-wider">
                        Count
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {repairFrequency.map((item: any, i: number) => (
                      <tr
                        key={i}
                        className="border-b border-vault-border/20 hover:bg-vault-muted/10 transition-colors"
                      >
                        <td className="px-4 py-2.5 text-vault-text">{item.name}</td>
                        <td className="px-4 py-2.5 text-vault-muted-text" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                          {item.serial_number}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-vault-amber/10 text-vault-amber border border-vault-amber/20">
                            {item.category}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span
                            className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-xs font-bold ${
                              item.repair_count >= 5
                                ? 'bg-vault-red/10 text-vault-red'
                                : item.repair_count >= 3
                                ? 'bg-vault-yellow/10 text-vault-yellow'
                                : 'bg-vault-muted/30 text-vault-muted-text'
                            }`}
                          >
                            {item.repair_count}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-vault-muted-text text-sm">
                No repair data available
              </div>
            )}
          </Card>
        </motion.div>

        {/* 6. Warranty Expiry */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.40, duration: 0.35 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-vault-amber" />
                  Warranty Expiring
                </div>
              </CardTitle>
              <span className="text-xs text-vault-muted-text">Next 90 days</span>
            </CardHeader>
            {warrantyExpiring.length > 0 ? (
              <div className="space-y-1.5 max-h-[340px] overflow-y-auto">
                {warrantyExpiring.map((item: any) => {
                  const days = item.days_remaining ?? 0
                  const isCritical = days <= 30
                  const isWarning = days <= 60 && days > 30

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors ${
                        isCritical
                          ? 'bg-vault-red/5 border-vault-red/15 hover:bg-vault-red/10'
                          : isWarning
                          ? 'bg-vault-yellow/5 border-vault-yellow/15 hover:bg-vault-yellow/10'
                          : 'bg-vault-muted/5 border-vault-border/30 hover:bg-vault-muted/15'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-vault-text font-medium truncate">
                          {item.name}
                        </p>
                        <p className="text-[11px] text-vault-muted-text" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          {item.serial_number}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p
                          className={`text-sm font-semibold ${
                            isCritical ? 'text-vault-red' : isWarning ? 'text-vault-yellow' : 'text-vault-green'
                          }`}
                        >
                          {days}d
                        </p>
                        <p className="text-[11px] text-vault-muted-text">
                          {formatDate(item.warranty_expiry)}
                        </p>
                      </div>
                      {isCritical && (
                        <AlertTriangle className="h-3.5 w-3.5 text-vault-red ml-2 flex-shrink-0" />
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-vault-muted-text text-sm">
                No warranties expiring in the next 90 days
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
