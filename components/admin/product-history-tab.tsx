"use client"

import { useState } from "react"
import { Search, Calendar, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { useAdminAssignments } from "@/hooks/useAdminAssignments"
import Image from "next/image"
import useSWR from "swr"
import * as XLSX from 'xlsx'
import { useToast } from '@/components/ui/use-toast'
import { Skeleton } from "@/components/ui/skeleton"

export default function HistoryTab() {
  const [searchTerm, setSearchTerm] = useState("")
  const [employeeFilter, setEmployeeFilter] = useState("all")
  const [productFilter, setProductFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  const {
    assignments,
    isLoading,
    error,
    pageCount,
    currentPage,
    pageSize,
    handlePageChange,
    handlePageSizeChange,
  } = useAdminAssignments({
    initialPage: 1,
    initialPageSize: 10,
    dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
    dateTo: dateTo ? new Date(dateTo).toISOString() : undefined,
  })

  // Fetch all employees and products for dropdowns
  const { data: employeesData } = useSWR("/api/employees?page=1&pageSize=1000", url => fetch(url).then(res => res.json()))
  const { data: productsData } = useSWR("/api/products?page=1&pageSize=1000", url => fetch(url).then(res => res.json()))
  const allEmployees = employeesData?.employees || []
  const allProducts = productsData?.products || []

  const { toast } = useToast()

  const filteredHistory = assignments.filter((entry) => {
    // Search
    if (searchTerm && !(
      entry.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.productName.toLowerCase().includes(searchTerm.toLowerCase())
    )) {
      return false;
    }
    // Employee filter
    if (employeeFilter !== "all" && String(entry.employeeId) !== employeeFilter) {
      return false;
    }
    // Product filter
    if (productFilter !== "all" && String(entry.productId) !== productFilter) {
      return false;
    }
    // Date range filter
    if (dateFrom && new Date(entry.assignedAt) < new Date(dateFrom)) {
      return false;
    }
    if (dateTo && new Date(entry.assignedAt) > new Date(dateTo)) {
      return false;
    }
    return true;
  })

  const handleExport = () => {
    if (!filteredHistory.length) {
      toast({ title: 'No data to export', description: 'There are no records to export for the current filters.', variant: 'destructive' });
      return;
    }
    // Prepare data for Excel
    const dataToExport = filteredHistory.map(entry => ({
      Employee: entry.employeeName,
      Product: entry.productName,
      Quantity: entry.quantity,
      Price: entry.productPrice,
      'Total Value': entry.totalValue,
      'Assigned Date': new Date(entry.assignedAt).toLocaleDateString(),
    }));
    // Create worksheet and workbook
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Assignment History');
    // Generate filename
    const fileName = `assignment_history_${new Date().toISOString().split('T')[0]}.xlsx`;
    // Save file
    XLSX.writeFile(wb, fileName);
    // Show toast
    toast({ title: 'Excel file downloaded', description: 'Assignment history has been exported successfully.', variant: 'default' });
  }

  const resetFilters = () => {
    setSearchTerm("");
    setEmployeeFilter("all");
    setProductFilter("all");
    setDateFrom("");
    setDateTo("");
  }

  // Helper for filter chips
  const filterChips = [];
  if (searchTerm) filterChips.push({ label: `Search: ${searchTerm}`, onRemove: () => setSearchTerm("") });
  if (employeeFilter !== "all") {
    const emp = allEmployees.find((e: any) => String(e.id) === employeeFilter);
    filterChips.push({ label: `Employee: ${emp?.user?.name || "Unknown"}`, onRemove: () => setEmployeeFilter("all") });
  }
  if (productFilter !== "all") {
    const prod = allProducts.find((p: any) => String(p.id) === productFilter);
    filterChips.push({ label: `Product: ${prod?.name || "Unknown"}`, onRemove: () => setProductFilter("all") });
  }
  if (dateFrom || dateTo) {
    filterChips.push({
      label: `Date: ${dateFrom ? new Date(dateFrom).toLocaleDateString() : ""}${dateTo ? " - " + new Date(dateTo).toLocaleDateString() : ""}`,
      onRemove: () => { setDateFrom(""); setDateTo(""); }
    });
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex flex-wrap md:flex-nowrap gap-2 items-center">
            <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search history..."
                className="pl-8 min-w-[180px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger className="min-w-[150px]">
              <SelectValue placeholder="Employee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
                {allEmployees.map((emp: any) => (
                  <SelectItem key={emp.id} value={String(emp.id)}>{emp.user?.name || "Unknown"}</SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger className="min-w-[150px]">
              <SelectValue placeholder="Product" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
                {allProducts.map((prod: any) => (
                  <SelectItem key={prod.id} value={String(prod.id)}>{prod.name}</SelectItem>
                ))}
            </SelectContent>
          </Select>
            <div className="flex items-center gap-1 border rounded px-2 py-1 bg-white">
              <label className="text-xs mr-1">From</label>
              <input
                type="date"
                className="border rounded px-2 py-1 text-sm w-[135px]"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                max={dateTo || undefined}
              />
              <label className="text-xs mx-1">To</label>
              <input
                type="date"
                className="border rounded px-2 py-1 text-sm w-[135px]"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                min={dateFrom || undefined}
              />
            </div>
            <Button variant="ghost" onClick={resetFilters}>Reset</Button>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4" /> Export</Button>
          </div>
        </div>
        {/* Filter chips */}
        {filterChips.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {filterChips.map((chip, idx) => (
              <span key={idx} className="bg-muted px-3 py-1 rounded-full text-sm flex items-center gap-1">
                {chip.label}
                <button onClick={chip.onRemove} className="ml-1 text-muted-foreground hover:text-destructive">×</button>
              </span>
            ))}
          </div>
        )}
        <div className="rounded-md border max-h-[400px] overflow-y-auto">
          <Table className="min-w-full">
            <TableHeader className="sticky top-0 bg-white z-10">
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Total Value</TableHead>
                <TableHead>Assigned Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-red-500">Error loading history</TableCell>
                </TableRow>
              ) : filteredHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">No history found.</TableCell>
                </TableRow>
              ) : (
                filteredHistory.map((entry: any) => (
                  <TableRow key={entry.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell>{entry.employeeName}</TableCell>
                    <TableCell>{entry.productName}</TableCell>
                    <TableCell>{entry.quantity}</TableCell>
                    <TableCell>${entry.productPrice.toFixed(2)}</TableCell>
                    <TableCell>${entry.totalValue.toFixed(2)}</TableCell>
                    <TableCell>{new Date(entry.assignedAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-center gap-2 mt-4">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={pageSize}
              onChange={e => {
                handlePageSizeChange(Number(e.target.value));
              }}
            >
              {[5, 10, 20, 25, 50, 100].map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handlePageChange(1)} disabled={currentPage === 1}>First</Button>
            <Button variant="outline" size="sm" onClick={() => handlePageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>&lt; Prev</Button>
            {Array.from({ length: pageCount }, (_, i) => (
              <Button
                key={i + 1}
                variant={currentPage === i + 1 ? "default" : "outline"}
                size="sm"
                onClick={() => handlePageChange(i + 1)}
              >
                {i + 1}
              </Button>
            ))}
            <Button variant="outline" size="sm" onClick={() => handlePageChange(Math.min(pageCount, currentPage + 1))} disabled={currentPage === pageCount || pageCount === 0}>Next &gt;</Button>
            <Button variant="outline" size="sm" onClick={() => handlePageChange(pageCount)} disabled={currentPage === pageCount || pageCount === 0}>Last</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function getActionClass(action: string) {
  switch (action) {
    case "Assigned":
      return "text-green-600 font-medium"
    case "Updated":
      return "text-amber-600 font-medium"
    case "Removed":
      return "text-red-600 font-medium"
    default:
      return ""
  }
}
