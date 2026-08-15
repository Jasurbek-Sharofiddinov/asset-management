import type { AssetCategory, AssetStatus } from '../types'
import type { AssetParams } from './api'

export function buildAssetQueryParams(opts: {
  page?: number
  size?: number
  search?: string
  statuses?: AssetStatus[]
  categories?: AssetCategory[]
  branch_id?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}): AssetParams {
  return {
    page: opts.page,
    size: opts.size,
    search: opts.search || undefined,
    status: opts.statuses && opts.statuses.length > 0 ? opts.statuses : undefined,
    category: opts.categories && opts.categories.length > 0 ? opts.categories : undefined,
    branch_id: opts.branch_id || undefined,
    sort_by: opts.sort_by,
    sort_order: opts.sort_order,
  }
}
