"use client"

import { useEffect, useState } from "react"
import { ArrowUpDown, CheckCircle, Clock, Download, Filter, Search, X, Calendar, User } from "lucide-react"
import type { DateRange } from "react-day-picker"
import * as XLSX from "xlsx"
import useSWR from "swr"
import type { AttendanceStatus } from "@/lib/mock-data"
import { adminFetcher, fetchWithCSRF } from "@/lib/admin-api-client"
import { getAvatarImage, getAvatarInitials } from "@/lib/avatar-utils"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DateRangePicker } from "@/components/date-range-picker"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/components/ui/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { useAdminEmployees } from "@/hooks/useAdminEmployees"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { LoadingButton } from "@/components/ui/loading-button"


// Define the attendance record type
interface AttendanceRecord {
  id: string
  employeeId: string
  employeeName: string
  date: string
  checkIn: string | null
  checkOut: string | null
  status: AttendanceStatus
  workHours: string
  notes?: string
}

function AttendanceTableSkeleton({ pageSize = 10 }: { pageSize?: number }) {
  return (
    <div>
      {/* Search/Filter Skeleton */}
      <div className="flex flex-wrap gap-2 items-center mb-6">
        <Skeleton className="h-8 w-72 rounded-full" />
        <Skeleton className="h-8 w-32 rounded" />
        <Skeleton className="h-8 w-32 rounded" />
        <Skeleton className="h-8 w-32 rounded" />
        <Skeleton className="h-8 w-40 rounded" />
      </div>
      {/* Table Skeleton */}
      <div className="rounded-md border max-h-[400px] overflow-y-auto w-full animate-pulse">
        <table className="w-full">
          <thead>
            <tr>
              <th className="w-[80px]"> </th>
              <th>Employee</th>
              <th>Date</th>
              <th>Check In</th>
              <th>Check Out</th>
              <th>Status</th>
              <th>Work Hours</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: pageSize }).map((_, i) => (
              <tr key={i}>
                <td><Skeleton className="h-5 w-12 rounded" /></td>
                <td>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div>
                      <Skeleton className="h-4 w-24 mb-1 rounded" />
                    </div>
                  </div>
                </td>
                <td><Skeleton className="h-4 w-20 rounded" /></td>
                <td><Skeleton className="h-4 w-16 rounded" /></td>
                <td><Skeleton className="h-4 w-16 rounded" /></td>
                <td><Skeleton className="h-4 w-16 rounded" /></td>
                <td><Skeleton className="h-4 w-16 rounded" /></td>
                <td><Skeleton className="h-4 w-32 rounded" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminAttendanceContent() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [selectedEmployee, setSelectedEmployee] = useState<AttendanceRecord | null>(null)
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false)
  const [employeeAttendanceRecords, setEmployeeAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [employeeFilterDate, setEmployeeFilterDate] = useState<string>("")
  const [employeeFilterStatus, setEmployeeFilterStatus] = useState<string[]>([])
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteRecord, setDeleteRecord] = useState<AttendanceRecord | null>(null);
  const { employees: allEmployees } = useAdminEmployees(1, 1000);
  const [activeTab, setActiveTab] = useState("today");
  // Today's Attendance filters
  const [todaySearch, setTodaySearch] = useState("");
  const [todayCity, setTodayCity] = useState("All");
  const [todayStatus, setTodayStatus] = useState("All");
  const [todayEmployee, setTodayEmployee] = useState("All");
  const [todayFromDate, setTodayFromDate] = useState("");
  const [todayToDate, setTodayToDate] = useState("");
  // Attendance History filters
  const [historySearch, setHistorySearch] = useState("");
  const [historyCity, setHistoryCity] = useState("All");
  const [historyStatus, setHistoryStatus] = useState("All");
  const [historyEmployee, setHistoryEmployee] = useState("All");
  const [historyFromDate, setHistoryFromDate] = useState("");
  const [historyToDate, setHistoryToDate] = useState("");
  const [todayPage, setTodayPage] = useState(1);
  const [todayTotal, setTodayTotal] = useState(0);
  const [isAddingAttendance, setIsAddingAttendance] = useState(false);
  const [isEditingAttendance, setIsEditingAttendance] = useState(false);
  const [isDeletingAttendance, setIsDeletingAttendance] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [addConfirmDialogOpen, setAddConfirmDialogOpen] = useState(false);
  const [editConfirmDialogOpen, setEditConfirmDialogOpen] = useState(false);
  const [formDataToConfirm, setFormDataToConfirm] = useState<any>(null);

  // Using the CSRF-protected adminFetcher instead of a custom fetcher

  // Today's date string (YYYY-MM-DD) in local time
  const today = new Date();
  const todayStr = today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');

  // Build query string for SWR for each tab
  const todayParams = new URLSearchParams({
    page: todayPage.toString(),
    pageSize: pageSize.toString(),
    fromDate: todayStr,
    toDate: todayStr,
  });
  if (todaySearch) todayParams.append("search", todaySearch);
  if (todayCity && todayCity !== "All") todayParams.append("city", todayCity);
  if (todayEmployee && todayEmployee !== "All") todayParams.append("employeeId", todayEmployee);
  if (todayStatus && todayStatus !== "All") todayParams.append("status", todayStatus);
  if (todayFromDate) todayParams.append("fromDate", todayFromDate);
  if (todayToDate) todayParams.append("toDate", todayToDate);
  const historyParams = new URLSearchParams({
    page: currentPage.toString(),
    pageSize: pageSize.toString(),
  });
  if (historySearch) historyParams.append("search", historySearch);
  if (historyCity && historyCity !== "All") historyParams.append("city", historyCity);
  if (historyEmployee && historyEmployee !== "All") historyParams.append("employeeId", historyEmployee);
  if (historyStatus && historyStatus !== "All") historyParams.append("status", historyStatus);
  if (historyFromDate) historyParams.append("fromDate", historyFromDate);
  if (historyToDate) historyParams.append("toDate", historyToDate);

  const todayKey = `/api/admin/attendance?${todayParams.toString()}`;
  const historyKey = `/api/admin/attendance?${historyParams.toString()}`;

  const { data: todayData, isLoading: todayLoading, mutate: mutateToday } = useSWR(todayKey, adminFetcher);
  const { data: historyData, error: swrError, isLoading, mutate } = useSWR(historyKey, adminFetcher);

  useEffect(() => {
    if (historyData) {
      setAttendanceRecords(Array.isArray(historyData.records) ? historyData.records : []);
      setTotal(historyData.total);
            setLoading(false);
    }
    if (swrError) setLoading(false);
  }, [historyData, swrError]);

  useEffect(() => {
    if (todayData) {
      setTodayTotal(todayData.total || 0);
    }
  }, [todayData]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Present":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle className="mr-1 h-3 w-3" /> {status}
          </Badge>
        )
      case "Late":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            <Clock className="mr-1 h-3 w-3" /> {status}
          </Badge>
        )
      case "Absent":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <X className="mr-1 h-3 w-3" /> {status}
          </Badge>
        )
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const handleExportData = () => {
    try {
    // Create CSV content
    const headers = [
      "ID",
      "Employee ID",
      "Employee Name",
      "Date",
      "Check In",
      "Check Out",
      "Status",
      "Work Hours",
      "Notes",
    ]
    const csvContent = [
      headers.join(","),
      ...attendanceRecords.map((record) =>
        [
          record.id,
          record.employeeId,
          `"${record.employeeName}"`, // Quotes to handle commas in names
          record.date,
          record.checkIn ? record.checkIn : "",
          record.checkOut ? record.checkOut : "",
          record.status,
          record.workHours,
          `"${record.notes || ""}"`, // Quotes to handle commas in notes
        ].join(","),
      ),
    ].join("\n")

    // Create a blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `attendance_report_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

      toast({ title: "Export Successful", description: "Attendance data exported as CSV." });
    } catch (err) {
      toast({ title: "Export Failed", description: "Could not export attendance data.", variant: "destructive" });
    }
  }

  // Helper to get today's records for cards
  const todaysRecords = todayData?.records || [];
  const presentCount = todaysRecords.filter((record: any) => record.status === "Present" || record.status === "Late").length;
  const lateCount = todaysRecords.filter((record: any) => record.status === "Late").length;
  const absentCount = todaysRecords.filter((record: any) => record.status === "Absent").length;

  // Pagination controls
  const totalPages = Math.ceil(total / pageSize)
  const handlePrev = () => setCurrentPage((p) => Math.max(1, p - 1))
  const handleNext = () => setCurrentPage((p) => Math.min(totalPages, p + 1))
  const handlePage = (n: number) => setCurrentPage(n)

  const handleEmployeeClick = (record: AttendanceRecord) => {
    setSelectedEmployee(record)
    setEmployeeDialogOpen(true)
    // Filter attendance records for this employee
    const employeeRecords = attendanceRecords.filter(r => r.employeeId === record.employeeId)
    setEmployeeAttendanceRecords(employeeRecords)
  }

  const filteredEmployeeRecords = employeeAttendanceRecords.filter(record => {
    if (employeeFilterDate) {
      const filterDate = new Date(employeeFilterDate)
      const recordDate = new Date(record.date)
      if (filterDate.toDateString() !== recordDate.toDateString()) {
        return false
      }
    }
    if (employeeFilterStatus.length > 0) {
      if (!employeeFilterStatus.includes(record.status)) {
        return false
      }
    }
    return true
  })

  const handleExportEmployeeData = () => {
    if (!selectedEmployee) return;

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Employee Info sheet
    const employeeInfo = [
      ["Employee Information"],
      ["Name", selectedEmployee.employeeName],
      ["ID", selectedEmployee.employeeId],
      [],
      ["Attendance Records"],
      ["Date", "Check In", "Check Out", "Status", "Work Hours", "Notes"]
    ];

    // Add attendance records
    const attendanceData = filteredEmployeeRecords.map(record => [
      new Date(record.date).toLocaleDateString(),
      record.checkIn ? record.checkIn : '-',
      record.checkOut ? record.checkOut : '-',
      record.status,
      record.workHours,
      record.notes || ""
    ]);

    // Combine all data
    const sheetData = [...employeeInfo, ...attendanceData];

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Employee Attendance");

    // Generate filename
    const fileName = `${selectedEmployee.employeeName.replace(/\s+/g, '_')}_attendance_${new Date().toISOString().split('T')[0]}.xlsx`;

    // Save file
    XLSX.writeFile(wb, fileName);
  };

  // Add a helper function to calculate working hours
  const calculateWorkHours = (checkIn: string, checkOut: string) => {
    if (!checkIn || !checkOut) return "-";
    
    const checkInTime = new Date(`1970-01-01T${checkIn}`);
    const checkOutTime = new Date(`1970-01-01T${checkOut}`);
    
    // If checkout is earlier than checkin, assume it's the next day
    let hours = (checkOutTime.getTime() - checkInTime.getTime()) / 3600000;
    if (hours < 0) {
      hours += 24;
    }
    
    return hours.toFixed(2);
  };

  // Modify the handleAddAttendance function to properly format the data
  const handleAddAttendance = async (form: any) => {
    // Create a formatted version of the form data for API submission
    const formattedForm = {
      employeeId: form.employeeId,
      date: form.date,
      checkIn: form.checkIn ? `${form.date}T${form.checkIn}` : null,
      checkOut: form.checkOut ? `${form.date}T${form.checkOut}` : null,
      status: form.status,
      notes: form.notes,
    };
    
    // Calculate work hours for display
    const workHours = calculateWorkHours(form.checkIn, form.checkOut);
    
    // Store both the formatted form (for API) and the original form (for display)
    setFormDataToConfirm({
      ...form,
      formattedData: formattedForm,
      workHours
    });
    
    setAddConfirmDialogOpen(true);
  };

  // Modify the confirmAndSubmitAddAttendance function to use the formatted data
  const confirmAndSubmitAddAttendance = async () => {
    if (!formDataToConfirm) return;
    
    setIsAddingAttendance(true);
    setActionError(null);
    try {
      const res = await fetch("/api/admin/attendance", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": "no-cache"
        },
        body: JSON.stringify(formDataToConfirm.formattedData),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to add attendance record");
      }
      
      toast({ title: "Attendance Added", description: "Attendance record added successfully." });
      setAddDialogOpen(false);
      setAddConfirmDialogOpen(false);
      setFormDataToConfirm(null);
      await mutate(historyKey);
      await mutateToday(todayKey);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to add attendance record");
      toast({ title: "Add Failed", description: "Failed to add attendance record.", variant: "destructive" });
    } finally {
      setIsAddingAttendance(false);
    }
  };

  // Similarly modify the handleEditAttendance function
  const handleEditAttendance = async (form: any) => {
    // Create a formatted version of the form data for API submission
    const formattedForm = {
      id: form.id,
      date: form.date,
      checkIn: form.checkIn ? `${form.date}T${form.checkIn}` : null,
      checkOut: form.checkOut ? `${form.date}T${form.checkOut}` : null,
      status: form.status,
      notes: form.notes,
    };
    
    // Calculate work hours for display
    const workHours = calculateWorkHours(form.checkIn, form.checkOut);
    
    // Store both the formatted form (for API) and the original form (for display)
    setFormDataToConfirm({
      ...form,
      formattedData: formattedForm,
      workHours
    });
    
    setEditConfirmDialogOpen(true);
  };

  // Modify the confirmAndSubmitEditAttendance function to use the formatted data
  const confirmAndSubmitEditAttendance = async () => {
    if (!formDataToConfirm) return;
    
    setIsEditingAttendance(true);
    setActionError(null);
    try {
      const res = await fetch("/api/admin/attendance", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": "no-cache"
        },
        body: JSON.stringify(formDataToConfirm.formattedData),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update attendance record");
      }
      
      toast({ title: "Attendance Updated", description: "Attendance record updated successfully." });
      setEditDialogOpen(false);
      setEditConfirmDialogOpen(false);
      setEditRecord(null);
      setFormDataToConfirm(null);
      await mutate(historyKey);
      await mutateToday(todayKey);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update attendance record");
      toast({ title: "Update Failed", description: "Failed to update attendance record.", variant: "destructive" });
    } finally {
      setIsEditingAttendance(false);
    }
  };

  const handleDeleteAttendance = async () => {
    if (!deleteRecord) return;
    
    // Start with setting UI state
    setIsDeletingAttendance(true);
    setActionError(null);
    
    // Show early feedback toast
    toast({ 
      title: "Deleting Attendance...", 
      description: "Processing your request...",
    });
    
    try {
      // Close dialog immediately for better perceived performance
      setDeleteDialogOpen(false);
      
      // Make the request
      const deletePromise = fetch("/api/admin/attendance", {
        method: "DELETE",
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        },
        body: JSON.stringify({ id: deleteRecord.id }),
      });
      
      // Start data revalidation in parallel without waiting for API completion
      // This gives a faster UI update
      const mutatePromise = Promise.all([
        mutate(historyKey, undefined, { revalidate: true }),
        mutateToday(todayKey, undefined, { revalidate: true })
      ]);
      
      // Clear UI state even before the API completes
      setDeleteRecord(null);
      
      // Wait for both API call and data revalidation
      const [res] = await Promise.all([deletePromise, mutatePromise]);
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to delete attendance record");
      }
      
      // Show success toast
      toast({ 
        title: "Attendance Deleted", 
        description: "Attendance record deleted successfully."
      });
      
      // Final data refresh
      mutate(historyKey);
      mutateToday(todayKey);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete attendance record");
      toast({ 
        title: "Delete Failed", 
        description: "Failed to delete attendance record. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsDeletingAttendance(false);
    }
  };

  // Pagination controls for today
  const todayTotalPages = Math.ceil(todayTotal / pageSize);
  const handleTodayFirst = () => setTodayPage(1);
  const handleTodayPrev = () => setTodayPage((p) => Math.max(1, p - 1));
  const handleTodayNext = () => setTodayPage((p) => Math.min(todayTotalPages, p + 1));
  const handleTodayLast = () => setTodayPage(todayTotalPages);
  const handleTodayPage = (n: number) => setTodayPage(n);

  // Pagination controls for history (already exist, add first/last)
  const handleFirst = () => setCurrentPage(1);
  const handleLast = () => setCurrentPage(totalPages);

  // Helper to combine date and time into local date-time string (no UTC conversion)
  function combineDateAndTime(date: string, time: string) {
    if (!date || !time) return null;
    return `${date}T${time}`; // local time string
  }

  // Helper to get employee name by id
  const getEmployeeNameById = (id: string) => {
    const employee = allEmployees.find(emp => emp.id === id);
    return employee?.user?.name || "Unknown Employee";
  };

  // Helper to format date and time for display
  const formatDateTime = (date: string, time: string) => {
    if (!date) return "Not specified";
    const formattedDate = new Date(date).toLocaleDateString();
    return time ? `${formattedDate} at ${time}` : formattedDate;
  };

  return (
    <div className="space-y-4 ml-8">
      {/* Dashboard Cards always at the top */}
      <div className="sticky top-0 z-20 bg-white rounded-b shadow pb-4 mb-2 mx-6 my-2 p-8">
          <h2 className="text-lg font-semibold mb-2">Today's Attendance Overview</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="p-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-2">
              <CardTitle className="text-xs font-medium">Total Records</CardTitle>
              <Clock className="h-3 w-3 text-muted-foreground" />
          </CardHeader>
            <CardContent className="p-2 text-xs">
              <div className="text-lg font-bold">{todaysRecords.length}</div>
              <p className="text-[10px] text-muted-foreground">Total attendance records</p>
          </CardContent>
        </Card>
          <Card className="p-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-2">
              <CardTitle className="text-xs font-medium">Present</CardTitle>
              <CheckCircle className="h-3 w-3 text-green-500" />
          </CardHeader>
            <CardContent className="p-2 text-xs">
              <div className="text-lg font-bold">{presentCount}</div>
              <p className="text-[10px] text-muted-foreground">Employees present</p>
          </CardContent>
        </Card>
          <Card className="p-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-2">
              <CardTitle className="text-xs font-medium">Late</CardTitle>
              <Clock className="h-3 w-3 text-amber-500" />
          </CardHeader>
            <CardContent className="p-2 text-xs">
              <div className="text-lg font-bold">{lateCount}</div>
              <p className="text-[10px] text-muted-foreground">Late arrivals</p>
          </CardContent>
        </Card>
          <Card className="p-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-2">
              <CardTitle className="text-xs font-medium">Absent</CardTitle>
              <X className="h-3 w-3 text-red-500" />
          </CardHeader>
            <CardContent className="p-2 text-xs">
              <div className="text-lg font-bold">{absentCount}</div>
              <p className="text-[10px] text-muted-foreground">Absent employees</p>
          </CardContent>
        </Card>
        </div>
      </div>
      {/* Tabs for Today's Attendance and Attendance History */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="today">Today's Attendance</TabsTrigger>
          <TabsTrigger value="history">Attendance History</TabsTrigger>
        </TabsList>
        <TabsContent value="today">
          {/* Filters for Today's Attendance */}
          <div className="flex flex-wrap gap-2 items-center mb-4">
          <Input
            placeholder="Search employees..."
              className="w-64"
              value={todaySearch}
              onChange={e => setTodaySearch(e.target.value)}
            />
            <select className="border rounded px-2 py-1 text-sm" value={todayCity} onChange={e => setTodayCity(e.target.value)}>
              <option value="All">All Cities</option>
              {Array.from(new Set(allEmployees.map(emp => emp.city).filter(Boolean))).sort().map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
            <select className="border rounded px-2 py-1 text-sm" value={todayStatus} onChange={e => setTodayStatus(e.target.value)}>
              <option value="All">All Statuses</option>
              <option value="Present">Present</option>
              <option value="Late">Late</option>
              <option value="Absent">Absent</option>
            </select>
            <select className="border rounded px-2 py-1 text-sm" value={todayEmployee} onChange={e => setTodayEmployee(e.target.value)}>
              <option value="All">All Employees</option>
              {allEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.user?.name}</option>
              ))}
            </select>
              <Input
                type="date"
              value={todayFromDate}
              onChange={e => setTodayFromDate(e.target.value)}
                className="w-[140px]"
              placeholder="From"
              />
              <Input
                type="date"
              value={todayToDate}
              onChange={e => setTodayToDate(e.target.value)}
                className="w-[140px]"
              placeholder="To"
          />
        </div>
          <Button className="mb-4" onClick={() => setAddDialogOpen(true)}>
            + Add Attendance
              </Button>
          <div className="rounded-md border max-h-[400px] min-h-[120px] overflow-y-scroll scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100" style={{ scrollbarGutter: 'stable' }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">ID</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Work Hours</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todayLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">Loading...</TableCell>
                  </TableRow>
                ) : todayData?.records?.length > 0 ? (
                  todayData.records.map((record: any) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.id}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage 
                              src={getAvatarImage({ 
                                image: record.user?.image, 
                                pictureUrl: record.employee?.pictureUrl 
                              })} 
                              alt={record.employeeName} 
                            />
                          </Avatar>
                          <div className="font-medium cursor-pointer hover:text-primary transition-colors" onClick={() => handleEmployeeClick(record)}>{record.employeeName}</div>
                        </div>
                      </TableCell>
                      <TableCell>{new Date(record.date).toLocaleDateString()}</TableCell>
                      <TableCell>{record.checkIn ? new Date(record.checkIn).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '-'}</TableCell>
                      <TableCell>{record.checkOut ? new Date(record.checkOut).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '-'}</TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell>{record.workHours} hrs</TableCell>
                      <TableCell className="max-w-[200px] truncate">{record.notes || "-"}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => { setEditRecord(record); setEditDialogOpen(true); }}>Edit</Button>
                        <Button size="sm" variant="destructive" className="ml-2" onClick={() => { setDeleteRecord(record); setDeleteDialogOpen(true); }}>Delete</Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">No attendance records found for today.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {/* Pagination controls for Today's Attendance */}
          <div className="flex flex-col sm:flex-row justify-end items-center gap-2 py-4">
            <div className="flex items-center gap-2 mb-2 sm:mb-0">
              <label htmlFor="todayPageSize" className="text-sm text-muted-foreground">Rows per page:</label>
              <select
                id="todayPageSize"
                className="border rounded px-2 py-1 text-sm"
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setTodayPage(1); }}
              >
                {[10, 20, 50, 100].map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
            <Button variant="outline" size="sm" onClick={handleTodayFirst} disabled={todayPage === 1}>&laquo; First</Button>
            <Button variant="outline" size="sm" onClick={handleTodayPrev} disabled={todayPage === 1}>&lt; Prev</Button>
            {Array.from({ length: todayTotalPages }, (_, i) => (
              <Button
                key={i + 1}
                variant={todayPage === i + 1 ? "default" : "outline"}
                size="sm"
                onClick={() => handleTodayPage(i + 1)}
              >
                {i + 1}
              </Button>
            ))}
            <Button variant="outline" size="sm" onClick={handleTodayNext} disabled={todayPage === todayTotalPages || todayTotalPages === 0}>Next &gt;</Button>
            <Button variant="outline" size="sm" onClick={handleTodayLast} disabled={todayPage === todayTotalPages || todayTotalPages === 0}>Last &raquo;</Button>
        </div>
        </TabsContent>
        <TabsContent value="history">
          {/* Filters for Attendance History (same as above) */}
          <div className="flex flex-wrap gap-2 items-center mb-4">
            <Input
              placeholder="Search employees..."
              className="w-64"
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
            />
            <select className="border rounded px-2 py-1 text-sm" value={historyCity} onChange={e => setHistoryCity(e.target.value)}>
              <option value="All">All Cities</option>
              {Array.from(new Set(allEmployees.map(emp => emp.city).filter(Boolean))).sort().map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
            <select className="border rounded px-2 py-1 text-sm" value={historyStatus} onChange={e => setHistoryStatus(e.target.value)}>
              <option value="All">All Statuses</option>
              <option value="Present">Present</option>
              <option value="Late">Late</option>
              <option value="Absent">Absent</option>
            </select>
            <select className="border rounded px-2 py-1 text-sm" value={historyEmployee} onChange={e => setHistoryEmployee(e.target.value)}>
              <option value="All">All Employees</option>
              {allEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.user?.name}</option>
              ))}
            </select>
            <Input
              type="date"
              value={historyFromDate}
              onChange={e => setHistoryFromDate(e.target.value)}
              className="w-[140px]"
              placeholder="From"
            />
            <Input
              type="date"
              value={historyToDate}
              onChange={e => setHistoryToDate(e.target.value)}
              className="w-[140px]"
              placeholder="To"
            />
      </div>
          {loading ? (
            <AttendanceTableSkeleton pageSize={pageSize} />
          ) : error ? (
            <div className="p-8 text-center text-red-600">{error}</div>
          ) : (
            <>
          <div className="rounded-md border max-h-[400px] min-h-[120px] overflow-y-scroll scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100" style={{ scrollbarGutter: 'stable' }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">ID</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
              <TableHead>Check In</TableHead>
              <TableHead>Check Out</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Work Hours</TableHead>
              <TableHead>Notes</TableHead>
                      <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
                {loading ? (
                  <TableRow>
                        <TableCell colSpan={8} className="text-center">Loading...</TableCell>
                  </TableRow>
                    ) : attendanceRecords.length > 0 ? (
                      attendanceRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">{record.id}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                                <AvatarImage 
                                  src={getAvatarImage({ 
                                    image: record.user?.image, 
                                    pictureUrl: record.employee?.pictureUrl 
                                  })} 
                                  alt={record.employeeName} 
                                />
                      </Avatar>
                              <div className="font-medium cursor-pointer hover:text-primary transition-colors" onClick={() => handleEmployeeClick(record)}>{record.employeeName}</div>
                    </div>
                  </TableCell>
                  <TableCell>{new Date(record.date).toLocaleDateString()}</TableCell>
                          <TableCell>{record.checkIn ? new Date(record.checkIn).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '-'}</TableCell>
                          <TableCell>{record.checkOut ? new Date(record.checkOut).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '-'}</TableCell>
                  <TableCell>{getStatusBadge(record.status)}</TableCell>
                  <TableCell>{record.workHours} hrs</TableCell>
                  <TableCell className="max-w-[200px] truncate">{record.notes || "-"}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" onClick={() => { setEditRecord(record); setEditDialogOpen(true); }}>Edit</Button>
                            <Button size="sm" variant="destructive" className="ml-2" onClick={() => { setDeleteRecord(record); setDeleteDialogOpen(true); }}>Delete</Button>
                          </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                        <TableCell colSpan={9} className="text-center">No attendance records found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
          {/* Pagination controls */}
          <div className="flex flex-col sm:flex-row justify-end items-center gap-2 py-4">
            <div className="flex items-center gap-2 mb-2 sm:mb-0">
              <label htmlFor="pageSize" className="text-sm text-muted-foreground">Rows per page:</label>
              <select
                id="pageSize"
                className="border rounded px-2 py-1 text-sm"
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              >
                {[10, 20, 50, 100].map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
                <Button variant="outline" size="sm" onClick={handleFirst} disabled={currentPage === 1}>&laquo; First</Button>
            <Button variant="outline" size="sm" onClick={handlePrev} disabled={currentPage === 1}>&lt; Prev</Button>
            {Array.from({ length: totalPages }, (_, i) => (
              <Button
                key={i + 1}
                variant={currentPage === i + 1 ? "default" : "outline"}
                size="sm"
                onClick={() => handlePage(i + 1)}
              >
                {i + 1}
              </Button>
            ))}
            <Button variant="outline" size="sm" onClick={handleNext} disabled={currentPage === totalPages}>Next &gt;</Button>
                <Button variant="outline" size="sm" onClick={handleLast} disabled={currentPage === totalPages}>Last &raquo;</Button>
          </div>
        </>
      )}
        </TabsContent>
      </Tabs>

      <Dialog open={employeeDialogOpen} onOpenChange={setEmployeeDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Employee Profile</DialogTitle>
          </DialogHeader>
          
          {selectedEmployee && (
            <div className="space-y-6">
              {/* Employee Info Card */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage
                        src={getAvatarImage({ 
                          image: selectedEmployee.user?.image, 
                          pictureUrl: selectedEmployee.employee?.pictureUrl 
                        })}
                        alt={selectedEmployee.employeeName}
                      />
                      <AvatarFallback>{getAvatarInitials(selectedEmployee.employeeName)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium leading-none">{selectedEmployee.employeeName}</p>
                      <p className="text-sm text-muted-foreground">{selectedEmployee.employeeId}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
      </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="w-[400px] max-w-full p-6 pb-8 flex flex-col items-center overflow-y-auto max-h-[90vh]">
          <DialogHeader><DialogTitle>Add Attendance</DialogTitle></DialogHeader>
          <AttendanceForm 
            employees={allEmployees} 
            onSubmit={handleAddAttendance} 
            onCancel={() => setAddDialogOpen(false)}
            isLoading={isAddingAttendance}
          />
          {actionError && <div className="text-red-500 mt-2">{actionError}</div>}
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={open => { setEditDialogOpen(open); if (!open) setEditRecord(null); }}>
        <DialogContent className="w-[400px] max-w-full p-6 pb-8 flex flex-col items-center overflow-y-auto max-h-[90vh]">
          <DialogHeader><DialogTitle>Edit Attendance</DialogTitle></DialogHeader>
          {editRecord && (
            <AttendanceForm 
              employees={allEmployees} 
              initial={editRecord} 
              onSubmit={handleEditAttendance} 
              onCancel={() => setEditDialogOpen(false)}
              isLoading={isEditingAttendance}
            />
          )}
          {actionError && <div className="text-red-500 mt-2">{actionError}</div>}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={open => { setDeleteDialogOpen(open); if (!open) setDeleteRecord(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Delete</DialogTitle></DialogHeader>
          <div>Are you sure you want to delete this attendance record?</div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <LoadingButton
              variant="destructive"
              loading={isDeletingAttendance}
              loadingText="Deleting..."
              onClick={handleDeleteAttendance}
            >
              Delete
            </LoadingButton>
          </div>
          {actionError && <div className="text-red-500 mt-2">{actionError}</div>}
        </DialogContent>
      </Dialog>

      {/* Add Attendance Confirmation Dialog */}
      <Dialog open={addConfirmDialogOpen} onOpenChange={open => { setAddConfirmDialogOpen(open); if (!open) setFormDataToConfirm(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Add Attendance</DialogTitle></DialogHeader>
          <div>
            <p>Please confirm that you want to add the following attendance record:</p>
            {formDataToConfirm && (
              <div className="mt-4 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-md">
                  <div className="font-semibold">Employee:</div>
                  <div>{getEmployeeNameById(formDataToConfirm.employeeId)}</div>
                  
                  <div className="font-semibold">Date:</div>
                  <div>{new Date(formDataToConfirm.date).toLocaleDateString()}</div>
                  
                  <div className="font-semibold">Check In:</div>
                  <div>{formDataToConfirm.checkIn || "Not specified"}</div>
                  
                  <div className="font-semibold">Check Out:</div>
                  <div>{formDataToConfirm.checkOut || "Not specified"}</div>
                  
                  <div className="font-semibold">Working Hours:</div>
                  <div>{formDataToConfirm.workHours || "-"} hrs</div>
                  
                  <div className="font-semibold">Status:</div>
                  <div>{formDataToConfirm.status}</div>
                  
                  <div className="font-semibold">Notes:</div>
                  <div>{formDataToConfirm.notes || "None"}</div>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setAddConfirmDialogOpen(false)} disabled={isAddingAttendance}>
              Cancel
            </Button>
            <LoadingButton 
              onClick={confirmAndSubmitAddAttendance} 
              loading={isAddingAttendance}
              loadingText="Adding..."
            >
              Confirm Add
            </LoadingButton>
          </div>
          {actionError && <div className="text-red-500 mt-2">{actionError}</div>}
        </DialogContent>
      </Dialog>
      
      {/* Edit Attendance Confirmation Dialog */}
      <Dialog open={editConfirmDialogOpen} onOpenChange={open => { setEditConfirmDialogOpen(open); if (!open) setFormDataToConfirm(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Edit Attendance</DialogTitle></DialogHeader>
          <div>
            <p>Please confirm that you want to update this attendance record:</p>
            {formDataToConfirm && (
              <div className="mt-4 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-md">
                  <div className="font-semibold">Employee:</div>
                  <div>{getEmployeeNameById(formDataToConfirm.employeeId)}</div>
                  
                  <div className="font-semibold">Date:</div>
                  <div>{new Date(formDataToConfirm.date).toLocaleDateString()}</div>
                  
                  <div className="font-semibold">Check In:</div>
                  <div>{formDataToConfirm.checkIn || "Not specified"}</div>
                  
                  <div className="font-semibold">Check Out:</div>
                  <div>{formDataToConfirm.checkOut || "Not specified"}</div>
                  
                  <div className="font-semibold">Working Hours:</div>
                  <div>{formDataToConfirm.workHours || "-"} hrs</div>
                  
                  <div className="font-semibold">Status:</div>
                  <div>{formDataToConfirm.status}</div>
                  
                  <div className="font-semibold">Notes:</div>
                  <div>{formDataToConfirm.notes || "None"}</div>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setEditConfirmDialogOpen(false)} disabled={isEditingAttendance}>
              Cancel
            </Button>
            <LoadingButton 
              onClick={confirmAndSubmitEditAttendance} 
              loading={isEditingAttendance}
              loadingText="Updating..."
            >
              Confirm Update
            </LoadingButton>
          </div>
          {actionError && <div className="text-red-500 mt-2">{actionError}</div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AttendanceForm({ employees, initial, onSubmit, onCancel, isLoading }: { employees: any[], initial?: any, onSubmit: (form: any) => void, onCancel: () => void, isLoading: boolean }) {
  // Helper to extract date (YYYY-MM-DD) and time (HH:mm) from ISO/local string
  function extractDate(dateTime: string) {
    if (!dateTime) return "";
    const d = new Date(dateTime);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function extractTime(dateTime: string) {
    if (!dateTime) return "";
    const d = new Date(dateTime);
    return d.toTimeString().slice(0,5); // HH:mm
  }
  // Helper to combine date and time into local date-time string (no UTC conversion)
  function combineDateAndTime(date: string, time: string) {
    if (!date || !time) return null;
    return `${date}T${time}`; // local time string
  }
  const [form, setForm] = useState({
    employeeId: initial?.employeeId || (employees[0]?.id ?? ""),
    date: initial?.date ? extractDate(initial.date) : "",
    checkIn: initial?.checkIn ? extractTime(initial.checkIn) : "",
    checkOut: initial?.checkOut ? extractTime(initial.checkOut) : "",
    status: initial?.status || "Present",
    notes: initial?.notes || "",
    id: initial?.id,
  });

  return (
    <form onSubmit={async e => {
      e.preventDefault();
      await onSubmit(form);
    }} className="space-y-4 w-full flex flex-col items-center">
      <div className="w-full">
        <label className="block text-sm font-medium mb-1">Employee</label>
        <select className="w-full border rounded px-2 py-2" value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} required disabled={!!initial}>
          {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.user?.name} ({emp.user?.email})</option>)}
        </select>
      </div>
      <div className="w-full">
        <label className="block text-sm font-medium mb-1">Date</label>
        <input type="date" className="w-full border rounded px-2 py-2" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
      </div>
      <div className="w-full flex flex-col gap-2">
        <div className="w-full">
          <label className="block text-sm font-medium mb-1">Check In</label>
          <input type="time" className="w-full border rounded px-2 py-2" value={form.checkIn} onChange={e => setForm(f => ({ ...f, checkIn: e.target.value }))} />
        </div>
        <div className="w-full">
          <label className="block text-sm font-medium mb-1">Check Out</label>
          <input type="time" className="w-full border rounded px-2 py-2" value={form.checkOut} onChange={e => setForm(f => ({ ...f, checkOut: e.target.value }))} />
        </div>
      </div>
      <div className="w-full">
        <label className="block text-sm font-medium mb-1">Status</label>
        <select className="w-full border rounded px-2 py-2" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} required>
          <option value="Present">Present</option>
          <option value="Late">Late</option>
          <option value="Absent">Absent</option>
        </select>
      </div>
      <div className="w-full">
        <label className="block text-sm font-medium mb-1">Notes</label>
        <textarea className="w-full border rounded px-2 py-2" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </div>
      <div className="flex justify-end gap-2 w-full">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isLoading}>{isLoading ? "Saving..." : "Save"}</Button>
      </div>
    </form>
  );
}