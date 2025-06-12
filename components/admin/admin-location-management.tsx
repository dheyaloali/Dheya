"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { MapContainer } from "@/components/admin/map-container"
import { EmployeeList } from "@/components/admin/employee-list"
import { DateRangePicker } from "@/components/date-range-picker"
import { useToast } from "@/components/ui/use-toast"
import apiClient from "@/lib/api-client"
import { MapPin, History, Users, Battery, Clock } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import useSWR from "swr"
import { DateRange } from "react-day-picker"
import { ToastAction } from "@/components/ui/toast"
import { useAdminSocket } from "@/hooks/useAdminSocket"
import { useAdminSocketEvents } from "@/hooks/useAdminSocketEvents"
import { useEmployeeStore } from "@/hooks/useEmployeeStore"
import isEqual from "lodash.isequal"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, TableCaption } from "@/components/ui/table"
import { Popup } from "react-leaflet"
import * as XLSX from "xlsx"
import { Skeleton } from "@/components/ui/skeleton"

const CITIES = ["All", "Jakarta", "Surabaya", "Bandung"]

// Minimal type definitions for Employee and LocationHistory
export interface Employee {
  id: string;
  name: string;
  city?: string;
  department?: string;
  location: {
    latitude: number;
    longitude: number;
    timestamp: string;
  };
  batteryLevel?: number;
  user?: { name?: string };
  locations?: Array<{
    latitude: number;
    longitude: number;
    timestamp: string;
    batteryLevel?: number;
  }>;
}

export interface LocationHistory {
  latitude: number;
  longitude: number;
  timestamp: string;
  [key: string]: any;
}

// --- WebSocket configuration ---
const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001"; // Set your backend endpoint here

type WebSocketStatus = "connecting" | "connected" | "disconnected";

// --- Shared normalization function ---
function normalizeEmployees(rawEmployees: any[]): Employee[] {
  return rawEmployees
    .map((emp: any) => {
      const name = emp.user?.name ?? emp.name ?? "Unknown";
      const city = emp.city ?? "Unknown";
      let location = undefined;
      if (emp.locations && emp.locations.length > 0) {
        const loc = emp.locations[0];
        if (
          loc &&
          typeof loc.latitude === "number" &&
          typeof loc.longitude === "number" &&
          !isNaN(loc.latitude) &&
          !isNaN(loc.longitude)
        ) {
          location = loc;
        }
      }
      return {
        ...emp,
        name,
        city,
        location,
      };
    });
}

// --- Robust LocationHistoryTable ---
function LocationHistoryTable({
  employeeId,
  dateRange,
  selectedIndex,
  onSelect,
  page,
  setPage,
  pageSize,
  setPageSize,
  allLocationHistory
}: {
  employeeId: string;
  dateRange: { from: Date; to: Date };
  selectedIndex: number | null;
  onSelect: (idx: number) => void;
  page: number;
  setPage: (p: number) => void;
  pageSize: number;
  setPageSize: (s: number) => void;
  allLocationHistory: LocationHistory[]; // All locations for map correlation
}) {
  // SWR for paginated location history with optimized caching
  const { data, isLoading, mutate } = useSWR(
    ["employee-location-history", employeeId, dateRange.from.toISOString(), dateRange.to.toISOString(), page, pageSize],
    async () => {
      // Check if we already have this data in allLocationHistory
      // If so, we can avoid an API call for small datasets
      if (allLocationHistory.length > 0 && allLocationHistory.length <= 100) {
        console.log("[LocationHistoryTable] Using cached data instead of API call");
        
        // Sort by newest first for table display (desc)
        const sorted = [...allLocationHistory].sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        
        // Paginate manually
        const start = page * pageSize;
        const end = start + pageSize;
        const paginatedLocations = sorted.slice(start, end);
        
        return {
          locations: paginatedLocations,
          total: allLocationHistory.length
        };
      }
      
      // For larger datasets, use the API with server-side pagination
      console.log("[LocationHistoryTable] Fetching from API with pagination");
      return await apiClient.fetchLocationHistory(employeeId, dateRange.from, dateRange.to, page, pageSize, 'desc');
    },
    {
      revalidateOnFocus: true,
      dedupingInterval: 500,
      keepPreviousData: true,
      revalidateIfStale: false
    }
  );
  const locations = data?.locations || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  // --- Robust: scroll selected row into view ---
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
  useEffect(() => {
    if (selectedIndex != null && rowRefs.current[selectedIndex]) {
      rowRefs.current[selectedIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedIndex]);

  // Find matching index in the allLocationHistory array
  const findAllHistoryIndex = (paginatedLocation: LocationHistory) => {
    if (!allLocationHistory || allLocationHistory.length === 0) return null;
    
    // Try to match by ID first if available
    if (paginatedLocation.id) {
      const idx = allLocationHistory.findIndex(loc => loc.id === paginatedLocation.id);
      if (idx >= 0) return idx;
    }
    
    // Otherwise match by timestamp and coordinates (more reliable than just timestamp)
    return allLocationHistory.findIndex(loc => 
      loc.timestamp === paginatedLocation.timestamp && 
      loc.latitude === paginatedLocation.latitude && 
      loc.longitude === paginatedLocation.longitude
    );
  };

  // Simple flag to prevent multiple downloads
  // This doesn't change the UI but prevents duplicate clicks
  const isDownloadingRef = useRef(false);

  // --- Download Excel handler ---
  const handleDownloadExcel = () => {
    // Prevent duplicate downloads without changing UI
    if (isDownloadingRef.current || locations.length === 0) {
      return;
    }
    
    isDownloadingRef.current = true;
    
    try {
      const dataToExport = locations.map(loc => ({
        Time: new Date(loc.timestamp).toLocaleString(),
        Address: loc.address || `${loc.latitude}, ${loc.longitude}`,
        Battery: loc.batteryLevel ?? '-',
      }));
      
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Location History");
      
      // Generate a better filename with timestamp to prevent conflicts
      const now = new Date();
      const filename = `location-history-${now.getTime()}.xlsx`;
      
      XLSX.writeFile(wb, filename);
    } finally {
      // Reset flag after a short delay to prevent rapid clicks
      setTimeout(() => {
        isDownloadingRef.current = false;
      }, 1000);
    }
  };

  return (
    <div className="mt-8 w-full max-w-3xl mx-auto border-t bg-white">
      <div className="max-h-96 overflow-y-auto">
        <Table>
          <TableCaption>Employee location history for the selected date range.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer">Time</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Battery</TableHead>
              <TableHead>Point #</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Skeleton loader for table rows
              Array.from({ length: pageSize }).map((_, idx) => (
                <TableRow key={idx}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                </TableRow>
              ))
            ) : locations.length === 0 ? (
              <TableRow><TableCell colSpan={4}>No location history found.</TableCell></TableRow>
            ) : (
              locations.map((loc: LocationHistory, idx: number) => {
                // Find the corresponding index in the allLocationHistory array
                const globalIdx = findAllHistoryIndex(loc);
                
                return (
                  <TableRow
                    ref={el => { rowRefs.current[idx] = el || null; }}
                    key={loc.id || loc.timestamp}
                    className={globalIdx === selectedIndex ? "bg-blue-100 text-blue-900 font-semibold cursor-pointer" : "hover:bg-gray-100 cursor-pointer"}
                    onClick={() => {
                      if (globalIdx !== null) {
                        onSelect(globalIdx);
                      }
                    }}
                  >
                    <TableCell>{new Date(loc.timestamp).toLocaleString()}</TableCell>
                    <TableCell>{loc.address || `${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`}</TableCell>
                    <TableCell>{loc.batteryLevel ?? '-'}</TableCell>
                    <TableCell>
                      {globalIdx !== null ? (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded-full text-xs font-medium">
                          #{globalIdx + 1}
                        </span>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      {/* Download Button at the bottom */}
      <div className="flex justify-end p-4">
        <button
          onClick={handleDownloadExcel}
          className={buttonVariants({ variant: "default", className: "bg-black text-white" })}
        >
          Download Excel
        </button>
      </div>
      {/* Pagination controls */}
      <div className="flex items-center gap-2 mt-2 justify-center">
        <button disabled={page === 0} onClick={() => setPage(0)} className="px-2 py-1 border rounded disabled:opacity-50">First</button>
        <button disabled={page === 0} onClick={() => setPage(page - 1)} className="px-2 py-1 border rounded disabled:opacity-50">Prev</button>
        <span>Page {page + 1} of {totalPages}</span>
        <button disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)} className="px-2 py-1 border rounded disabled:opacity-50">Next</button>
        <button disabled={page + 1 >= totalPages} onClick={() => setPage(totalPages - 1)} className="px-2 py-1 border rounded disabled:opacity-50">Last</button>
      </div>
    </div>
  );
}

export function AdminLocationManagement() {
  useAdminSocketEvents(normalizeEmployees); // pass normalization function to socket events
  const employees = useEmployeeStore((s) => s.employees);
  const onlineMap = useEmployeeStore((s) => s.onlineMap);
  const notifications = useEmployeeStore((s) => s.notifications);
  const connected = useEmployeeStore((s) => s.connected);
  const setEmployees = useEmployeeStore((s) => s.setEmployees);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    to: new Date(),
  })
  const [viewMode, setViewMode] = useState<"realtime" | "history">("realtime")
  const { toast } = useToast()
  const [selectedCity, setSelectedCity] = useState("All")
  const [isMapFullscreen, setIsMapFullscreen] = useState(false)
  const { socket, connected: adminSocketConnected, connect, disconnect } = useAdminSocket();
  // Fetch settings directly to use as source of truth for connection status
  const { data: settings, mutate: mutateSettings } = useSWR("/api/admin/settings", url => fetch(url).then(r => r.json()));
  
  // The true connection status should respect settings as source of truth
  const connectionEnabled = settings?.adminRealtimeEnabled === true;
  
  // Combined connection status - ONLY show connected if both:
  // 1. Settings have enabled the connection (source of truth)
  // 2. Socket is actually connected (implementation detail)
  const effectiveConnectionStatus = connectionEnabled && connected;
  
  // Ensure both connection states are in sync
  useEffect(() => {
    // Log the connection state from all sources for debugging
    console.log("[AdminLocation] Connection states:", { 
      storeConnected: connected, 
      socketConnected: adminSocketConnected,
      settingsEnabled: connectionEnabled,
      effectiveStatus: effectiveConnectionStatus
    });
    
    // Force immediate connection/disconnection based on settings
    if (connectionEnabled && !connected && socket) {
      console.log("[AdminLocation] Settings enabled but not connected - forcing connection");
      connect(); // This will update the server setting and connect the socket
    } else if (!connectionEnabled && connected) {
      console.log("[AdminLocation] Settings disabled but connected - forcing disconnection");
      disconnect(); // This will update the server setting and disconnect the socket
    }
  }, [connectionEnabled, connected, socket, effectiveConnectionStatus, connect, disconnect, adminSocketConnected]);
  
  // Listen for settings changes from other components
  useEffect(() => {
    const handleSettingsChange = (event: CustomEvent) => {
      if (event.detail?.setting === 'adminRealtimeEnabled') {
        console.log('[AdminLocation] Detected settings change event:', event.detail);
        // Force refetch settings to update UI immediately
        mutateSettings();
      }
    };
    
    const handleSocketStateChange = (event: CustomEvent) => {
      console.log('[AdminLocation] Detected socket state change event:', event.detail);
      // No need to manually update connected state as it will be updated through the useAdminSocketEvents hook
      
      // If the socket connection state changes but doesn't match settings, force alignment
      if (event.detail?.connected && !connectionEnabled) {
        // Connected but settings say it should be disconnected
        console.log('[AdminLocation] Socket connected but settings disabled - forcing disconnect');
        disconnect();
      } else if (!event.detail?.connected && connectionEnabled) {
        // Disconnected but settings say it should be connected
        console.log('[AdminLocation] Socket disconnected but settings enabled - forcing connect');
        connect();
      }
      
      // Force SWR to refetch settings to ensure UI is up to date
      mutateSettings();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('admin-settings-changed', handleSettingsChange as EventListener);
      window.addEventListener('admin-socket-state-changed', handleSocketStateChange as EventListener);
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('admin-settings-changed', handleSettingsChange as EventListener);
        window.removeEventListener('admin-socket-state-changed', handleSocketStateChange as EventListener);
      }
    };
  }, [connectionEnabled, connect, disconnect, mutateSettings]);
  
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number | null>(null);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const lastVisibleRef = useRef(false);
  const pageLoadTimeRef = useRef(Date.now());
  
  // SWR for all location history (for the map)
  const { data: allLocationHistoryData, isLoading: isAllHistoryLoading, mutate: mutateAllHistory } = useSWR(
    viewMode === "history" && selectedEmployee && dateRange.from && dateRange.to
      ? ["employee-location-history-all", selectedEmployee.id, dateRange.from.toISOString(), dateRange.to.toISOString()]
      : null,
    () =>
      selectedEmployee && dateRange.from && dateRange.to
        ? apiClient.fetchLocationHistory(selectedEmployee.id, dateRange.from, dateRange.to)
        : Promise.resolve([]),
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 0,
      keepPreviousData: true,
      errorRetryCount: 3
    }
  );
  
  // Sort the history data by timestamp to ensure correct ordering
  const allLocationHistory = useMemo(() => {
    const data = Array.isArray(allLocationHistoryData) 
      ? allLocationHistoryData 
      : allLocationHistoryData?.locations || [];
      
    // Sort by timestamp ascending (oldest to newest)
    return [...data].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [allLocationHistoryData]);
  
  // Reset selected history index when employee or date range changes
  useEffect(() => {
    setSelectedHistoryIndex(null);
  }, [selectedEmployee?.id, dateRange.from, dateRange.to]);
  
  // Reset to page 0 when employee or date range changes
  useEffect(() => {
    setHistoryPage(0);
  }, [selectedEmployee?.id, dateRange.from, dateRange.to]);

  // SWR for paginated location history (for the table)
  const shouldFetchHistory = viewMode === 'history' && selectedEmployee && dateRange.from && dateRange.to;
  const { data: locationHistory = [], isLoading: isHistoryLoading, error: historyError, mutate: mutateHistory } = useSWR(
    shouldFetchHistory
      ? [
          'employee-location-history',
          selectedEmployee?.id,
          dateRange.from?.toISOString(),
          dateRange.to?.toISOString(),
          historyPage,
          historyPageSize
        ]
      : null,
    async ([, employeeId, from, to, page, pageSize]) => {
      if (!employeeId || !from || !to) return [];
      return await apiClient.fetchLocationHistory(
        employeeId, 
        new Date(from), 
        new Date(to), 
        page, 
        pageSize, 
        'desc'
      );
    },
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 0,
      keepPreviousData: true,
      errorRetryCount: 3
    }
  );

  // --- SWR fallback: always fetch fallback data ---
  const { data: fallbackEmployees = [], isLoading: isFallbackLoading, mutate: mutateFallback } = useSWR(
    ["employees-fallback", selectedCity],
    () => apiClient.fetchEmployees(selectedCity),
    {
      refreshInterval: !connected ? 30000 : 0,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 0,
      keepPreviousData: true,
      errorRetryCount: 3
    }
  );
  
  // Track page visibility to refresh data when returning to the page
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      
      // If page becomes visible, refresh data immediately
      // No time constraints or previous state requirements
      if (isVisible) {
        console.log("[AdminLocation] Page became visible, refreshing data");
        
        // Force refresh data
        mutateFallback();
        if (shouldFetchHistory) {
          mutateHistory();
          mutateAllHistory();
        }
      }
      
      lastVisibleRef.current = isVisible;
    };
    
    // Also refresh data on initial mount to ensure we have latest data
    console.log("[AdminLocation] Component mounted, initializing data");
    mutateFallback();
    if (shouldFetchHistory) {
      mutateHistory();
      mutateAllHistory();
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    lastVisibleRef.current = document.visibilityState === 'visible';
    pageLoadTimeRef.current = Date.now();
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [shouldFetchHistory, mutateAllHistory, mutateHistory, mutateFallback]);
  
  // Refresh data when socket reconnects
  useEffect(() => {
    if (!socket) return;
    
    const handleConnect = () => {
      console.log("[AdminLocation] Socket reconnected, refreshing data");
      mutateFallback();
      if (shouldFetchHistory) {
        mutateHistory();
        mutateAllHistory();
      }
    };
    
    socket.on('connect', handleConnect);
    
    // Also do an immediate refresh if socket is already connected
    if (socket.connected) {
      console.log("[AdminLocation] Socket already connected, refreshing data");
      mutateFallback();
      if (shouldFetchHistory) {
        mutateHistory();
        mutateAllHistory();
      }
    }
    
    return () => {
      socket.off('connect', handleConnect);
    };
  }, [socket, shouldFetchHistory, mutateAllHistory, mutateHistory, mutateFallback]);

  // --- Only update store with fallback data if not connected and store is empty ---
  useEffect(() => {
    if (!connected && fallbackEmployees.length > 0 && employees.length === 0) {
      const normalized = normalizeEmployees(fallbackEmployees);
      console.log("[Fallback] Normalized employees:", normalized);
      setEmployees(normalized);
    }
  }, [fallbackEmployees, connected, setEmployees, employees]);

  // Robust, instant client-side city filter
  const filteredEmployees = useMemo(() =>
    employees.filter((employee) => 
      selectedCity === "All" ||
      (employee.city && employee.city.toLowerCase() === selectedCity.toLowerCase())
    ), [employees, selectedCity]);

  // Add debug log for filtered employees (now after declaration)
  useEffect(() => {
    console.log("Filtered employees for UI:", filteredEmployees);
  }, [filteredEmployees]);

  const handleEmployeeSelect = (employee: Employee) => {
    setSelectedEmployee(employee)
  }

  const handleDateRangeChange = (range: DateRange) => {
    // Store current values to detect actual changes
    const oldFrom = dateRange.from?.toISOString();
    const oldTo = dateRange.to?.toISOString();
    const newFrom = range.from?.toISOString();
    const newTo = range.to?.toISOString();
    
    // Only update if values actually changed
    if (oldFrom !== newFrom || oldTo !== newTo) {
      setDateRange(range);
    }
  }
  
  // Add a ref to store the last time date inputs were changed
  const lastDateChangeRef = useRef(0);
  
  // Create debounced date input handlers
  const handleFromDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const now = Date.now();
    // Ignore rapid changes (within 300ms)
    if (now - lastDateChangeRef.current < 300) {
      return;
    }
    lastDateChangeRef.current = now;
    
    const from = e.target.value ? new Date(e.target.value) : undefined;
    setDateRange(dr => ({ ...dr, from }));
  };
  
  const handleToDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const now = Date.now();
    // Ignore rapid changes (within 300ms)
    if (now - lastDateChangeRef.current < 300) {
      return;
    }
    lastDateChangeRef.current = now;
    
    const to = e.target.value ? new Date(e.target.value) : undefined;
    setDateRange(dr => ({ ...dr, to }));
  };

  // Determine loading state: only show skeletons if no employees and loading
  const isLoading = employees.length === 0 && isFallbackLoading;

  return (
    <div className="p-6 space-y-6 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-bold">Employee Location Tracker</h1>
        
        {/* Connection status indicator - now respects settings as source of truth */}
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${effectiveConnectionStatus ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className={`text-sm ${effectiveConnectionStatus ? 'text-green-700' : 'text-red-700'}`}>
            {!connectionEnabled ? 'Real-time disabled in settings' : 
             (effectiveConnectionStatus ? 'Connected' : 'Connecting...')}
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Filter section */}
        <div className="p-4 bg-white rounded-lg shadow-sm md:col-span-4">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-medium">Filter by Location</h2>
          </div>
          <Select
            value={selectedCity}
            onValueChange={setSelectedCity}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a city" />
            </SelectTrigger>
            <SelectContent>
              {CITIES.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500 mt-2">
            Select a city to filter employees by their location
          </p>
          <div className="mt-4">
            <input 
              type="text" 
              placeholder="Search employees..." 
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Checked In ({employees.length})</h3>
            </div>
            <div className="h-[calc(100vh-16rem)] overflow-y-auto pr-2 space-y-2">
              {filteredEmployees.map((employee) => (
                <div 
                  key={employee.id}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedEmployee?.id === employee.id
                      ? "bg-blue-50 border-l-4 border-blue-500"
                      : "bg-gray-50 hover:bg-gray-100"
                  }`}
                  onClick={() => handleEmployeeSelect(employee)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium">
                      {employee.name?.split(" ").map(n => n[0]).join("") || "?"}
                    </div>
                    <div>
                      <div className="font-medium">{employee.name}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <div className={`h-2 w-2 rounded-full ${onlineMap[employee.id] ? "bg-green-500" : "bg-gray-400"}`} />
                        {employee?.department || "Sales Representative"}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <div className="flex items-center gap-1">
                          <Battery className="w-3 h-3" />
                          <span>{employee.batteryLevel || 16}%</span>
                        </div>
                        <div className="mx-1">•</div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{employee.location?.timestamp ? new Date(employee.location.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "05:18 PM"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Map and Controls */}
        <div className="flex flex-1 flex-col md:col-span-8 h-full w-full">
          <div className="border-b bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Tabs
                defaultValue="realtime"
                value={viewMode}
                onValueChange={(value) => setViewMode(value as "realtime" | "history")}
                className="w-full sm:w-auto"
              >
                <TabsList>
                  <TabsTrigger value="realtime" className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    Real-time
                  </TabsTrigger>
                  <TabsTrigger value="history" className="flex items-center gap-1">
                    <History className="h-4 w-4" />
                    History
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {viewMode === "history" && (
                <div className="flex items-center gap-2">
                  <label className="text-xs">From</label>
                  <input
                    type="date"
                    className="border rounded px-2 py-1 text-sm"
                    value={dateRange.from ? dateRange.from.toISOString().slice(0, 10) : ""}
                    max={dateRange.to ? dateRange.to.toISOString().slice(0, 10) : undefined}
                    onChange={handleFromDateChange}
                  />
                  <label className="text-xs">To</label>
                  <input
                    type="date"
                    className="border rounded px-2 py-1 text-sm"
                    value={dateRange.to ? dateRange.to.toISOString().slice(0, 10) : ""}
                    min={dateRange.from ? dateRange.from.toISOString().slice(0, 10) : undefined}
                    onChange={handleToDateChange}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Always stacked: map full width, table below in history mode */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 min-h-[500px] h-[calc(100vh-16rem)]">
              {!isMapFullscreen && (
                <MapContainer
                  employees={filteredEmployees}
                  selectedEmployee={selectedEmployee}
                  locationHistory={viewMode === "history" ? allLocationHistory : []}
                  isLoading={isLoading || isAllHistoryLoading}
                  selectedCity={selectedCity}
                  isFullscreen={false}
                  onRequestFullscreen={() => setIsMapFullscreen(true)}
                  onRequestExitFullscreen={() => setIsMapFullscreen(false)}
                  selectedHistoryIndex={selectedHistoryIndex}
                  onSelectHistoryIndex={setSelectedHistoryIndex}
                >
                  {selectedEmployee && viewMode === "history" && dateRange.from && dateRange.to && (
                    <Popup>
                      <div>
                        <b>{new Date(selectedEmployee.location.timestamp).toLocaleString()}</b><br />
                        {selectedEmployee.city || `${selectedEmployee.location.latitude}, ${selectedEmployee.location.longitude}`}<br />
                        Battery: {selectedEmployee.batteryLevel ?? '-'}
                      </div>
                    </Popup>
                  )}
                </MapContainer>
              )}
              {isMapFullscreen && (
                <div className="fixed inset-0 w-screen h-screen z-[200] bg-black/60 flex items-center justify-center" onClick={() => setIsMapFullscreen(false)}>
                  <div className="relative w-full h-full max-w-none max-h-none" onClick={e => e.stopPropagation()}>
                    <MapContainer
                      employees={filteredEmployees}
                      selectedEmployee={selectedEmployee}
                      locationHistory={viewMode === "history" ? allLocationHistory : []}
                      isLoading={isLoading || isAllHistoryLoading}
                      selectedCity={selectedCity}
                      isFullscreen={true}
                      onRequestExitFullscreen={() => setIsMapFullscreen(false)}
                      selectedHistoryIndex={selectedHistoryIndex}
                      onSelectHistoryIndex={setSelectedHistoryIndex}
                    >
                      {selectedEmployee && viewMode === "history" && dateRange.from && dateRange.to && (
                        <Popup>
                          <div>
                            <b>{new Date(selectedEmployee.location.timestamp).toLocaleString()}</b><br />
                            {selectedEmployee.city || `${selectedEmployee.location.latitude}, ${selectedEmployee.location.longitude}`}<br />
                            Battery: {selectedEmployee.batteryLevel ?? '-'}
                          </div>
                        </Popup>
                      )}
                    </MapContainer>
                  </div>
                </div>
              )}
            </div>
            {/* Table always below map in history mode */}
            {viewMode === "history" && selectedEmployee && dateRange.from && dateRange.to && (
              <LocationHistoryTable
                employeeId={selectedEmployee.id}
                dateRange={dateRange as { from: Date; to: Date }}
                selectedIndex={selectedHistoryIndex}
                onSelect={setSelectedHistoryIndex}
                page={historyPage}
                setPage={setHistoryPage}
                pageSize={historyPageSize}
                setPageSize={setHistoryPageSize}
                allLocationHistory={allLocationHistory}
              />
            )}
            {viewMode === "history" && !isLoading && (!selectedEmployee || !dateRange.from || !dateRange.to) && (
              <div className="text-center text-muted-foreground mt-8">No location history found for this employee and date range.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
