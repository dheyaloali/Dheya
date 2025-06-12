"use client"

import React from "react"
import { useState, useEffect, useRef } from "react"
import { ArrowUpDown, MoreHorizontal, Pencil, Trash2, UserCog, CheckCircle, PauseCircle, Search, BarChart2, FileText, CalendarCheck } from "lucide-react"
import Link from "next/link"
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { PaginationControls } from "@/components/pagination-controls";
import { useToast } from "@/components/ui/use-toast"
import useSWR from "swr";
import { Skeleton } from "@/components/ui/skeleton";
import { useSWRConfig } from "swr";

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { EmployeeForm } from "@/components/employee-form"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

const cityOptions = ["All", "Jakarta", "Surabaya", "Bandung"];
const positionOptions = [
  "All",
  "Sales Representative", "Account Manager", "Sales Manager", "Account Executive",
  "Marketing Specialist", "Marketing Manager", "Content Creator", "SEO Specialist",
  "Financial Analyst", "Accountant", "Finance Manager", "Payroll Specialist",
  "HR Specialist", "HR Manager", "Recruiter", "Training Coordinator",
  "Software Developer", "Systems Administrator", "IT Support", "IT Manager",
  "Operations Coordinator", "Operations Manager", "Logistics Specialist", "Supply Chain Manager"
];
const statusOptions = ["All", "active", "inactive"];

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error("Failed to fetch employees");
  return res.json();
});

function EmployeeTableSkeleton({ pageSize = 10 }: { pageSize?: number }) {
  return (
    <div>
      {/* Search/Filter Skeleton */}
      <div className="flex flex-wrap gap-2 items-center mb-6">
        <Skeleton className="h-8 w-80 rounded-full" />
        <Skeleton className="h-8 w-32 rounded" />
        <Skeleton className="h-8 w-32 rounded" />
        <Skeleton className="h-8 w-32 rounded" />
        <Skeleton className="h-8 w-40 rounded" />
        <Skeleton className="h-8 w-24 rounded" />
        <Skeleton className="h-8 w-32 rounded" />
      </div>
      {/* Table Skeleton */}
      <div className="rounded-md border max-h-[500px] overflow-y-auto w-full animate-pulse">
        <table className="w-full">
          <thead>
            <tr>
              <th className="w-[50px]"> </th>
              <th className="w-[80px]"> </th>
              <th>Employee</th>
              <th>City</th>
              <th>Position</th>
              <th>Status</th>
              <th>Join Date</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: pageSize }).map((_, i) => (
              <tr key={i}>
                <td><Skeleton className="h-5 w-5 rounded" /></td>
                <td><Skeleton className="h-5 w-12 rounded" /></td>
                <td>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div>
                      <Skeleton className="h-4 w-24 mb-1 rounded" />
                      <Skeleton className="h-3 w-32 rounded" />
                    </div>
                  </div>
                </td>
                <td><Skeleton className="h-4 w-20 rounded" /></td>
                <td><Skeleton className="h-4 w-28 rounded" /></td>
                <td><Skeleton className="h-4 w-16 rounded" /></td>
                <td><Skeleton className="h-4 w-20 rounded" /></td>
                <td className="text-right"><Skeleton className="h-4 w-16 rounded ml-auto" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function EmployeeTable({ search, setSearch }: { search: string, setSearch: (v: string) => void }) {
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [filterCity, setFilterCity] = useState("All");
  const [filterPosition, setFilterPosition] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterJoinDate, setFilterJoinDate] = useState("");
  const [editEmployee, setEditEmployee] = useState<any | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<any | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [employeeToToggleStatus, setEmployeeToToggleStatus] = useState<any | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [detailsEmployee, setDetailsEmployee] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsTab, setDetailsTab] = useState("profile");
  const [attendanceOpenGroups, setAttendanceOpenGroups] = useState<Record<string, boolean>>({});
  const [documentsOpenGroups, setDocumentsOpenGroups] = useState<Record<string, boolean>>({});
  const [attendanceFilter, setAttendanceFilter] = useState('This Month');
  const [documentTypeFilter, setDocumentTypeFilter] = useState('All Types');
  const [documentSearch, setDocumentSearch] = useState('');
  const profileRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { toast } = useToast();
  const { mutate } = useSWRConfig();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editConfirmDialogOpen, setEditConfirmDialogOpen] = useState(false);
  const [formDataToConfirm, setFormDataToConfirm] = useState<any>(null);

  // Build query string for SWR
  const queryParams = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  });
  if (search) queryParams.append("search", search);
  if (filterCity && filterCity !== "All") queryParams.append("city", filterCity);
  if (filterPosition && filterPosition !== "All") queryParams.append("position", filterPosition);
  if (filterStatus && filterStatus !== "All") queryParams.append("status", filterStatus);
  if (filterJoinDate) queryParams.append("joinDate", filterJoinDate);
  const swrKey = `/api/employees?${queryParams.toString()}`;

  const {
    data,
    error: swrError,
    isLoading,
  } = useSWR(swrKey, fetcher);

  const employees = data?.employees || [];
  const total = data?.total || 0;

  // Expand/collapse all helpers
  const expandAllAttendance = (groups: string[]) => setAttendanceOpenGroups(Object.fromEntries(groups.map(g => [g, true])));
  const collapseAllAttendance = (groups: string[]) => setAttendanceOpenGroups(Object.fromEntries(groups.map(g => [g, false])));
  const expandAllDocuments = (groups: string[]) => setDocumentsOpenGroups(Object.fromEntries(groups.map(g => [g, true])));
  const collapseAllDocuments = (groups: string[]) => setDocumentsOpenGroups(Object.fromEntries(groups.map(g => [g, false])));

  // Only one group open at a time
  const toggleAttendanceGroup = (month: string, allMonths: string[]) => {
    setAttendanceOpenGroups(prev => {
      const newState: Record<string, boolean> = {};
      allMonths.forEach(m => { newState[m] = false; });
      newState[month] = !prev[month];
      return newState;
    });
  };
  const toggleDocumentsGroup = (type: string, allTypes: string[]) => {
    setDocumentsOpenGroups(prev => {
      const newState: Record<string, boolean> = {};
      allTypes.forEach(t => { newState[t] = false; });
      newState[type] = !prev[type];
      return newState;
    });
  };

  const toggleSelectAll = () => {
    if (selectedEmployees.length === employees.length) {
      setSelectedEmployees([])
    } else {
      setSelectedEmployees(employees.map((employee: any) => employee.id))
    }
  }

  const toggleSelectEmployee = (id: string) => {
    if (selectedEmployees.includes(id)) {
      setSelectedEmployees(selectedEmployees.filter((employeeId: string) => employeeId !== id))
    } else {
      setSelectedEmployees([...selectedEmployees, id])
    }
  }

  // Add this function to handle status toggling
  const handleToggleStatus = async (employee: any) => {
    if (!employeeToToggleStatus) return;
    
    setIsTogglingStatus(true);
    const newStatus = (employeeToToggleStatus.user?.status?.toLowerCase() === "active") ? "Inactive" : "Active";
    
    try {
      const res = await fetch(`/api/employees/${employeeToToggleStatus.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (!res.ok) throw new Error("Failed to update status");
      
      toast({
        title: "Status Updated",
        description: `Employee status updated to ${newStatus}.`,
      });
      
      // More aggressive data revalidation
      await Promise.all([
        mutate(swrKey),
        mutate('/api/employees'),
        mutate((key) => typeof key === 'string' && key.includes('/api/employees'), undefined, { revalidate: true })
      ]);
      
      // Ensure the current page refreshes
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          mutate(swrKey);
        }, 500);
      }
      
      setStatusDialogOpen(false);
      setEmployeeToToggleStatus(null);
    } catch (err) {
      toast({
        title: "Status Update Failed",
        description: "Failed to update employee status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsTogglingStatus(false);
    }
  };

  // Edit form submit handler
  const handleEditSubmit = async (data: any) => {
    // Open confirmation dialog instead of submitting right away
    setFormDataToConfirm(data);
    setEditConfirmDialogOpen(true);
  };

  // Actual edit submission after confirmation
  const confirmAndSubmitEdit = async () => {
    if (!formDataToConfirm) return;
    
    setIsEditing(true);
    
    // Close dialogs immediately to improve perceived performance
    setEditConfirmDialogOpen(false);
    
    try {
      // Show early success toast for better user experience
      toast({
        title: "Updating Employee...",
        description: "Your changes are being processed.",
      });
      
      // Fire API request without awaiting it to improve UI responsiveness
      const updatePromise = fetch(`/api/employees/${editEmployee.id}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",  // Prevent caching
          "Pragma": "no-cache"
        },
        body: JSON.stringify({
          name: formDataToConfirm.name,
          email: formDataToConfirm.email,
          phoneNumber: formDataToConfirm.phoneNumber,
          city: formDataToConfirm.city,
          position: formDataToConfirm.position,
          joinDate: formDataToConfirm.startDate,
          status: formDataToConfirm.status,
        }),
      });
      
      // Close dialogs and clear state immediately without waiting for API
      setEditDialogOpen(false);
      setEditEmployee(null);
      setFormDataToConfirm(null);
      
      // Start data revalidation immediately (without waiting for API completion)
      mutate(swrKey);
      
      // Process API result in background
      updatePromise.then(res => {
        if (!res.ok) throw new Error("Failed to update employee");
        
        // Show success notification
      toast({
        title: "Employee Updated",
        description: "Employee details updated successfully.",
      });
        
        // Refresh data in background
        Promise.all([
          mutate(swrKey),
          mutate('/api/employees'),
          mutate((key) => typeof key === 'string' && key.includes('/api/employees'), undefined, { revalidate: true })
        ]);
      }).catch(err => {
        console.error("Update error:", err);
        toast({
          title: "Update May Have Failed",
          description: "Please check if your changes were saved correctly.",
          variant: "destructive",
        });
      }).finally(() => {
        setIsEditing(false);
      });
    } catch (err) {
      // This catch only handles errors in the setup process, not the API call
      toast({
        title: "Update Failed",
        description: "Failed to update employee. Please try again.",
        variant: "destructive",
      });
      setIsEditing(false);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (!employeeToDelete) return;
    
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/employees/${employeeToDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete employee");
      setDeleteDialogOpen(false);
      setEmployeeToDelete(null);
      toast({
        title: "Employee Deleted",
        description: "Employee deleted successfully.",
      });
      await mutate(swrKey);
    } catch (err) {
      toast({
        title: "Delete Failed",
        description: "Failed to delete employee. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Bulk delete handler
  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const res = await fetch("/api/employees/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedEmployees }),
      });
      if (!res.ok) throw new Error("Failed to bulk delete employees");
      setBulkDeleteDialogOpen(false);
      toast({
        title: "Employees Deleted",
        description: "Selected employees deleted successfully.",
      });
      await mutate(swrKey);
    } catch (err) {
      toast({
        title: "Bulk Delete Failed",
        description: "Failed to bulk delete employees. Please try again.",
        variant: "destructive",
      });
    } finally {
      setBulkDeleting(false);
    }
  };

  // Fetch full details when opening the modal
  const openDetailsModal = async (employee: any) => {
    setDetailsDialogOpen(true);
    setDetailsTab("profile");
    setDetailsLoading(true);
    setDetailsError(null);
    try {
      const res = await fetch(`/api/employees/${employee.id}/details`);
      if (!res.ok) throw new Error("Failed to fetch employee details");
      const data = await res.json();
      setDetailsEmployee(data.employee);
    } catch (err: any) {
      setDetailsError(err.message || "Failed to fetch employee details");
      setDetailsEmployee(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handlePrintProfile = async () => {
    if (!detailsEmployee) return;
    // Build a styled HTML string for the PDF (narrow, fixed width)
    const html = `
      <div style="font-family: Arial, sans-serif; color: #222; padding: 8px; width: 400px; font-size: 10px;">
        <div style="border-bottom: 2px solid #6366f1; padding-bottom: 6px; margin-bottom: 10px;">
          <h1 style="margin: 0; color: #4f46e5; font-size: 1.2rem;">${detailsEmployee.user?.name}</h1>
          <div style="font-size: 0.9rem; color: #555; margin-bottom: 2px;">${detailsEmployee.user?.email}</div>
          <div style="font-size: 0.85rem; color: #666;">${detailsEmployee.position} | ${detailsEmployee.city} | Status: ${detailsEmployee.user?.status}</div>
          <div style="font-size: 0.8rem; color: #888;">Joined: ${new Date(detailsEmployee.joinDate).toLocaleDateString()}</div>
        </div>
        <h2 style="color: #6366f1; border-bottom: 1px solid #e0e7ff; padding-bottom: 1px; font-size: 1rem;">Sales</h2>
        <table style="width: 380px; table-layout: fixed; border-collapse: collapse; margin-bottom: 8px; font-size: 9px;">
          <thead>
            <tr style="background: #f3f4f6; color: #374151;">
              <th style="padding: 2px; border: 1px solid #e5e7eb; word-break: break-word;">Date</th>
              <th style="padding: 2px; border: 1px solid #e5e7eb; word-break: break-word;">Amount</th>
              <th style="padding: 2px; border: 1px solid #e5e7eb; word-break: break-word;">Notes</th>
            </tr>
          </thead>
          <tbody>
            ${detailsEmployee.sales.map((sale: any, i: number) => `
              <tr style="background: ${i % 2 === 0 ? '#fff' : '#f9fafb'};">
                <td style="padding: 2px; border: 1px solid #e5e7eb; word-break: break-word;">${new Date(sale.date).toLocaleDateString()}</td>
                <td style="padding: 2px; border: 1px solid #e5e7eb; color: #10b981; font-weight: bold; word-break: break-word;">$${sale.amount}</td>
                <td style="padding: 2px; border: 1px solid #e5e7eb; word-break: break-word;">${sale.notes || ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <h2 style="color: #6366f1; border-bottom: 1px solid #e0e7ff; padding-bottom: 1px; font-size: 1rem;">Attendance</h2>
        <table style="width: 380px; table-layout: fixed; border-collapse: collapse; margin-bottom: 8px; font-size: 9px;">
          <thead>
            <tr style="background: #f3f4f6; color: #374151;">
              <th style="padding: 2px; border: 1px solid #e5e7eb; word-break: break-word;">Date</th>
              <th style="padding: 2px; border: 1px solid #e5e7eb; word-break: break-word;">Check-in</th>
              <th style="padding: 2px; border: 1px solid #e5e7eb; word-break: break-word;">Check-out</th>
              <th style="padding: 2px; border: 1px solid #e5e7eb; word-break: break-word;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${detailsEmployee.attendance.map((att: any, i: number) => `
              <tr style="background: ${i % 2 === 0 ? '#fff' : '#f9fafb'};">
                <td style="padding: 2px; border: 1px solid #e5e7eb; word-break: break-word;">${new Date(att.date).toLocaleDateString()}</td>
                <td style="padding: 2px; border: 1px solid #e5e7eb; word-break: break-word;">${att.checkIn ? new Date(att.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                <td style="padding: 2px; border: 1px solid #e5e7eb; word-break: break-word;">${att.checkOut ? new Date(att.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                <td style="padding: 2px; border: 1px solid #e5e7eb; word-break: break-word;">${att.status || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <h2 style="color: #6366f1; border-bottom: 1px solid #e0e7ff; padding-bottom: 1px; font-size: 1rem;">Documents</h2>
        <table style="width: 380px; table-layout: fixed; border-collapse: collapse; margin-bottom: 8px; font-size: 9px;">
          <thead>
            <tr style="background: #f3f4f6; color: #374151;">
              <th style="padding: 2px; border: 1px solid #e5e7eb; word-break: break-word;">Title</th>
              <th style="padding: 2px; border: 1px solid #e5e7eb; word-break: break-word;">Type</th>
              <th style="padding: 2px; border: 1px solid #e5e7eb; word-break: break-word;">Description</th>
              <th style="padding: 2px; border: 1px solid #e5e7eb; word-break: break-word;">Uploaded</th>
            </tr>
          </thead>
          <tbody>
            ${detailsEmployee.documents.map((doc: any, i: number) => `
              <tr style="background: ${i % 2 === 0 ? '#fff' : '#f9fafb'};">
                <td style="padding: 2px; border: 1px solid #e5e7eb; word-break: break-word;">${doc.title}</td>
                <td style="padding: 2px; border: 1px solid #e5e7eb; word-break: break-word;">${doc.type}</td>
                <td style="padding: 2px; border: 1px solid #e5e7eb; word-break: break-word;">${doc.description || ''}</td>
                <td style="padding: 2px; border: 1px solid #e5e7eb; word-break: break-word;">${doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    await pdf.html(html, {
      margin: [8, 8, 8, 8],
      autoPaging: 'text',
      x: 0,
      y: 0,
      width: 400,
      windowWidth: 400,
      html2canvas: { scale: 1 },
      callback: function (doc) {
        doc.save(`${detailsEmployee.user?.name}-profile.pdf`);
      }
    });
  };

  const handleDownloadExcel = () => {
    if (!detailsEmployee) return;
    // Personal Info sheet
    const personalInfo = [
      ["Name", detailsEmployee.user?.name],
      ["Email", detailsEmployee.user?.email],
      ["Phone Number", detailsEmployee.user?.phoneNumber || '-'],
      ["Position", detailsEmployee.position],
      ["City", detailsEmployee.city],
      ["Status", detailsEmployee.user?.status],
      ["Join Date", new Date(detailsEmployee.joinDate).toLocaleDateString()],
    ];
    // Sales sheet
    const salesSheet = [
      ["Date", "Amount", "Notes"],
      ...detailsEmployee.sales.map((sale: any) => [
        new Date(sale.date).toLocaleDateString(),
        sale.amount,
        sale.notes || ""
      ])
    ];
    // Attendance sheet
    const attendanceSheet = [
      ["Date", "Check-in", "Check-out", "Status"],
      ...detailsEmployee.attendance.map((att: any) => [
        new Date(att.date).toLocaleDateString(),
        att.checkIn ? new Date(att.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        att.checkOut ? new Date(att.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        att.status || "-"
      ])
    ];
    // Documents sheet
    const documentsSheet = [
      ["Title", "Type", "Description", "Uploaded"],
      ...detailsEmployee.documents.map((doc: any) => [
        doc.title,
        doc.type,
        doc.description || "",
        doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : ""
      ])
    ];
    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(personalInfo), "Personal Info");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(salesSheet), "Sales");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(attendanceSheet), "Attendance");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(documentsSheet), "Documents");
    // Download
    XLSX.writeFile(wb, `${detailsEmployee.user?.name.replace(/\s+/g, '_')}_profile.xlsx`);
  };

  if (isLoading) {
    return <EmployeeTableSkeleton pageSize={pageSize} />;
  }

  if (swrError) {
    return <div className="p-8 text-center text-red-600">{swrError.message}</div>;
  }

  return (
    <div>
      <Dialog open={open} onOpenChange={setOpen}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-4 w-full">
          <div className="flex flex-wrap gap-2 items-center mb-6">
            <label className="text-sm mr-1" htmlFor="filter-city">City</label>
            <select id="filter-city" value={filterCity} onChange={e => { setFilterCity(e.target.value); setPage(1); }} className="border rounded px-1.5 py-1 text-sm h-8">
              {cityOptions.map(city => <option key={city} value={city}>{city}</option>)}
            </select>
            <label className="text-sm ml-2 mr-1" htmlFor="filter-position">Position</label>
            <select id="filter-position" value={filterPosition} onChange={e => { setFilterPosition(e.target.value); setPage(1); }} className="border rounded px-1.5 py-1 text-sm h-8">
              {positionOptions.map(pos => <option key={pos} value={pos}>{pos}</option>)}
            </select>
            <label className="text-sm ml-2 mr-1" htmlFor="filter-status">Status</label>
            <select id="filter-status" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className="border rounded px-1.5 py-1 text-sm h-8">
              {statusOptions.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
            <label className="text-sm ml-2 mr-1" htmlFor="filter-joindate">Join Date</label>
            <input
              id="filter-joindate"
              type="date"
              value={filterJoinDate}
              onChange={e => { setFilterJoinDate(e.target.value); setPage(1); }}
              className="border rounded px-1.5 py-1 text-sm h-8"
              placeholder="Join Date"
            />
            <Button variant="outline" size="sm" className="h-8 px-3" onClick={() => { setFilterCity("All"); setFilterPosition("All"); setFilterStatus("All"); setFilterJoinDate(""); setPage(1); }}>
              Reset Filters
            </Button>
            <DialogTrigger asChild>
              <Button onClick={() => setOpen(true)} size="sm" className="h-8 px-3">
                + Add Employee
              </Button>
            </DialogTrigger>
          </div>
        </div>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
          </DialogHeader>
          <EmployeeForm onSuccess={async () => { setOpen(false); await mutate(swrKey); }} />
        </DialogContent>
      </Dialog>
      <div className="rounded-md border max-h-[500px] overflow-y-auto w-full">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedEmployees.length === employees.length && employees.length > 0}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select All"
                />
              </TableHead>
              <TableHead className="w-[80px]">ID</TableHead>
              <TableHead>
                <div className="flex items-center">
                  Employee
                  <Button variant="ghost" size="sm" className="ml-1 h-8 p-0">
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </div>
              </TableHead>
              <TableHead>City</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <div className="flex items-center">
                  Join Date
                  <Button variant="ghost" size="sm" className="ml-1 h-8 p-0">
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </div>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center">No employees found.</TableCell>
              </TableRow>
            ) : (
              employees.map((employee: any) => (
              <TableRow key={employee.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedEmployees.includes(employee.id)}
                    onCheckedChange={() => toggleSelectEmployee(employee.id)}
                  />
                </TableCell>
                <TableCell className="font-medium">{employee.id}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage
                        src={`/abstract-geometric-shapes.png?height=36&width=36&query=${employee.user?.name ?? ""}`}
                        alt={employee.user?.name ?? ""}
                      />
                      <AvatarFallback>
                        {(employee.user?.name ?? "")
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{employee.user?.name}</div>
                      <div className="text-sm text-muted-foreground">{employee.user?.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{employee.city}</TableCell>
                <TableCell>{employee.position}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      (employee.user?.status?.toLowerCase() === "active")
                        ? "default"
                        : (employee.user?.status?.toLowerCase() === "on leave")
                          ? "outline"
                          : "destructive"
                    }
                  >
                    {(employee.user?.status?.charAt(0).toUpperCase() || "") + (employee.user?.status?.slice(1).toLowerCase() || "")}
                  </Badge>
                </TableCell>
                <TableCell>{new Date(employee.joinDate).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => openDetailsModal(employee)}>
                          <UserCog className="mr-2 h-4 w-4" />
                          <span>View Details</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <button
                          className="flex items-center w-full"
                          onClick={() => {
                            setEditEmployee(employee);
                            setEditDialogOpen(true);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          <span>Edit</span>
                        </button>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { 
                        setEmployeeToToggleStatus(employee); 
                        setStatusDialogOpen(true); 
                      }}>
                        {employee.user?.status?.toLowerCase() === "active" ? (
                          <PauseCircle className="mr-2 h-4 w-4 text-muted-foreground" />
                        ) : (
                          <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                        )}
                        <span>
                          {employee.user?.status === "Active" ? "Deactivate" : "Activate"}
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600" onClick={() => { setEmployeeToDelete(employee); setDeleteDialogOpen(true); }}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>Delete</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4 mt-6">
        <div className="text-sm text-muted-foreground">
          {selectedEmployees.length} of {employees.length} row(s) selected.
        </div>
      </div>
      {/* Edit Employee Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={open => { setEditDialogOpen(open); if (!open) setEditEmployee(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
          </DialogHeader>
          {editEmployee && (
            <EditEmployeeForm
              employee={editEmployee}
              onSuccess={async () => {
                setEditDialogOpen(false);
                setEditEmployee(null);
                await mutate(swrKey);
              }}
              onSubmit={handleEditSubmit}
            />
          )}
        </DialogContent>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={open => { setDeleteDialogOpen(open); if (!open) setEmployeeToDelete(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <div>Are you sure you want to delete this employee? This action cannot be undone.</div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete} 
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Bulk Delete Button */}
      {selectedEmployees.length > 0 && (
        <div className="mb-2 flex justify-end">
          <Button
            variant="destructive"
            size="sm"
            className="h-8 px-3"
            onClick={() => setBulkDeleteDialogOpen(true)}
          >
            Delete Selected ({selectedEmployees.length})
          </Button>
        </div>
      )}
      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Bulk Delete</DialogTitle>
          </DialogHeader>
          <div>Are you sure you want to delete the selected employees? This action cannot be undone.</div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setBulkDeleteDialogOpen(false)} disabled={bulkDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? "Deleting..." : `Delete (${selectedEmployees.length})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Status Toggle Confirmation Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={open => { setStatusDialogOpen(open); if (!open) setEmployeeToToggleStatus(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Status Change</DialogTitle>
          </DialogHeader>
          <div>
            {employeeToToggleStatus && (
              <>
                Are you sure you want to {employeeToToggleStatus.user?.status?.toLowerCase() === "active" ? "deactivate" : "activate"} this employee?
                {employeeToToggleStatus.user?.status?.toLowerCase() === "active" && (
                  <p className="text-amber-600 mt-2">
                    Deactivating will prevent the employee from logging in and using the system.
                  </p>
                )}
              </>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)} disabled={isTogglingStatus}>Cancel</Button>
            <Button 
              variant={employeeToToggleStatus?.user?.status?.toLowerCase() === "active" ? "destructive" : "default"}
              onClick={handleToggleStatus} 
              disabled={isTogglingStatus}
            >
              {isTogglingStatus ? "Updating..." : employeeToToggleStatus?.user?.status?.toLowerCase() === "active" ? "Deactivate" : "Activate"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Edit Confirmation Dialog */}
      <Dialog open={editConfirmDialogOpen} onOpenChange={open => { setEditConfirmDialogOpen(open); if (!open) setFormDataToConfirm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Employee Update</DialogTitle>
          </DialogHeader>
          <div>
            Are you sure you want to update this employee's information? Please review the changes before confirming.
            {formDataToConfirm && (
              <div className="mt-4 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-md">
                  <div className="font-semibold">Name:</div>
                  <div>{formDataToConfirm.name}</div>
                  <div className="font-semibold">Email:</div>
                  <div>{formDataToConfirm.email}</div>
                  <div className="font-semibold">Phone Number:</div>
                  <div>{formDataToConfirm.phoneNumber || '-'}</div>
                  <div className="font-semibold">Position:</div>
                  <div>{formDataToConfirm.position}</div>
                  <div className="font-semibold">City:</div>
                  <div>{formDataToConfirm.city}</div>
                  <div className="font-semibold">Status:</div>
                  <div>{formDataToConfirm.status}</div>
                  <div className="font-semibold">Join Date:</div>
                  <div>{new Date(formDataToConfirm.startDate).toLocaleDateString()}</div>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setEditConfirmDialogOpen(false)} disabled={isEditing}>
              Cancel
            </Button>
            <Button 
              onClick={confirmAndSubmitEdit} 
              disabled={isEditing}
            >
              {isEditing ? "Updating..." : "Confirm Update"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* View Details Modal */}
      <Dialog open={detailsDialogOpen} onOpenChange={open => { setDetailsDialogOpen(open); if (!open) setDetailsEmployee(null); }}>
        <DialogContent className="max-w-4xl w-full max-h-[90vh] p-0 overflow-y-auto bg-white rounded-2xl shadow-2xl border-0">
          <DialogHeader className="px-10 pt-10 pb-2">
            <DialogTitle className="text-2xl font-bold tracking-tight">Employee Details</DialogTitle>
          </DialogHeader>
          <div className="px-10 pb-10" ref={profileRef}>
            {detailsLoading ? (
              <div className="flex flex-col md:flex-row gap-10 w-full animate-pulse">
                {/* Profile Section Skeleton */}
                <div className="md:w-1/3 w-full flex flex-col items-center md:items-start gap-6 border-r border-gray-200 pr-0 md:pr-8 mb-8 md:mb-0">
                  <Skeleton className="h-28 w-28 rounded-full mb-4" />
                  <div className="flex flex-col items-center md:items-start gap-1 w-full">
                    <Skeleton className="h-6 w-40 mb-2" />
                    <Skeleton className="h-4 w-32 mb-2" />
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 w-full text-sm mt-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <React.Fragment key={i}>
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-32" />
                      </React.Fragment>
                    ))}
                  </div>
                </div>
                {/* Activity Section Skeleton */}
                <div className="md:w-2/3 w-full flex flex-col gap-8">
                  {/* Sales Section Skeleton */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-8 w-24" />
                    </div>
                    <ul className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <li key={i} className="flex gap-4 items-center">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-4 w-24" />
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* Attendance Section Skeleton */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-8 w-32" />
                    </div>
                    <ul className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <li key={i} className="flex gap-4 items-center">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-4 w-16" />
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* Documents Section Skeleton */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-8 w-32" />
                    </div>
                    <div className="flex gap-2 mb-3">
                      <Skeleton className="h-8 w-32" />
                      <Skeleton className="h-8 w-48" />
                    </div>
                    <ul className="space-y-2">
                      {Array.from({ length: 2 }).map((_, i) => (
                        <li key={i} className="flex gap-4 items-center">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-4 w-24" />
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : detailsError ? (
              <div className="p-12 text-center text-red-600 text-lg">{detailsError}</div>
            ) : detailsEmployee && (
              <div className="flex flex-col md:flex-row gap-10 w-full">
                {/* Profile Section */}
                <div className="md:w-1/3 w-full flex flex-col items-center md:items-start gap-6 border-r border-gray-200 pr-0 md:pr-8 mb-8 md:mb-0">
                  <Avatar className="h-28 w-28 shadow-lg border-4 border-white -mt-2">
                    <AvatarImage
                      src={`/abstract-geometric-shapes.png?height=112&width=112&query=${detailsEmployee.user?.name ?? ""}`}
                      alt={detailsEmployee.user?.name ?? ""}
                    />
                    <AvatarFallback className="text-3xl">
                      {(detailsEmployee.user?.name ?? "")
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-center md:items-start gap-1 w-full">
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-semibold">{detailsEmployee.user?.name}</span>
                      <Badge
                        variant={
                          detailsEmployee.user?.status?.toLowerCase() === "active"
                            ? "default"
                            : detailsEmployee.user?.status?.toLowerCase() === "on leave"
                              ? "outline"
                              : "destructive"
                        }
                        className="text-xs px-2 py-0.5 rounded-full"
                      >
                        {(detailsEmployee.user?.status?.charAt(0).toUpperCase() || "") + (detailsEmployee.user?.status?.slice(1).toLowerCase() || "")}
                      </Badge>
                    </div>
                    <span className="text-muted-foreground text-sm mb-2">{detailsEmployee.user?.email}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 w-full text-sm mt-2">
                    <div className="text-muted-foreground">Phone Number</div>
                    <div>{detailsEmployee.user?.phoneNumber || '-'}</div>
                    <div className="text-muted-foreground">City</div>
                    <div>{detailsEmployee.city}</div>
                    <div className="text-muted-foreground">Position</div>
                    <div>{detailsEmployee.position}</div>
                    <div className="text-muted-foreground">Join Date</div>
                    <div>{new Date(detailsEmployee.joinDate).toLocaleDateString()}</div>
                    <div className="text-muted-foreground">ID</div>
                    <div>{detailsEmployee.id}</div>
                    <div className="text-muted-foreground">Account Created</div>
                    <div>{new Date(detailsEmployee.user?.createdAt).toLocaleDateString()}</div>
                    <div className="text-muted-foreground">User State</div>
                    <div>{detailsEmployee.user?.state || "-"}</div>
                  </div>
                </div>
                {/* Activity Section */}
                <div className="md:w-2/3 w-full flex flex-col gap-8">
                  <div className="flex flex-col gap-6">
                    {/* Sales Section */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-lg font-semibold">
                          <BarChart2 className="h-5 w-5 text-primary" /> Sales
                          <span className="text-muted-foreground text-sm font-normal">({detailsEmployee.sales.length})</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => router.push(`/sales?employeeId=${detailsEmployee.id}`)}>
                          View All Sales
                        </Button>
                      </div>
                      <ul className="text-sm pl-0 space-y-1 max-h-[300px] overflow-y-scroll pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                        {detailsEmployee.sales.length === 0 ? (
                          <li className="text-muted-foreground italic">No sales records.</li>
                        ) : detailsEmployee.sales.map((sale: any) => (
                          <li key={sale.id} className="flex justify-between items-center border-b last:border-b-0 py-1">
                            <span className="font-medium">${sale.amount}</span>
                            <span className="text-muted-foreground text-sm">{new Date(sale.date).toLocaleDateString()}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Attendance Section */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-lg font-semibold">
                          <CalendarCheck className="h-5 w-5 text-primary" /> Attendance
                          <span className="text-muted-foreground text-sm font-normal">({detailsEmployee.attendance.length})</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => router.push(`/admin/attendance?employeeId=${detailsEmployee.id}`)}>
                          View All Attendance
                        </Button>
                      </div>
                      <div className="max-h-[300px] overflow-y-scroll pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                        {(() => {
                          const filteredAttendance = detailsEmployee.attendance.filter((att: any) => {
                            const now = new Date();
                            const attDate = new Date(att.date);
                            if (attendanceFilter === 'This Month') {
                              return attDate.getMonth() === now.getMonth() && attDate.getFullYear() === now.getFullYear();
                            } else if (attendanceFilter === 'Last Month') {
                              const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                              return attDate.getMonth() === lastMonth.getMonth() && attDate.getFullYear() === lastMonth.getFullYear();
                            } else if (attendanceFilter === 'Last 3 Months') {
                              const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                              return attDate >= threeMonthsAgo && attDate <= now;
                            }
                            return true;
                          });
                          const groups = Object.entries(
                            filteredAttendance.reduce((acc: Record<string, any[]>, att: any) => {
                              const month = new Date(att.date).toLocaleString('default', { month: 'long', year: 'numeric' });
                              if (!acc[month]) acc[month] = [];
                              acc[month].push(att);
                              return acc;
                            }, {})
                          ) as [string, any[]][];
                          const allMonths = groups.map(([month]) => month);
                          return groups.map(([month, records]: [string, any[]]) => (
                            <div key={month} className="mb-4 border rounded bg-gray-50">
                              <button
                                type="button"
                                className="w-full flex items-center justify-between px-3 py-2 font-medium text-sm hover:bg-gray-100 focus:outline-none"
                                onClick={() => toggleAttendanceGroup(month, allMonths)}
                              >
                                <span>{month}</span>
                                <span className={`transition-transform ${attendanceOpenGroups[month] ? 'rotate-90' : ''}`}>▶</span>
                              </button>
                              {attendanceOpenGroups[month] && (
                                <div className="px-3 pb-2">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs text-muted-foreground">{records.length} records</span>
                                  </div>
                                  <ul className="text-sm pl-0 space-y-1">
                                    {records.map((att: any) => (
                                      <li key={att.id} className="flex items-center gap-2 border-b last:border-b-0 py-1">
                                        <span className="font-medium">{new Date(att.date).toLocaleDateString()}</span>
                                        <span className="text-muted-foreground text-sm">
                                          {att.checkIn ? new Date(att.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                          {' - '}
                                          {att.checkOut ? new Date(att.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                        </span>
                                        <span className="text-muted-foreground">{att.status || "-"}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          ));
                        })()}
                      </div>
                    </div>

                    {/* Documents Section */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-lg font-semibold">
                          <FileText className="h-5 w-5 text-primary" /> Documents
                          <span className="text-muted-foreground text-sm font-normal">({detailsEmployee.documents.length})</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => router.push(`/admin/documents?employeeId=${detailsEmployee.id}`)}>
                          View All Documents
                        </Button>
                      </div>
                      <div className="flex gap-2 mb-3">
                        <select className="text-sm border rounded px-2 py-1" value={documentTypeFilter} onChange={e => setDocumentTypeFilter(e.target.value)}>
                          <option>All Types</option>
                          <option>ID Proof</option>
                          <option>Certificates</option>
                          <option>Contracts</option>
                          <option>Reports</option>
                          <option>Other</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Search documents..."
                          className="text-sm border rounded px-2 py-1 flex-1"
                          value={documentSearch}
                          onChange={e => setDocumentSearch(e.target.value)}
                        />
                      </div>
                      <div className="max-h-[300px] overflow-y-scroll pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                        {(() => {
                          const normalize = (str: string) => str.trim().toLowerCase().replace(/s$/, '');
                          const filteredDocuments = detailsEmployee.documents.filter((doc: any) => {
                            const typeMatch = documentTypeFilter === 'All Types' || normalize(doc.type) === normalize(documentTypeFilter);
                            const searchMatch = documentSearch === '' || doc.title.toLowerCase().includes(documentSearch.toLowerCase());
                            return typeMatch && searchMatch;
                          });
                          const groups = Object.entries(
                            filteredDocuments.reduce((acc: Record<string, any[]>, doc: any) => {
                              if (!acc[doc.type]) acc[doc.type] = [];
                              acc[doc.type].push(doc);
                              return acc;
                            }, {})
                          ) as [string, any[]][];
                          const allTypes = groups.map(([type]) => type);
                          return groups.map(([type, docs]: [string, any[]]) => (
                            <div key={type} className="mb-4 border rounded bg-gray-50">
                              <button
                                type="button"
                                className="w-full flex items-center justify-between px-3 py-2 font-medium text-sm hover:bg-gray-100 focus:outline-none"
                                onClick={() => toggleDocumentsGroup(type, allTypes)}
                              >
                                <span className="capitalize">{type}</span>
                                <span className={`transition-transform ${documentsOpenGroups[type] ? 'rotate-90' : ''}`}>▶</span>
                              </button>
                              {documentsOpenGroups[type] && (
                                <div className="px-3 pb-2">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs text-muted-foreground">{docs.length} documents</span>
                                  </div>
                                  <ul className="text-sm pl-0 space-y-1">
                                    {docs.map((doc: any) => (
                                      <li key={doc.id} className="flex items-center gap-2 border-b last:border-b-0 py-1">
                                        <span className="font-medium">{doc.title}</span>
                                        <span className="text-muted-foreground">({doc.type})</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* Print Profile as PDF Button */}
          <div className="flex justify-end mt-6 px-10 pb-6 gap-2">
            <Button variant="outline" onClick={handlePrintProfile}>
              Print Profile as PDF
            </Button>
            <Button variant="outline" onClick={handleDownloadExcel}>
              Download as Excel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <PaginationControls
        page={page}
        setPage={setPage}
        totalPages={Math.ceil(total / pageSize)}
        pageSize={pageSize}
        setPageSize={setPageSize}
        total={total}
        from={total === 0 ? 0 : (page - 1) * pageSize + 1}
        to={Math.min(page * pageSize, total)}
      />
    </div>
  )
}

function EditEmployeeForm({ employee, onSuccess, onSubmit }: { employee: any, onSuccess: () => void, onSubmit: (data: any) => void }) {
  const initialName = employee.user?.name || "";
  const initialEmail = employee.user?.email || "";
  const [form, setForm] = useState({
    name: initialName,
    email: initialEmail,
    phoneNumber: employee.user?.phoneNumber || "",
    city: employee.city || "",
    position: employee.position || "",
    startDate: employee.joinDate ? new Date(employee.joinDate).toISOString().slice(0, 10) : "",
    status: employee.user?.status || "Active",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real-time feedback state
  const [uniqueStatus, setUniqueStatus] = useState({
    name: { loading: false, available: true, message: "" },
    email: { loading: false, available: true, message: "" }
  });
  // Track if user has interacted with name/email fields
  const [touched, setTouched] = useState({ name: false, email: false });
  // Track if user has changed the value from the initial value
  const [dirty, setDirty] = useState({ name: false, email: false });

  // List of valid Indonesian mobile prefixes (not exhaustive)
  const validPrefixes = [
    '+62811', '+62812', '+62813', '+62821', '+62822', '+62823', // Telkomsel
    '+62851', '+62852', '+62853', // Telkomsel
    '+62814', '+62815', '+62816', '+62855', '+62856', '+62857', '+62858', // Indosat
    '+62817', '+62818', '+62819', '+62859', '+62877', '+62878', // XL
    '+62831', '+62832', '+62833', '+62838', // Axis
    '+62881', '+62882', '+62883', '+62884', '+62885', '+62886', '+62887', '+62888', '+62889', // Smartfren
    '+62895', '+62896', '+62897', '+62898', '+62899', // Three
  ];
  function isValidIndonesianMobileNumber(number: string) {
    if (!/^\+62\d{9,13}$/.test(number)) return false;
    return validPrefixes.some(prefix => number.startsWith(prefix));
  }

  // Helper to check uniqueness with status update
  const handleUniqueCheck = async (field: "name" | "email", value: string) => {
    setUniqueStatus(prev => ({
      ...prev,
      [field]: { ...prev[field], loading: true, message: "Checking..." }
    }));
    if (!value) {
      setUniqueStatus(prev => ({
        ...prev,
        [field]: { ...prev[field], loading: false, available: true, message: "" }
      }));
      return;
    }
    // Don't check if value is unchanged from original
    if (value === (field === "name" ? employee.user?.name : employee.user?.email)) {
      setUniqueStatus(prev => ({
        ...prev,
        [field]: { ...prev[field], loading: false, available: true, message: "" }
      }));
      return;
    }
    const res = await fetch("/api/check-unique", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field, value }),
    });
    const data = await res.json();
    setUniqueStatus(prev => ({
      ...prev,
      [field]: {
        loading: false,
        available: data.available,
        message: data.available ? "" : (field === "name" ? "Name already exists" : "Email already exists")
      }
    }));
    if (!data.available) {
      setError(data.message || (field === "name" ? "Name already exists" : "Email already exists"));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: name === 'phoneNumber' ? value.replace(/\s+/g, '') : value });
    if (name === "name" || name === "email") {
      setTouched(t => ({ ...t, [name]: true }));
      setDirty(d => ({ ...d, [name]: value !== (name === "name" ? initialName : initialEmail) }));
      handleUniqueCheck(name as "name" | "email", value);
    }
  };
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "name" || name === "email") {
      setTouched(t => ({ ...t, [name]: true }));
      setDirty(d => ({ ...d, [name]: value !== (name === "name" ? initialName : initialEmail) }));
      handleUniqueCheck(name as "name" | "email", value);
    }
  };

  // Real-time phone number feedback
  const value = form.phoneNumber || "";
  const isFormatValid = /^\+62\d{9,13}$/.test(value);
  const isRealNumber = isFormatValid && isValidIndonesianMobileNumber(value);
  let phoneMessage = '';
  if (!isFormatValid && value) {
    phoneMessage = 'Invalid phone number format. Example: +628123456789';
  } else if (isFormatValid && !isRealNumber) {
    phoneMessage = 'Invalid phone number. Please enter a real Indonesian mobile number, e.g., +628123456789';
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // Validate Indonesian phone number format and real number
    const trimmedPhone = form.phoneNumber.replace(/\s+/g, '');
    if (!/^\+62\d{9,13}$/.test(trimmedPhone)) {
      setError("Phone number must be in Indonesian format: +62xxxxxxxxxxx");
      return;
    }
    if (!isValidIndonesianMobileNumber(trimmedPhone)) {
      setError("Invalid phone number. Please enter a real Indonesian mobile number, e.g., +628123456789");
      return;
    }
    if (!uniqueStatus.name.available) {
      setError("Name already exists");
      return;
    }
    if (!uniqueStatus.email.available) {
      setError("Email already exists");
      return;
    }
    onSubmit({ ...form, phoneNumber: trimmedPhone });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="text-red-600 text-center mb-2">{error}</div>}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input name="name" value={form.name} onChange={handleChange} onBlur={handleBlur} className="w-full border rounded px-2 py-2" required />
            {dirty.name && touched.name && uniqueStatus.name.loading && (
              <span className="block text-xs text-blue-500 mt-1">Checking...</span>
            )}
            {dirty.name && touched.name && !uniqueStatus.name.loading && form.name && (
              <span className={`block text-xs mt-1 ${uniqueStatus.name.available ? 'text-green-500' : 'text-red-500'}`}>{uniqueStatus.name.available ? 'Available' : 'Not available'}</span>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input name="email" type="email" value={form.email} onChange={handleChange} onBlur={handleBlur} className="w-full border rounded px-2 py-2" required />
            {dirty.email && touched.email && uniqueStatus.email.loading && (
              <span className="block text-xs text-blue-500 mt-1">Checking...</span>
            )}
            {dirty.email && touched.email && !uniqueStatus.email.loading && form.email && (
              <span className={`block text-xs mt-1 ${uniqueStatus.email.available ? 'text-green-500' : 'text-red-500'}`}>{uniqueStatus.email.available ? 'Available' : 'Not available'}</span>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone Number</label>
            <input name="phoneNumber" value={form.phoneNumber} onChange={handleChange} className="w-full border rounded px-2 py-2" placeholder="+6281234567890" required />
            {form.phoneNumber && (
              <span className={`block text-xs mt-1 ${isRealNumber ? 'text-green-500' : 'text-red-500'}`}>{isRealNumber ? 'Valid' : phoneMessage}</span>
            )}
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">City</label>
            <select name="city" value={form.city} onChange={handleChange} className="w-full border rounded px-2 py-2" required>
              <option value="">Select city</option>
              <option value="Jakarta">Jakarta</option>
              <option value="Surabaya">Surabaya</option>
              <option value="Bandung">Bandung</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Position</label>
            <select name="position" value={form.position} onChange={handleChange} className="w-full border rounded px-2 py-2" required>
              <option value="">Select position</option>
              <option value="Sales Representative">Sales Representative</option>
              <option value="Account Manager">Account Manager</option>
              <option value="Sales Manager">Sales Manager</option>
              <option value="Account Executive">Account Executive</option>
              <option value="Marketing Specialist">Marketing Specialist</option>
              <option value="Marketing Manager">Marketing Manager</option>
              <option value="Content Creator">Content Creator</option>
              <option value="SEO Specialist">SEO Specialist</option>
              <option value="Financial Analyst">Financial Analyst</option>
              <option value="Accountant">Accountant</option>
              <option value="Finance Manager">Finance Manager</option>
              <option value="Payroll Specialist">Payroll Specialist</option>
              <option value="HR Specialist">HR Specialist</option>
              <option value="HR Manager">HR Manager</option>
              <option value="Recruiter">Recruiter</option>
              <option value="Training Coordinator">Training Coordinator</option>
              <option value="Software Developer">Software Developer</option>
              <option value="Systems Administrator">Systems Administrator</option>
              <option value="IT Support">IT Support</option>
              <option value="IT Manager">IT Manager</option>
              <option value="Operations Coordinator">Operations Coordinator</option>
              <option value="Operations Manager">Operations Manager</option>
              <option value="Logistics Specialist">Logistics Specialist</option>
              <option value="Supply Chain Manager">Supply Chain Manager</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select name="status" value={form.status} onChange={handleChange} className="w-full border rounded px-2 py-2" required>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Join Date</label>
            <input name="startDate" type="date" value={form.startDate} onChange={handleChange} className="w-full border rounded px-2 py-2" required />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button type="button" variant="outline" onClick={() => onSuccess()}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading || !uniqueStatus.name.available || !uniqueStatus.email.available || !isRealNumber}>
        {loading ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}

export function EmployeeTableSearchInput({ search, setSearch }: { search: string, setSearch: (v: string) => void }) {
  return (
    <div className="relative w-full md:w-80">
      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        <Search className="h-4 w-4 text-muted-foreground" />
      </span>
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search employees..."
        className="w-full pl-10 pr-4 py-2 rounded-full border border-gray-300 bg-gray-50 focus:bg-white focus:border-primary focus:outline-none transition-colors"
      />
    </div>
  );
}
