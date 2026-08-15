import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
import { StatusBadge } from '../components/ui/Badge'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { useToast } from '../components/ui/Toast'
import { AssetForm } from '../components/assets/AssetForm'
import { AssignmentPanel } from '../components/assets/AssignmentPanel'
import { formatDate, formatDateTime, formatCurrency } from '../lib/utils'
import { canTransition } from '../lib/assetStatus'
import { useLanguageStore } from '../stores/languageStore'
import type { AssetStatus } from '../types'

type TabId = 'overview' | 'history' | 'qr' | 'assignments'

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { t } = useLanguageStore()
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
      toast.success(t('detail.statusUpdated'))
      setShowStatusModal(null)
      setStatusChangeReason('')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || t('detail.statusUpdateFailed'))
    },
  })

  if (isLoading) return <PageLoader />
  if (!asset) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-vault-muted-text">{t('detail.notFound')}</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/assets')}>
          {t('detail.backToAssets')}
        </Button>
      </div>
    )
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: t('detail.overview') },
    { id: 'history', label: t('detail.history') },
    { id: 'qr', label: t('detail.qrCode') },
    { id: 'assignments', label: t('detail.assignments') },
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
    { status: 'IN_REPAIR' as AssetStatus, icon: Wrench, label: t('detail.sendToRepair'), color: 'text-vault-yellow' },
    { status: 'LOST' as AssetStatus, icon: AlertTriangle, label: t('detail.markLost'), color: 'text-vault-red' },
    { status: 'WRITTEN_OFF' as AssetStatus, icon: Trash2, label: t('detail.writeOff'), color: 'text-vault-red' },
    { status: 'REGISTERED' as AssetStatus, icon: Package, label: t('detail.resetRegistered'), color: 'text-vault-gray' },
  ].filter((a) => a.status !== asset.status && canTransition(asset.status, a.status))

  return (
    <div className="space-y-6">
      {/* Back button + Hero */}
      <div>
        <button
          onClick={() => navigate('/assets')}
          className="flex items-center gap-2 text-sm text-vault-muted-text hover:text-vault-text mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('detail.backToAssets')}
        </button>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-semibold text-vault-text">
                {asset.name}
              </h1>
              <StatusBadge status={asset.status} />
            </div>
            <p className="font-mono text-[13px] text-vault-muted-text">
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
              {t('detail.edit')}
            </Button>
            {asset.status !== 'ASSIGNED' && (
              <Button size="sm" onClick={() => setShowAssignPanel(true)}>
                <UserPlus className="h-4 w-4" />
                {t('detail.assign')}
              </Button>
            )}
            {asset.status === 'ASSIGNED' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAssignPanel(true)}
              >
                <ArrowLeftRight className="h-4 w-4" />
                {t('detail.manage')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-vault-surface rounded-lg border border-vault-border w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
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
              <h3 className="text-lg font-semibold text-vault-text mb-4">
                {t('detail.assetDetails')}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: t('detail.name'), value: asset.name },
                  { label: t('detail.type'), value: asset.asset_type },
                  { label: t('detail.category'), value: asset.category },
                  { label: t('detail.serialNumber'), value: asset.serial_number, mono: true },
                  { label: t('detail.brand'), value: asset.brand || '-' },
                  { label: t('detail.model'), value: asset.model || '-' },
                  {
                    label: t('detail.purchaseDate'),
                    value: asset.purchase_date ? formatDate(asset.purchase_date) : '-',
                    icon: Calendar,
                  },
                  {
                    label: t('detail.purchasePrice'),
                    value: asset.purchase_price
                      ? formatCurrency(Number(asset.purchase_price))
                      : '-',
                    icon: DollarSign,
                  },
                  {
                    label: t('detail.warrantyExpiry'),
                    value: asset.warranty_expiry ? formatDate(asset.warranty_expiry) : '-',
                    icon: Shield,
                  },
                  {
                    label: t('detail.created'),
                    value: formatDateTime(asset.created_at),
                    icon: Clock,
                  },
                ].map((field) => (
                  <div key={field.label} className="p-3 rounded-lg bg-vault-muted border border-vault-border">
                    <p className="text-xs text-vault-muted-text mb-1">{field.label}</p>
                    <p
                      className={`text-sm text-vault-text ${
                        field.mono ? 'font-mono text-[13px]' : ''
                      }`}
                    >
                      {field.value}
                    </p>
                  </div>
                ))}
              </div>
              {asset.description && (
                <div className="mt-4 p-3 rounded-lg bg-vault-muted border border-vault-border">
                  <p className="text-xs text-vault-muted-text mb-1">{t('detail.description')}</p>
                  <p className="text-sm text-vault-text">{asset.description}</p>
                </div>
              )}
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Current Assignment */}
            <Card>
              <h3 className="text-base font-semibold text-vault-text mb-3">
                {t('detail.currentAssignment')}
              </h3>
              {asset.status === 'ASSIGNED' ? (
                <div className="space-y-2">
                  {asset.current_employee_name && (
                    <div className="p-3 rounded-lg bg-vault-muted border border-vault-border">
                      <p className="text-xs text-vault-muted-text">{t('assign.employee')}</p>
                      <p className="text-sm text-vault-text font-medium">
                        {asset.current_employee_name}
                      </p>
                    </div>
                  )}
                  {asset.current_department_name && (
                    <div className="p-3 rounded-lg bg-vault-muted border border-vault-border">
                      <p className="text-xs text-vault-muted-text">{t('assign.department')}</p>
                      <p className="text-sm text-vault-text font-medium">
                        {asset.current_department_name}
                      </p>
                    </div>
                  )}
                  {asset.current_branch_name && (
                    <div className="p-3 rounded-lg bg-vault-muted border border-vault-border">
                      <p className="text-xs text-vault-muted-text">{t('assign.branch')}</p>
                      <p className="text-sm text-vault-text font-medium">
                        {asset.current_branch_name}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-vault-muted-text py-4 text-center">
                  {t('detail.notAssigned')}
                </p>
              )}
            </Card>

            {/* Warranty Status */}
            {asset.warranty_expiry && (
              <Card>
                <h3 className="text-base font-semibold text-vault-text mb-3">
                  {t('detail.warrantyStatus')}
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
                          ? 'bg-danger-soft border-danger/20'
                          : isExpiringSoon
                          ? 'bg-warn-soft border-warn/20'
                          : 'bg-ok-soft border-ok/20'
                      }`}
                    >
                      <p
                        className={`text-sm font-medium ${
                          isExpired
                            ? 'text-danger'
                            : isExpiringSoon
                            ? 'text-warn'
                            : 'text-ok'
                        }`}
                      >
                        {isExpired
                          ? t('detail.expiredAgo').replace('{days}', String(Math.abs(daysRemaining)))
                          : t('detail.daysRemaining').replace('{days}', String(daysRemaining))}
                      </p>
                      <p className="text-xs text-vault-muted-text mt-1">
                        {t('detail.expires')}: {formatDate(asset.warranty_expiry)}
                      </p>
                    </div>
                  )
                })()}
              </Card>
            )}

            {/* Quick Status Actions */}
            <Card>
              <h3 className="text-base font-semibold text-vault-text mb-3">
                {t('detail.quickActions')}
              </h3>
              <div className="space-y-2">
                {quickStatusActions.map((action) => (
                  <button
                    key={action.status}
                    onClick={() => setShowStatusModal(action.status)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-vault-text hover:bg-vault-muted border border-vault-border transition-colors"
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
          <h3 className="text-lg font-semibold text-vault-text mb-4">
            {t('detail.assignmentHistory')}
          </h3>
          {history.length > 0 ? (
            <div className="relative">
              <div className="absolute left-[15px] top-0 bottom-0 w-px bg-vault-border" />
              <div className="space-y-4">
                {history.map((event: any, idx: number) => (
                  <div
                    key={event.id || idx}
                    className="relative flex gap-4 pl-10"
                  >
                    <div className={`absolute left-[10px] top-2 w-[11px] h-[11px] rounded-full border-2 border-vault-surface z-10 ${event.returned_at ? 'bg-vault-muted-text' : 'bg-vault-amber'}`} />
                    <div className="flex-1 p-3 rounded-lg bg-vault-muted border border-vault-border">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${event.returned_at ? 'bg-vault-muted text-vault-muted-text' : 'bg-ok-soft text-ok'}`}>
                          {event.returned_at ? t('detail.returned') : t('detail.active')}
                        </span>
                        <span className="text-xs text-vault-muted-text">
                          {formatDateTime(event.assigned_at)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {event.employee_name && (
                          <div>
                            <p className="text-[10px] text-vault-muted-text uppercase tracking-wider">{t('assign.employee')}</p>
                            <p className="text-vault-text">{event.employee_name}</p>
                          </div>
                        )}
                        {event.department_name && (
                          <div>
                            <p className="text-[10px] text-vault-muted-text uppercase tracking-wider">{t('assign.department')}</p>
                            <p className="text-vault-text">{event.department_name}</p>
                          </div>
                        )}
                        {event.branch_name && (
                          <div>
                            <p className="text-[10px] text-vault-muted-text uppercase tracking-wider">{t('assign.branch')}</p>
                            <p className="text-vault-text">{event.branch_name}</p>
                          </div>
                        )}
                        {event.assigner_name && (
                          <div>
                            <p className="text-[10px] text-vault-muted-text uppercase tracking-wider">{t('detail.assignedBy')}</p>
                            <p className="text-vault-text">{event.assigner_name}</p>
                          </div>
                        )}
                      </div>
                      {event.returned_at && (
                        <p className="text-xs text-vault-muted-text mt-2">
                          {t('detail.returned')}: {formatDateTime(event.returned_at)}
                          {event.return_reason ? ` — ${event.return_reason}` : ''}
                        </p>
                      )}
                      {event.notes && (
                        <p className="text-xs text-vault-muted-text mt-1">{t('assign.notes')}: {event.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-vault-muted-text text-center py-8">
              {t('detail.noHistory')}
            </p>
          )}
        </Card>
      )}

      {activeTab === 'qr' && (
        <Card className="flex flex-col items-center py-8">
          <h3 className="text-lg font-semibold text-vault-text mb-6">
            {t('detail.qrCode')}
          </h3>
          <div className="p-6 bg-white rounded-2xl border-2 border-white mb-6">
            <QRCodeSVG
              id="asset-qr-code"
              value={`${window.location.origin}/assets/${asset.id}`}
              size={220}
              level="H"
              includeMargin={false}
              bgColor="#FFFFFF"
              fgColor="#0C0E14"
            />
          </div>
          <p className="font-mono text-[13px] text-vault-muted-text mb-6">
            {asset.serial_number}
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleDownloadQR}>
              <Download className="h-4 w-4" />
              {t('detail.downloadPng')}
            </Button>
            <Button variant="secondary" onClick={handlePrintQR}>
              <Printer className="h-4 w-4" />
              {t('detail.print')}
            </Button>
          </div>
        </Card>
      )}

      {activeTab === 'assignments' && (
        <Card>
          <h3 className="text-lg font-semibold text-vault-text mb-4">
            {t('detail.assignmentHistory')}
          </h3>
          {assignments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-vault-border">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                      {t('assign.employee')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                      {t('assign.department')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                      {t('assign.branch')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                      {t('detail.assignedAt')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                      {t('detail.returnedAt')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                      {t('assign.notes')}
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
                          <span className="text-vault-green">{t('detail.active')}</span>
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
              {t('detail.noAssignments')}
            </p>
          )}
        </Card>
      )}

      {/* Status Change Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-vault-text/40"
            onClick={() => setShowStatusModal(null)}
          />
          <div className="relative bg-vault-surface border border-vault-border rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-vault-text mb-2">
              {t('detail.changeStatusTo')} {showStatusModal.replace('_', ' ')}
            </h3>
            <p className="text-sm text-vault-muted-text mb-4">
              {t('detail.changeStatusConfirm')} "{asset.name}"?
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-vault-text mb-1.5">
                {t('detail.reasonOptional')}
              </label>
              <textarea
                value={statusChangeReason}
                onChange={(e) => setStatusChangeReason(e.target.value)}
                rows={3}
                placeholder={t('detail.reasonPlaceholder')}
                className="w-full px-3 py-2 bg-vault-surface border border-vault-border rounded-lg text-vault-text text-sm placeholder:text-vault-muted-text/50 focus:outline-none focus:ring-2 focus:ring-vault-amber/30 focus:border-vault-amber/40 transition-all resize-none"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowStatusModal(null)}>
                {t('common.cancel')}
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
                {t('common.confirm')}
              </Button>
            </div>
          </div>
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
