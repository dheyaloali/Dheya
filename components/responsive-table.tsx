"use client"

import type React from "react"

import { useState } from "react"
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { useBreakpoint } from "@/hooks/use-responsive"

interface Column<T> {
  header: string
  accessorKey: keyof T
  cell?: (item: T) => React.ReactNode
  sortable?: boolean
  className?: string
  mobileLabel?: string
  priority?: number // Lower number = higher priority (shown on smaller screens)
}

interface ResponsiveTableProps<T> {
  data: T[]
  columns: Column<T>[]
  className?: string
  onRowClick?: (item: T) => void
}

export function ResponsiveTable<T extends Record<string, any>>({
  data,
  columns,
  className,
  onRowClick,
}: ResponsiveTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<keyof T | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const { breakpoint } = useBreakpoint()

  const isMobileView = breakpoint === "xs" || breakpoint === "sm"

  // Sort data if a sort column is selected
  const sortedData = [...data]
  if (sortColumn) {
    sortedData.sort((a, b) => {
      const aValue = a[sortColumn]
      const bValue = b[sortColumn]

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
      return 0
    })
  }

  // For mobile view, filter columns by priority
  const visibleColumns = isMobileView
    ? columns
        .filter((col) => col.priority !== undefined)
        .sort((a, b) => (a.priority || 999) - (b.priority || 999))
        .slice(0, 3) // Show at most 3 columns on mobile
    : columns

  const handleSort = (column: Column<T>) => {
    if (!column.sortable) return

    if (sortColumn === column.accessorKey) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column.accessorKey)
      setSortDirection("asc")
    }
  }

  // Render for mobile view
  if (isMobileView) {
    return (
      <div className={cn("space-y-4", className)}>
        {sortedData.map((item, index) => (
          <Card
            key={index}
            className={cn("p-4", onRowClick && "cursor-pointer hover:bg-muted/50")}
            onClick={() => onRowClick?.(item)}
          >
            {visibleColumns.map((column) => (
              <div key={String(column.accessorKey)} className="flex justify-between py-2">
                <span className="font-medium text-muted-foreground">{column.mobileLabel || column.header}:</span>
                <span className="text-right">{column.cell ? column.cell(item) : item[column.accessorKey]}</span>
              </div>
            ))}
          </Card>
        ))}
      </div>
    )
  }

  // Render for tablet/desktop view
  return (
    <div className={cn("w-full overflow-auto", className)}>
      <table className="w-full caption-bottom text-sm">
        <thead>
          <tr className="border-b">
            {columns.map((column) => (
              <th
                key={String(column.accessorKey)}
                className={cn(
                  "h-12 px-4 text-left align-middle font-medium text-muted-foreground",
                  column.sortable && "cursor-pointer select-none",
                  column.className,
                )}
                onClick={() => column.sortable && handleSort(column)}
              >
                <div className="flex items-center gap-1">
                  {column.header}
                  {column.sortable && (
                    <div className="ml-1">
                      {sortColumn === column.accessorKey ? (
                        sortDirection === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-4 w-4 opacity-50" />
                      )}
                    </div>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((item, index) => (
            <tr
              key={index}
              className={cn("border-b transition-colors", onRowClick && "cursor-pointer hover:bg-muted/50")}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((column) => (
                <td key={String(column.accessorKey)} className={cn("p-4 align-middle", column.className)}>
                  {column.cell ? column.cell(item) : item[column.accessorKey]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
