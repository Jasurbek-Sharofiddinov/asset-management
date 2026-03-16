import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  totalItems?: number
  pageSize?: number
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
}: PaginationProps) {
  if (totalPages <= 1) return null

  const getPages = () => {
    const pages: (number | '...')[] = []
    const delta = 2

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - delta && i <= currentPage + delta)
      ) {
        pages.push(i)
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...')
      }
    }

    return pages
  }

  const startItem = totalItems ? (currentPage - 1) * (pageSize || 20) + 1 : 0
  const endItem = totalItems
    ? Math.min(currentPage * (pageSize || 20), totalItems)
    : 0

  return (
    <div className="flex items-center justify-between px-1 py-3">
      {totalItems !== undefined && (
        <p className="text-sm text-vault-muted-text">
          Showing <span className="text-vault-text font-medium">{startItem}</span> to{' '}
          <span className="text-vault-text font-medium">{endItem}</span> of{' '}
          <span className="text-vault-text font-medium">{totalItems}</span> results
        </p>
      )}

      <div className="flex items-center gap-1 ml-auto">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className={cn(
            'p-2 rounded-lg transition-colors',
            currentPage <= 1
              ? 'text-vault-muted-text/30 cursor-not-allowed'
              : 'text-vault-muted-text hover:text-vault-text hover:bg-vault-muted'
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {getPages().map((page, i) =>
          page === '...' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-vault-muted-text">
              ...
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page as number)}
              className={cn(
                'min-w-[36px] h-9 rounded-lg text-sm font-medium transition-all duration-200',
                page === currentPage
                  ? 'bg-vault-amber text-vault-black'
                  : 'text-vault-muted-text hover:text-vault-text hover:bg-vault-muted'
              )}
            >
              {page}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className={cn(
            'p-2 rounded-lg transition-colors',
            currentPage >= totalPages
              ? 'text-vault-muted-text/30 cursor-not-allowed'
              : 'text-vault-muted-text hover:text-vault-text hover:bg-vault-muted'
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
