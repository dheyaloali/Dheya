"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { BarChart3, CalendarDays, Table, ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { DateRange } from "react-day-picker";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast"
import { useSalesRecords } from "@/hooks/useSalesRecords";
import { useSalesTrends } from "@/hooks/useSalesTrends";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrency } from "@/components/providers/currency-provider";

const sections = [
  { key: "by-product", label: "Sales Trends", icon: <BarChart3 className="w-6 h-6" /> },
  { key: "all", label: "All Sales Records", icon: <Table className="w-6 h-6" /> },
];

export default function AdminSalesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [section, setSection] = useState("by-product");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [salesPage, setSalesPage] = useState(1);
  const [salesPageSize, setSalesPageSize] = useState(10);
  const [view, setView] = useState<'monthly' | 'yearly'>('monthly');
  const getCurrentYear = () => new Date().getFullYear();
  const [year, setYear] = useState(getCurrentYear());
  const [filterFromDate, setFilterFromDate] = useState<string>("");
  const [filterToDate, setFilterToDate] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("active");

  // Separate filter state for Sales Trends and All Sales Records
  const [trendsSelectedProducts, setTrendsSelectedProducts] = useState<string[]>([]);
  const [trendsSelectedEmployees, setTrendsSelectedEmployees] = useState<string[]>([]);
  const [recordsSelectedProducts, setRecordsSelectedProducts] = useState<string[]>([]);
  const [recordsSelectedEmployees, setRecordsSelectedEmployees] = useState<string[]>([]);
  const [recordsSelectedCities, setRecordsSelectedCities] = useState<string[]>([]);

  const { toast } = useToast();
  const { formatAmount } = useCurrency();

  // Helper to format date
  function formatDate(dateStr: string) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleDateString();
  }

  // Helper to format month number to name
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const formatMonth = (monthNum: number | string) => {
    const idx = typeof monthNum === "string" ? parseInt(monthNum, 10) - 1 : monthNum - 1;
    return monthNames[idx] || String(monthNum);
  };

  // Use SWR for paginated sales records
  const {
    sales: pagedSalesArchive,
    total: totalSales,
    isLoading: isSalesLoading,
    error: salesError,
    mutate: mutateSales
  } = useSalesRecords({
    page: salesPage,
    pageSize: salesPageSize,
    productId: recordsSelectedProducts,
    employeeId: recordsSelectedEmployees,
    city: recordsSelectedCities,
    status: filterStatus,
    from: filterFromDate,
    to: filterToDate,
  });
  const totalPagesArchive = Math.ceil(totalSales / salesPageSize);

  // SWR for sales trends/chart data
  const { data: trendsData, isLoading: isTrendsLoading, error: trendsError } = useSalesTrends({
    year,
    productId: trendsSelectedProducts,
    employeeId: trendsSelectedEmployees,
  });
  // Transform chart data for the chart (mimic previous logic)
  const productIdToName: Record<string, string> = {};
  products.forEach(p => { productIdToName[String(p.id)] = p.name; });
  const productIdsToShow = trendsSelectedProducts.length > 0
    ? trendsSelectedProducts
    : products.map(p => String(p.id));

  // Memoized chart data
  const memoizedChartData = useMemo(() => {
    if (!Array.isArray(trendsData)) return [];
    if (view === 'yearly') {
      const years = Array.from(new Set(trendsData.map((row: any) => row.year))).sort();
      return years.map((y: number) => {
        const entry: any = { year: y };
        productIdsToShow.forEach(pid => {
          const prodName = productIdToName[pid] || `Product ${pid}`;
          entry[prodName] = trendsData
            .filter((row: any) => (row.year === y) && ((row.productId && String(row.productId) === pid) || (row.product && row.product === prodName)))
            .reduce((sum: number, row: any) => sum + (row.totalSales ?? row.amount ?? row.sales ?? 0), 0);
        });
        return entry;
      });
    } else {
      const chartData = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const entry: any = { month };
        productIdsToShow.forEach(pid => {
          const prodName = productIdToName[pid] || `Product ${pid}`;
          entry[prodName] = 0;
        });
        return entry;
      });
      trendsData.forEach((row: any) => {
        const monthIdx = Number(row.month) - 1;
        const prodName = row.product || productIdToName[String(row.productId)] || `Product ${row.productId}`;
        if (chartData[monthIdx]) {
          chartData[monthIdx][prodName] = row.totalSales ?? row.amount ?? row.sales ?? 0;
        }
      });
      return chartData;
    }
  }, [trendsData, view, productIdsToShow, productIdToName]);

  // Excel download handlers
  const handleDownloadExcel = (data: any[], filename: string) => {
    if (!data.length) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales Records");
    XLSX.writeFile(wb, filename);
  };

  // For city dropdown, get unique cities from the full employees list
  const allCities = Array.from(new Set(employees.map(e => e.city)));

  // Assign a unique, consistent color to each product
  const productColorMap: Record<string, string> = {};
  products.forEach((p, idx) => {
    productColorMap[p.name] = `hsl(${(idx * 60) % 360}, 70%, 60%)`;
  });

  // For the Status filter in the All Sales Records section:
  const allStatuses = Array.from(new Set(employees.map(e => e.user?.status))).filter(Boolean);

  // Memoized sorted and filtered sales
  const sortedAndFilteredSales = useMemo(() => {
    return (pagedSalesArchive || [])
      .map((sale: any) => ({ ...sale, _date: new Date(sale.date || sale.createdAt || sale.updatedAt || 0) }))
      .sort((a: any, b: any) => b._date.getTime() - a._date.getTime())
      .filter((sale: any) => {
        if (filterStatus === 'all') return true;
        const emp = employees.find((e: any) => String(e.id) === String(sale.employeeId));
        return emp?.user?.status === filterStatus;
      });
  }, [pagedSalesArchive, filterStatus, employees]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    const fetchProducts = async () => {
      const response = await fetch("/api/products");
      const data = await response.json();
      setProducts(data.products);
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    const fetchEmployees = async () => {
      const response = await fetch("/api/employees");
      const data = await response.json();
      setEmployees(Array.isArray(data.employees) ? data.employees : Array.isArray(data) ? data : []);
    };
    fetchEmployees();
  }, []);

  useEffect(() => {
    toast({ title: "Sales Page Loaded", description: "This is a demo toast for Sales." });
  }, [toast]);

  // Reset salesPage to 1 when any records tab filter changes
  useEffect(() => {
    setSalesPage(1);
  }, [recordsSelectedProducts, recordsSelectedEmployees, recordsSelectedCities, filterStatus, filterFromDate, filterToDate, salesPageSize]);

  // Smart formatting for table cells
  function formatCell(col: string, value: any) {
    if (col.toLowerCase().includes('date') && value) {
      const d = new Date(value);
      return d.toLocaleDateString();
    }
    if (col.toLowerCase().includes('amount') || col.toLowerCase().includes('price') || col.toLowerCase().includes('total')) {
      return value != null ? formatAmount(Number(value)) : '-';
    }
    return value ?? '-';
  }

  // Sales table skeleton loader
  const SalesTableSkeleton = () => (
    <div className="bg-white rounded-lg border shadow-sm">
      <div className="border-b">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left p-4">Date</th>
              <th className="text-left p-4">Product</th>
              <th className="text-left p-4">Employee</th>
              <th className="text-left p-4">Amount</th>
              <th className="text-left p-4">Quantity</th>
              <th className="text-left p-4">Notes</th>
            </tr>
          </thead>
        </table>
      </div>
      <div className="overflow-y-auto max-h-[500px]">
        <table className="w-full">
          <tbody>
            {[...Array(4)].map((_, i) => (
              <tr key={i} className="border-b">
                <td className="p-4"><Skeleton className="h-4 w-24" /></td>
                <td className="p-4"><Skeleton className="h-4 w-32" /></td>
                <td className="p-4"><Skeleton className="h-4 w-32" /></td>
                <td className="p-4"><Skeleton className="h-4 w-20" /></td>
                <td className="p-4"><Skeleton className="h-4 w-16" /></td>
                <td className="p-4"><Skeleton className="h-4 w-32" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Empty state component
  const EmptyState = ({ message, subMessage }: { message: string; subMessage?: string }) => (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-lg border shadow-sm min-h-[300px]">
      <div className="text-gray-400 mb-2">
        <BarChart3 className="w-12 h-12 mx-auto" />
      </div>
      <h3 className="text-lg font-semibold text-gray-700 mb-1">{message}</h3>
      {subMessage && <p className="text-sm text-gray-500">{subMessage}</p>}
    </div>
  );

  // Memoized event handlers
  const handleSectionChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => setSection(e.target.value), []);
  const handleYearChange = useCallback((v: string) => setYear(Number(v)), []);
  const handleViewChange = useCallback((v: string) => setView(v as 'monthly' | 'yearly'), []);
  const handleDownload = useCallback(() => handleDownloadExcel(pagedSalesArchive, "sales.xlsx"), [pagedSalesArchive]);
  const handleFromDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setFilterFromDate(e.target.value), []);
  const handleToDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setFilterToDate(e.target.value), []);
  const handleStatusChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => setFilterStatus(e.target.value), []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-white p-8 pt-0 transition-all duration-300 w-full">
      {/* Sticky Sales View Filter Bar */}
      <div
        className="sticky top-0 z-20 bg-white rounded-r-2xl shadow-md flex items-center gap-4 px-6 py-4 mb-4 mt-0"
        style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, marginTop: 0 }}
      >
        <span className="text-lg font-semibold text-black">Sales View:</span>
        <div className="relative">
          <select
            aria-label="Sales View Selector"
            className="border border-blue-300 rounded-lg px-4 py-2 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all bg-white text-black font-medium hover:border-blue-400"
            value={section}
            onChange={handleSectionChange}
          >
            {sections.map(s => (
              <option key={s.key} value={s.key} className="text-black">{s.label}</option>
            ))}
          </select>
        </div>
      </div>
      {/* Business-Oriented Filters and Download Buttons */}
      {section === "all" && (
        <div className="mb-6 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium mb-1">From</label>
            <input type="date" className="border rounded px-2 py-1" value={filterFromDate} onChange={handleFromDateChange} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">To</label>
            <input type="date" className="border rounded px-2 py-1" value={filterToDate} onChange={handleToDateChange} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Product</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="border rounded px-2 py-1 bg-white w-48 text-left">
                  {recordsSelectedProducts.length === 0
                    ? "Select Products"
                    : recordsSelectedProducts.length === 1
                    ? products.find(p => String(p.id) === recordsSelectedProducts[0])?.name
                    : `${recordsSelectedProducts.length} selected`}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-60 overflow-y-auto w-48">
                {products.map(p => (
                  <DropdownMenuCheckboxItem
                    key={p.id}
                    checked={recordsSelectedProducts.includes(String(p.id))}
                    onCheckedChange={(checked: boolean) => {
                      if (checked) setRecordsSelectedProducts(prev => [...prev, String(p.id)]);
                      else setRecordsSelectedProducts(prev => prev.filter(id => id !== String(p.id)));
                    }}
                  >
                    {p.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Employee</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="border rounded px-2 py-1 bg-white w-48 text-left">
                  {recordsSelectedEmployees.length === 0
                    ? "Select Employees"
                    : recordsSelectedEmployees.length === 1
                    ? employees.find(e => String(e.id) === recordsSelectedEmployees[0])?.user?.name
                    : `${recordsSelectedEmployees.length} selected`}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-60 overflow-y-auto w-48">
                {employees.map(e => (
                  <DropdownMenuCheckboxItem
                    key={e.id}
                    checked={recordsSelectedEmployees.includes(String(e.id))}
                    onCheckedChange={(checked: boolean) => {
                      if (checked) setRecordsSelectedEmployees(prev => [...prev, String(e.id)]);
                      else setRecordsSelectedEmployees(prev => prev.filter(id => id !== String(e.id)));
                    }}
              >
                    {e.user?.name || 'Unknown'}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Status</label>
            <select className="border rounded px-2 py-1" value={filterStatus} onChange={handleStatusChange}>
              <option value="all">All</option>
              {allStatuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">City</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="border rounded px-2 py-1 bg-white w-40 text-left">
                  {recordsSelectedCities.length === 0
                    ? "Select Cities"
                    : recordsSelectedCities.length === 1
                    ? recordsSelectedCities[0]
                    : `${recordsSelectedCities.length} selected`}
              </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-60 overflow-y-auto w-40">
                {allCities.map(c => (
                  <DropdownMenuCheckboxItem
                    key={c}
                    checked={recordsSelectedCities.includes(c)}
                    onCheckedChange={(checked: boolean) => {
                      if (checked) setRecordsSelectedCities(prev => [...prev, c]);
                      else setRecordsSelectedCities(prev => prev.filter(city => city !== c));
                    }}
                  >
                    {c}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex flex-col gap-2 ml-4">
            <button aria-label="Download sales records as Excel" className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700" onClick={handleDownload}>Download</button>
          </div>
        </div>
      )}
        <h2 className="text-2xl font-bold mb-6 text-blue-700">{sections.find(s => s.key === section)?.label}</h2>
        {/* Section Content */}
        {section === "by-product" && (
            <div className="bg-white rounded shadow p-6 min-h-[300px]">
              {/* Filters inside the chart card */}
        <div className="flex flex-wrap gap-4 mb-6 items-end">
          <div>
                  <label className="block text-xs font-medium mb-1">View</label>
                  <Select value={view} onValueChange={handleViewChange}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="View" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {view === 'monthly' && (
                <div>
                  <label className="block text-xs font-medium mb-1">Year</label>
                  <Select value={String(year)} onValueChange={handleYearChange}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => getCurrentYear() - i).map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
            </div>
                )}
          <div>
            <label className="block text-xs font-medium mb-1">Product</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="border rounded px-2 py-1 bg-white w-48 text-left">
                    {trendsSelectedProducts.length === 0
                      ? "Select Products"
                      : trendsSelectedProducts.length === 1
                      ? products.find(p => String(p.id) === trendsSelectedProducts[0])?.name
                      : `${trendsSelectedProducts.length} selected`}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-60 overflow-y-auto w-48">
                  {products.map(p => (
                    <DropdownMenuCheckboxItem
                      key={p.id}
                      checked={trendsSelectedProducts.includes(String(p.id))}
                      onCheckedChange={(checked: boolean) => {
                        if (checked) setTrendsSelectedProducts(prev => [...prev, String(p.id)]);
                        else setTrendsSelectedProducts(prev => prev.filter(id => id !== String(p.id)));
                      }}
                    >
                      {p.name}
                    </DropdownMenuCheckboxItem>
                ))}
                </DropdownMenuContent>
              </DropdownMenu>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Employee</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="border rounded px-2 py-1 bg-white w-48 text-left">
                    {trendsSelectedEmployees.length === 0
                      ? "Select Employees"
                      : trendsSelectedEmployees.length === 1
                      ? employees.find(e => String(e.id) === trendsSelectedEmployees[0])?.user?.name
                      : `${trendsSelectedEmployees.length} selected`}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-60 overflow-y-auto w-48">
                  {employees.map(e => (
                    <DropdownMenuCheckboxItem
                      key={e.id}
                      checked={trendsSelectedEmployees.includes(String(e.id))}
                      onCheckedChange={(checked: boolean) => {
                        if (checked) setTrendsSelectedEmployees(prev => [...prev, String(e.id)]);
                        else setTrendsSelectedEmployees(prev => prev.filter(id => id !== String(e.id)));
                      }}
                    >
                      {e.user?.name || 'Unknown'}
                    </DropdownMenuCheckboxItem>
                ))}
                </DropdownMenuContent>
              </DropdownMenu>
          </div>
        </div>
              {/* Chart Section */}
              {isTrendsLoading ? (
                <div className="flex items-center justify-center min-h-[300px]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : trendsError ? (
                <EmptyState 
                  message="Error loading sales trends" 
                  subMessage="Please try again later or contact support if the problem persists."
                />
              ) : !memoizedChartData || memoizedChartData.length === 0 ? (
                <EmptyState 
                  message="No sales data available" 
                  subMessage={`No sales records found for the selected year and filters.\nTry adjusting your filters or add new sales records to see trends here.`}
                />
              ) : (
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={memoizedChartData} margin={{ left: 60, right: 20, top: 20, bottom: 20 }}>
              <XAxis
                dataKey={view === 'monthly' ? 'month' : 'year'}
                tickFormatter={view === 'monthly' ? (v, _i) => formatMonth(v) : (v, _i) => String(v)}
              />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatAmount(value)} />
              {(trendsSelectedProducts.length > 0 ? trendsSelectedProducts : products.map(p => String(p.id))).map((productId) => {
                const product = products.find(p => String(p.id) === productId);
                if (!product) return null;
                return (
                  <Bar key={productId} dataKey={product.name} fill={productColorMap[product.name]} />
                );
              })}
                </BarChart>
              </ResponsiveContainer>
                </div>
              )}
          </div>
        )}
        {section === "all" && (
          <div className="bg-white rounded shadow p-6">
              {isSalesLoading ? (
                <SalesTableSkeleton />
            ) : salesError ? (
              <EmptyState 
                message="Error loading sales records" 
                subMessage="Please try again later or contact support if the problem persists."
              />
            ) : !pagedSalesArchive || pagedSalesArchive.length === 0 ? (
              <EmptyState 
                message="No sales records found" 
                subMessage={`
                  ${filterFromDate || filterToDate ? 'No sales found for the selected date range.' : ''}
                  ${recordsSelectedProducts.length > 0 ? 'No sales found for the selected products.' : ''}
                  ${recordsSelectedEmployees.length > 0 ? 'No sales found for the selected employees.' : ''}
                  ${recordsSelectedCities.length > 0 ? 'No sales found for the selected cities.' : ''}
                  ${filterStatus !== 'all' ? 'No sales found for the selected status.' : ''}
                  ${!filterFromDate && !filterToDate && recordsSelectedProducts.length === 0 && 
                    recordsSelectedEmployees.length === 0 && recordsSelectedCities.length === 0 && 
                    filterStatus === 'all' ? 'No sales records available in the system.' : ''}
                `.trim()}
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full" role="table">
                    <thead>
                      <tr>
                      {Object.keys(pagedSalesArchive[0])
                          .filter(col => !['id', 'employeeid', 'productid'].includes(col.toLowerCase()))
                          .map((col) => (
                            <th scope="col" key={col} className="p-2">{col.charAt(0).toUpperCase() + col.slice(1)}</th>
                          ))}
                        <th scope="col" className="p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                    {sortedAndFilteredSales.map((sale: any, i: number) => (
                        <tr key={i} className="border-t hover:bg-blue-50">
                        {Object.keys(pagedSalesArchive[0])
                          .filter((col: string) => !['id', 'employeeid', 'productid'].includes(col.toLowerCase()))
                          .map((col: string) => (
                              <td key={col} className="p-2">{formatCell(col, sale[col])}</td>
                            ))}
                        <td className="p-2">{
                          (() => {
                            const emp = employees.find(e => String(e.id) === String(sale.employeeId));
                            return emp?.user?.status || '-';
                          })()
                        }</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

            </div>
            {/* Pagination */}
            <div className="flex flex-col md:flex-row justify-between items-center mt-4 gap-2">
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select
                  className="border rounded px-2 py-1 text-sm"
                  value={salesPageSize}
                  onChange={e => setSalesPageSize(Number(e.target.value))}
                >
                  {[5, 10, 20, 25, 50, 100].map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
              <div className="text-xs text-gray-500">Page {salesPage} of {totalPagesArchive}</div>
              <div className="flex gap-2">
                <button
                  className="px-2 py-1 rounded border text-xs disabled:opacity-50"
                  onClick={() => setSalesPage(1)}
                  disabled={salesPage === 1}
                >First</button>
                <button
                  className="px-2 py-1 rounded border text-xs disabled:opacity-50"
                  onClick={() => setSalesPage(p => Math.max(1, p - 1))}
                  disabled={salesPage === 1}
                >Prev</button>
                <button
                  className="px-2 py-1 rounded border text-xs disabled:opacity-50"
                  onClick={() => setSalesPage(p => Math.min(totalPagesArchive, p + 1))}
                  disabled={salesPage === totalPagesArchive || totalPagesArchive === 0}
                >Next</button>
                <button
                  className="px-2 py-1 rounded border text-xs disabled:opacity-50"
                  onClick={() => setSalesPage(totalPagesArchive)}
                  disabled={salesPage === totalPagesArchive || totalPagesArchive === 0}
                >Last</button>
              </div>
            </div>
              </>
            )}
          </div>
        )}
    </div>
  );
}
