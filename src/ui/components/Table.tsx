import type { ReactNode } from 'react'

export interface TableColumn<T> {
  key: string
  header: ReactNode
  align?: 'left' | 'right' | 'center'
  sortable?: boolean
  render: (row: T) => ReactNode
}

interface TableProps<T> {
  columns: TableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  sortKey?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (key: string) => void
  className?: string
}

const alignClass = (align?: 'left' | 'right' | 'center') =>
  align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'

/** Small, reusable table. Header cells are sortable when a column declares `sortable` and the
 * caller supplies `onSort`. Kept generic so both Distribuidores (Task 12) and Maestro (Task 14)
 * can reuse it. */
export default function Table<T>({ columns, rows, rowKey, sortKey, sortDir, onSort, className = '' }: TableProps<T>) {
  return (
    <table className={`w-full border-collapse text-sm ${className}`}>
      <thead>
        <tr>
          {columns.map((col) => {
            const isSorted = col.sortable && sortKey === col.key
            return (
              <th
                key={col.key}
                onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
                aria-sort={isSorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                className={`border-b-2 border-navy px-3 py-2 text-[10.5px] font-bold uppercase tracking-wide text-slate ${alignClass(
                  col.align,
                )} ${col.sortable ? 'cursor-pointer select-none hover:text-navy' : ''}`}
              >
                {col.header}
                {isSorted ? <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span> : null}
              </th>
            )
          })}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)} className="border-b border-line">
            {columns.map((col) => (
              <td key={col.key} className={`px-3 py-2 ${alignClass(col.align)}`}>
                {col.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
