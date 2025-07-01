"use client"
// ... existing imports
import * as XLSX from 'xlsx';
import { redirect } from "next/navigation"
import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableCell, TableHead, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Spinner } from "@/components/ui/spinner"
import { SalaryTrendsChart } from "@/components/charts/salary-trends-chart"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown, Check, X } from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import useSWR, { mutate } from 'swr';
import { Skeleton } from '@/components/ui/skeleton';
import { adminFetcher, fetchWithCSRF } from '@/lib/admin-api-client';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationFirst,
  PaginationPrevious,
  PaginationNext,
  PaginationLast,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { getAvatarImage, getAvatarInitials } from "@/lib/avatar-utils"
import { useCurrency } from "@/components/providers/currency-provider";

function extractRelevantFields(obj: any) {
  if (!obj) return {};
  const fields = [
    'amount', 'status', 'payDate', 'startDate', 'endDate', 'createdAt', 'updatedAt'
  ];
  let result: Record<string, any> = {};
  for (const key of fields) {
    if (obj[key] !== undefined) result[key] = obj[key];
  }
  if (obj.metadata && typeof obj.metadata === 'object') {
    for (const [k, v] of Object.entries(obj.metadata)) {
      result[`metadata.${k}`] = v;
    }
  }
  return result;
}

function getChangedFields(oldValue: any, newValue: any) {
  const oldFields = extractRelevantFields(oldValue);
  const newFields = extractRelevantFields(newValue);
  const allKeys = Array.from(new Set([...Object.keys(oldFields), ...Object.keys(newFields)]));
  return allKeys
    .filter(key => oldFields[key] !== newFields[key])
    .map(key => ({
      field: key,
      old: oldFields[key],
      new: newFields[key],
    }));
}

export default function SalariesPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [trendsData, setTrendsData] = useState<any[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<any>(null);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [salaryStatusFilter, setSalaryStatusFilter] = useState("");
  const [employmentStatusFilter, setEmploymentStatusFilter] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [employees, setEmployees] = useState<any[]>([]);
  const [salaryPreview, setSalaryPreview] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState("");
  const [processSuccess, setProcessSuccess] = useState("");
  const [employeeSales, setEmployeeSales] = useState<any[]>([]);
  const [employeeAttendance, setEmployeeAttendance] = useState<any[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [editFields, setEditFields] = useState({
    baseSalary: 0,
    bonusPercent: 5,
    overtimeRate: 20,
    undertimeDeduction: 15,
    absenceDeduction: 50,
    salesTotal: 0,
    totalWorkedHours: 0,
    absentDays: 0,
  });
  const [editSalary, setEditSalary] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [deleteSalaryId, setDeleteSalaryId] = useState<number|null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [currentMonthPage, setCurrentMonthPage] = useState(1);
  const [currentMonthPageSize, setCurrentMonthPageSize] = useState(25);
  const [currentMonthSalaries, setCurrentMonthSalaries] = useState<any[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingSalary, setIsEditingSalary] = useState(false);
  const [isFormChanged, setIsFormChanged] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showEmployeeSelector, setShowEmployeeSelector] = useState(false);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("");
  const [fieldErrors, setFieldErrors] = useState({
    baseSalary: '',
    totalWorkedHours: '',
    salesTotal: '',
    bonusPercent: '',
    overtimeRate: '',
    undertimeDeduction: '',
    absenceDeduction: '',
    absentDays: '',
  });
  // Add touched state for each editable field
  const [touched, setTouched] = useState({
    baseSalary: false,
    bonusPercent: false,
    overtimeRate: false,
    undertimeDeduction: false,
    absenceDeduction: false,
  });
  const { formatAmount } = useCurrency();

  // Add the missing handleEditField function
  const handleEditField = (field: string, value: string) => {
    // Convert value to number and validate
    const numValue = Number(value);
    
    // Update the field value
    setEditFields(prev => ({
      ...prev,
      [field]: numValue
    }));
    
    // Mark field as touched
    if (field in touched) {
      setTouched(prev => ({
        ...prev,
        [field]: true
      }));
    }
    
    // Validate the field
    let error = '';
    if (field === 'baseSalary' && (isNaN(numValue) || numValue < 0)) {
      error = 'Base salary must be a positive number';
    } else if (field === 'bonusPercent' && (isNaN(numValue) || numValue < 0 || numValue > 100)) {
      error = 'Bonus percent must be between 0 and 100';
    } else if ((field === 'overtimeRate' || field === 'undertimeDeduction' || field === 'absenceDeduction') 
      && (isNaN(numValue) || numValue < 0)) {
      error = `${field.charAt(0).toUpperCase() + field.slice(1)} must be a positive number`;
    }
    
    // Update field errors
    setFieldErrors(prev => ({
      ...prev,
      [field]: error
    }));
  };

  // SWR for salary history
  const { data: salaryDataResp, isLoading: isSalaryLoading, error: salaryError } = useSWR(
    `/api/salaries?page=${page}&pageSize=${pageSize}&sort=desc`,
    adminFetcher,
    {
      onError: (err) => {
        console.error("Error fetching salary data:", err);
        toast({
          title: "Error",
          description: "Failed to load salary data. Please refresh the page.",
          variant: "destructive",
        });
      },
      shouldRetryOnError: false,
      dedupingInterval: 5000
    }
  );
  const salaryData = salaryDataResp?.salaries || [];
  const total = salaryDataResp?.total || 0;

  // SWR for current month salaries
  const { data: currentMonthResp, isLoading: isCurrentMonthLoading, error: currentMonthError } = useSWR(
    `/api/salaries/current-month?page=${currentMonthPage}&pageSize=${currentMonthPageSize}&sort=desc`,
    adminFetcher,
    {
      onError: (err) => {
        console.error("Error fetching current month data:", err);
        toast({
          title: "Error",
          description: "Failed to load current month data. Please refresh the page.",
          variant: "destructive",
        });
      },
      shouldRetryOnError: false,
      dedupingInterval: 5000
    }
  );
  
  // Synchronize SWR data with component state
  useEffect(() => {
    if (currentMonthResp) {
      console.log('SWR data updated, syncing to component state', { 
        currentMonthPage, 
        currentMonthPageSize,
        salariesCount: currentMonthResp.salaries?.length 
      });
      setMonthlyStats(currentMonthResp);
      setCurrentMonthSalaries(currentMonthResp.salaries || []);
    }
  }, [currentMonthResp]);

  // Add a timeout to exit loading state if it takes too long
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if ((isSalaryLoading || isCurrentMonthLoading) && !salaryDataResp && !currentMonthResp) {
        // Debug check - try a direct fetch with full error handling
        try {
          const testResponse = await fetch('/api/salaries?page=1&pageSize=1', {
            credentials: 'include',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            }
          });
          
          console.info("Debug test request status:", testResponse.status, testResponse.statusText);
          
          if (!testResponse.ok) {
            try {
              const errorText = await testResponse.text();
              console.error("API response error:", errorText);
            } catch (e) {
              console.error("Could not read error text:", e);
            }
            
            toast({
              title: `API Error (${testResponse.status})`,
              description: `Server responded with: ${testResponse.statusText}. Please check your connection and try again.`,
              variant: "destructive",
            });
          } else {
            console.info("Test request succeeded but SWR is still loading");
          }
        } catch (testError) {
          console.error("Test fetch error:", testError);
        }
        
        console.error("Data fetch timeout - forcing exit from loading state");
        toast({
          title: "Loading Timeout",
          description: "The data is taking too long to load. Please check your connection and refresh the page.",
          variant: "destructive",
        });
        setLoading(false);
      }
    }, 10000); // Reduce to 10 seconds
    
    return () => clearTimeout(timeoutId);
  }, [isSalaryLoading, isCurrentMonthLoading, salaryDataResp, currentMonthResp, toast]);

  // Check if there's an authentication error and exit loading state
  useEffect(() => {
    if (salaryError || currentMonthError) {
      console.error("Auth error detected:", salaryError || currentMonthError);
      setLoading(false);
    }
  }, [salaryError, currentMonthError]);

  const handleDownloadHistory = async () => {
    // Check if already downloading to prevent multiple submissions
    if (isDownloading) {
      console.log("Already downloading, ignoring duplicate request");
      return;
    }
    
    if (!salaryData.length) {
      toast({
        title: "No Data Available",
        description: "There are no salary records to export.",
        variant: "destructive",
        duration: 4000,
      });
      return;
    }
    
    // Set downloading state
    setIsDownloading(true);
    
    // Show loading notification
    toast({
      title: "Preparing export",
      description: "Gathering salary data...",
      variant: "default"
    });
    
    try {
    // Create array to hold all data with full breakdown information
    const dataToExport = [];
    
    // Filter records that should be included
    const filteredData = salaryData
      .filter((item: any) => !salaryData.some((other: any) => other.correctionOf === item.id))
      .filter((item: any) => !item.deleted && item.status !== 'deleted')
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
      if (filteredData.length === 0) {
        throw new Error("No valid salary records found after filtering.");
      }
    
    // Process each record to get full breakdown details
    for (const item of filteredData) {
      try {
          // Update progress toast
          if (filteredData.length > 10) {
            const progress = Math.round((dataToExport.length / filteredData.length) * 100);
            if (progress % 10 === 0) {
              toast({
                title: `Export in progress (${progress}%)`,
                description: `Processing record ${dataToExport.length + 1} of ${filteredData.length}`,
                variant: "default"
              });
            }
          }
          
        // Fetch the detailed breakdown including audit logs via API
          const response = await fetch(`/api/salaries/${item.id}/breakdown`, {
            headers: { 
              "Cache-Control": "no-cache",
              "Pragma": "no-cache"
            }
          });
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        
        const data = await response.json();
        
        // Format the audit logs with detailed old and new values
        const auditLogDetailed = data.auditLogs?.map((log: any) => {
          const action = log.action;
          const by = log.changedBy;
          const at = new Date(log.changedAt).toLocaleString();
          
          let entryText = `Action: ${action}, By: ${by}, At: ${at}\n`;
          
          // Add old value details
          if (log.oldValue) {
            entryText += "Old Values:\n";
            // Add basic fields
            entryText += `- Amount: ${log.oldValue.amount}\n`;
            entryText += `- Status: ${log.oldValue.status}\n`;
            // Add metadata fields if they exist
            if (log.oldValue.metadata) {
              entryText += `- Base Salary: ${log.oldValue.metadata.baseSalary}\n`;
              entryText += `- Bonus %: ${log.oldValue.metadata.bonusPercent}\n`;
              entryText += `- Total Worked Hours: ${log.oldValue.metadata.totalWorkedHours}\n`;
              entryText += `- Overtime Rate: ${log.oldValue.metadata.overtimeRate}\n`;
              entryText += `- Undertime Deduction: ${log.oldValue.metadata.undertimeDeduction}\n`;
              entryText += `- Absence Deduction: ${log.oldValue.metadata.absenceDeduction}\n`;
              entryText += `- Absent Days: ${log.oldValue.metadata.absentDays}\n`;
            }
          }
          
          // Add new value details
          if (log.newValue) {
            entryText += "New Values:\n";
            // Add basic fields
            entryText += `- Amount: ${log.newValue.amount}\n`;
            entryText += `- Status: ${log.newValue.status}\n`;
            // Add metadata fields if they exist
            if (log.newValue.metadata) {
              entryText += `- Base Salary: ${log.newValue.metadata.baseSalary}\n`;
              entryText += `- Bonus %: ${log.newValue.metadata.bonusPercent}\n`;
              entryText += `- Total Worked Hours: ${log.newValue.metadata.totalWorkedHours}\n`;
              entryText += `- Overtime Rate: ${log.newValue.metadata.overtimeRate}\n`;
              entryText += `- Undertime Deduction: ${log.newValue.metadata.undertimeDeduction}\n`;
              entryText += `- Absence Deduction: ${log.newValue.metadata.absenceDeduction}\n`;
              entryText += `- Absent Days: ${log.newValue.metadata.absentDays}\n`;
            }
          }
          
          return entryText;
        }).join('\n---\n') || '';
        
        // Create the export row with all available data
        dataToExport.push({
          Employee: data.employeeName,
          Amount: item.amount,
          Status: item.status,
          Date: new Date(item.createdAt).toLocaleDateString(),
          BaseSalary: data.baseSalary || 0,
          TotalWorkedHours: data.totalWorkedHours || 0,
          SalesTotal: data.salesTotal || 0,
          AbsentDays: data.absentDays || 0,
          Bonus: data.bonus || 0,
          OvertimeBonus: data.overtimeBonus || 0,
          UndertimeDeduction: data.undertimeDeduction || 0,
          AbsenceDeduction: data.absenceDeduction || 0,
          TotalSalary: data.totalSalary || 0,
          Period: `${new Date(data.period?.startDate).toLocaleDateString()} - ${new Date(data.period?.endDate).toLocaleDateString()}`,
          AuditLog: auditLogDetailed
        });
      } catch (error) {
        console.error(`Error fetching breakdown for salary ${item.id}:`, error);
        // Still add the item but without detailed breakdown
        dataToExport.push({
          Employee: item.employeeName,
          Amount: item.amount,
          Status: item.status,
          Date: new Date(item.createdAt).toLocaleDateString(),
          AuditLog: 'Failed to load detailed data'
        });
      }
    }
      
      toast({
        title: "Creating Excel file",
        description: "Formatting data...",
        variant: "default"
      });
    
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    
    // Set column widths for better readability
    const colWidths = [
      { wch: 25 }, // Employee
      { wch: 10 }, // Amount
      { wch: 10 }, // Status
      { wch: 12 }, // Date
      { wch: 12 }, // BaseSalary
      { wch: 15 }, // TotalWorkedHours
      { wch: 12 }, // SalesTotal
      { wch: 12 }, // AbsentDays
      { wch: 10 }, // Bonus
      { wch: 15 }, // OvertimeBonus
      { wch: 18 }, // UndertimeDeduction
      { wch: 18 }, // AbsenceDeduction
      { wch: 12 }, // TotalSalary
      { wch: 25 }, // Period
      { wch: 100 }  // AuditLog - wide column for detailed information
    ];
    ws['!cols'] = colWidths;
    
    // Enable text wrapping for the AuditLog column
    if (!ws['!rows']) ws['!rows'] = [];
    for (let i = 0; i < dataToExport.length + 1; i++) {
      ws['!rows'][i] = { hpt: 60 }; // Set row height to accommodate multiple lines
    }
    
    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(wb, ws, "Salary History");
    
    // Generate filename with current date
    const fileName = `salary_history_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    // Save the file
    XLSX.writeFile(wb, fileName);
    
    // Show success notification
    toast({
      title: "Excel file downloaded",
        description: `${dataToExport.length} salary records exported successfully.`,
      variant: "default"
    });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "An error occurred during export.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const fetchSalaryData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/salaries?page=${page}&pageSize=${pageSize}`);
      if (!response.ok) {
        throw new Error('Failed to fetch salary data');
      }
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        // Calculate total expenses
        const totalExpenses = data.salaries.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
        setTotalExpenses(totalExpenses);
      } else {
        console.error('Expected JSON response but got:', await response.text());
      }
      // Fetch current month salaries with stats (paginated)
      const currentMonthResponse = await fetch(`/api/salaries/current-month?page=${currentMonthPage}&pageSize=${currentMonthPageSize}`);
      if (!currentMonthResponse.ok) {
        throw new Error('Failed to fetch current month salaries');
      }
      const currentMonthData = await currentMonthResponse.json();
      setMonthlyStats(currentMonthData);
      setCurrentMonthSalaries(currentMonthData.salaries);
      // Fetch trends data (e.g., monthly or yearly trends)
      const trendsResponse = await fetch('/api/salaries/trends');
      if (!trendsResponse.ok) {
        throw new Error('Failed to fetch trends data');
      }
      const trendsContentType = trendsResponse.headers.get('content-type');
      if (trendsContentType && trendsContentType.includes('application/json')) {
        const trendsData = await trendsResponse.json();
        setTrendsData(trendsData);
      } else {
        console.error('Expected JSON response but got:', await trendsResponse.text());
        setTrendsData([]);
      }
    } catch (error) {
      console.error('Error fetching salary data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalaryData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, currentMonthPage, currentMonthPageSize]);

  // Fetch all employees for the dropdown
  useEffect(() => {
    fetch("/api/employees?pageSize=100") // Set a high limit to get all employees
      .then(res => res.json())
      .then(data => setEmployees(Array.isArray(data.employees) ? data.employees : []))
      .catch(error => {
        console.error("Error fetching employees:", error);
        toast({
          title: "Error",
          description: "Failed to load employees. Please refresh the page.",
          variant: "destructive",
        });
      });
  }, []);

  // Fetch salary preview when employee is selected
  useEffect(() => {
    if (!selectedEmployeeId) return;
    setSalaryPreview(null);
    setProcessError("");
    setProcessSuccess("");
    
    // Immediately show a toast notification
    const loadingToastId = setTimeout(() => {
      toast({
        title: "Loading employee data",
        description: "Retrieving salary information...",
        variant: "default",
      });
    }, 300); // Small delay to avoid showing for very quick responses
    
    fetch("/api/salaries/preview", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache"
      },
      body: JSON.stringify({ employeeId: selectedEmployeeId })
    })
      .then(res => res.json())
      .then(data => {
        setSalaryPreview(data);
        fetchSalaryData();
        // Clear the toast when data is loaded
        clearTimeout(loadingToastId);
      })
      .catch(error => {
        console.error("Error fetching salary preview:", error);
        toast({
          title: "Error",
          description: "Failed to load salary preview data",
          variant: "destructive",
        });
        // Clear the toast on error
        clearTimeout(loadingToastId);
      });
  }, [selectedEmployeeId]);

  // Fetch sales and attendance for the selected employee
  useEffect(() => {
    if (!selectedEmployeeId) {
      setEmployeeSales([]);
      setEmployeeAttendance([]);
      return;
    }
    
    // Update UI immediately with loading states
    setEmployeeSales([{ loading: true }]);
    setEmployeeAttendance([{ loading: true }]);
    
    // Get current month range
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0);
    
    // Fetch sales and attendance in parallel
    const salesPromise = fetch(`/api/sales?employeeId=${selectedEmployeeId}&start=${startOfMonth.toISOString()}&end=${endOfMonth.toISOString()}`, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache"
      }
    })
      .then(res => res.json())
      .then(data => {
        setEmployeeSales(Array.isArray(data) ? data : []);
        return data;
      })
      .catch(error => {
        console.error("Error fetching sales data:", error);
        setEmployeeSales([]);
        return [];
      });
    
    const attendancePromise = fetch(`/api/attendance?employeeId=${selectedEmployeeId}&start=${startOfMonth.toISOString()}&end=${endOfMonth.toISOString()}`, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache"
      }
    })
      .then(res => res.json())
      .then(data => {
        setEmployeeAttendance(Array.isArray(data) ? data : []);
        return data;
      })
      .catch(error => {
        console.error("Error fetching attendance data:", error);
        setEmployeeAttendance([]);
        return [];
      });
    
    // Handle both promises together (optional)
    Promise.all([salesPromise, attendancePromise])
      .then(([salesData, attendanceData]) => {
        // Both data fetches complete - could do something with combined data here if needed
      })
      .catch(error => {
        console.error("Error fetching employee data:", error);
      });
      
  }, [selectedEmployeeId]);

  useEffect(() => {
    if (salaryPreview) {
      setEditFields({
        baseSalary: salaryPreview.baseSalary,
        bonusPercent: 5, // or salaryPreview.bonusPercent if available
        overtimeRate: 20,
        undertimeDeduction: 15,
        absenceDeduction: 50,
        salesTotal: salaryPreview.salesTotal,
        totalWorkedHours: salaryPreview.totalWorkedHours,
        absentDays: salaryPreview.absentDays,
      });
    }
  }, [salaryPreview]);

  // Setup form change detection for the edit form
  useEffect(() => {
    if (!editSalary) return;
    
    // Store the original values when form opens
    if (!editSalary._original) {
      setEditSalary({
        ...editSalary,
        _original: {
          baseSalary: editSalary.baseSalary,
          salesTotal: editSalary.salesTotal,
          bonusPercent: editSalary.bonusPercent ?? 5,
          totalWorkedHours: editSalary.totalWorkedHours,
          overtimeRate: editSalary.overtimeRate ?? 20,
          undertimeDeduction: editSalary.undertimeDeduction ?? 15,
          absenceDeduction: editSalary.absenceDeduction ?? 50,
          absentDays: editSalary.absentDays
        }
      });
      return;
    }
    
    // Check if any values have changed
    const original = editSalary._original;
    const isChanged = 
      original.baseSalary !== editSalary.baseSalary ||
      original.salesTotal !== editSalary.salesTotal ||
      original.bonusPercent !== editSalary.bonusPercent ||
      original.totalWorkedHours !== editSalary.totalWorkedHours ||
      original.overtimeRate !== editSalary.overtimeRate ||
      original.undertimeDeduction !== editSalary.undertimeDeduction ||
      original.absenceDeduction !== editSalary.absenceDeduction ||
      original.absentDays !== editSalary.absentDays;
    
    setIsFormChanged(isChanged);
  }, [editSalary]);

  // Calculation logic
  const STANDARD_HOURS = 160;
  const overtimeHours = Math.max(0, editFields.totalWorkedHours - STANDARD_HOURS);
  const undertimeHours = Math.max(0, STANDARD_HOURS - editFields.totalWorkedHours);
  const bonus = editFields.salesTotal * (editFields.bonusPercent / 100);
  const overtimeBonus = overtimeHours * editFields.overtimeRate;
  const undertimeDeduction = undertimeHours * editFields.undertimeDeduction;
  const absenceDeduction = editFields.absentDays * editFields.absenceDeduction;
  const totalSalary =
    editFields.baseSalary +
    bonus +
    overtimeBonus -
    undertimeDeduction -
    absenceDeduction;

  // Real-time calculation for edit dialog
  const editDialogTotalSalary = (() => {
    if (!editSalary) return 0;
    const STANDARD_HOURS = 160;
    const overtimeHours = Math.max(0, (editSalary.totalWorkedHours ?? 0) - STANDARD_HOURS);
    const undertimeHours = Math.max(0, STANDARD_HOURS - (editSalary.totalWorkedHours ?? 0));
    const bonus = (editSalary.salesTotal ?? 0) * ((editSalary.bonusPercent ?? 0) / 100);
    const overtimeBonus = overtimeHours * (editSalary.overtimeRate ?? 0);
    const undertimeDeduction = undertimeHours * (editSalary.undertimeDeduction ?? 0);
    const absenceDeduction = (editSalary.absentDays ?? 0) * (editSalary.absenceDeduction ?? 0);
    return (
      (editSalary.baseSalary ?? 0) +
      bonus +
      overtimeBonus -
      undertimeDeduction -
      absenceDeduction
    );
  })();

  // Handler for processing salary
  const handleProcessSalary = async () => {
    // Validate data first
    if (!selectedEmployeeId) {
      toast({
        title: "Error",
        description: "Please select an employee",
        variant: "destructive",
        duration: 4000,
      });
      return;
    }

    if (!editFields.baseSalary) {
      toast({
        title: "Error",
        description: "Base salary is required",
        variant: "destructive",
        duration: 4000,
      });
      return;
    }

    if (totalSalary < 0) {
      toast({
        title: "Error",
        description: "Total salary cannot be negative",
        variant: "destructive",
        duration: 4000,
      });
      return;
    }
    
    // Check if already processing to prevent multiple submissions
    if (processing) {
      console.log("Already processing salary, ignoring duplicate request");
      return;
    }

    setProcessing(true);
    setProcessError("");
    setProcessSuccess("");
    
    // Show feedback toast
    toast({
      title: "Processing salary payment",
      description: "Please wait while we process the payment...",
    });
    
    const payload = {
      employeeId: selectedEmployeeId,
      ...editFields
    };

    try {
      const res = await fetch("/api/salaries/process", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to process salary");
      }
      
      // Success
        toast({
          title: "Success",
          description: `Salary paid successfully!\nAmount: $${data.salaryRecord?.amount?.toLocaleString()}\nPay Date: ${data.salaryRecord?.payDate ? new Date(data.salaryRecord.payDate).toLocaleDateString() : ""}`,
          variant: "default",
          duration: 4000,
        });
      
      // Update data
        setSalaryPreview(data);
      
      // Refresh all salary data with SWR - don't call fetchSalaryData directly
        mutate('/api/salaries');
        mutate(['/api/salaries', page, pageSize]);
        mutate(['/api/salaries/current-month', currentMonthPage, currentMonthPageSize]);
        mutate(key => typeof key === 'string' && key.startsWith('/api/salaries/trends'));
      
      // Close dialog
      setShowConfirmDialog(false);
      
      // Reset selection after successful payment
      setSelectedEmployeeId("");
    } catch (err) {
      console.error("Error processing salary:", err);
      setProcessError(err instanceof Error ? err.message : "Failed to process salary");
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to process salary",
        variant: "destructive",
        duration: 4000,
      });
    } finally {
      setProcessing(false);
    }
  };

  // Compute unique cities for the city dropdown
  const uniqueCities = useMemo(() => Array.from(new Set(currentMonthSalaries.map((item: any) => item.employee?.city).filter(Boolean))) as string[], [currentMonthSalaries]);

  // Build a merged list of all employees with their latest salary for the current month (if any)
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0);

  // Find latest, non-corrected, non-deleted salary for each employee for the current month
  const latestSalaryByEmployeeId: Record<string, any> = {};
  currentMonthSalaries.forEach(s => {
    if (!s || s.status === "corrected" || s.deleted) return;
    if (!latestSalaryByEmployeeId[s.employeeId] || new Date(s.payDate) > new Date(latestSalaryByEmployeeId[s.employeeId].payDate)) {
      latestSalaryByEmployeeId[s.employeeId] = s;
    }
  });

  // Build the merged list
  const mergedEmployeeSalaries = employees.map(emp => {
    const salary = latestSalaryByEmployeeId[emp.id];
    return {
      employee: emp,
      amount: salary ? salary.amount : 0,
      status: salary ? salary.status : "not paid",
      payDate: salary ? salary.payDate : null,
      deleted: salary ? salary.deleted : false,
      id: salary ? salary.id : undefined,
    };
  });

  // Apply filters to the merged list
  const filteredMerged = useMemo(() => {
    return mergedEmployeeSalaries.filter((item: any) => {
      const employeeName = item.employee?.user?.name?.toLowerCase() ?? '';
      const city = item.employee?.city?.toLowerCase() ?? '';
    const amount = item.amount ?? 0;
      const salaryStatus = item.status?.toLowerCase() ?? '';
      const employmentStatus = item.employee?.status?.toLowerCase() ?? '';
    return (
      (!employeeFilter || employeeName.includes(employeeFilter.toLowerCase())) &&
      (!cityFilter || city.includes(cityFilter.toLowerCase())) &&
      (!amountMin || amount >= parseFloat(amountMin)) &&
      (!amountMax || amount <= parseFloat(amountMax)) &&
      (!salaryStatusFilter || salaryStatus === salaryStatusFilter.toLowerCase()) &&
      (!employmentStatusFilter || employmentStatus === employmentStatusFilter.toLowerCase())
    );
  });
  }, [mergedEmployeeSalaries, employeeFilter, cityFilter, amountMin, amountMax, salaryStatusFilter, employmentStatusFilter]);

  // Inside the SalariesPage component, after employees are loaded:
  const employeeMap = useMemo(() => {
    const map = new Map();
    for (const emp of employees) {
      map.set(emp.id, emp);
    }
    return map;
  }, [employees]);

  const totalPages = Math.ceil(total / pageSize);
  const pageNumbers = [];
  const maxPageButtons = 5;
  let startPage = Math.max(1, page - Math.floor(maxPageButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);
  if (endPage - startPage < maxPageButtons - 1) {
    startPage = Math.max(1, endPage - maxPageButtons + 1);
  }
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  // Show error state if there are errors
  if (salaryError || currentMonthError) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-4">Salaries</h1>
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4 mb-6">
          <h3 className="text-lg font-semibold mb-2">Error Loading Data</h3>
          <p>There was a problem loading the salary data. This could be due to:</p>
          <ul className="list-disc pl-5 mt-2">
            <li>Authentication issues - Please try logging out and back in</li>
            <li>Server connection problems - Check your internet connection</li>
            <li>Temporary server unavailability - Please try again in a few minutes</li>
          </ul>
          <div className="mt-4">
            <Button 
              onClick={() => window.location.reload()}
              className="mr-2"
            >
              Refresh Page
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.location.href = "/admin/dashboard"}
            >
              Return to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show fallback if data loaded but no valid data was returned
  if (!salaryDataResp && !currentMonthResp) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-4">Salaries</h1>
        <div className="border border-yellow-200 bg-yellow-50 text-yellow-800 rounded-md p-4 mb-6">
          <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
          <p>No salary data is currently available. This could be because:</p>
          <ul className="list-disc pl-5 mt-2">
            <li>You haven't processed any salaries yet</li>
            <li>There was an issue retrieving your data</li>
          </ul>
          <div className="mt-4">
            <Button 
              onClick={() => window.location.reload()}
              className="mr-2"
            >
              Refresh Page
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const safeEmployees = Array.isArray(employees) ? employees : [];

  // Add handler functions here
  const handleEditSalary = async () => {
    if (!editSalary || !isFormChanged) return;
    
    setIsEditingSalary(true);
    
    try {
      // Use the correct endpoint for correcting salaries
      const res = await fetch(`/api/salaries/correct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salaryId: editSalary.id,
          baseSalary: editSalary.baseSalary,
          salesTotal: editSalary.salesTotal,
          bonusPercent: editSalary.bonusPercent,
          totalWorkedHours: editSalary.totalWorkedHours,
          overtimeRate: editSalary.overtimeRate,
          undertimeDeduction: editSalary.undertimeDeduction,
          absenceDeduction: editSalary.absenceDeduction,
          absentDays: editSalary.absentDays
        })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update salary');
      }
      
      toast({
        title: "Success",
        description: "Salary updated successfully",
        variant: "default"
      });
      
      // Refresh data
      mutate('/api/salaries');
      mutate(['/api/salaries', page, pageSize]);
      mutate(['/api/salaries/current-month', currentMonthPage, currentMonthPageSize]);
      
      // Close dialog and reset state
      setShowEditDialog(false);
      setEditSalary(null);
      setIsFormChanged(false);
    } catch (err) {
      console.error('Error updating salary:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update salary",
        variant: "destructive"
      });
    } finally {
      setIsEditingSalary(false);
    }
  };

  const handleDeleteSalary = async () => {
    if (!deleteSalaryId) return;
    
    setIsDeleting(true);
    
    try {
      // Use the correct endpoint for deleting salaries
      const res = await fetch(`/api/salaries/${deleteSalaryId}/delete`, {
        method: 'DELETE'
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete salary');
      }
      
      toast({
        title: "Success",
        description: "Salary deleted successfully",
        variant: "default"
      });
      
      // Refresh data
      mutate('/api/salaries');
      mutate(['/api/salaries', page, pageSize]);
      mutate(['/api/salaries/current-month', currentMonthPage, currentMonthPageSize]);
      
      // Close dialog and reset state
      setShowDeleteDialog(false);
      setDeleteSalaryId(null);
    } catch (err) {
      console.error('Error deleting salary:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete salary",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="ml-8 min-h-screen overflow-x-auto">
        <div className="space-y-6">
          <div className="sticky top-0 z-20 bg-white flex justify-between items-center px-8 py-4 border-b">
            <h1 className="text-3xl font-bold">Salaries</h1>
            <Button>Generate Report</Button>
          </div>
          {/* Quick View Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Expenses Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-muted-foreground"
                >
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </CardHeader>
              <CardContent>
                {isSalaryLoading || isCurrentMonthLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <span className="text-2xl font-bold">{formatAmount(totalExpenses)}</span>
                )}
              </CardContent>
            </Card>

            {/* Average Salary Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Salary</CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-muted-foreground"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </CardHeader>
              <CardContent>
                {isSalaryLoading || isCurrentMonthLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <>
                <div className="text-2xl font-bold">{formatAmount(monthlyStats?.averageSalary ?? 0)}</div>
                <p className="text-xs text-muted-foreground">Per Employee</p>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Employees Paid Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Employees Paid</CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-muted-foreground"
                >
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </CardHeader>
              <CardContent>
                {isSalaryLoading || isCurrentMonthLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <>
                <div className="text-2xl font-bold">{monthlyStats?.employeesPaid ?? 0}</div>
                <p className="text-xs text-muted-foreground">This Month</p>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Highest Salary Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Highest Salary</CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-muted-foreground"
                >
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </CardHeader>
              <CardContent>
                {isSalaryLoading || isCurrentMonthLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <>
                <div className="text-2xl font-bold">{formatAmount(monthlyStats?.highestSalary ?? 0)}</div>
                <p className="text-xs text-muted-foreground">This Month</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Process Salary Section */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Process Salary</CardTitle>
            </CardHeader>
            <CardContent>
              {isSalaryLoading || isCurrentMonthLoading ? (
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div>
                      <Skeleton className="h-4 w-20 mb-1" /> {/* Label skeleton */}
                      <Skeleton className="h-10 w-64" /> {/* Button skeleton */}
                    </div>
                    <div className="mt-4 md:mt-0">
                      <Skeleton className="h-10 w-32" /> {/* Pay Salary button skeleton */}
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded">
                      <Skeleton className="h-5 w-40 mb-2" /> {/* Sales Records title skeleton */}
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-5/6" />
                      </div>
                    </div>
                    <div className="p-4 border rounded">
                      <Skeleton className="h-5 w-48 mb-2" /> {/* Attendance Records title skeleton */}
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-5/6" />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div>
                  <label className="block text-xs font-medium mb-1">Select Employee</label>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      className="w-64 justify-between"
                      onClick={() => setShowEmployeeSelector(true)}
                    >
                      <span className="truncate">
                        {selectedEmployeeId 
                          ? safeEmployees.find(emp => emp.id === selectedEmployeeId)?.user?.name || `Employee ${selectedEmployeeId}`
                          : "-- Select Employee --"
                        }
                      </span>
                      <ChevronDown className="h-4 w-4 ml-2 opacity-70" />
                    </Button>
                    {selectedEmployeeId && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0" 
                        onClick={() => setSelectedEmployeeId("")}
                      >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Clear selection</span>
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-4 md:mt-0">
                  <Button
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={
                      !selectedEmployeeId ||
                      processing ||
                      (salaryPreview && salaryPreview.salaryRecord) ||
                      !salaryPreview
                    }
                    className={(!selectedEmployeeId || processing || (salaryPreview && salaryPreview.salaryRecord) || !salaryPreview) ? "opacity-50 cursor-not-allowed" : ""}
                  >
                    {(!salaryPreview && selectedEmployeeId)
                      ? (<><Spinner className="mr-2 h-4 w-4" /> Loading...</>)
                      : salaryPreview && salaryPreview.salaryRecord
                        ? "Already Paid"
                        : processing
                          ? (<><Spinner className="mr-2 h-4 w-4" /> Processing...</>)
                          : "Pay Salary"}
                  </Button>
                </div>
              </div>
              {/* Show sales and attendance records */}
              {selectedEmployeeId && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded" style={{ maxHeight: 300, overflowY: 'auto' }}>
                    <div className="font-bold mb-2">Sales Records (Current Month)</div>
                    <ul className="text-xs">
                      {employeeSales.length === 1 && employeeSales[0]?.loading ? (
                        <li className="flex items-center gap-2">
                          <Spinner className="h-3 w-3" />
                          <span>Loading sales records...</span>
                        </li>
                      ) : employeeSales.length === 0 ? (
                        <li>No sales records.</li>
                      ) : (
                        employeeSales.map((sale, idx) => (
                        <li key={idx}>{formatAmount(sale.amount)} on {sale.date ? new Date(sale.date).toLocaleDateString() : ""} (Product: {sale.product?.name ?? ""})</li>
                        ))
                      )}
                    </ul>
                  </div>
                  <div className="p-4 border rounded" style={{ maxHeight: 300, overflowY: 'scroll' }}>
                    <div className="font-bold mb-2">Attendance Records (Current Month)</div>
                    <ul className="text-xs">
                      {employeeAttendance.length === 1 && employeeAttendance[0]?.loading ? (
                        <li className="flex items-center gap-2">
                          <Spinner className="h-3 w-3" />
                          <span>Loading attendance records...</span>
                        </li>
                      ) : employeeAttendance.length === 0 ? (
                        <li>No attendance records.</li>
                      ) : (
                        employeeAttendance.map((att, idx) => (
                        <li key={idx}>{att.date ? new Date(att.date).toLocaleDateString() : ""}: {att.status ?? ""}</li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Replacement for the default select - custom dropdown implementation */}
          <Dialog open={showEmployeeSelector} onOpenChange={setShowEmployeeSelector}>
            <DialogContent className="sm:max-w-md max-h-[95vh] overflow-hidden">
              <DialogHeader>
                <DialogTitle>Select Employee</DialogTitle>
                <DialogDescription>
                  Choose an employee to process salary for
                </DialogDescription>
              </DialogHeader>
              <div className="border rounded my-2">
                <div className="sticky top-0 bg-white p-2 border-b z-10 max-w-full">
                  <Input 
                    placeholder="Search employees by name..." 
                    className="mb-0"
                    value={employeeSearchTerm}
                    onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    Showing {safeEmployees
                      .filter(emp => 
                        !employeeSearchTerm || 
                        emp.user?.name?.toLowerCase().includes(employeeSearchTerm.toLowerCase())
                      ).length} of {safeEmployees.length} employees
                  </div>
                </div>
                <div className="max-h-[350px] overflow-y-auto p-1 pb-4">
                  {safeEmployees
                    .filter(emp => 
                      !employeeSearchTerm || 
                      emp.user?.name?.toLowerCase().includes(employeeSearchTerm.toLowerCase())
                    )
                    .map(emp => {
                      const paid = latestSalaryByEmployeeId[emp.id] && latestSalaryByEmployeeId[emp.id].status === 'paid';
                      return (
                        <div 
                          key={emp.id} 
                          className={`px-3 py-2 rounded-sm flex items-center justify-between ${paid ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'hover:bg-gray-100 cursor-pointer'}`}
                          onClick={() => {
                            if (paid) return;
                            setSelectedEmployeeId(emp.id);
                            setShowEmployeeSelector(false);
                          }}
                          aria-disabled={paid}
                        >
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center text-xs">
                              {emp.user?.name?.charAt(0).toUpperCase() || 'E'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate">{emp.user?.name ?? `Employee ${emp.id}`}</div>
                              {emp.city && <div className="text-xs text-gray-500">{emp.city}</div>}
                            </div>
                          </div>
                          {paid && (
                            <span className="ml-2 px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs font-semibold">Paid</span>
                          )}
                          {emp.id === selectedEmployeeId && !paid && (
                            <Check className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                      );
                    })
                  }
                  {safeEmployees.filter(emp => 
                    !employeeSearchTerm || 
                    emp.user?.name?.toLowerCase().includes(employeeSearchTerm.toLowerCase())
                  ).length === 0 && (
                                      <div className="p-3 text-center text-gray-500 mb-2">No employees found</div>
                  )}
                </div>
              </div>
              <DialogFooter className="sm:justify-between mt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => setEmployeeSearchTerm("")}
                  disabled={!employeeSearchTerm}
                >
                  Clear Search
                </Button>
                <DialogClose asChild>
                  <Button type="button" variant="secondary">Close</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Confirmation Dialog */}
          {showConfirmDialog && (
            <AlertDialog open={showConfirmDialog} onOpenChange={(open) => !processing && setShowConfirmDialog(open)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm Salary Payment</AlertDialogTitle>
                <AlertDialogDescription>
                    Please review and edit the salary details below before processing the payment.
                    This action will create an official salary record for the employee.
                </AlertDialogDescription>
              </AlertDialogHeader>
                <div className="bg-gray-50 p-4 rounded-lg border my-4 max-h-[50vh] overflow-y-auto">
                  {salaryPreview ? (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center gap-2">
                        <span className="font-medium">Employee:</span>
                        <span>{salaryPreview.employeeName}</span>
                    </div>
                      <div className="flex justify-between items-center gap-2">
                        <label className="font-medium" htmlFor="baseSalary">Base Salary:</label>
                        <div className="flex flex-col items-end w-32">
                          <input
                            id="baseSalary"
                            type="number"
                            min={0}
                            step={0.01}
                            value={editFields.baseSalary}
                            onChange={e => handleEditField('baseSalary', e.target.value)}
                            onBlur={() => setTouched(prev => ({ ...prev, baseSalary: true }))}
                            className="border rounded px-2 py-1 text-right w-full"
                            disabled={processing}
                          />
                          <span className="text-xs text-gray-500">
                            ${formatAmount(Number(editFields.baseSalary))}
                          </span>
                          {touched.baseSalary && fieldErrors.baseSalary && (
                            <div className="text-red-600 text-xs w-full text-right">{fieldErrors.baseSalary}</div>
                          )}
                    </div>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="font-medium">Total Worked Hours:</span>
                        <span>
                          {formatAmount(Number(salaryPreview.totalWorkedHours ?? editFields.totalWorkedHours))}
                        </span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="font-medium">Sales Total:</span>
                        <span>
                          ${formatAmount(Number(salaryPreview.salesTotal ?? editFields.salesTotal))}
                        </span>
                    </div>
                      <div className="flex justify-between items-center gap-2">
                        <label className="font-medium" htmlFor="bonusPercent">Bonus Percent:</label>
                        <div className="flex flex-col items-end w-32">
                          <input id="bonusPercent" type="number" min={0} max={100} step={0.01} value={editFields.bonusPercent} onChange={e => handleEditField('bonusPercent', e.target.value)} onBlur={() => setTouched(prev => ({ ...prev, bonusPercent: true }))} className="border rounded px-2 py-1 text-right w-full" disabled={processing} />
                          <span className="text-xs text-gray-500">
                            {formatAmount(Number(editFields.bonusPercent))}%
                          </span>
                          {touched.bonusPercent && fieldErrors.bonusPercent && (
                            <div className="text-red-600 text-xs w-full text-right">{fieldErrors.bonusPercent}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <label className="font-medium" htmlFor="overtimeRate">Overtime Rate:</label>
                        <div className="flex flex-col items-end w-32">
                          <input id="overtimeRate" type="number" min={0} step={0.01} value={editFields.overtimeRate} onChange={e => handleEditField('overtimeRate', e.target.value)} onBlur={() => setTouched(prev => ({ ...prev, overtimeRate: true }))} className="border rounded px-2 py-1 text-right w-full" disabled={processing} />
                          <span className="text-xs text-gray-500">
                            {formatAmount(Number(editFields.overtimeRate))}/hr
                          </span>
                          {touched.overtimeRate && fieldErrors.overtimeRate && (
                            <div className="text-red-600 text-xs w-full text-right">{fieldErrors.overtimeRate}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <label className="font-medium" htmlFor="undertimeDeduction">Undertime Deduction:</label>
                        <div className="flex flex-col items-end w-32">
                          <input id="undertimeDeduction" type="number" min={0} step={0.01} value={editFields.undertimeDeduction} onChange={e => handleEditField('undertimeDeduction', e.target.value)} onBlur={() => setTouched(prev => ({ ...prev, undertimeDeduction: true }))} className="border rounded px-2 py-1 text-right w-full" disabled={processing} />
                          <span className="text-xs text-gray-500">
                            {formatAmount(Number(editFields.undertimeDeduction))}/hr
                          </span>
                          {touched.undertimeDeduction && fieldErrors.undertimeDeduction && (
                            <div className="text-red-600 text-xs w-full text-right">{fieldErrors.undertimeDeduction}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <label className="font-medium" htmlFor="absenceDeduction">Absence Deduction:</label>
                        <div className="flex flex-col items-end w-32">
                          <input id="absenceDeduction" type="number" min={0} step={0.01} value={editFields.absenceDeduction} onChange={e => handleEditField('absenceDeduction', e.target.value)} onBlur={() => setTouched(prev => ({ ...prev, absenceDeduction: true }))} className="border rounded px-2 py-1 text-right w-full" disabled={processing} />
                          <span className="text-xs text-gray-500">
                            {formatAmount(Number(editFields.absenceDeduction))}/day
                          </span>
                          {touched.absenceDeduction && fieldErrors.absenceDeduction && (
                            <div className="text-red-600 text-xs w-full text-right">{fieldErrors.absenceDeduction}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="font-medium">Absent Days:</span>
                        <span>
                          {formatAmount(Number(salaryPreview.absentDays ?? editFields.absentDays))}
                        </span>
                      </div>
                      {/* Error messages for each field */}
                      {Object.entries(fieldErrors).map(([field, error]) => error && (
                        <div key={field} className="text-red-600 text-xs">{error}</div>
                      ))}
                      <div className="border-t pt-2 mt-2">
                        <span className="font-bold text-green-700 flex justify-between items-center">
                          <span>Total Salary:</span>
                          <span className="text-lg">
                            ${formatAmount(totalSalary)}
                  </span>
                        </span>
                        {totalSalary < 0 && (
                          <div className="text-red-600 font-semibold mt-2">
                            Warning: Total salary is negative. Please review the input values.
                          </div>
                        )}
                    </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <Spinner className="h-8 w-8 mx-auto mb-2" />
                        <p>Calculating salary...</p>
                      </div>
                    )}
                  </div>
                  {processError && (
                    <div className="bg-red-50 text-red-700 p-3 rounded-lg border border-red-200 mb-4">
                      {processError}
                  </div>
                )}
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleProcessSalary}
                      disabled={!salaryPreview || processing || totalSalary < 0 || Object.values(fieldErrors).some(Boolean)}
                      className={(!salaryPreview || processing || totalSalary < 0 || Object.values(fieldErrors).some(Boolean)) ? "opacity-50 cursor-not-allowed" : ""}
                    >
                      {processing ? (
                        <>
                          <Spinner className="mr-2 h-4 w-4" />
                          Processing...
                        </>
                      ) : (
                        "Confirm Payment"
                      )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Current Month Salaries */}
          <Card>
            <CardHeader>
              <CardTitle>Current Month Salaries</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Salary Status</TableHead>
                    <TableHead>Employment Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                  <TableRow>
                    <TableHead>
                      <input
                        type="text"
                        placeholder="Filter"
                        value={employeeFilter}
                        onChange={e => setEmployeeFilter(e.target.value)}
                        className="mt-1 block w-full border rounded px-2 py-1 text-xs"
                      />
                    </TableHead>
                    <TableHead>
                      <select
                        value={cityFilter}
                        onChange={e => setCityFilter(e.target.value)}
                        className="mt-1 block w-full border rounded px-2 py-1 text-xs"
                      >
                        <option value="">All</option>
                        {uniqueCities.map(city => (
                          <option key={city} value={city}>{city}</option>
                        ))}
                      </select>
                    </TableHead>
                    <TableHead>
                      <div className="flex gap-1 mt-1">
                        <input
                          type="number"
                          placeholder="Min"
                          value={amountMin}
                          onChange={e => setAmountMin(e.target.value)}
                          className="w-14 border rounded px-1 py-1 text-xs"
                        />
                        <input
                          type="number"
                          placeholder="Max"
                          value={amountMax}
                          onChange={e => setAmountMax(e.target.value)}
                          className="w-14 border rounded px-1 py-1 text-xs"
                        />
                      </div>
                    </TableHead>
                    <TableHead>
                      <select
                        value={salaryStatusFilter}
                        onChange={e => setSalaryStatusFilter(e.target.value)}
                        className="mt-1 block w-full border rounded px-2 py-1 text-xs"
                      >
                        <option value="">All</option>
                        <option value="paid">Paid</option>
                        <option value="pending">Pending</option>
                        <option value="not paid">Not Paid</option>
                      </select>
                    </TableHead>
                    <TableHead>
                      <select
                        value={employmentStatusFilter}
                        onChange={e => setEmploymentStatusFilter(e.target.value)}
                        className="mt-1 block w-full border rounded px-2 py-1 text-xs"
                      >
                        <option value="">All</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
              </Table>
              <div style={{ maxHeight: '600px', overflowY: 'auto', width: '100%', borderBottom: '1px solid #e2e8f0' }} className="scrollable-container">
                <Table>
                  <TableBody>
                      {isCurrentMonthLoading
                        ? Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                              <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                            </TableRow>
                          ))
                      : filteredMerged.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                              No employees found matching the current filters
                            </TableCell>
                          </TableRow>
                        ) : filteredMerged
                            .filter((item: any) => !item.deleted)
                        .map((item: any, index: number) => (
                          <TableRow key={item.employee.id}>
                            <TableCell>{item.employee?.user?.name ?? ''}</TableCell>
                            <TableCell>{item.employee?.city ?? ''}</TableCell>
                            <TableCell>{formatAmount(item.amount)}</TableCell>
                            <TableCell>{item.status}</TableCell>
                            <TableCell>{item.employee?.user?.status ?? ''}</TableCell>
                            <TableCell>
                              {item.status === 'paid' && !item.deleted && (
                                <>
                                  <Button size="sm" variant="outline" className="mr-2" onClick={async () => {
                                    const res = await fetchWithCSRF(`/api/salaries/${item.id}/breakdown`);
                                    const data = await res.json();
                                    setEditSalary({
                                      id: item.id,
                                      amount: item.amount,
                                      baseSalary: data.baseSalary ?? 0,
                                      salesTotal: data.salesTotal ?? 0,
                                      bonusPercent: 5,
                                      overtimeRate: 20,
                                      undertimeDeduction: 15,
                                      absenceDeduction: 50,
                                      totalWorkedHours: data.totalWorkedHours ?? 0,
                                      absentDays: data.absentDays ?? 0,
                                    });
                                    setShowEditDialog(true);
                                  }}>Edit</Button>
                                  <Button size="sm" variant="destructive" onClick={() => { setDeleteSalaryId(item.id); setShowDeleteDialog(true); }}>Delete</Button>
                                </>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                  </TableBody>
                </Table>
              </div>
              {/* Pagination controls for current month salaries */}
              <div className="flex flex-col md:flex-row justify-between items-center mt-4 gap-2">
                <span>Page {currentMonthPage} of {Math.max(1, Math.ceil(filteredMerged.length / currentMonthPageSize))}</span>
                <div className="flex gap-1">
                  <Button size="icon" variant="outline" onClick={() => setCurrentMonthPage(1)} disabled={currentMonthPage === 1} aria-label="First Page">
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => setCurrentMonthPage(p => Math.max(1, p - 1))} disabled={currentMonthPage === 1} aria-label="Previous Page">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, Math.ceil(filteredMerged.length / currentMonthPageSize)) }, (_, i) => {
                    // Center the current page in the pagination display when possible
                    let pageNum;
                    const totalPages = Math.max(1, Math.ceil(filteredMerged.length / currentMonthPageSize));
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else {
                      // More complex logic to center current page
                      let startPage = Math.max(1, currentMonthPage - 2);
                      let endPage = Math.min(totalPages, startPage + 4);
                      
                      // Adjust if we're near the end
                      if (endPage - startPage < 4) {
                        startPage = Math.max(1, endPage - 4);
                      }
                      
                      pageNum = startPage + i;
                      if (pageNum > totalPages) return null;
                    }
                    
                    return (
                    <Button
                        key={pageNum}
                      size="icon"
                        variant={pageNum === currentMonthPage ? "default" : "outline"}
                        onClick={() => setCurrentMonthPage(pageNum)}
                        aria-label={`Page ${pageNum}`}
                      >
                        <span className="text-xs">{pageNum}</span>
                    </Button>
                    );
                  }).filter(Boolean)}
                  <Button size="icon" variant="outline" onClick={() => setCurrentMonthPage(p => Math.min(Math.ceil(filteredMerged.length / currentMonthPageSize), p + 1))} disabled={currentMonthPage === Math.ceil(filteredMerged.length / currentMonthPageSize)} aria-label="Next Page">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => setCurrentMonthPage(Math.ceil(filteredMerged.length / currentMonthPageSize))} disabled={currentMonthPage === Math.ceil(filteredMerged.length / currentMonthPageSize)} aria-label="Last Page">
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
                <select value={currentMonthPageSize} onChange={e => { setCurrentMonthPageSize(Number(e.target.value)); setCurrentMonthPage(1); }} className="border rounded px-2 py-1 text-xs">
                  {[10, 25, 50, 100].map(size => (
                    <option key={size} value={size}>{size} per page</option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Salary Trends */}
          <Card>
            <CardHeader>
              <CardTitle>Salary Trends</CardTitle>
            </CardHeader>
            <CardContent>
                {isSalaryLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
              <SalaryTrendsChart />
                )}
            </CardContent>
          </Card>

          {/* Salary History */}
          <Card>
            <CardHeader>
              <CardTitle>Salary History</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ maxHeight: '600px', overflowY: 'auto', width: '100%', borderBottom: '1px solid #e2e8f0' }}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Breakdown</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                      {isSalaryLoading
                        ? Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                              <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                            </TableRow>
                          ))
                        : salaryData
                            .filter((item: any) => !salaryData.some((other: any) => other.correctionOf === item.id))
                            .filter((item: any) => !item.deleted && item.status !== 'deleted')
                            .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((item: any, index: number) => {
                        const employee = employeeMap.get(item.employeeId);
                        const employeeName = employee?.user?.name ?? "Unknown";
                        return (
                          <TableRow key={index} className={item.deleted ? 'bg-red-50 text-gray-400' : ''}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage
                                    src={getAvatarImage({ 
                                      image: item.employee?.user?.image, 
                                      pictureUrl: item.employee?.pictureUrl 
                                    })}
                                    alt={employeeName}
                                  />
                                  <AvatarFallback>
                                    {getAvatarInitials(employeeName)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="font-medium">{employeeName}</div>
                              </div>
                            </TableCell>
                            <TableCell>{formatAmount(item.amount)}</TableCell>
                            <TableCell>{item.status}</TableCell>
                            <TableCell>{item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}</TableCell>
                            <TableCell>
                              {(item.breakdown || item.metadata) ? (
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={async () => {
                                    // Show loading state
                                    setShowBreakdown({ 
                                      loading: true, 
                                      employeeName: item.employee?.user?.name || `Employee ${item.employeeId}`
                                    });
                                    
                                    try {
                                  const res = await fetchWithCSRF(`/api/salaries/${item.id}/breakdown`);
                                      if (!res.ok) throw new Error("Failed to fetch breakdown");
                                  const data = await res.json();
                                  setShowBreakdown(data);
                                    } catch (error) {
                                      toast({
                                        title: "Error",
                                        description: "Failed to load salary breakdown",
                                        variant: "destructive",
                                        duration: 4000,
                                      });
                                      setShowBreakdown(null);
                                    }
                                  }}
                                >
                                  View
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">N/A</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
                <div className="flex flex-col md:flex-row justify-between items-center mt-2 gap-2">
                  {isSalaryLoading ? (
                    <>
                      <Skeleton className="h-4 w-24" /> {/* Page info skeleton */}
                      <div className="flex gap-1">
                        <Skeleton className="h-8 w-8" /> {/* First page button skeleton */}
                        <Skeleton className="h-8 w-8" /> {/* Previous page button skeleton */}
                        <Skeleton className="h-8 w-8" /> {/* Page number button skeleton */}
                        <Skeleton className="h-8 w-8" /> {/* Next page button skeleton */}
                        <Skeleton className="h-8 w-8" /> {/* Last page button skeleton */}
                      </div>
                      <Skeleton className="h-8 w-24" /> {/* Page size select skeleton */}
                    </>
                  ) : (
                    <>
                  <span>Page {page} of {totalPages}</span>
                  <div className="flex gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="outline" onClick={() => setPage(1)} disabled={page === 1} aria-label="First Page">
                          <ChevronsLeft className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>First Page</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} aria-label="Previous Page">
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Previous Page</TooltipContent>
                    </Tooltip>
                    {startPage > 1 && <span className="px-1">...</span>}
                    {pageNumbers.map(num => (
                      <Button
                        key={num}
                        size="icon"
                        variant={num === page ? "default" : "outline"}
                        onClick={() => setPage(num)}
                        aria-label={`Page ${num}`}
                      >
                        <span className="text-xs">{num}</span>
                      </Button>
                    ))}
                    {endPage < totalPages && <span className="px-1">...</span>}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} aria-label="Next Page">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Next Page</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="outline" onClick={() => setPage(totalPages)} disabled={page === totalPages} aria-label="Last Page">
                          <ChevronsRight className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Last Page</TooltipContent>
                    </Tooltip>
                  </div>
                  <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} className="border rounded px-2 py-1 text-xs">
                    {[10, 25, 50, 100].map(size => (
                      <option key={size} value={size}>{size} per page</option>
                    ))}
                  </select>
                    </>
                  )}
                </div>
                {isSalaryLoading ? (
                  <Skeleton className="h-10 w-32 mt-4" />
                ) : (
                  <Button 
                    className="mt-4" 
                    onClick={handleDownloadHistory} 
                    disabled={isDownloading || isSalaryLoading}
                  >
                    {isDownloading ? (
                      <>
                        <Spinner className="mr-2 h-4 w-4" />
                        Exporting Data...
                      </>
                    ) : (
                      "Download History"
                    )}
                  </Button>
                )}
              {showBreakdown && (
                <AlertDialog open={!!showBreakdown} onOpenChange={() => setShowBreakdown(null)}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Salary Calculation Breakdown</AlertDialogTitle>
                    </AlertDialogHeader>
                    <div className="font-bold text-base mb-2">Employee: {showBreakdown.employeeName}</div>
                    {/* SCROLLABLE CONTENT STARTS HERE */}
                    <div className="max-h-[70vh] overflow-y-auto pr-2">
                      {showBreakdown.loading ? (
                        <div className="py-8 flex flex-col items-center justify-center">
                          <Spinner className="h-8 w-8 mb-4" />
                          <div className="text-sm text-gray-500">Loading salary breakdown...</div>
                        </div>
                      ) : (() => {
                        const breakdownFields = [
                          "baseSalary",
                          "totalWorkedHours",
                          "salesTotal",
                          "absentDays",
                          "bonus",
                          "overtimeBonus",
                          "undertimeDeduction",
                          "absenceDeduction",
                          "totalSalary"
                        ];
                        return (
                          <div className="space-y-1 text-sm">
                            {breakdownFields.map((k) => (
                              <div key={k} className="flex justify-between">
                                <span className="font-medium">{k}</span>
                                <span>
                                  {showBreakdown[k] !== undefined && showBreakdown[k] !== null
                                    ? (typeof showBreakdown[k] === 'number'
                                        ? showBreakdown[k].toLocaleString()
                                        : String(showBreakdown[k]))
                                    : 'N/A'}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                      {showBreakdown.auditLogs && showBreakdown.auditLogs.length > 0 && (
                        <div className="mt-4 border-t pt-4">
                          <h3 className="font-bold mb-2">Audit Log</h3>
                          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                            {showBreakdown.auditLogs.map((log: any, idx: number) => (
                              <div key={idx} className="text-xs border-b pb-2 mb-2">
                                <div><b>Action:</b> {log.action}</div>
                                <div><b>Changed By:</b> {log.changedBy}</div>
                                <div><b>Changed At:</b> {new Date(log.changedAt).toLocaleString()}</div>
                                {log.oldValue && (
                                  <details className="mt-2 group">
                                    <summary className="font-semibold cursor-pointer text-xs text-gray-600 hover:text-blue-600 transition">
                                      <span className="mr-1">🕑</span> Old Value
                                    </summary>
                                    <div className="space-y-1 mt-2">
                                      {log.newValue
                                        ? getChangedFields(log.oldValue, log.newValue).map(({ field, old }) => (
                                            <div key={field} className="flex items-center text-xs">
                                              <span className="w-40 font-medium text-gray-500">{field.replace(/^metadata\./, '')}</span>
                                              <span className="ml-2 text-red-500">{String(old)}</span>
                                            </div>
                                          ))
                                        : Object.entries(extractRelevantFields(log.oldValue)).map(([key, value]) => (
                                            <div key={key} className="flex items-center text-xs">
                                              <span className="w-40 font-medium text-gray-500">{key.replace(/^metadata\./, '')}</span>
                                              <span className="ml-2 text-red-500">{String(value)}</span>
                                            </div>
                                          ))}
                                    </div>
                                  </details>
                                )}
                                {log.newValue && (
                                  <details className="mt-2 group">
                                    <summary className="font-semibold cursor-pointer text-xs text-gray-600 hover:text-green-600 transition">
                                      <span className="mr-1">✅</span> New Value
                                    </summary>
                                    <div className="space-y-1 mt-2">
                                      {log.oldValue
                                        ? getChangedFields(log.oldValue, log.newValue).map(({ field, new: newVal }) => (
                                            <div key={field} className="flex items-center text-xs">
                                              <span className="w-40 font-medium text-gray-500">{field.replace(/^metadata\./, '')}</span>
                                              <span className="ml-2 text-green-600 font-semibold">{String(newVal)}</span>
                                            </div>
                                          ))
                                        : Object.entries(extractRelevantFields(log.newValue)).map(([key, value]) => (
                                            <div key={key} className="flex items-center text-xs">
                                              <span className="w-40 font-medium text-gray-500">{key.replace(/^metadata\./, '')}</span>
                                              <span className="ml-2 text-green-600 font-semibold">{String(value)}</span>
                                            </div>
                                          ))}
                                    </div>
                                  </details>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {/* SCROLLABLE CONTENT ENDS HERE */}
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setShowBreakdown(null)}>Close</AlertDialogCancel>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {/* Edit Salary Dialog */}
              {showEditDialog && editSalary && (
                <AlertDialog open={showEditDialog} onOpenChange={(open) => !isEditingSalary && setShowEditDialog(open)}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Edit Salary</AlertDialogTitle>
                      <AlertDialogDescription>
                        Edit the salary details below. This will create a correction record.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Base Salary</label>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={editSalary.baseSalary}
                            onChange={e => {
                              const value = Number(e.target.value);
                              if (value < 0) return; // Prevent negative values
                              setEditSalary(prev => ({ ...prev, baseSalary: value }));
                              setIsFormChanged(true);
                            }}
                            className="w-full border rounded px-2 py-1"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Sales Total</label>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={editSalary.salesTotal}
                            onChange={e => {
                              const value = Number(e.target.value);
                              if (value < 0) return; // Prevent negative values
                              setEditSalary(prev => ({ ...prev, salesTotal: value }));
                              setIsFormChanged(true);
                            }}
                            className="w-full border rounded px-2 py-1"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Bonus Percent</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            value={editSalary.bonusPercent}
                            onChange={e => {
                              const value = Number(e.target.value);
                              if (value < 0 || value > 100) return; // Prevent invalid values
                              setEditSalary(prev => ({ ...prev, bonusPercent: value }));
                              setIsFormChanged(true);
                            }}
                            className="w-full border rounded px-2 py-1"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Overtime Rate</label>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={editSalary.overtimeRate}
                            onChange={e => {
                              const value = Number(e.target.value);
                              if (value < 0) return; // Prevent negative values
                              setEditSalary(prev => ({ ...prev, overtimeRate: value }));
                              setIsFormChanged(true);
                            }}
                            className="w-full border rounded px-2 py-1"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Undertime Deduction</label>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={editSalary.undertimeDeduction}
                            onChange={e => {
                              const value = Number(e.target.value);
                              if (value < 0) return; // Prevent negative values
                              setEditSalary(prev => ({ ...prev, undertimeDeduction: value }));
                              setIsFormChanged(true);
                            }}
                            className="w-full border rounded px-2 py-1"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Absence Deduction</label>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={editSalary.absenceDeduction}
                            onChange={e => {
                              const value = Number(e.target.value);
                              if (value < 0) return; // Prevent negative values
                              setEditSalary(prev => ({ ...prev, absenceDeduction: value }));
                              setIsFormChanged(true);
                            }}
                            className="w-full border rounded px-2 py-1"
                          />
                        </div>
                      </div>
                      <div className="border-t pt-4">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Total Worked Hours:</span>
                          <span>{editSalary.totalWorkedHours}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Absent Days:</span>
                          <span>{editSalary.absentDays}</span>
                        </div>
                        <div className="flex justify-between items-center font-bold mt-2">
                          <span>Total Salary:</span>
                          <span className={editDialogTotalSalary < 0 ? "text-red-600" : "text-green-600"}>
                            ${formatAmount(editDialogTotalSalary)}
                          </span>
                        </div>
                        {editDialogTotalSalary < 0 && (
                          <div className="text-red-600 text-sm mt-1">
                            Total salary cannot be negative. Please adjust the values.
                          </div>
                        )}
                      </div>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isEditingSalary}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleEditSalary}
                        disabled={!isFormChanged || isEditingSalary || editDialogTotalSalary < 0}
                        className={(!isFormChanged || isEditingSalary || editDialogTotalSalary < 0) ? "opacity-50 cursor-not-allowed" : ""}
                      >
                        {isEditingSalary ? (
                          <>
                            <Spinner className="mr-2 h-4 w-4" />
                            Saving...
                          </>
                        ) : (
                          "Save Changes"
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              
              {/* Delete Salary Dialog */}
              {showDeleteDialog && deleteSalaryId && (
                <AlertDialog open={showDeleteDialog} onOpenChange={(open) => !isDeleting && setShowDeleteDialog(open)}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Salary Record</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this salary record? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteSalary}
                        disabled={isDeleting}
                        className={isDeleting ? "opacity-50 cursor-not-allowed" : ""}
                      >
                        {isDeleting ? (
                          <>
                            <Spinner className="mr-2 h-4 w-4" />
                            Deleting...
                          </>
                        ) : (
                          "Delete"
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}

