import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import {
  ArrowLeft,
  Edit,
  UserPlus,
  ArrowLeftRight,
  Wrench,
  AlertTriangle,
  Trash2,
  Download,
  Printer,
  Clock,
  Package,
  Calendar,
  DollarSign,
  Shield,
} from 'lucide-react'
import { assetsApi, assignmentsApi } from '../lib/api'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatusBadge, ActionBadge } from '../components/ui/Badge'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { useToast } from '../components/ui/Toast'
import { AssetForm } from '../components/assets/AssetForm'
import { AssignmentPanel } from '../components/assets/AssignmentPanel'
import { formatDate, formatDateTime, formatCurrency } from '../lib/utils'
import type { AssetStatus } from '../types'

type TabId = 'overview' | 'history' | 'qr' | 'assignments'

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [showEditForm, setShowEditForm] = useState(false)
  const [showAssignPanel, setShowAssignPanel] = useState(false)
  const [statusChangeReason, setStatusChangeReason] = useState('')
  const [showStatusModal, setShowStatusModal] = useState<AssetStatus | null>(null)

  const assetId = id || ''

  const { data: asset, isLoading } = useQuery({
    queryKey: ['asset', assetId],
    queryFn: () => assetsApi.getAsset(assetId),
    enabled: !!assetId,
  })

  const { data: history = [] } = useQuery({
    queryKey: ['asset-history', assetId],
    queryFn: () => assetsApi.getAssetHistory(assetId),
    enabled: activeTab === 'history' && !!assetId,
  })

  const { data: assignments = [] } = useQuery({
    queryKey: ['assignments', assetId],
    queryFn: () => assignmentsApi.getAssignments(assetId),
    enabled: activeTab === 'assignments' && !!assetId,
  })

  const statusMutation = useMutation({
    mutationFn: ({ status, reason }: { status: string; reason?: string }) =>
      assetsApi.changeAssetStatus(assetId, status, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset', assetId] })
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      toast.success('Status updated successfully')
      setShowStatusModal(null)
      setStatusChangeReason('')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to update status')
    },
  })

  if (isLoading) return <PageLoader />
  if (!asset) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-vault-muted-text">Asset not found</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/assets')}>
          Back to Assets
        </Button>
      </div>
    )
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'history', label: 'History' },
    { id: 'qr', label: 'QR Code' },
    { id: 'assignments', label: 'Assignments' },
  ]

  const handleDownloadQR = () => {
    const svg = document.getElementById('asset-qr-code')
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx?.drawImage(img, 0, 0)
      const link = document.createElement('a')
      link.download = `asset-${asset.serial_number}-qr.png`
      link.href = canvas.toDataURL()
      link.click()
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
  }

  const handlePrintQR = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    const svg = document.getElementById('asset-qr-code')
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    printWindow.document.write(`
      <html>
        <head><title>QR Code - ${asset.name}</title></head>
        <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;">
          <h2>${asset.name}</h2>
          <p style="color:#666;">${asset.serial_number}</p>
          ${svgData}
          <script>window.print();window.close();</script>
        </body>
      </html>
    `)
  }

  const quickStatusActions = [
    { status: 'IN_REPAIR' as AssetStatus, icon: Wrench, label: 'Send to Repair', color: 'text-vault-yellow' },
    { status: 'LOST' as AssetStatus, icon: AlertTriangle, label: 'Mark Lost', color: 'text-vault-red' },
    { status: 'WRITTEN_OFF' as AssetStatus, icon: Trash2, label: 'Write Off', color: 'text-vault-red' },
    { status: 'REGISTERED' as AssetStatus, icon: Package, label: 'Reset to Registered', color: 'text-vault-gray' },
  ].filter((a) => a.status !== asset.status)

  return (
    <div className="space-y-6">
      {/* Back button + Hero */}
      <div>
        <button
          onClick={() => navigate('/assets')}
          className="flex items-center gap-2 text-sm text-vault-muted-text hover:text-vault-text mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Assets
        </button>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-start justify-between gap-4"
        >
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-vault-text">
                {asset.name}
              </h1>
              <StatusBadge status={asset.status} />
            </div>
            <p className="font-[family-name:var(--font-mono)] text-[13px] text-vault-muted-text">
              {asset.serial_number}
            </p>
            {asset.brand && (
              <p className="text-sm text-vault-muted-text mt-1">
                {asset.brand} {asset.model || ''}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowEditForm(true)}>
              <Edit className="h-4 w-4" />
              Edit
            </Button>
            {asset.status !== 'ASSIGNED' && (
              <Button size="sm" onClick={() => setShowAssignPanel(true)}>
                <UserPlus className="h-4 w-4" />
                Assign
              </Button>
            )}
            {asset.status === 'ASSIGNED' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAssignPanel(true)}
              >
                <ArrowLeftRight className="h-4 w-4" />
                Manage
              </Button>
            )}
          </div>
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-vault-surface rounded-lg border border-vault-border w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-vault-amber/10 text-vault-amber'
                : 'text-vault-muted-text hover:text-vault-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Metadata Grid */}
          <div className="lg:col-span-2">
            <Card>
              <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-vault-text mb-4">
                Asset Details
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Name', value: asset.name },
                  { label: 'Type', value: asset.asset_type },
                  { label: 'Category', value: asset.category },
                  { label: 'Serial Number', value: asset.serial_number, mono: true },
                  { label: 'Brand', value: asset.brand || '-' },
                  { label: 'Model', value: asset.model || '-' },
                  {
                    label: 'Purchase Date',
                    value: asset.purchase_date ? formatDate(asset.purchase_date) : '-',
                    icon: Calendar,
                  },
                  {
                    label: 'Purchase Price',
                    value: asset.purchase_price
                      ? formatCurrency(Number(asset.purchase_price))
                      : '-',
                    icon: DollarSign,
                  },
                  {
                    label: 'Warranty Expiry',
                    value: asset.warranty_expiry ? formatDate(asset.warranty_expiry) : '-',
                    icon: Shield,
                  },
                  {
                    label: 'Created',
                    value: formatDateTime(asset.created_at),
                    icon: Clock,
                  },
                ].map((field) => (
                  <div key={field.label} className="p-3 rounded-lg bg-vault-black/50 border border-vault-border/30">
                    <p className="text-xs text-vault-muted-text mb-1">{field.label}</p>
                    <p
                      className={`text-sm text-vault-text ${
                        field.mono ? 'font-[family-name:var(--font-mono)] text-[13px]' : ''
                      }`}
                    >
                      {field.value}
                    </p>
                  </div>
                ))}
              </div>
              {asset.description && (
                <div className="mt-4 p-3 rounded-lg bg-vault-black/50 border border-vault-border/30">
                  <p className="text-xs text-vault-muted-text mb-1">Description</p>
                  <p className="text-sm text-vault-text">{asset.description}</p>
                </div>
              )}
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Current Assignment */}
            <Card>
              <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-vault-text mb-3">
                Current Assignment
              </h3>
              {asset.status === 'ASSIGNED' ? (
                <div className="space-y-2">
                  {asset.current_employee_name && (
                    <div className="p-3 rounded-lg bg-vault-green/5 border border-vault-green/20">
                      <p className="text-xs text-vault-muted-text">Employee</p>
                      <p className="text-sm text-vault-text font-medium">
                        {asset.current_employee_name}
                      </p>
                    </div>
                  )}
                  {asset.current_department_name && (
                    <div className="p-3 rounded-lg bg-vault-blue/5 border border-vault-blue/20">
                      <p className="text-xs text-vault-muted-text">Department</p>
                      <p className="text-sm text-vault-text font-medium">
                        {asset.current_department_name}
                      </p>
                    </div>
                  )}
                  {asset.current_branch_name && (
                    <div className="p-3 rounded-lg bg-vault-muted/10 border border-vault-border">
                      <p className="text-xs text-vault-muted-text">Branch</p>
                      <p className="text-sm text-vault-text font-medium">
                        {asset.current_branch_name}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-vault-muted-text py-4 text-center">
                  Not currently assigned
                </p>
              )}
            </Card>

            {/* Warranty Status */}
            {asset.warranty_expiry && (
              <Card>
                <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-vault-text mb-3">
                  Warranty Status
                </h3>
                {(() => {
                  const expiry = new Date(asset.warranty_expiry)
                  const now = new Date()
                  const daysRemaining = Math.ceil(
                    (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                  )
                  const isExpired = daysRemaining < 0
                  const isExpiringSoon = daysRemaining <= 90 && daysRemaining >= 0

                  return (
                    <div
                      className={`p-3 rounded-lg border ${
                        isExpired
                          ? 'bg-vault-red/5 border-vault-red/20'
                          : isExpiringSoon
                          ? 'bg-vault-yellow/5 border-vault-yellow/20'
                          : 'bg-vault-green/5 border-vault-green/20'
                      }`}
                    >
                      <p
                        className={`text-sm font-medium ${
                          isExpired
                            ? 'text-vault-red'
                            : isExpiringSoon
                            ? 'text-vault-yellow'
                            : 'text-vault-green'
                        }`}
                      >
                        {isExpired
                          ? `Expired ${Math.abs(daysRemaining)} days ago`
                          : `${daysRemaining} days remaining`}
                      </p>
                      <p className="text-xs text-vault-muted-text mt-1">
                        Expires: {formatDate(asset.warranty_expiry)}
                      </p>
                    </div>
                  )
                })()}
              </Card>
            )}

            {/* Quick Status Actions */}
            <Card>
              <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-vault-text mb-3">
                Quick Actions
              </h3>
              <div className="space-y-2">
                {quickStatusActions.map((action) => (
                  <button
                    key={action.status}
                    onClick={() => setShowStatusModal(action.status)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-vault-text hover:bg-vault-muted/30 border border-vault-border/50 transition-colors"
                  >
                    <action.icon className={`h-4 w-4 ${action.color}`} />
                    {action.label}
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <Card>
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-vault-text mb-4">
            Asset History
          </h3>
          {history.length > 0 ? (
            <div className="relative">
              <div className="absolute left-[15px] top-0 bottom-0 w-px bg-vault-border" />
              <div className="space-y-4">
                {history.map((event: any, idx: number) => (
                  <motion.div
                    key={event.id || idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="relative flex gap-4 pl-10"
                  >
                    <div className="absolute left-[10px] top-2 w-[11px] h-[11px] rounded-full bg-vault-amber border-2 border-vault-surface z-10" />
                    <div className="flex-1 p-3 rounded-lg bg-vault-black/50 border border-vault-border/50">
                      <div className="flex items-center gap-2 mb-1">
                        <ActionBadge action={event.action} />
                        <span className="text-xs text-vault-muted-text">
                          {formatDateTime(event.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-vault-text">
                        {event.actor_name || 'System'}
                      </p>
                      {event.reason && (
                        <p className="text-xs text-vault-muted-text mt-1">
                          Reason: {event.reason}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-vault-muted-text text-center py-8">
              No history records found
            </p>
          )}
        </Card>
      )}

      {activeTab === 'qr' && (
        <Card className="flex flex-col items-center py-8">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-vault-text mb-6">
            QR Code
          </h3>
          <div className="p-6 bg-white rounded-2xl mb-6">
            <QRCodeSVG
              id="asset-qr-code"
              value={`${window.location.origin}/assets/${asset.id}`}
              size={220}
              level="H"
              includeMargin={false}
            />
          </div>
          <p className="font-[family-name:var(--font-mono)] text-[13px] text-vault-muted-text mb-6">
            {asset.serial_number}
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleDownloadQR}>
              <Download className="h-4 w-4" />
              Download PNG
            </Button>
            <Button variant="secondary" onClick={handlePrintQR}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        </Card>
      )}

      {activeTab === 'assignments' && (
        <Card>
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-vault-text mb-4">
            Assignment History
          </h3>
          {assignments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-vault-border">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                      Department
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                      Branch
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                      Assigned At
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                      Returned At
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a: any) => (
                    <tr
                      key={a.id}
                      className="border-b border-vault-border/30 hover:bg-vault-muted/10"
                    >
                      <td className="px-4 py-3 text-vault-text">
                        {a.employee_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-vault-text">
                        {a.department_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-vault-text">
                        {a.branch_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-vault-muted-text">
                        {formatDateTime(a.assigned_at)}
                      </td>
                      <td className="px-4 py-3 text-vault-muted-text">
                        {a.returned_at ? formatDateTime(a.returned_at) : (
                          <span className="text-vault-green">Active</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-vault-muted-text">
                        {a.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-vault-muted-text text-center py-8">
              No assignments found
            </p>
          )}
        </Card>
      )}

      {/* Status Change Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowStatusModal(null)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-vault-surface border border-vault-border rounded-xl p-6 w-full max-w-md shadow-2xl"
          >
            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-vault-text mb-2">
              Change Status to {showStatusModal.replace('_', ' ')}
            </h3>
            <p className="text-sm text-vault-muted-text mb-4">
              Are you sure you want to change the status of "{asset.name}"?
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-vault-text mb-1.5">
                Reason (optional)
              </label>
              <textarea
                value={statusChangeReason}
                onChange={(e) => setStatusChangeReason(e.target.value)}
                rows={3}
                placeholder="Enter reason for status change..."
                className="w-full px-3 py-2 bg-vault-black border border-vault-border rounded-lg text-vault-text text-sm placeholder:text-vault-muted-text/50 focus:outline-none focus:ring-2 focus:ring-vault-amber/40 focus:border-vault-amber/50 transition-all resize-none"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowStatusModal(null)}>
                Cancel
              </Button>
              <Button
                variant={
                  showStatusModal === 'LOST' || showStatusModal === 'WRITTEN_OFF'
                    ? 'danger'
                    : 'primary'
                }
                isLoading={statusMutation.isPending}
                onClick={() =>
                  statusMutation.mutate({
                    status: showStatusModal,
                    reason: statusChangeReason || undefined,
                  })
                }
              >
                Confirm
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Form */}
      <AssetForm
        isOpen={showEditForm}
        onClose={() => setShowEditForm(false)}
        asset={asset}
      />

      {/* Assignment Panel */}
      {asset && (
        <AssignmentPanel
          isOpen={showAssignPanel}
          onClose={() => setShowAssignPanel(false)}
          asset={asset}
        />
      )}
    </div>
  )
}
