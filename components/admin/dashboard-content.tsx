"use client"

import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import { ArrowUpRight, BarChart3, CalendarDays, DollarSign, FileText, MapPin, Users, Building2, Bell } from "lucide-react"
import Link from "next/link"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import dynamic from 'next/dynamic'

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"

import { AttendanceChart } from "@/components/charts/attendance-chart"
import { fetchWithCache } from "@/lib/data-fetching"
import { PaginationControls } from "@/components/pagination-controls"
import { DashboardStatsCards } from "@/components/admin/DashboardStatsCards"
import { useDashboardStats } from "@/hooks/useDashboardStats"
import { TopPerformersTable, TopPerformersTableSkeleton } from "@/components/admin/TopPerformersTable"
import { useTopPerformers } from "@/hooks/useTopPerformers"
import { useAttendanceRecords } from "@/hooks/useAttendanceRecords"
import { AttendanceRecordsTable, AttendanceRecordsTableSkeleton } from "@/components/admin/AttendanceRecordsTable"
import { getAvatarImage, getAvatarInitials } from "@/lib/avatar-utils"

// Types for dashboard data
interface DashboardStats {
  totalEmployees: number
  employeeGrowth: number
  attendanceToday: number
  attendanceRate: number
  totalSales: number
  salesGrowth: number
  pendingSalaries: number
  pendingSalariesCount: number
}

interface TopPerformer {
  id: string
  name: string
  location: string
  sales: number
  topProducts?: { name: string; amount: number }[]
  avatar?: string
}

interface AttendanceRecord {
  id: number
  name: string
  city: string
  checkInTime: string
  status: "Present" | "Late" | "Absent"
  avatar?: string
}

// Utility function to format large numbers
function formatLargeNumber(num: number | null | undefined): string {
  if (!num) return "0";
  if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
  if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
  return num.toLocaleString();
}

// Component for top performers list
const TopPerformersList = ({ performers }: { performers: TopPerformer[] }) => (
  <div className="space-y-8 w-full max-w-full h-[420px] overflow-y-scroll overflow-x-auto">
    {performers.map((performer, index) => (
      <div key={performer.id} className="flex items-center justify-between gap-8 pr-4">
        <div className="flex items-center min-w-0">
          <Avatar className="h-9 w-9 min-w-[2.25rem]">
          <AvatarImage 
            src={getAvatarImage({ 
              image: performer.user?.image, 
              pictureUrl: performer.employee?.pictureUrl 
            })} 
            alt={performer.name} 
          />
          <AvatarFallback>
            {getAvatarInitials(performer.name)}
          </AvatarFallback>
        </Avatar>
          <div className="ml-4 space-y-1 min-w-0">
            <p className="text-sm font-medium leading-none truncate">{performer.name}</p>
          <div className="flex items-center text-sm text-muted-foreground">
            <MapPin className="mr-1 h-3 w-3" />
              <span className="truncate">{performer.location}</span>
            </div>
            {Array.isArray(performer.topProducts) && performer.topProducts.length > 0 && (
              <div className="text-xs text-blue-600 font-medium mt-1 whitespace-nowrap overflow-x-hidden scrollbar scrollbar-thumb-gray-300 scrollbar-track-gray-100" style={{ WebkitOverflowScrolling: 'touch' }}>
                Top Products: {(performer.topProducts ?? []).map((p, i) => (
                  <span key={p.name}>
                    {p.name} <span className="text-muted-foreground">(${p.amount.toLocaleString()})</span>{i < (performer.topProducts?.length ?? 0) - 1 ? ', ' : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="ml-8 font-semibold text-lg whitespace-nowrap">${performer.sales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
    ))}
  </div>
)

// Loading skeleton for top performers
const TopPerformersListSkeleton = () => (
  <div className="space-y-8">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="flex items-center">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="ml-4 space-y-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="ml-auto h-4 w-16" />
      </div>
    ))}
  </div>
)

// Component for attendance records
const AttendanceRecordsList = ({ records }: { records: AttendanceRecord[] }) => (
  <div className="space-y-4 max-h-[350px] overflow-y-auto overflow-x-auto w-full max-w-full">
    <div className="grid grid-cols-[25px_1fr_120px_120px_120px] items-center gap-4">
      <span className="font-medium">#</span>
      <span className="font-medium">Employee</span>
      <span className="font-medium">City</span>
      <span className="font-medium">Check In</span>
      <span className="font-medium">Status</span>
    </div>
    {records.map((record) => (
      <div key={record.id} className="grid grid-cols-[25px_1fr_120px_120px_120px] items-center gap-4">
        <span className="text-muted-foreground">{record.id}</span>
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage 
              src={getAvatarImage({ 
                image: record.user?.image, 
                pictureUrl: record.employee?.pictureUrl 
              })} 
              alt={record.name} 
            />
            <AvatarFallback>
              {getAvatarInitials(record.name)}
            </AvatarFallback>
          </Avatar>
          <span>{record.name}</span>
        </div>
        <span>{record.city}</span>
        <span>{record.checkInTime}</span>
        <Badge
          variant="outline"
          className={
            record.status === "Present"
              ? "bg-green-50 text-green-700 border-green-200"
              : record.status === "Late"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-red-50 text-red-700 border-red-200"
          }
        >
          {record.status}
        </Badge>
      </div>
    ))}
  </div>
)

// Loading skeleton for attendance records
const AttendanceRecordsListSkeleton = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-[25px_1fr_120px_120px_120px] items-center gap-4">
      <span className="font-medium">#</span>
      <span className="font-medium">Employee</span>
      <span className="font-medium">City</span>
      <span className="font-medium">Check In</span>
      <span className="font-medium">Status</span>
    </div>
    {[...Array(4)].map((_, i) => (
      <div key={i} className="grid grid-cols-[25px_1fr_120px_120px_120px] items-center gap-4">
        <Skeleton className="h-4 w-4" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    ))}
  </div>
)

// Custom legend for grouped bar chart
const CityLegend = ({ cities }: { cities: string[] }) => {
  const colors = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#06b6d4', '#22d3ee', '#fbbf24', '#f87171'];
  return (
    <div
      style={{
        position: "absolute",
        top: -70,
        right: 16,
        left: "auto",
        maxWidth: 350,
        maxHeight: 60,
        background: "rgba(255,255,255,0.95)",
        borderRadius: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        padding: "4px 8px",
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        alignItems: "center",
        zIndex: 2,
        fontSize: 13,
        whiteSpace: "normal",
        overflowY: "auto"
      }}
    >
      {cities.map((city, index) => (
        <span key={city} style={{ display: "flex", alignItems: "center", marginRight: 8, marginBottom: 4 }}>
          <span style={{
            display: "inline-block",
            width: 12,
            height: 12,
            borderRadius: 3,
            background: colors[index % colors.length],
            marginRight: 4,
            border: "1px solid #e5e7eb"
          }} />
          <span style={{ fontSize: 13, color: "#333", fontWeight: 500 }}>{city}</span>
        </span>
      ))}
    </div>
  );
};

// Import admin API client with CSRF protection
import adminApiClient from "@/lib/admin-api-client";

const fetchAttendanceRecords = async (): Promise<AttendanceRecord[]> => {
  const res = await fetch("/api/admin/dashboard/attendance/today");
  if (!res.ok) throw new Error("Failed to fetch today's attendance");
  const data = await res.json();
  // Map API response to AttendanceRecord type
  return data.map((item: any, idx: number) => ({
    id: idx + 1, // Use index as id for display
    name: item.name,
    city: item.city,
    checkInTime: item.checkInTime,
    status: item.status,
    avatar: undefined, // Or map if available
  }));
}

function TopPerformersCard({ active, loading }: { active: boolean; loading: boolean }) {
  const [selectedCity, setSelectedCity] = useState<string>('All');
  const {
    performers,
    total,
    page,
    pageSize,
    setPage,
    setPageSize,
    isLoading,
    error,
  } = useTopPerformers(1, 4, selectedCity);
  const cityOptions = ['All', 'Jakarta', 'Surabaya', 'Bandung'];
  return (
    <Card className="col-span-7 w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Top Performers</CardTitle>
          <CardDescription>Your top performing employees this month.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="city-filter" className="text-sm font-medium">City:</label>
          <select
            id="city-filter"
            value={selectedCity}
            onChange={e => { setSelectedCity(e.target.value); setPage(1); }}
            className="border rounded px-2 py-1 text-sm"
          >
            {cityOptions.map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent style={{ padding: 0 }}>
        <div className="overflow-x-auto w-full max-w-full">
          {loading || isLoading ? <TopPerformersTableSkeleton /> : error ? (
            <div className="text-red-600 py-8 text-center">{error.message || 'Failed to load top performers'}</div>
          ) : (
            <TopPerformersTable
              performers={performers}
              total={total}
              page={page}
              pageSize={pageSize}
              setPage={setPage}
              setPageSize={setPageSize}
            />
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Link href="/admin/sales" className="text-sm text-blue-600 hover:underline flex items-center">
          View detailed performance
          <ArrowUpRight className="ml-1 h-3 w-3" />
        </Link>
      </CardFooter>
    </Card>
  );
}

function AttendanceTabContent({ active }: { active: boolean }) {
  const {
    records: attendanceRecords,
    total,
    page,
    pageSize,
    setPage,
    setPageSize,
    isLoading: attendanceLoading,
    error: attendanceError,
  } = useAttendanceRecords();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Recent Attendance</CardTitle>
        <CardDescription>Today's attendance records</CardDescription>
      </CardHeader>
      <CardContent>
        {attendanceLoading ? (
          <AttendanceRecordsTableSkeleton />
        ) : attendanceError ? (
          <div className="text-red-600 py-8 text-center">{attendanceError.message || 'Failed to load attendance records'}</div>
        ) : attendanceRecords ? (
          <AttendanceRecordsTable
            records={attendanceRecords}
            total={total}
            page={page}
            pageSize={pageSize}
            setPage={setPage}
            setPageSize={setPageSize}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

// Add dynamic import for ExportButton
const ExportButton = dynamic(() => import('./ExportButton'), {
  ssr: false,
  loading: () => (
    <Button variant="outline" disabled>
      <FileText className="mr-2 h-4 w-4" />
      Loading...
    </Button>
  ),
});

export function AdminDashboardContent() {
  const { data: session } = useSession();
  const router = useRouter();

  // Move all hooks here, before any return
  const [activeTab, setActiveTab] = useState("overview")
  const { stats, isLoading: statsLoading, error: statsError, isMinimalData } = useDashboardStats();
  const currentYear = new Date().getFullYear();
  const [cityYear, setCityYear] = useState(currentYear);
  const years = Array.from({ length: 31 }, (_, i) => currentYear + i);
  const [groupedCities, setGroupedCities] = useState<string[]>([]);
  const [salesView, setSalesView] = useState<'city' | 'product'>('city');
  const [productList, setProductList] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>('');
  const cityOptions = ['All', 'Jakarta', 'Surabaya', 'Bandung'];
  const chartRef = useRef<HTMLDivElement>(null);
  const attendanceChartRef = useRef<HTMLDivElement>(null);
  const { performers: topPerformers } = useTopPerformers();
  const { records: attendanceRecords } = useAttendanceRecords();

  // Add back the handleTabChange function
  const handleTabChange = (value: string) => {
    setActiveTab(value)
  }

  const defaultStats = {
    totalEmployees: 0,
    employeeGrowth: 0,
    attendanceToday: 0,
    attendanceRate: 0,
    totalSales: 0,
    salesGrowth: 0,
    pendingSalaries: 0,
    pendingSalariesCount: 0,
  };

  // Remove loading check and return immediately
  return (
    <div className="w-full p-4 md:p-6 pb-20 pt-4 md:pt-0">
      {/* Dashboard header - static content, no skeleton needed */}
      <div className="sticky top-0 bg-background z-40 pt-4 pb-4 border-b shadow-sm transition-all duration-300 w-full mb-4">
        <div className="w-full px-4 md:px-6 flex flex-row items-center justify-between gap-4">
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            
            {/* Replace the Button with ExportButton */}
            <ExportButton 
              chartRef={chartRef} 
              attendanceChartRef={attendanceChartRef}
              disabled={activeTab !== "sales"}
            />
        </div>
        </div>

      <div className="flex flex-col w-full">
        {/* Dynamic content with skeleton */}
        <DashboardStatsCards 
          stats={stats || defaultStats} 
          loading={statsLoading} 
          isMinimalData={isMinimalData}
        />

        {/* Rest of the dynamic content with appropriate skeleton loading */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4 mt-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              <TopPerformersCard active={activeTab === "overview"} loading={statsLoading} />
            </div>
          </TabsContent>

          <TabsContent value="attendance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Attendance Overview</CardTitle>
                <CardDescription>Daily attendance records for the current month.</CardDescription>
              </CardHeader>
              <CardContent>
                <div ref={attendanceChartRef}>
                  <AttendanceChart loading={statsLoading} />
                </div>
              </CardContent>
            </Card>
            {statsLoading ? (
              <AttendanceRecordsTableSkeleton />
            ) : (
            <AttendanceTabContent active={activeTab === "attendance"} />
            )}
          </TabsContent>

          <TabsContent value="sales" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Products Sold by City</CardTitle>
                <CardDescription>Number of each product sold in every city for the selected year.</CardDescription>
                <div className="mt-2 flex gap-4 items-center">
                  <label htmlFor="products-by-city-year" className="mr-2 font-medium">Year:</label>
                  <select
                    id="products-by-city-year"
                    value={cityYear}
                    onChange={e => setCityYear(Number(e.target.value))}
                    className="border rounded px-2 py-1"
                  >
                    {years.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </CardHeader>
              <CardContent style={{ position: 'relative', minHeight: 350 }}>
                <div className="w-full max-w-full overflow-x-auto" ref={chartRef}>
                  <SalesPerformanceChart year={cityYear} view="city" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function SalesPerformanceChart({ year, view }: { year: number; view: 'city' | 'product' }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState<string>('All');
  const [period, setPeriod] = useState<string>('monthly');
  const cityOptions = ['All', 'Jakarta', 'Surabaya', 'Bandung'];
  const periodOptions = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' }
  ];

  useEffect(() => {
    setLoading(true);
    // Use the optimized endpoints with aggregation parameters
    const url = view === 'city'
      ? `/api/admin/sales-by-city?year=${year}&period=${period}&limit=5`
      : `/api/admin/sales-by-product?year=${year}&period=${period}&limit=10`;
    
    fetch(url)
      .then(res => res.json())
      .then(resData => {
        let filtered = resData;
        if (selectedCity && selectedCity !== 'All' && view === 'city') {
          filtered = resData.filter((c: any) => c.city === selectedCity);
        }
        setData(filtered);
        setLoading(false);
      });
  }, [year, view, selectedCity, period]);

  // Skeleton data for loading state
  const skeletonData = Array.from({ length: period === 'yearly' ? 1 : period === 'quarterly' ? 4 : 12 }).map((_, i) => {
    const entry: any = { 
      period: period === 'yearly' ? year.toString() : 
             period === 'quarterly' ? `Q${i + 1}` : 
             `M${i + 1}`
    };
    cityOptions.forEach(city => {
      if (city !== 'All') entry[city] = 0;
    });
    return entry;
  });

  // Transform data based on the response format
  const chartData = loading ? skeletonData : (
    view === 'city' && data.length > 0 ? 
      // City view - transform data for chart
      data[0].data.map((periodData: any, i: number) => {
        const entry: any = { period: periodData.period };
        data.forEach((cityData: any) => {
          entry[cityData.city] = cityData.data[i].totalSales;
        });
        return entry;
      }) : 
    // Product view - transform data for chart
    view === 'product' && data.length > 0 && data[0].data ? 
      data[0].data.map((periodData: any, i: number) => {
        const entry: any = { period: periodData.period };
        data.forEach((productData: any) => {
          entry[productData.product] = productData.data[i].totalSales;
        });
        return entry;
      }) :
    // Fallback for yearly product view or empty data
    []
  );

  const chartPadding = { top: 24, right: 24, left: 24, bottom: 24 };
  
  // Extract keys for the chart
  const keys = view === 'city' ? 
    data.length > 0 ? data.map(item => item.city) : cityOptions.filter(c => c !== 'All') :
    data.length > 0 ? data.map(item => item.product).slice(0, 5) : [];
  
  const colors = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#06b6d4', '#22d3ee', '#fbbf24', '#f87171'];

  return (
    <div>
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        {view === 'city' && (
          <>
            <label htmlFor="products-by-city-city" className="font-medium">City:</label>
            <select
              id="products-by-city-city"
              value={selectedCity}
              onChange={e => setSelectedCity(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              {cityOptions.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </>
        )}
        
        <label htmlFor="data-period" className="font-medium ml-4">Period:</label>
        <select
          id="data-period"
          value={period}
          onChange={e => setPeriod(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          {periodOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      
      <ResponsiveContainer width="100%" height={340}>
        <BarChart 
          data={chartData} 
          margin={{ ...chartPadding, bottom: 48 }} 
          barCategoryGap={16}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="period" 
            stroke="#888" 
            fontSize={15} 
            fontWeight={600} 
            tickLine={false} 
            axisLine={false} 
            angle={-30} 
            textAnchor="end" 
            height={48} 
          />
          <YAxis 
            stroke="#888" 
            fontSize={15} 
            fontWeight={600} 
            tickLine={false} 
            axisLine={false} 
            tickFormatter={v => `$${v}`} 
          />
          <Tooltip />
          {keys.map((key, idx) => (
            <Bar
              key={key}
              dataKey={key}
              fill={colors[idx % colors.length]}
              fillOpacity={loading ? 0.3 : 1}
              isAnimationActive={!loading}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}