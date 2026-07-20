import { useQuery } from '@tanstack/react-query'
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
import { useLanguageStore } from '../stores/languageStore'

// Status-based charts use the tuned light-theme status colors.
const STATUS_COLORS: Record<string, string> = {
  REGISTERED: '#6B7280', // gray
  ASSIGNED: '#16A34A', // green
  IN_REPAIR: '#CA8A04', // yellow
  LOST: '#DC2626', // red
  WRITTEN_OFF: '#9CA3AF', // muted gray
}

// Non-status series use a restrained slate/blue monochrome ramp (dark → light).
const SERIES_RAMP = [
  '#17233D', '#2B3A5C', '#3F5480', '#5570A2', '#6E8BBB', '#8CA6CE', '#B0C2DD',
]

// Light-theme chart primitives
const GRID_STROKE = '#E4E7EC'
const TICK_FILL = '#79808C'
const BRAND = '#17233D'

const tooltipStyle = {
  backgroundColor: '#FFFFFF',
  border: '1px solid #E4E7EC',
  borderRadius: '10px',
  color: '#0C0E14',
  fontSize: '12px',
  boxShadow: '0 4px 16px rgba(12,14,20,0.08)',
}

export default function AnalyticsPage() {
  const { t } = useLanguageStore()

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
    queryFn: () => analyticsApi.getDepartmentAllocation(),
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 [&>div]:h-full">
        {/* 1. Asset Value Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.assetValueOverTime')}</CardTitle>
          </CardHeader>
          {valueOverTime && (valueOverTime as any[]).length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={valueOverTime as any[]}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="date" stroke={GRID_STROKE} tick={{ fill: TICK_FILL, fontSize: 11 }} tickLine={false} />
                <YAxis
                  stroke={GRID_STROKE}
                  tick={{ fill: TICK_FILL, fontSize: 11 }}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ stroke: GRID_STROKE }}
                  formatter={(value: any) => [formatCurrency(Number(value)), 'Total Value']}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={BRAND}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: BRAND, stroke: '#FFFFFF', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-vault-muted-text text-sm">
              {t('analytics.noData')}
            </div>
          )}
        </Card>

        {/* 2. Status Breakdown Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.statusBreakdown')}</CardTitle>
          </CardHeader>
          {statusOverTime.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={statusOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="date" stroke={GRID_STROKE} tick={{ fill: TICK_FILL, fontSize: 11 }} tickLine={false} />
                <YAxis stroke={GRID_STROKE} tick={{ fill: TICK_FILL, fontSize: 11 }} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(23,35,61,0.04)' }} />
                <Legend
                  verticalAlign="bottom"
                  formatter={(value: string) => (
                    <span style={{ color: TICK_FILL, fontSize: '11px' }}>
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
                    fillOpacity={0.18}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-vault-muted-text text-sm">
              {t('analytics.noData')}
            </div>
          )}
        </Card>

        {/* 3. Department Allocation */}
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.departmentAllocation')}</CardTitle>
          </CardHeader>
          {deptAllocation.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={deptAllocation} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                <XAxis type="number" stroke={GRID_STROKE} tick={{ fill: TICK_FILL, fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="department"
                  stroke={GRID_STROKE}
                  tick={{ fill: TICK_FILL, fontSize: 11 }}
                  width={100}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: 'rgba(23,35,61,0.04)' }}
                  formatter={(value: any) => [`${value} assets`, 'Assigned']}
                />
                <Bar dataKey="assets" radius={[0, 4, 4, 0]} barSize={20}>
                  {deptAllocation.map((_: any, index: number) => (
                    <Cell key={index} fill={SERIES_RAMP[index % SERIES_RAMP.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-vault-muted-text text-sm">
              {t('analytics.noData')}
            </div>
          )}
        </Card>

        {/* 4. Age Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.ageDistribution')}</CardTitle>
          </CardHeader>
          {ageDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ageDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="range" stroke={GRID_STROKE} tick={{ fill: TICK_FILL, fontSize: 11 }} tickLine={false} />
                <YAxis stroke={GRID_STROKE} tick={{ fill: TICK_FILL, fontSize: 11 }} tickLine={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: 'rgba(23,35,61,0.04)' }}
                  formatter={(value: any) => [`${value} assets`, 'Count']}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40} fill={BRAND} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-vault-muted-text text-sm">
              {t('analytics.noData')}
            </div>
          )}
        </Card>

        {/* 5. Repair Frequency */}
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-vault-yellow" />
                {t('analytics.repairFrequency')}
              </div>
            </CardTitle>
            <span className="text-xs text-vault-muted-text">{t('analytics.top10')}</span>
          </CardHeader>
          {repairFrequency.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-vault-border">
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-vault-muted-text uppercase tracking-wider">
                      {t('analytics.colAsset')}
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-vault-muted-text uppercase tracking-wider">
                      {t('analytics.colSerial')}
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-vault-muted-text uppercase tracking-wider">
                      {t('analytics.colCategory')}
                    </th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-vault-muted-text uppercase tracking-wider">
                      {t('analytics.colCount')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {repairFrequency.map((item: any, i: number) => (
                    <tr
                      key={i}
                      className="border-b border-vault-border/60 hover:bg-vault-muted/50 transition-colors"
                    >
                      <td className="px-4 py-2.5 text-vault-text">{item.name}</td>
                      <td className="px-4 py-2.5 text-vault-muted-text font-mono text-[12px]">
                        {item.serial_number}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-vault-muted text-vault-text border border-vault-border">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span
                          className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-xs font-bold ${
                            item.repair_count >= 5
                              ? 'bg-danger-soft text-danger'
                              : item.repair_count >= 3
                              ? 'bg-warn-soft text-warn'
                              : 'bg-vault-muted text-vault-muted-text'
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
              {t('analytics.noRepairData')}
            </div>
          )}
        </Card>

        {/* 6. Warranty Expiry */}
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-vault-muted-text" />
                {t('analytics.warrantyExpiring')}
              </div>
            </CardTitle>
            <span className="text-xs text-vault-muted-text">{t('analytics.next90days')}</span>
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
                        ? 'bg-danger-soft border-vault-border hover:border-vault-border-focus'
                        : isWarning
                        ? 'bg-warn-soft border-vault-border hover:border-vault-border-focus'
                        : 'bg-vault-muted border-vault-border hover:border-vault-border-focus'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-vault-text font-medium truncate">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-vault-muted-text font-mono">
                        {item.serial_number}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p
                        className={`text-sm font-semibold font-mono ${
                          isCritical ? 'text-danger' : isWarning ? 'text-warn' : 'text-vault-green'
                        }`}
                      >
                        {days}d
                      </p>
                      <p className="text-[11px] text-vault-muted-text">
                        {formatDate(item.warranty_expiry)}
                      </p>
                    </div>
                    {isCritical && (
                      <AlertTriangle className="h-3.5 w-3.5 text-danger ml-2 flex-shrink-0" />
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-vault-muted-text text-sm">
              {t('analytics.noWarranties')}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
