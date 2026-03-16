import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  className?: string
  render?: (item: T) => ReactNode
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (item: T) => void
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onSort?: (key: string) => void
  isLoading?: boolean
  emptyMessage?: string
}

export function Table<T extends Record<string, any>>({
  columns,
  data,
  onRowClick,
  sortBy,
  sortOrder,
  onSort,
  isLoading,
  emptyMessage = 'No data found',
}: TableProps<T>) {
  const renderSortIcon = (key: string) => {
    if (sortBy !== key)
      return <ChevronsUpDown className="h-3.5 w-3.5 text-vault-muted-text/50" />
    return sortOrder === 'asc' ? (
      <ChevronUp className="h-3.5 w-3.5 text-vault-amber" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5 text-vault-amber" />
    )
  }

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-vault-border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="bg-vault-muted/30 border-b border-vault-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider',
                  col.sortable && 'cursor-pointer select-none hover:text-vault-text transition-colors',
                  col.className
                )}
                onClick={() => col.sortable && onSort?.(col.key)}
              >
                <div className="flex items-center gap-1.5">
                  {col.header}
                  {col.sortable && renderSortIcon(col.key)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-vault-border/50">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <div className="h-4 bg-vault-muted/30 rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-12 text-center text-vault-muted-text"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item, index) => (
              <tr
                key={item.id ?? index}
                className={cn(
                  'border-b border-vault-border/30 transition-colors',
                  index % 2 === 1 && 'bg-vault-muted/5',
                  onRowClick &&
                    'cursor-pointer hover:bg-vault-amber/5'
                )}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-3 text-vault-text', col.className)}>
                    {col.render ? col.render(item) : item[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
