"use client"

import { useState } from "react"
import { format } from "date-fns"
import useSWR, { useSWRConfig } from "swr"
import { useTranslations } from "next-intl"
import { Input } from "@/components/ui/input"
import { DateRangePicker } from "@/components/date-range-picker"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import * as XLSX from "xlsx"
import { Search as SearchIcon } from "lucide-react"
import { PaginationControls } from "@/components/pagination-controls"
import { useToast } from "@/components/ui/use-toast"

const fetcher = (url: string) => fetch(url).then(res => res.json())

// Cache duration - 5 minutes
const CACHE_DURATION = 5 * 60 * 1000

export function EmployeeAttendanceContent() {
  const t = useTranslations('Attendance')
  const { toast } = useToast()
  const { mutate: globalMutate } = useSWRConfig()
  
  // Pagination state
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  // Date filter state
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [search, setSearch] = useState("")

  // Build query params
  const params = new URLSearchParams()
  params.append("page", String(page))
  params.append("pageSize", String(pageSize))
  if (fromDate) params.append("from", fromDate)
  if (toDate) params.append("to", toDate)

  const url = `/api/employee/attendance?${params.toString()}`

  // SWR fetch with optimized configuration
  const { data, isLoading, isValidating } = useSWR(
    url,
    fetcher,
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      dedupingInterval: 60000,
      revalidateOnMount: true,
      staleTime: CACHE_DURATION,
    }
  )

  const records = data?.records || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / pageSize)
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  // Optimistic update helper
  const optimisticUpdate = async (updatedRecord: any) => {
    // Optimistically update the UI
    await globalMutate(
      url,
      async (currentData: any) => ({
        ...currentData,
        records: currentData.records.map((record: any) => 
          record.id === updatedRecord.id ? updatedRecord : record
        )
      }),
      false // Don't revalidate immediately
    )
  }

  // Handle check-in/out with optimistic updates
  const handleAttendanceAction = async (action: 'checkIn' | 'checkOut', undo = false) => {
    try {
      const method = action === 'checkIn' ? 'POST' : 'PUT'
      const response = await fetch('/api/employee/attendance', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ undo })
      })

      if (!response.ok) {
        throw new Error('Failed to update attendance')
      }

      const updatedRecord = await response.json()
      await optimisticUpdate(updatedRecord)

      toast({
        title: t('success'),
        description: t(undo ? 'actionUndone' : action === 'checkIn' ? 'checkedIn' : 'checkedOut'),
      })
    } catch (error) {
      toast({
        title: t('error'),
        description: t('actionFailed'),
        variant: "destructive"
      })
    }
  }

  // Filter records client-side for search
  const filteredRecords = records.filter((rec: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (rec.status && rec.status.toLowerCase().includes(s)) ||
      (rec.notes && rec.notes.toLowerCase().includes(s)) ||
      (rec.date && format(new Date(rec.date), 'yyyy-MM-dd').includes(s))
    );
  });

  // Sort by date descending (latest first)
  const sortedRecords = filteredRecords.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleExport = () => {
    if (!sortedRecords.length) return;
    const dataToExport = sortedRecords.map((rec: any) => ({
      Date: format(new Date(rec.date), 'yyyy-MM-dd'),
      Status: rec.status,
      'Check-In': rec.checkIn ? format(new Date(rec.checkIn), 'h:mm a') : '-',
      'Check-Out': rec.checkOut ? format(new Date(rec.checkOut), 'h:mm a') : '-',
      'Hours Worked': rec.workHours || '-',
      Notes: rec.notes || '-',
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    XLSX.writeFile(wb, `attendance_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-4 pt-4 ml-4 md:ml-8">
      {/* Search and filters */}
      <Card>
        <CardHeader>
          <CardTitle>{t('archiveTitle')}</CardTitle>
          <CardDescription>{t('archiveDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-2">
            <label className="text-sm font-medium" htmlFor="pageSize">{t('rowsPerPage') || 'Rows per page:'}</label>
            <select
              id="pageSize"
              value={pageSize}
              onChange={e => setPageSize(Number(e.target.value))}
              className="border rounded px-2 py-1"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
          <div className="overflow-x-auto max-w-full">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('date')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead>{t('checkIn')}</TableHead>
                  <TableHead>{t('checkOut')}</TableHead>
                  <TableHead>{t('hoursWorked')}</TableHead>
                  <TableHead>{t('notes')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && !data ? (
                  // Only show skeleton on initial load
                  Array.from({ length: pageSize }).map((_, idx) => (
                      <TableRow key={idx}>
                        {Array.from({ length: 6 }).map((_, i) => (
                          <TableCell key={i}><Skeleton className="h-5 w-24" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                ) : (
                  sortedRecords.map((rec: any) => (
                    <TableRow 
                      key={rec.id} 
                      className={isValidating ? "opacity-50" : ""}
                    >
                        <TableCell>{format(new Date(rec.date), 'yyyy-MM-dd')}</TableCell>
                        <TableCell>{rec.status}</TableCell>
                        <TableCell>{rec.checkIn ? format(new Date(rec.checkIn), 'h:mm a') : '-'}</TableCell>
                        <TableCell>{rec.checkOut ? format(new Date(rec.checkOut), 'h:mm a') : '-'}</TableCell>
                        <TableCell>{rec.workHours || '-'}</TableCell>
                        <TableCell>{rec.notes || '-'}</TableCell>
                      </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination controls */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              {t('showing')} {from}-{to} {t('of')} {total}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(1)}
                disabled={page === 1}
              >
                {t('first')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                {t('previous')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                {t('next')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
              >
                {t('last')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export button outside the table container */}
      <div className="flex justify-center mt-8">
        <Button onClick={handleExport} className="bg-black text-white hover:bg-gray-900" variant="default">
          {t('exportToExcel')}
        </Button>
      </div>
    </div>
  )
}
