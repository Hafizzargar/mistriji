import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  LayoutList,
  Table as TableIcon
} from 'lucide-react'

export interface Column<T> {
  key: string
  header: string
  render?: (item: T) => React.ReactNode
  sortable?: boolean
  searchValue?: (item: T) => string
  width?: string
}

export interface ServerPaginationConfig {
  totalCount: number
  currentPage: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  loading?: boolean
  searchPlaceholder?: string
  defaultPageSize?: number
  emptyMessage?: string
  emptyIcon?: React.ReactNode
  onRowClick?: (item: T) => void
  keyExtractor?: (item: T) => string
  toolbarActions?: React.ReactNode
  serverPagination?: ServerPaginationConfig
  onSearchChange?: (value: string) => void
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  searchPlaceholder = 'Search records...',
  defaultPageSize = 10,
  emptyMessage = 'No records found',
  emptyIcon = '📋',
  onRowClick,
  keyExtractor,
  toolbarActions,
  serverPagination,
  onSearchChange,
}: DataTableProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [search, setSearch]       = useState('')
  const [clientPage, setClientPage] = useState(1)
  const [clientPageSize, setClientPageSize] = useState(defaultPageSize)
  const [sortKey, setSortKey]     = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [viewMode, setViewMode]   = useState<'cards' | 'table'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'cards'
    }
    return 'table'
  })

  // Determine whether using server or client pagination
  const isServer = !!serverPagination
  const currentPage = isServer ? serverPagination.currentPage : clientPage
  const pageSize = isServer ? serverPagination.pageSize : clientPageSize

  // 1. Search Filter (for client-side mode)
  const filteredData = useMemo(() => {
    if (isServer) return data
    if (!search.trim()) return data
    const query = search.toLowerCase().trim()
    return data.filter(item => {
      return columns.some(col => {
        const val = col.searchValue
          ? col.searchValue(item)
          : String(item[col.key] ?? '')
        return val.toLowerCase().includes(query)
      })
    })
  }, [data, search, columns, isServer])

  // 2. Sorting (for client-side mode)
  const sortedData = useMemo(() => {
    if (isServer || !sortKey) return filteredData
    const col = columns.find(c => c.key === sortKey)
    return [...filteredData].sort((a, b) => {
      const valA = col?.searchValue ? col.searchValue(a) : a[sortKey]
      const valB = col?.searchValue ? col.searchValue(b) : b[sortKey]

      if (valA == null && valB == null) return 0
      if (valA == null) return 1
      if (valB == null) return -1

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA
      }

      const strA = String(valA).toLowerCase()
      const strB = String(valB).toLowerCase()
      if (strA < strB) return sortOrder === 'asc' ? -1 : 1
      if (strA > strB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredData, sortKey, sortOrder, columns, isServer])

  // 3. Pagination calculation
  const totalItems = isServer ? serverPagination.totalCount : sortedData.length
  const totalPages = Math.ceil(totalItems / pageSize) || 1

  const paginatedData = useMemo(() => {
    if (isServer) return sortedData
    const start = (currentPage - 1) * pageSize
    return sortedData.slice(start, start + pageSize)
  }, [sortedData, currentPage, pageSize, isServer])

  const goToPage = (page: number) => {
    const targetPage = Math.max(1, Math.min(page, totalPages))
    if (isServer) {
      serverPagination.onPageChange(targetPage)
    } else {
      setClientPage(targetPage)
    }
    // Smooth scroll to top of table/card container on mobile or desktop
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      if (rect.top < 0) {
        containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }

  const handlePageSizeChange = (newSize: number) => {
    if (isServer) {
      serverPagination.onPageSizeChange?.(newSize)
      serverPagination.onPageChange(1)
    } else {
      setClientPageSize(newSize)
      setClientPage(1)
    }
  }

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortOrder === 'asc') setSortOrder('desc')
      else setSortKey(null) // reset on 3rd click
    } else {
      setSortKey(key)
      setSortOrder('asc')
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    onSearchChange?.(e.target.value)
    if (!isServer) {
      setClientPage(1) // Reset to first page on search
    }
  }

  const startRecord = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endRecord = Math.min(currentPage * pageSize, totalItems)

  return (
    <div ref={containerRef} className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        padding: '0.875rem 1rem',
        borderBottom: '1px solid var(--gray-200)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        flexWrap: 'wrap',
        background: '#fff',
      }}>
        {/* Search Input */}
        <div style={{ flex: '1 1 200px', minWidth: 180, position: 'relative' }}>
          <Search size={15} style={{
            position: 'absolute',
            left: '0.75rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--gray-400)',
          }} />
          <input
            className="input"
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={handleSearchChange}
            style={{ paddingLeft: '2.25rem', fontSize: '0.85rem' }}
          />
        </div>

        {/* View Switcher & Toolbar Actions */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Cards vs Table View Toggle */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'var(--gray-100)',
            padding: '2px',
            borderRadius: '0.5rem',
            border: '1px solid var(--gray-200)',
          }}>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.3rem 0.55rem',
                fontSize: '0.75rem',
                fontWeight: viewMode === 'cards' ? 700 : 500,
                color: viewMode === 'cards' ? '#fff' : 'var(--gray-600)',
                background: viewMode === 'cards' ? 'var(--brand-500)' : 'transparent',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Card View (easy to read on mobile)"
            >
              <LayoutList size={13} />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.3rem 0.55rem',
                fontSize: '0.75rem',
                fontWeight: viewMode === 'table' ? 700 : 500,
                color: viewMode === 'table' ? '#fff' : 'var(--gray-600)',
                background: viewMode === 'table' ? 'var(--brand-500)' : 'transparent',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Table View"
            >
              <TableIcon size={13} />
              <span>Table</span>
            </button>
          </div>

          {toolbarActions}
        </div>
      </div>

      {/* TOP QUICK PAGINATION BAR (Instantly accessible on both Mobile Cards & Desktop Tables) */}
      <div style={{
        padding: '0.5rem 1rem',
        background: '#f8fafc',
        borderBottom: '1px solid var(--gray-200)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem',
        fontSize: '0.8rem',
        color: 'var(--gray-600)',
      }}>
        {/* Left: Range and total */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span>Showing <strong>{startRecord}</strong>–<strong>{endRecord}</strong> of <strong>{totalItems}</strong> entries</span>
          {totalPages > 1 && (
            <span style={{ background: 'var(--brand-50)', color: 'var(--brand-700)', padding: '1px 6px', borderRadius: 4, fontWeight: 700, fontSize: '0.72rem' }}>
              Page {currentPage}/{totalPages}
            </span>
          )}
        </div>

        {/* Right: Quick Prev/Next & Rows */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Rows:</span>
            <select
              className="input"
              value={pageSize}
              onChange={e => handlePageSizeChange(Number(e.target.value))}
              style={{ width: 'auto', padding: '0.15rem 0.35rem', fontSize: '0.75rem', height: 'auto', borderRadius: 4 }}
            >
              {[5, 10, 20, 50, 100].map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <button
                type="button"
                className="btn btn-xs btn-secondary"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                title="Previous Page"
              >
                <ChevronLeft size={13} /> Prev
              </button>
              <button
                type="button"
                className="btn btn-xs btn-secondary"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                title="Next Page"
              >
                Next <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content Rendering: Card View vs Table View */}
      {viewMode === 'cards' ? (
        <div style={{ background: 'var(--gray-50)', minHeight: 120 }}>
          {loading ? (
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="skeleton" style={{ height: 110, borderRadius: '0.75rem' }} />
              ))}
            </div>
          ) : paginatedData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <div className="empty-state">
                <div className="empty-state-icon" style={{ fontSize: '2rem' }}>{emptyIcon}</div>
                <div className="empty-state-title">{emptyMessage}</div>
                {search && <div className="empty-state-desc">No records match "{search}"</div>}
              </div>
            </div>
          ) : (
            <div className="datatable-mobile-cards">
              {paginatedData.map((item, rowIdx) => {
                const key = keyExtractor ? keyExtractor(item) : (item.id ?? String(rowIdx))
                const firstCol = columns[0]
                const otherCols = columns.slice(1).filter(c => c.key !== 'actions')
                const actionCol = columns.find(c => c.key === 'actions')

                return (
                  <div
                    key={key}
                    className="datatable-card-item"
                    onClick={() => onRowClick?.(item)}
                    style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                  >
                    {/* Primary Header Row */}
                    {firstCol && (
                      <div className="datatable-card-header">
                        {firstCol.render ? firstCol.render(item) : (item[firstCol.key] ?? '—')}
                      </div>
                    )}

                    {/* Data Rows */}
                    <div className="datatable-card-fields">
                      {otherCols.map(col => (
                        <div key={col.key} className="datatable-card-field-row">
                          <span className="datatable-card-field-label">{col.header}</span>
                          <div className="datatable-card-field-value">
                            {col.render ? col.render(item) : (item[col.key] ?? '—')}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Bottom Action Bar */}
                    {actionCol && (
                      <div className="datatable-card-actions">
                        {actionCol.render ? actionCol.render(item) : (item[actionCol.key] ?? '—')}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        /* Table View */
        <div>
          <div className="table-scroll-hint">
            <span>💡 Swipe horizontally to view all table columns ↔</span>
          </div>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table className="table" style={{ width: '100%', minWidth: 640, margin: 0 }}>
              <thead>
                <tr>
                  {columns.map(col => (
                    <th
                      key={col.key}
                      style={{
                        width: col.width,
                        cursor: col.sortable !== false ? 'pointer' : 'default',
                        userSelect: 'none',
                      }}
                      onClick={() => col.sortable !== false && handleSort(col.key)}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                        {col.header}
                        {col.sortable !== false && (
                          sortKey === col.key ? (
                            sortOrder === 'asc' ? <ArrowUp size={13} style={{ color: 'var(--brand-600)' }} /> : <ArrowDown size={13} style={{ color: 'var(--brand-600)' }} />
                          ) : (
                            <ArrowUpDown size={13} style={{ color: 'var(--gray-300)' }} />
                          )
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: pageSize > 5 ? 5 : pageSize }).map((_, idx) => (
                    <tr key={idx}>
                      {columns.map((col, cIdx) => (
                        <td key={cIdx}>
                          <div className="skeleton" style={{ height: 24, borderRadius: 4 }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                      <div className="empty-state">
                        <div className="empty-state-icon" style={{ fontSize: '2rem' }}>{emptyIcon}</div>
                        <div className="empty-state-title">{emptyMessage}</div>
                        {search && <div className="empty-state-desc">No records match "{search}"</div>}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((item, rowIdx) => {
                    const key = keyExtractor ? keyExtractor(item) : (item.id ?? String(rowIdx))
                    return (
                      <tr
                        key={key}
                        onClick={() => onRowClick?.(item)}
                        style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                      >
                        {columns.map(col => (
                          <td key={col.key}>
                            {col.render ? col.render(item) : (item[col.key] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BOTTOM FULL PAGINATION TOOLBAR */}
      <div style={{
        padding: '0.875rem 1.25rem',
        borderTop: '1px solid var(--gray-200)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        background: '#fafafa',
        fontSize: '0.85rem',
        color: 'var(--gray-600)',
      }}>
        {/* Left: Total Records Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span>
            Showing <strong>{startRecord}</strong> to <strong>{endRecord}</strong> of <strong>{totalItems}</strong> entries
          </span>
          {search && !isServer && <span style={{ color: 'var(--brand-600)', fontSize: '0.78rem' }}>(filtered from {data.length} total)</span>}
        </div>

        {/* Right: Page Navigation & Rows per page */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap' }}>
          {/* Page size selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>Rows:</span>
            <select
              className="input"
              value={pageSize}
              onChange={e => handlePageSizeChange(Number(e.target.value))}
              style={{ width: 'auto', padding: '0.2rem 0.45rem', fontSize: '0.8rem', height: 'auto' }}
            >
              {[5, 10, 20, 50, 100].map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>

          {/* Page Buttons & Numeric Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <button
              type="button"
              className="btn btn-xs btn-secondary"
              onClick={() => goToPage(1)}
              disabled={currentPage === 1}
              title="First Page"
              style={{ padding: '0.25rem 0.45rem' }}
            >
              <ChevronsLeft size={13} />
            </button>
            <button
              type="button"
              className="btn btn-xs btn-secondary"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              title="Previous Page"
              style={{ padding: '0.25rem 0.45rem' }}
            >
              <ChevronLeft size={13} />
            </button>
            
            {/* Numbered Page Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1]
                  return (
                    <React.Fragment key={p}>
                      {prev && p - prev > 1 && (
                        <span style={{ padding: '0 0.15rem', color: 'var(--gray-400)', fontSize: '0.75rem' }}>…</span>
                      )}
                      <button
                        type="button"
                        onClick={() => goToPage(p)}
                        style={{
                          minWidth: 26,
                          height: 26,
                          padding: '0 0.35rem',
                          borderRadius: '0.375rem',
                          fontSize: '0.75rem',
                          fontWeight: currentPage === p ? 700 : 500,
                          background: currentPage === p ? 'var(--brand-500)' : 'var(--gray-100)',
                          color: currentPage === p ? '#fff' : 'var(--gray-700)',
                          border: `1px solid ${currentPage === p ? 'var(--brand-600)' : 'var(--gray-200)'}`,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  )
                })}
            </div>

            <button
              type="button"
              className="btn btn-xs btn-secondary"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages || totalPages === 0}
              title="Next Page"
              style={{ padding: '0.25rem 0.45rem' }}
            >
              <ChevronRight size={13} />
            </button>
            <button
              type="button"
              className="btn btn-xs btn-secondary"
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages || totalPages === 0}
              title="Last Page"
              style={{ padding: '0.25rem 0.45rem' }}
            >
              <ChevronsRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
