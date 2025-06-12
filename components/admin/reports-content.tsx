"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Check, X, Calendar, History, Clock, ShoppingCart } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import useSWR from "swr"
import * as XLSX from "xlsx"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { addDays, format } from "date-fns"

// --- Types ---
interface Report {
  id: string;
  employeeId: number;
  employeeName: string;
  city: string;
  type: "time" | "absence" | "sales";
  status?: string;
  details: any;
  notes?: string;
  date: string;
}

interface Filters {
  employee: string;
  type: string;
  status: string;
  city: string;
  documentStatus: string;
}

interface DateRange {
  from: Date;
  to: Date;
}

// --- Constants ---
const CITIES = ["Jakarta", "Surabaya", "Bandung"];
const PAGE_SIZE = 10;

// --- Filtering Logic ---
function filterReports(
  reports: Report[],
  filters: Filters,
  onlyToday: boolean = false,
  dateRange: DateRange | null = null
): Report[] {
  const todayStr = new Date().toISOString().slice(0, 10);
  return reports.filter((report) => {
    if (onlyToday && report.date.slice(0, 10) !== todayStr) return false;
    if (!onlyToday && dateRange) {
      const reportDate = new Date(report.date);
      if (reportDate < dateRange.from || reportDate > dateRange.to) return false;
    }
    if (filters.employee && filters.employee !== "all" && String(report.employeeId) !== filters.employee) return false;
    if (filters.type && filters.type !== "all" && report.type !== filters.type) return false;
    if (filters.status && filters.status !== "all" && report.status !== filters.status) return false;
    if (filters.city && filters.city !== "all" && report.city !== filters.city) return false;
    if (filters.documentStatus && filters.documentStatus !== "all" && report.status !== filters.documentStatus) return false;
    return true;
  });
}

// --- Skeleton Loader ---
const ReportsTableSkeleton = () => (
  <div className="bg-white rounded-lg border shadow-sm">
    <div className="border-b">
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left p-4">Date</th>
            <th className="text-left p-4">Employee</th>
            <th className="text-left p-4">City</th>
            <th className="text-left p-4">Type</th>
            <th className="text-left p-4">Status</th>
            <th className="text-left p-4">Notes</th>
            <th className="text-left p-4">Actions</th>
          </tr>
        </thead>
      </table>
    </div>
    <div className="overflow-y-auto max-h-[500px]">
      <table className="w-full">
        <tbody>
          {[...Array(4)].map((_, i) => (
            <tr key={i} className="border-b">
              {Array.from({ length: 7 }).map((_, j) => (
                <td key={j} className="p-4">
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export function ReportsContent() {
  const { toast } = useToast();
  // --- State ---
  const [filters, setFilters] = useState<Filters>({
    employee: "all",
    type: "all",
    status: "all",
    city: "all",
    documentStatus: "all",
  });
  const [dateRange, setDateRange] = useState<DateRange>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });
  const [page, setPage] = useState(1);
  const [onlyToday, setOnlyToday] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  
  // Track operation states to prevent multiple submissions
  const [isDownloading, setIsDownloading] = useState(false);
  const [processingReportIds, setProcessingReportIds] = useState<Set<string>>(new Set());
  
  const PAGE_SIZE = 10;

  // Build query params for SWR
  const params = new URLSearchParams({
        page: page.toString(),
        pageSize: PAGE_SIZE.toString(),
        type: filters.type,
        status: filters.status,
        employeeId: filters.employee,
        city: filters.city,
        onlyToday: onlyToday.toString(),
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
      });
  const url = `/api/admin/reports?${params.toString()}`;

  const { data, error, isLoading, mutate } = useSWR(url, (url) => fetch(url, {
    headers: {
      "Cache-Control": "no-cache",
      "Pragma": "no-cache"
    }
  }).then(res => {
    if (!res.ok) throw new Error("Failed to fetch reports");
    return res.json();
  }));

  const reports: Report[] = data?.reports || [];
  const totalPages = data?.totalPages || 1;
  const totalReports = data?.total || 0;

  // --- Employee Filter Options ---
  const employeeOptions = useMemo(() => {
    const unique: { [id: string]: string } = {};
    reports.forEach((r) => {
      unique[r.employeeId] = r.employeeName;
    });
    return Object.entries(unique).map(([id, name]) => ({ id, name }));
  }, [reports]);

  // --- Status update handler ---
  const handleStatusUpdate = async (reportId: string, newStatus: string) => {
    // Prevent multiple submissions for the same report
    if (processingReportIds.has(reportId)) {
      toast({
        title: "Operation in progress",
        description: "Please wait for the current operation to complete.",
        variant: "default"
      });
      return;
    }
    
    // Add to processing set
    setProcessingReportIds(prev => new Set(prev).add(reportId));
    
    try {
      // Show immediate feedback toast
      toast({
        title: `${newStatus === 'approved' ? 'Approving' : 'Rejecting'} report`,
        description: "Please wait...",
      });
      
      const response = await fetch(`/api/admin/reports/${reportId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update status');
      }
      
      await mutate();
      
      toast({
        title: `Report ${newStatus === 'approved' ? 'Approved' : 'Rejected'}`,
        description: `Report has been ${newStatus === 'approved' ? 'approved' : 'rejected'} successfully.`,
      });
    } catch (error) {
      toast({
        title: 'Status Update Failed',
        description: 'Failed to update report status. Please try again.',
        variant: 'destructive',
      });
      console.error('Failed to update report status:', error);
    } finally {
      // Remove from processing set
      setProcessingReportIds(prev => {
        const updated = new Set(prev);
        updated.delete(reportId);
        return updated;
      });
    }
  };

  // --- Excel download handler ---
  const handleDownloadExcel = () => {
    if (!reports.length) {
      toast({
        title: "No data to export",
        description: "There are no reports matching your current filters.",
        variant: "default"
      });
      return;
    }
    
    // Prevent multiple download operations
    if (isDownloading) {
      toast({
        title: "Download in progress",
        description: "Please wait for the current download to complete.",
        variant: "default"
      });
      return;
    }
    
    setIsDownloading(true);
    
    try {
      // Show immediate feedback toast
      toast({
        title: "Preparing Excel file",
        description: "Please wait...",
      });
      
      // Set a timeout to handle potential XLSX processing issues
      const timeoutId = setTimeout(() => {
        setIsDownloading(false);
        toast({
          title: "Export Timeout",
          description: "The export is taking longer than expected. Please try again.",
          variant: "destructive"
        });
      }, 15000); // 15 second timeout
      
      // Prepare data for export (only visible columns)
      const exportData = reports.map(r => ({
        Employee: r.employeeName || "Unknown",
        City: r.city || "Unknown",
        Type: r.type || "Unknown",
        Status: r.status || "Pending",
        Date: r.date ? new Date(r.date).toLocaleDateString() : "Unknown",
        Notes: r.notes || ""
      }));
      
      if (exportData.length === 0) {
        clearTimeout(timeoutId);
        setIsDownloading(false);
        toast({
          title: "No Data to Export",
          description: "There are no records matching your current filters.",
          variant: "default"
        });
        return;
      }
      
      try {
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reports");
        
        // Use a more reliable filename with date
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
        const filename = `reports_${dateStr}.xlsx`;
        
        XLSX.writeFile(wb, filename);
        clearTimeout(timeoutId);
        
        toast({
          title: "Export Successful",
          description: `The Excel file "${filename}" has been downloaded.`,
        });
      } catch (xlsxError) {
        clearTimeout(timeoutId);
        console.error("XLSX processing error:", xlsxError);
        toast({
          title: "Export Processing Failed",
          description: "Failed to process the Excel file. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export the reports. Please try again.",
        variant: "destructive"
      });
      console.error("Failed to export reports:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  // --- Filter Bar ---
  const FilterBar = ({ filters, setFilters }: { filters: Filters; setFilters: React.Dispatch<React.SetStateAction<Filters>> }) => (
    <div className="flex flex-wrap gap-4 p-4 bg-muted rounded-lg mb-4">
      <div className="flex flex-col items-start gap-1 bg-blue-50 border border-blue-200 rounded-lg p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className={
              `bg-blue-100 border border-blue-300 rounded-md text-blue-900 font-medium px-4 py-2 shadow-sm transition-colors duration-150 ` +
              (onlyToday
                ? "bg-blue-200 border-blue-400"
                : "hover:bg-blue-200 hover:border-blue-400")
            }
            onClick={() => {
              setOnlyToday(!onlyToday);
              setPage(1); // Reset to first page when filter changes
            }}
            title={onlyToday ? "Show all history reports" : "Show only today's reports"}
          >
            {onlyToday ? <History className="h-4 w-4 mr-1" /> : <Calendar className="h-4 w-4 mr-1" />}
            {onlyToday ? "Show All History" : "Show Only Today"}
          </Button>
        </div>
        <span className="text-xs text-muted-foreground ml-1">
          {onlyToday
            ? "Currently showing only today's reports. Click to view all history."
            : "Currently showing all history. Click to view only today's reports."}
        </span>
      </div>
      {!onlyToday && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="border rounded px-2 py-1 text-sm bg-white"
            value={format(dateRange.from, 'yyyy-MM-dd')}
            max={format(dateRange.to, 'yyyy-MM-dd')}
            onChange={e => {
              setDateRange(dr => ({ ...dr, from: new Date(e.target.value) }));
              setPage(1);
            }}
          />
          <span className="mx-1 text-muted-foreground">to</span>
          <input
            type="date"
            className="border rounded px-2 py-1 text-sm bg-white"
            value={format(dateRange.to, 'yyyy-MM-dd')}
            min={format(dateRange.from, 'yyyy-MM-dd')}
            onChange={e => {
              setDateRange(dr => ({ ...dr, to: new Date(e.target.value) }));
              setPage(1);
            }}
          />
                </div>
      )}
      {/* City */}
      <Select 
        value={filters.city} 
        onValueChange={(v) => {
          setFilters((f) => ({ ...f, city: v }));
          setPage(1); // Reset to first page when filter changes
        }}
      >
        <SelectTrigger className="w-[150px]"><SelectValue placeholder="City" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Cities</SelectItem>
          {CITIES.map((city) => (
            <SelectItem key={city} value={city}>{city}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* Employee */}
      <Select 
        value={filters.employee} 
        onValueChange={(v) => {
          setFilters((f) => ({ ...f, employee: v }));
          setPage(1); // Reset to first page when filter changes
        }}
      >
        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Employee" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Employees</SelectItem>
          {employeeOptions.map((emp) => (
            <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* Type */}
      <Select 
        value={filters.type} 
        onValueChange={(v) => {
          setFilters((f) => ({ ...f, type: v }));
          setPage(1); // Reset to first page when filter changes
        }}
      >
        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Type" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="time">Time</SelectItem>
          <SelectItem value="absence">Absence</SelectItem>
          <SelectItem value="sales">Sales</SelectItem>
        </SelectContent>
      </Select>
      {/* Status */}
      <Select 
        value={filters.status} 
        onValueChange={(v) => {
          setFilters((f) => ({ ...f, status: v }));
          setPage(1); // Reset to first page when filter changes
        }}
      >
        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
        </SelectContent>
      </Select>
                </div>
  );

  // --- Table ---
  interface ReportsTableProps {
    data: Report[];
    onStatusUpdate: (id: string, status: string) => void;
    loading: boolean;
    page: number;
    setPage: (page: number) => void;
    totalPages: number;
  }

  function ReportsTable({ data, onStatusUpdate, loading, page, setPage, totalPages }: ReportsTableProps) {
    return (
          <Card>
        <CardContent className="p-0">
          <div className="h-[400px] sm:h-[600px] overflow-y-auto w-full">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">Loading...</TableCell>
                  </TableRow>
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No reports found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((report: Report) => (
                    <TableRow key={report.id}>
                      <TableCell>{report.employeeName}</TableCell>
                      <TableCell>{report.city}</TableCell>
                      <TableCell>{report.type}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="secondary" onClick={() => openDetailsModal(report)}>
                          View Details
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            report.status === "approved"
                              ? "default"
                              : report.status === "rejected"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {report.status || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(report.date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {report.status === "pending" ? (
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => onStatusUpdate(report.id, "approved")}
                              disabled={processingReportIds.has(report.id)}
                            > 
                              {processingReportIds.has(report.id) ? (
                                <>
                                  <span className="animate-spin mr-1">⏳</span> Processing...
                                </>
                              ) : (
                                <>
                                  <Check className="h-4 w-4 mr-1" /> Approve
                                </>
                              )}
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => onStatusUpdate(report.id, "rejected")}
                              disabled={processingReportIds.has(report.id)}
                            > 
                              {processingReportIds.has(report.id) ? (
                                <>
                                  <span className="animate-spin mr-1">⏳</span> Processing...
                                </>
                              ) : (
                                <>
                                  <X className="h-4 w-4 mr-1" /> Reject
                                </>
                              )}
                            </Button>
                          </div>
                        ) : (
                          <span>-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
                    </div>
          {/* Showing X reports summary */}
          <div className="flex justify-end items-center px-4 py-2 text-sm text-muted-foreground">
            Showing {totalReports} reports
                  </div>
          {/* Pagination Controls */}
          <div className="flex justify-end items-center gap-2 p-4 border-t">
            <Button size="sm" variant="outline" onClick={() => setPage(1)} disabled={page <= 1 || loading}>
              First
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPage(page - 1)} disabled={page <= 1 || loading}>
              Previous
            </Button>
            <span>Page {page} of {totalPages}</span>
            <Button size="sm" variant="outline" onClick={() => setPage(page + 1)} disabled={page >= totalPages || loading}>
              Next
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPage(totalPages)} disabled={page >= totalPages || loading}>
              Last
            </Button>
              </div>
            </CardContent>
          </Card>
    );
  }

  // --- Custom Modal for Details ---
  // ESC key and overlay click close support
  useEffect(() => {
    if (!detailsModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDetailsModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detailsModalOpen]);

  const openDetailsModal = (report: Report) => {
    setSelectedReport(report);
    setDetailsModalOpen(true);
  };
  const closeDetailsModal = () => {
    setDetailsModalOpen(false);
    setSelectedReport(null);
  };

  const ReportDetailsModal = () => (
    detailsModalOpen && selectedReport ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeDetailsModal}>
        <div
          className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md relative animate-fade-in"
          onClick={e => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <button
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
            onClick={closeDetailsModal}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 mb-6">
            {selectedReport.type === "time" && <Clock className="w-5 h-5 text-gray-500" />}
            {selectedReport.type === "absence" && <Calendar className="w-5 h-5 text-gray-500" />}
            {selectedReport.type === "sales" && <ShoppingCart className="w-5 h-5 text-gray-500" />}
            <h3 className="text-xl font-semibold text-gray-800">
              {selectedReport.type.charAt(0).toUpperCase() + selectedReport.type.slice(1)} Report Details
            </h3>
                </div>
          <dl className="grid grid-cols-2 gap-y-4 gap-x-4">
            {selectedReport.type === "time" && <>
              <dt className="text-sm text-gray-600 font-medium">Hours:</dt>
              <dd className="text-sm text-gray-900">{selectedReport.details.hours}</dd>
              <dt className="text-sm text-gray-600 font-medium">Overtime:</dt>
              <dd className="text-sm text-gray-900">{selectedReport.details.overtimeHours}</dd>
              <dt className="text-sm text-gray-600 font-medium">Undertime:</dt>
              <dd className="text-sm text-gray-900">{selectedReport.details.undertimeHours}</dd>
            </>}
            {selectedReport.type === "absence" && <>
              <dt className="text-sm text-gray-600 font-medium">Type:</dt>
              <dd className="text-sm text-gray-900">{selectedReport.details.absenceType}</dd>
              <dt className="text-sm text-gray-600 font-medium">Duration:</dt>
              <dd className="text-sm text-gray-900">{selectedReport.details.duration} days</dd>
            </>}
            {selectedReport.type === "sales" && <>
              <dt className="text-sm text-gray-600 font-medium">Product:</dt>
              <dd className="text-sm text-gray-900">{selectedReport.details.productName}</dd>
              <dt className="text-sm text-gray-600 font-medium">Quantity:</dt>
              <dd className="text-sm text-gray-900">{selectedReport.details.quantity}</dd>
              <dt className="text-sm text-gray-600 font-medium">Amount:</dt>
              <dd className="text-sm text-gray-900">{selectedReport.details.amount}</dd>
            </>}
          </dl>
          {selectedReport.notes && (
            <div className="mt-6 p-3 bg-gray-50 border border-gray-200 rounded text-gray-700 text-sm">
              <span className="font-semibold">Notes:</span> {selectedReport.notes}
                    </div>
          )}
                    </div>
                  </div>
    ) : null
  );

  // --- Render ---
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Reports</h2>
        <Button
          variant="default"
          className={`${isDownloading ? 'bg-gray-500 cursor-not-allowed' : 'bg-black hover:bg-gray-800'} 
                    text-white px-4 py-2 rounded shadow transition-colors duration-150`}
          onClick={handleDownloadExcel}
          disabled={isDownloading || reports.length === 0 || isLoading}
        >
          {isDownloading ? (
            <>
              <span className="animate-spin inline-block mr-1">⏳</span> Exporting...
            </>
          ) : (
            'Export to Excel'
          )}
        </Button>
              </div>
      <FilterBar filters={filters} setFilters={setFilters} />
      {isLoading ? <ReportsTableSkeleton /> : (
      <ReportsTable
        data={reports}
        onStatusUpdate={handleStatusUpdate}
        loading={isLoading}
        page={page}
        setPage={setPage}
        totalPages={totalPages}
      />
      )}
      <ReportDetailsModal />
    </section>
  );
}
