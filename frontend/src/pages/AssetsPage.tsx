import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Filter, X, Search } from 'lucide-react'
import { assetsApi, referenceApi, type AssetParams } from '../lib/api'
import { Table } from '../components/ui/Table'
import { Pagination } from '../components/ui/Pagination'
import { Button } from '../components/ui/Button'
import { StatusBadge, CategoryBadge } from '../components/ui/Badge'
import { AssetForm } from '../components/assets/AssetForm'
import { formatDate, formatCurrency } from '../lib/utils'
import type { Asset, AssetStatus, AssetCategory } from '../types'

const statusOptions: AssetStatus[] = [
  'REGISTERED',
  'ASSIGNED',
  'IN_REPAIR',
  'LOST',
  'WRITTEN_OFF',
]
const categoryOptions: AssetCategory[] = [
  'IT', 'OFFICE', 'SECURITY', 'NETWORKING', 'PRINTING',
  'SERVER', 'MOBILE', 'FURNITURE', 'OTHER',
]

export default function AssetsPage() {
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [params, setParams] = useState<AssetParams>({
    page: 1,
    size: 20,
    sort_by: 'created_at',
    sort_order: 'desc',
  })
  const [searchInput, setSearchInput] = useState('')
  const [selectedStatuses, setSelectedStatuses] = useState<AssetStatus[]>([])
  const [selectedCategories, setSelectedCategories] = useState<AssetCategory[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string>('')

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: referenceApi.getBranches,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['assets', params, selectedStatuses, selectedCategories, selectedBranchId],
    queryFn: () =>
      assetsApi.getAssets({
        ...params,
        status: selectedStatuses.length === 1 ? selectedStatuses[0] : undefined,
        category: selectedCategories.length === 1 ? selectedCategories[0] : undefined,
        branch_id: selectedBranchId || undefined,
      }),
  })

  const handleSearch = useCallback(() => {
    setParams((prev) => ({ ...prev, page: 1, search: searchInput || undefined }))
  }, [searchInput])

  const handleSort = useCallback((key: string) => {
    setParams((prev) => ({
      ...prev,
      sort_by: key,
      sort_order: prev.sort_by === key && prev.sort_order === 'asc' ? 'desc' : 'asc',
    }))
  }, [])

  const toggleStatus = (status: AssetStatus) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    )
  }

  const toggleCategory = (cat: AssetCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  const clearFilters = () => {
    setSelectedStatuses([])
    setSelectedCategories([])
    setSelectedBranchId('')
    setSearchInput('')
    setParams({ page: 1, size: 20, sort_by: 'created_at', sort_order: 'desc' })
  }

  const columns = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (item: Asset) => (
        <div>
          <p className="text-sm font-medium text-vault-text">{item.name}</p>
          {item.brand && (
            <p className="text-xs text-vault-muted-text">
              {item.brand} {item.model || ''}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      render: (item: Asset) => <CategoryBadge category={item.category} />,
    },
    {
      key: 'serial_number',
      header: 'Serial',
      render: (item: Asset) => (
        <span className="font-[family-name:var(--font-mono)] text-[13px] text-vault-muted-text">
          {item.serial_number}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (item: Asset) => <StatusBadge status={item.status} />,
    },
    {
      key: 'assigned_to',
      header: 'Assigned To',
      render: (item: any) => (
        <span className="text-sm text-vault-text">
          {item.assigned_to || '-'}
        </span>
      ),
    },
    {
      key: 'purchase_date',
      header: 'Purchase Date',
      sortable: true,
      render: (item: Asset) => (
        <span className="text-sm text-vault-muted-text">
          {item.purchase_date ? formatDate(item.purchase_date) : '-'}
        </span>
      ),
    },
    {
      key: 'purchase_price',
      header: 'Value',
      sortable: true,
      render: (item: Asset) => (
        <span className="text-sm text-vault-text">
          {item.purchase_price ? formatCurrency(Number(item.purchase_price)) : '-'}
        </span>
      ),
    },
  ]

  const hasActiveFilters = selectedStatuses.length > 0 || selectedCategories.length > 0 || !!selectedBranchId || searchInput

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-vault-muted-text" />
            <input
              type="text"
              placeholder="Search by name, serial, brand..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-9 pr-4 py-2 bg-vault-surface border border-vault-border rounded-lg text-sm text-vault-text placeholder:text-vault-muted-text/50 focus:outline-none focus:ring-2 focus:ring-vault-amber/30 focus:border-vault-amber/40 transition-all"
            />
          </div>

          <Button
            variant={showFilters ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 w-5 h-5 rounded-full bg-vault-amber text-vault-black text-[10px] flex items-center justify-center font-bold">
                {selectedStatuses.length + selectedCategories.length + (selectedBranchId ? 1 : 0)}
              </span>
            )}
          </Button>
        </div>

        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" />
          Add Asset
        </Button>
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
            <h3 className="text-sm font-medium text-vault-text">Filters</h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-vault-muted-text hover:text-vault-text transition-colors"
              >
                <X className="h-3 w-3" />
                Clear all
              </button>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-vault-muted-text mb-2">Status</p>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map((status) => (
                  <button
                    key={status}
                    onClick={() => toggleStatus(status)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                      selectedStatuses.includes(status)
                        ? 'bg-vault-amber/10 text-vault-amber border-vault-amber/30'
                        : 'text-vault-muted-text border-vault-border hover:border-vault-muted'
                    }`}
                  >
                    {status.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-vault-muted-text mb-2">Category</p>
              <div className="flex flex-wrap gap-2">
                {categoryOptions.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                      selectedCategories.includes(cat)
                        ? 'bg-vault-amber/10 text-vault-amber border-vault-amber/30'
                        : 'text-vault-muted-text border-vault-border hover:border-vault-muted'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-vault-muted-text mb-2">Branch</p>
              <select
                value={selectedBranchId}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value)
                  setParams((prev) => ({ ...prev, page: 1 }))
                }}
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
          </div>
        </motion.div>
      )}

      {/* Table */}
      <Table
        columns={columns}
        data={data?.items || []}
        isLoading={isLoading}
        onRowClick={(asset) => navigate(`/assets/${asset.id}`)}
        sortBy={params.sort_by}
        sortOrder={params.sort_order}
        onSort={handleSort}
        emptyMessage="No assets found. Create your first asset to get started."
      />

      {/* Pagination */}
      {data && (
        <Pagination
          currentPage={data.page}
          totalPages={data.pages}
          totalItems={data.total}
          pageSize={params.size}
          onPageChange={(page) => setParams((prev) => ({ ...prev, page }))}
        />
      )}

      {/* Asset Form Modal */}
      <AssetForm
        isOpen={showForm || !!editingAsset}
        onClose={() => {
          setShowForm(false)
          setEditingAsset(null)
        }}
        asset={editingAsset}
      />
    </div>
  )
}
