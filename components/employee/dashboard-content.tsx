"use client"

import React, { useCallback, useMemo, useEffect } from 'react'
import { useTranslations } from "next-intl";
import { useState, useRef } from "react"
import {
  ArrowRight,
  Calendar,
  CheckCircle,
  ClipboardList,
  Clock,
  FileText,
  MapPin,
  Package,
  ShoppingCart,
  User,
  ChevronDown,
  ChevronRight,
  Eye,
  Pencil,
  Trash2,
  Timer,
  Bell,
} from "lucide-react"
import { format } from "date-fns"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { RecordSaleDialog } from "@/components/ui/employee/Record-sale-dialog"
import { LocationDialog } from "@/components/ui/employee/location-dialog"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import useSWR, { useSWRConfig } from 'swr'
import { Skeleton } from "@/components/ui/skeleton"
import { useSession } from "next-auth/react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useEmployeeSettings } from "@/hooks/useEmployeeSettings"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/components/ui/use-toast"
import { useEmployeeSocket } from "@/hooks/useEmployeeSocket"

// Add types at the top of the file
type DialogOpenChange = (open: boolean) => void;

interface AttendanceData {
  serverNow: string;
  attendance: {
    id: string;
    checkIn: string;
    checkOut?: string;
    status: string;
    date: string;
  }[];
}

interface SalesData {
  id: string;
  amount: number;
  date: string;
  product?: {
    name: string;
    price: number;
  };
}

interface DocumentData {
  id: string;
  status: string;
  date: string;
  title: string;
}

// Add error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Dashboard error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-center">
          <h2 className="text-lg font-semibold text-red-600">Something went wrong</h2>
          <p className="text-sm text-gray-600 mt-2">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

// Utility to get CSRF token from cookie
function getCsrfTokenFromCookie() {
  const match = document.cookie.match(/(?:^|; )next-auth\.csrf-token=([^;]*)/)
  if (!match) return ''
  // The cookie value is like: token|hash, we want only the token part
  return decodeURIComponent(match[1]).split('|')[0]
}

// Add retry utility
const fetchWithRetry = async (url: string, options: RequestInit, retries = 3): Promise<Response> => {
  for (let i = 0; i < retries; i++) {
    try {
      const csrfToken = typeof window !== 'undefined' ? getCsrfTokenFromCookie() : ''
      const res = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        credentials: 'include', // This enables CSRF protection
      })
      if (res.ok) return res
      // Only retry on server errors
      if (res.status >= 500) {
        console.log(`Retry attempt ${i + 1} of ${retries}`)
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
        continue
      }
      return res
    } catch (error) {
      if (i === retries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
  throw new Error('Max retries reached')
}

// Update the fetcher to use retry logic
const fetcher = async (url: string): Promise<any> => {
  const res = await fetchWithRetry(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })
  
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.message || 'Failed to fetch data')
  }
  
  return res.json()
}

// Add offline support
const useOfflineSupport = () => {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
    }
  }, [])
}

// Utility for compact number formatting
const compactNumber = (value: number) =>
  new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

// Utility to compare dates in UTC (ignoring time)
function isSameUTCDate(dateA: Date, dateB: Date) {
  return (
    dateA.getUTCFullYear() === dateB.getUTCFullYear() &&
    dateA.getUTCMonth() === dateB.getUTCMonth() &&
    dateA.getUTCDate() === dateB.getUTCDate()
  );
}

const UNDO_WINDOW_SECONDS = 60;

function getTodayKey(suffix: string) {
  const today = new Date();
  return `${suffix}_${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
}

// Utility to always return an array for attendance data
function toAttendanceArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.attendance)) return data.attendance;
  if (data && Array.isArray(data.records)) return data.records;
  return [];
}

// Add validation utility
const validateAttendanceData = (data: any) => {
  if (!data?.serverNow) {
    console.error('Missing server timestamp');
    return false;
  }
  if (!data?.attendance) {
    console.error('Missing attendance data');
    return false;
  }
  return true;
};

const validateData = (data: any, operation: string): boolean => {
  switch (operation) {
    case 'check-in':
      return !!(
        data?.serverNow &&
        data?.attendance &&
        Array.isArray(data.attendance) &&
        data.attendance.every((rec: any) => 
          rec.id && 
          rec.checkIn && 
          rec.status && 
          rec.date
        )
      );
    
    case 'check-out':
      return !!(
        data?.serverNow &&
        data?.attendance &&
        Array.isArray(data.attendance) &&
        data.attendance.every((rec: any) => 
          rec.id && 
          rec.checkIn && 
          rec.checkOut && 
          rec.status && 
          rec.date
        )
      );
    
    case 'sales':
      return !!(
        data?.sales &&
        Array.isArray(data.sales) &&
        data.sales.every((sale: any) => 
          sale.id && 
          sale.amount && 
          sale.date
        )
      );
    
    case 'documents':
      return !!(
        data?.documents &&
        Array.isArray(data.documents) &&
        data.documents.every((doc: any) => 
          doc.id && 
          doc.status && 
          doc.date
        )
      );
    
    default:
      return false;
  }
};

// Add time formatting utility
const formatTime = (date: string) => {
  const now = new Date();
  const then = new Date(date);
  const diff = now.getTime() - then.getTime();
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
  return format(then, 'MMM d, yyyy');
}

// Add local cache utility
const useLocalCache = () => {
  const [cache, setCache] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const updateCache = useCallback((data: any) => {
    setCache(data);
    setLastUpdate(new Date());
  }, []);

  return { cache, lastUpdate, updateCache };
};

export function EmployeeDashboardContent() {
  // Add date/time variables at the top of the function
  const now = new Date();
  const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const from = startOfToday.toISOString();
  const to = endOfToday.toISOString();

  // Add offline support
  useOfflineSupport()

  const t = useTranslations('Dashboard');
  const tSales = useTranslations('Sales');
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const { toast } = useToast();
  const { socket } = useEmployeeSocket();
  const { cache, lastUpdate, updateCache } = useLocalCache();

  // Cache key for employee profile
  const profileCacheKey = userId ? `employee-profile-${userId}` : null;

  // First get the employee ID from the user ID with optimized caching
  const { data: employeeData, error: employeeError } = useSWR(
    userId ? `/api/employee/profile` : null,
    fetcher,
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      dedupingInterval: 300000, // 5 minutes
      focusThrottleInterval: 5000,
      loadingTimeout: 3000,
      onError: (err) => {
        console.error('Profile fetch error:', err);
        toast({
          title: t('error'),
          description: t('failedToLoadEmployeeData'),
          variant: 'destructive',
        });
      }
    }
  );

  // Cache key for employee details
  const detailsCacheKey = employeeData?.employee?.id ? `employee-details-${employeeData.employee.id}` : null;

  // Then use the employee ID to fetch details with optimized caching
  const { data: detailsData, error: detailsError, isLoading: detailsLoading } = useSWR(
    employeeData?.employee?.id ? `/api/employees/${employeeData.employee.id}/details` : null,
    fetcher,
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      dedupingInterval: 60000, // 1 minute for details
      focusThrottleInterval: 5000,
      loadingTimeout: 3000,
      onError: (err) => {
        console.error('Details fetch error:', err);
        toast({
          title: t('error'),
          description: t('failedToLoadEmployeeDetails'),
          variant: 'destructive',
        });
      }
    }
  );

  // Add optimistic updates for both profile and details
  const mutateProfile = useSWRConfig().mutate;
  const mutateDetails = useSWRConfig().mutate;

  // Function to update both caches
  const updateEmployeeData = useCallback(async (newData: any) => {
    if (profileCacheKey) {
      await mutateProfile(profileCacheKey, { ...employeeData, ...newData }, false);
    }
    if (detailsCacheKey) {
      await mutateDetails(detailsCacheKey, { ...detailsData, ...newData }, false);
    }
  }, [profileCacheKey, detailsCacheKey, employeeData, detailsData, mutateProfile, mutateDetails]);

  // Add socket update handler for real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleEmployeeUpdate = (update: any) => {
      if (update.userId === userId) {
        updateEmployeeData(update.data);
      }
    };

    socket.on("employee-update", handleEmployeeUpdate);
    return () => {
      socket.off("employee-update", handleEmployeeUpdate);
    };
  }, [socket, userId, updateEmployeeData]);

  // Add background sync for stale data
  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        const lastProfileUpdate = new Date(employeeData?.updatedAt || 0);
        const lastDetailsUpdate = new Date(detailsData?.updatedAt || 0);
        const now = new Date();
        
        // Sync profile if older than 5 minutes
        if (now.getTime() - lastProfileUpdate.getTime() > 300000) {
          mutateProfile(`/api/employee/profile`);
        }
        
        // Sync details if older than 1 minute
        if (now.getTime() - lastDetailsUpdate.getTime() > 60000) {
          mutateDetails(`/api/employees/${employeeData?.employee?.id}/details`);
        }
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(syncInterval);
  }, [employeeData?.updatedAt, detailsData?.updatedAt, mutateProfile, mutateDetails, employeeData?.employee?.id]);

  // Fetch real attendance data (for check-in/out and today's record)
  const { data: attendanceData, error: attendanceError, isLoading: attendanceLoading, mutate: mutateAttendance } = useSWR(
    '/api/employee/attendance',
    fetcher,
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      dedupingInterval: 60000,
    }
  );

  // Fetch sales and documents for Recent Activity
  const { data: salesDataRaw, error: salesError, isLoading: salesLoading, mutate: mutateSales } = useSWR(
    `/api/employee/sales?from=${from}&to=${to}`,
    fetcher,
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      dedupingInterval: 60000,
    }
  );
  const { data: documentsData, error: documentsError, isLoading: documentsLoading, mutate: mutateDocuments } = useSWR(
    '/api/employee/documents',
    fetcher,
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      dedupingInterval: 60000,
    }
  );

  // Fetch dashboard stats and employee info
  const { data: dashboardData, error: dashboardError, isLoading: dashboardLoading, mutate: mutateDashboard } = useSWR(
    '/api/employee/dashboard',
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
      refreshInterval: 0, // Don't auto-refresh
      onSuccess: (data) => {
        updateCache(data);
      }
    }
  );

  // Fetch reports for the current employee for today
  const { data: reportsData, error: reportsError, isLoading: reportsLoading, isValidating: reportsValidating } = useSWR(
    employeeData?.employee?.id ? `/api/employee/reports?onlyToday=true` : null,
    fetcher,
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      dedupingInterval: 60000,
    }
  );
  const todaysReports = (reportsData?.reports || []);

  // Use the utility everywhere attendanceData is used as an array
  const safeAttendanceData = toAttendanceArray(attendanceData);
  const todaysAttendance = safeAttendanceData.filter((rec: any) => {
    const recDate = new Date(rec.date);
    return isSameUTCDate(recDate, utcMidnight);
  });
  const salesArray = Array.isArray(salesDataRaw) ? salesDataRaw : (salesDataRaw?.sales || []);
  const filteredTodaysSales = salesArray.filter((sale: any) => {
    const recDate = new Date(sale.date);
    recDate.setHours(0, 0, 0, 0);
    return recDate.getTime() === new Date().setHours(0, 0, 0, 0);
  });
  const documents = documentsData?.documents || [];
  const todaysDocuments = documents.filter((doc: any) => {
    const recDate = new Date(doc.date || doc.uploadedAt);
    recDate.setHours(0, 0, 0, 0);
    return recDate.getTime() === new Date().setHours(0, 0, 0, 0);
  });

  // Add SWR for employee settings
  const { data: settingsData, mutate: mutateSettings, updateSettings } = useEmployeeSettings();

  const [showLocationDialog, setShowLocationDialog] = useState(false)
  const [locationEnabled, setLocationEnabled] = useState(false)
  const [checkedIn, setCheckedIn] = useState(false)
  const [checkedOut, setCheckedOut] = useState(false)
  const [checkInTime, setCheckInTime] = useState<Date | null>(null)
  const [checkOutTime, setCheckOutTime] = useState<Date | null>(null)
  const [stats, setStats] = useState({
    attendance: { present: 0, absent: 0, late: 0 },
    sales: { total: 0, target: 0 },
    products: { assigned: 0, sold: 0, lowStock: 0 },
    documents: { total: 0, pending: 0 },
  })
  const [undoUsed, setUndoUsed] = useState(false)

  // Collapsible state for Recent Activity categories
  const [attendanceOpen, setAttendanceOpen] = useState(true);
  const [salesOpen, setSalesOpen] = useState(true);
  const [documentsOpen, setDocumentsOpen] = useState(true);

  // Animate stats on load
  useEffect(() => {
    const timer = setTimeout(() => {
      setStats({
        attendance: { present: 18, absent: 2, late: 1 },
        sales: { total: 7250, target: 0 },
        products: { assigned: 12, sold: 45, lowStock: 2 },
        documents: { total: 8, pending: 3 },
      })
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  // Only use the useEffect that checks settingsData.locationAccess to control setShowLocationDialog and setLocationEnabled
  useEffect(() => {
    if (settingsData && settingsData.locationAccess !== true) {
        setShowLocationDialog(true)
      setLocationEnabled(false)
    } else if (settingsData && settingsData.locationAccess === true) {
      setShowLocationDialog(false)
      setLocationEnabled(true)
    }
  }, [settingsData])

  // Fetch today's attendance record
  const todayRecord = safeAttendanceData.find((rec: any) => {
    const recDate = new Date(rec.date);
    return isSameUTCDate(recDate, utcMidnight);
  });

  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const getUndoSecondsLeftReal = useCallback((actionTimestamp: string | Date | null, windowSeconds: number) => {
    if (!actionTimestamp) return 0;
    const elapsed = (nowTs - new Date(actionTimestamp).getTime()) / 1000;
    return Math.max(0, Math.ceil(windowSeconds - elapsed));
  }, [nowTs]);

  // Robust undo timer logic: always calculate based on real time
  const checkInUndoSecondsLeft =
    todayRecord && todayRecord.checkIn && !todayRecord.checkInUndone && !todayRecord.checkOut
      ? getUndoSecondsLeftReal(todayRecord.checkIn, UNDO_WINDOW_SECONDS)
      : 0;
  const checkOutUndoSecondsLeft =
    todayRecord && todayRecord.checkOut && !todayRecord.checkOutUndone
      ? getUndoSecondsLeftReal(todayRecord.checkOut, UNDO_WINDOW_SECONDS)
      : 0;

  // Add state for loading states
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isUndoingCheckIn, setIsUndoingCheckIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isUndoingCheckOut, setIsUndoingCheckOut] = useState(false);

  // Add optimistic update utilities
  const optimisticUpdate = async (
    mutate: () => Promise<any>,
    optimisticData: any,
    errorMessage: string
  ) => {
    try {
      // Update UI immediately with optimistic data
      await mutate();
      return true;
    } catch (error) {
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
      return false;
    }
  };

  // Update sales recording with optimistic updates
  const handleRecordSale = async (saleData: any) => {
    try {
      const res = await fetchWithRetry('/api/employee/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleData)
      });

      if (!res.ok) {
        const errorData = await res.json();
        toast({ title: 'Error', description: errorData.error || 'Failed to record sale.' });
        return;
      }

      const data = await res.json();
      if (validateData(data, 'sales')) {
        await optimisticUpdate(
          () => mutateDashboard(),
          data,
          'Failed to update sales data.'
        );
        toast({ title: 'Success', description: 'Sale recorded successfully.' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to record sale.' });
    }
  };

  // Update document upload with optimistic updates
  const handleDocumentUpload = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetchWithRetry('/api/employee/documents', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json();
        toast({ title: 'Error', description: errorData.error || 'Failed to upload document.' });
        return;
      }

      const data = await res.json();
      if (validateData(data, 'documents')) {
        await optimisticUpdate(
          () => mutateDashboard(),
          data,
          'Failed to update documents.'
        );
        toast({ title: 'Success', description: 'Document uploaded successfully.' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to upload document.' });
    }
  };

  // Update report handling with optimistic updates
  const handleReportUpdate = async (reportData: any) => {
    try {
      const res = await fetchWithRetry(`/api/employee/reports/${reportData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportData)
      });

      if (!res.ok) {
        const errorData = await res.json();
        toast({ title: 'Error', description: errorData.error || 'Failed to update report.' });
      return;
      }

    const data = await res.json();
      if (validateData(data, 'reports')) {
        await optimisticUpdate(
          () => mutateDashboard(),
          data,
          'Failed to update report data.'
        );
        toast({ title: 'Success', description: 'Report updated successfully.' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update report.' });
    }
  };

  // Update check-in handler with new validation and retry
  const handleCheckIn = async () => {
    try {
      setIsCheckingIn(true);
      const response = await fetch('/api/employee/attendance/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to check in');
      }

      await mutateAttendance();
      await mutateDashboard();
      
      toast({
        title: t('success'),
        description: t('checkedInSuccess'),
      });
    } catch (error) {
      console.error('Check-in error:', error);
      toast({
        title: t('error'),
        description: t('checkInFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Undo check-in handler
  const handleUndoCheckIn = async () => {
    if (isUndoingCheckIn) return;
    setIsUndoingCheckIn(true);
    try {
      const res = await fetch('/api/employee/attendance', {
      method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ undo: true })
      });
      if (!res.ok) {
        const errorData = await res.json();
      toast({ title: 'Undo Failed', description: errorData.error || 'Could not undo check-in.', variant: 'destructive' });
      return;
    }
    } finally {
      setIsUndoingCheckIn(false);
    }
  };

  // Update check-out handler with new validation and retry
  const handleCheckOut = async () => {
    try {
      setIsCheckingOut(true);
      const response = await fetch('/api/employee/attendance/check-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to check out');
      }

      await mutateAttendance();
      await mutateDashboard();
      
      toast({
        title: t('success'),
        description: t('checkedOutSuccess'),
      });
    } catch (error) {
      console.error('Check-out error:', error);
      toast({
        title: t('error'),
        description: t('checkOutFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Undo check-out handler
  const handleUndoCheckOut = async () => {
    if (isUndoingCheckOut) return;
    setIsUndoingCheckOut(true);
    try {
      const res = await fetch('/api/employee/attendance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ undo: true })
      });
      if (!res.ok) {
        const errorData = await res.json();
        toast({ title: 'Undo Failed', description: errorData.error || 'Could not undo check-out.', variant: 'destructive' });
      return;
      }
    } finally {
      setIsUndoingCheckOut(false);
    }
  };

  // Use server time for all check-in window logic
  const serverNowForWindow = attendanceData?.serverNow ? new Date(attendanceData.serverNow) : new Date();
  const windowStart = new Date(serverNowForWindow); windowStart.setHours(7, 0, 0, 0);
  const windowEnd = new Date(serverNowForWindow); windowEnd.setHours(20, 0, 0, 0);
  const isCheckInWindow = serverNowForWindow >= windowStart && serverNowForWindow <= windowEnd;

  // Button states
  const canCheckIn = isCheckInWindow && (!todayRecord || !todayRecord.checkIn);
  const canUndoCheckIn = (todayRecord && todayRecord.checkIn && !todayRecord.checkInUndone && (checkInUndoSecondsLeft > 0));
  const checkInDisabled = !canCheckIn && !canUndoCheckIn;

  const canCheckOut = todayRecord && todayRecord.checkIn && !todayRecord.checkOut && !todayRecord.checkOutUndone && checkInUndoSecondsLeft === 0;
  const canUndoCheckOut = (todayRecord && todayRecord.checkOut && !todayRecord.checkOutUndone && (checkOutUndoSecondsLeft > 0));
  const checkOutDisabled = !canCheckOut && !canUndoCheckOut;

  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [editReport, setEditReport] = useState<any | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ open: boolean, id: string | null }>({ open: false, id: null });

  // Edit Report Handler
  async function handleEdit(updatedReport: any) {
    try {
      const res = await fetch(`/api/employee/reports/${updatedReport.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedReport),
      });
      if (!res.ok) throw new Error('Failed to update report');
      toast({ title: 'Report updated!' });
      setEditReport(null);
      mutateDashboard();
    } catch (e) {
      toast({ title: 'Error', description: 'Could not update report', variant: 'destructive' });
    }
  }
  // Delete Report Handler
  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/employee/reports/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete report');
      toast({ title: 'Report deleted!' });
      mutateDashboard();
    } catch (e) {
      toast({ title: 'Error', description: 'Could not delete report', variant: 'destructive' });
    }
  }

  // Fetch assigned products for this employee (Upcoming Tasks) - use the same logic as the product page
  const nowForProducts = new Date();
  const { data: todayProductsData, error: todayProductsError, isLoading: todayProductsLoading, mutate: mutateProducts } = useSWR(
    '/api/employee/product?assignedToday=true',
    fetcher,
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      dedupingInterval: 60000,
    }
  );
  // Only show products with status 'assigned' (not sold or partially sold)
  const todaysAssignedProducts = (todayProductsData?.products || []).filter(
    (prod: any) => prod.status === "assigned"
  );

  // Robust monthly stats for cards
  // 1. Attendance (monthly)
  const monthStart = new Date(nowForProducts.getFullYear(), nowForProducts.getMonth(), 1);
  const monthEnd = new Date(nowForProducts.getFullYear(), nowForProducts.getMonth() + 1, 0, 23, 59, 59, 999);
  const monthlyAttendance = toAttendanceArray(attendanceData).filter((rec: any) => {
    const recDate = new Date(rec.date);
    return recDate >= monthStart && recDate <= monthEnd;
  });
  const present = monthlyAttendance.filter((rec: any) => rec.status === "Present").length;
  const late = monthlyAttendance.filter((rec: any) => rec.status === "Late").length;
  const absent = monthlyAttendance.filter((rec: any) => rec.status === "Absent").length;

  // 2. Sales (monthly)
  const monthlySales = salesArray.filter((sale: any) => {
    const recDate = new Date(sale.date);
    return recDate >= monthStart && recDate <= monthEnd;
  });
  const totalSales = monthlySales.reduce((sum: number, sale: any) => sum + (sale.amount || 0), 0);
  const salesTarget = dashboardData?.sales?.target || 0;

  // 3. Products (today)
  const assignedToday = (todayProductsData?.products || []).length;
  const soldToday = (todayProductsData?.products || []).filter((p: any) => p.status === "sold").length;

  // 4. Documents (all)
  const docs = documentsData?.documents || [];
  const totalDocs = docs.length;
  const acceptedDocs = docs.filter((doc: any) => doc.status === "accepted").length;
  const rejectedDocs = docs.filter((doc: any) => doc.status === "rejected").length;
  const pendingDocs = docs.filter((doc: any) => doc.status === "pending").length;

  // Confirmation dialog state
  const [confirmCheckIn, setConfirmCheckIn] = useState(false);
  const [confirmCheckOut, setConfirmCheckOut] = useState(false);
  const [confirmUndoCheckIn, setConfirmUndoCheckIn] = useState(false);
  const [confirmUndoCheckOut, setConfirmUndoCheckOut] = useState(false);

  async function handleEnableLocation() {
    try {
      const res = await fetch('/api/employee/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationAccess: true }),
      })
      if (!res.ok) throw new Error('Failed to enable location')
      setLocationEnabled(true)
      setShowLocationDialog(false)
      mutateSettings()
      toast({ title: 'Location Enabled', description: 'Location access has been granted.' })
    } catch (err) {
      toast({ title: 'Error', description: 'Could not enable location access.', variant: 'destructive' })
    }
  }

  // Sync locale cookie to backend after login
  useEffect(() => {
    if (!settingsData) return;
    const cookieLocale = document.cookie
      .split('; ')
      .find(row => row.startsWith('locale='))
      ?.split('=')[1];
    if (cookieLocale && settingsData.language && cookieLocale !== settingsData.language) {
      updateSettings({ language: cookieLocale });
      toast({
        title: cookieLocale === 'id' ? 'Bahasa telah diperbarui' : 'Language updated',
        description: cookieLocale === 'id' ? 'Preferensi bahasa Anda telah disimpan.' : 'Your language preference has been saved.',
        variant: 'default',
      });
    }
  }, [settingsData]);

  // Use cached data if available and not too old
  const displayData = useMemo(() => {
    if (!dashboardData) return null;
    
    const isCacheValid = cache && 
      new Date().getTime() - lastUpdate.getTime() < 30000; // 30 seconds

    return isCacheValid ? cache : dashboardData;
  }, [dashboardData, cache, lastUpdate]);

  // Add this near the top of the component
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update time display in your JSX
  return (
    <ErrorBoundary>
    <div className="w-full p-4 md:p-6 pb-20 pt-4 md:pt-0">
      {/* Welcome header - sticky at top */}
      <div className="sticky top-0 bg-background z-40 pt-4 pb-4 border-b shadow-sm transition-all duration-300 w-full mb-4">
        <div className="w-full px-4 md:px-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-8 w-8 text-primary" />
              </div>
        <div>
                  <h1 className="text-2xl font-bold">{t('welcomeHeader')}, {displayData?.employee?.user?.name || t('employee')}</h1>
                <div className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
                    <span>{displayData?.employee?.position || t('position')}</span>
                  <span className="hidden md:inline">•</span>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                      <span>{displayData?.employee?.city || t('city')}</span>
        </div>
                  <span className="hidden md:inline">•</span>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{format(new Date(), "EEEE, MMMM d, yyyy")}</span>
                </div>
                </div>
              </div>
            </div>
            {/* Restore attendance and record sale buttons */}
            <div className="flex items-center gap-2">
              {/* Attendance Buttons */}
              {canCheckIn && (
                <Button 
                  onClick={() => setConfirmCheckIn(true)} 
                  variant="default" 
                  size="sm" 
                  disabled={isCheckingIn || !mounted}
                >
                    {isCheckingIn ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> 
                      {t('checkIn')}
                    </span>
                    ) : t('checkIn')}
                </Button>
              )}
              {canUndoCheckIn && (
                  <Button onClick={() => setConfirmUndoCheckIn(true)} variant="outline" size="sm" disabled={isUndoingCheckIn}>
                    {isUndoingCheckIn ? (
                      <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {t('undoCheckIn')} ({checkInUndoSecondsLeft})</span>
                    ) : `${t('undoCheckIn')} (${checkInUndoSecondsLeft})`}
                </Button>
              )}
              {canCheckOut && (
                  <Button onClick={() => setConfirmCheckOut(true)} variant="default" size="sm" disabled={isCheckingOut}>
                    {isCheckingOut ? (
                      <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {t('checkOut')}</span>
                    ) : t('checkOut')}
                </Button>
              )}
              {canUndoCheckOut && (
                  <Button onClick={() => setConfirmUndoCheckOut(true)} variant="outline" size="sm" disabled={isUndoingCheckOut}>
                    {isUndoingCheckOut ? (
                      <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {t('undoCheckOut')} ({checkOutUndoSecondsLeft})</span>
                    ) : `${t('undoCheckOut')} (${checkOutUndoSecondsLeft})`}
                </Button>
              )}
              {/* Record Sale Dialog */}
              <RecordSaleDialog />
                      </div>
                    </div>
                </div>
                      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard title={t('attendance')} icon={ClipboardList} iconColor="text-blue-500" bgColor="bg-blue-50">
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div className="flex flex-col items-center p-2 rounded-md bg-background">
                {dashboardLoading ? <Skeleton className="h-6 w-12 mb-1" /> : <span className="text-xl font-bold" title={present.toLocaleString()}>{compactNumber(present)}</span>}
              <span className="text-xs text-muted-foreground">{t('present')}</span>
                      </div>
            <div className="flex flex-col items-center p-2 rounded-md bg-background">
                {dashboardLoading ? <Skeleton className="h-6 w-12 mb-1" /> : <span className="text-xl font-bold" title={late.toLocaleString()}>{compactNumber(late)}</span>}
              <span className="text-xs text-muted-foreground">{t('late')}</span>
                      </div>
            <div className="flex flex-col items-center p-2 rounded-md bg-background">
                {dashboardLoading ? <Skeleton className="h-6 w-12 mb-1" /> : <span className="text-xl font-bold" title={absent.toLocaleString()}>{compactNumber(absent)}</span>}
              <span className="text-xs text-muted-foreground">{t('absent')}</span>
                      </div>
                    </div>
        </StatsCard>

        <StatsCard title={t('sales')} icon={ShoppingCart} iconColor="text-green-500" bgColor="bg-green-50">
          <div className="mt-2">
            <div className="flex justify-between mb-1">
                {dashboardLoading ? <Skeleton className="h-6 w-16" /> : <span className="text-lg font-bold" title={totalSales.toLocaleString()}>${compactNumber(totalSales)}</span>}
                {dashboardLoading ? <Skeleton className="h-4 w-16" /> : <span className="text-xs text-muted-foreground truncate" title={salesTarget.toLocaleString()}>{t('target')}: ${compactNumber(salesTarget)}</span>}
                    </div>
              {dashboardLoading ? <Skeleton className="h-2 w-full" /> : <Progress value={salesTarget ? (totalSales / salesTarget) * 100 : 0} className="h-2" />}
                    </div>
        </StatsCard>

        <StatsCard title={t('products')} icon={Package} iconColor="text-purple-500" bgColor="bg-purple-50">
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="flex flex-col items-center p-2 rounded-md bg-background">
                {todayProductsLoading ? <Skeleton className="h-6 w-12 mb-1" /> : <span className="text-xl font-bold" title={assignedToday.toLocaleString()}>{compactNumber(assignedToday)}</span>}
              <span className="text-xs text-muted-foreground">{t('assignedToday')}</span>
                    </div>
            <div className="flex flex-col items-center p-2 rounded-md bg-background">
                {todayProductsLoading ? <Skeleton className="h-6 w-12 mb-1" /> : <span className="text-xl font-bold" title={soldToday.toLocaleString()}>{compactNumber(soldToday)}</span>}
              <span className="text-xs text-muted-foreground">{t('soldToday')}</span>
                    </div>
                  </div>
        </StatsCard>

        <StatsCard title={t('documents')} icon={FileText} iconColor="text-amber-500" bgColor="bg-amber-50">
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="flex flex-col items-center p-2 rounded-md bg-background">
                {documentsLoading ? <Skeleton className="h-6 w-12 mb-1" /> : <span className="text-xl font-bold" title={totalDocs.toLocaleString()}>{compactNumber(totalDocs)}</span>}
              <span className="text-xs text-muted-foreground">{t('total')}</span>
            </div>
            <div className="flex flex-col items-center p-2 rounded-md bg-background">
                {documentsLoading ? <Skeleton className="h-4 w-16 mb-1" /> : <span className="text-xs text-green-600 truncate" title={acceptedDocs.toLocaleString()}>{t('accepted')}: {compactNumber(acceptedDocs)}</span>}
                {documentsLoading ? <Skeleton className="h-4 w-16 mb-1" /> : <span className="text-xs text-red-600 truncate" title={rejectedDocs.toLocaleString()}>{t('rejected')}: {compactNumber(rejectedDocs)}</span>}
                {documentsLoading ? <Skeleton className="h-4 w-16 mb-1" /> : <span className="text-xs text-yellow-600 truncate" title={pendingDocs.toLocaleString()}>{t('pending')}: {compactNumber(pendingDocs)}</span>}
                            </div>
                          </div>
        </StatsCard>
                        </div>

      {/* Quick access sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QuickAccessSection t={t} title={t('recentActivity')} viewAllLink="/activity">
          <div className="space-y-6 max-h-[300px] overflow-y-auto pr-2">
            {/* Attendance */}
            <div>
                <div className="flex items-center justify-between mb-2">
              <button
                    className="flex items-center gap-2 text-left font-semibold text-sm focus:outline-none"
                onClick={() => setAttendanceOpen((v) => !v)}
                aria-expanded={attendanceOpen}
                aria-controls="attendance-section"
              >
                {attendanceOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {t('attendance')}
              </button>
                  <a href="/employee/attendance" className="text-xs text-blue-600 hover:underline">{t('viewAll')}</a>
                </div>
              {attendanceOpen && (
                <div id="attendance-section" className="transition-all duration-200">
                  {attendanceLoading ? (
                      <>
                        {[...Array(3)].map((_, i) => (
                          <Skeleton key={i} className="h-12 w-full mb-2" />
                        ))}
                      </>
                  ) : attendanceError ? (
                    <div className="text-red-500 text-xs">{t('failedToLoadAttendance')}</div>
                  ) : todaysAttendance.length === 0 ? (
                    <div className="text-muted-foreground text-xs">{t('noAttendanceRecordsForToday')}</div>
                  ) : (
                    todaysAttendance.map((rec: any, idx: number) => (
                      <div key={rec.id || idx} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <div className="flex-1">
                          <p className="text-xs font-medium">
                            {t('checkedIn')} {rec.checkIn ? new Date(rec.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                            {rec.checkOut && (
                              <>
                                {" | "}{t('checkedOut')} {new Date(rec.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">Status: {rec.status} | {t('hours')} {rec.workHours || '-'}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
                    </div>
            {/* Sales */}
            <div>
                <div className="flex items-center justify-between mb-2">
              <button
                    className="flex items-center gap-2 text-left font-semibold text-sm focus:outline-none"
                onClick={() => setSalesOpen((v) => !v)}
                aria-expanded={salesOpen}
                aria-controls="sales-section"
              >
                {salesOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {t('sales')}
              </button>
                  <a href="/employee/sales" className="text-xs text-blue-600 hover:underline">{t('viewAll')}</a>
                </div>
              {salesOpen && (
                <div id="sales-section" className="transition-all duration-200">
                  {salesLoading ? (
                      <>
                        {[...Array(3)].map((_, i) => (
                          <Skeleton key={i} className="h-12 w-full mb-2" />
                        ))}
                      </>
                  ) : salesError ? (
                    <div className="text-red-500 text-xs">{t('failedToLoadSales')}</div>
                    ) : filteredTodaysSales.length === 0 ? (
                    <div className="text-muted-foreground text-xs">{t('noSalesRecordedToday')}</div>
                  ) : (
                      filteredTodaysSales.map((sale: any, idx: number) => (
                      <div key={sale.id || idx} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50">
                        <ShoppingCart className="h-4 w-4 text-blue-500" />
                <div className="flex-1">
                          <p className="text-xs font-medium">
                            {sale.product?.name || t('product')} | {t('qty')}: {sale.quantity} | {t('amount')}: ${sale.amount?.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">{t('soldAt')} {new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
              {/* Reports */}
            <div>
                <div className="flex items-center justify-between mb-2">
              <button
                    className="flex items-center gap-2 text-left font-semibold text-sm focus:outline-none"
                onClick={() => setDocumentsOpen((v) => !v)}
                aria-expanded={documentsOpen}
                aria-controls="reports-section"
              >
                {documentsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {t('reports')}
              </button>
                  <a href="/employee/reports" className="text-xs text-blue-600 hover:underline">{t('viewAll')}</a>
                </div>
              {documentsOpen && (
                <div id="reports-section" className="transition-all duration-200">
                  {reportsLoading ? (
                      <>
                        {[...Array(3)].map((_, i) => (
                          <Skeleton key={i} className="h-12 w-full mb-2" />
                        ))}
                      </>
                  ) : reportsError ? (
                    <div className="text-red-500 text-xs">{t('failedToLoadReports')}</div>
                  ) : todaysReports.length === 0 ? (
                    <div className="text-muted-foreground text-xs">{t('noReportsForToday')}</div>
                  ) : (
                    todaysReports.map((report: any, idx: number) => (
                      <div key={report.id || idx} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50">
                        <ClipboardList className="h-4 w-4 text-amber-500" />
                        <div className="flex-1">
                          <p className="text-xs font-medium">{report.type || t('report')} | {report.status || ''}</p>
                          <p className="text-xs text-muted-foreground">{report.title || report.notes || t('noDetails')} | {new Date(report.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="ml-1" onClick={() => setSelectedReport(report)} title={t('view')}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="ml-1" onClick={() => setEditReport(report)} title={t('edit')}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="ml-1" onClick={() => setShowDeleteConfirm({ open: true, id: report.id })} title={t('delete')}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
                    </div>
        </QuickAccessSection>

        <QuickAccessSection t={t} title={t('upcomingTasks')} viewAllLink="/employee/product">
          {todayProductsLoading ? (
              <>
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full mb-2" />
                ))}
              </>
          ) : todayProductsError ? (
            <div className="text-red-500 p-4">{t('failedToLoadAssignedProducts')}</div>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {todaysAssignedProducts.length === 0 ? (
                <div className="text-muted-foreground text-sm p-2">{t('noProductsAssignedToYouToday')}</div>
              ) : (
                todaysAssignedProducts.map((prod: any, idx: number) => (
                  <div key={prod.id || idx} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50">
                    <img src={prod.image || "/placeholder.svg"} alt={prod.name} className="w-10 h-10 rounded-md object-cover" />
                <div className="flex-1">
                      <p className="text-sm font-medium">{prod.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('qty')}: {prod.quantity} | {t('price')}: ${prod.price?.toFixed(2)}
                        {prod.notes ? ` | ${t('notes')}: ${prod.notes}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{t('assigned')} {prod.assignedAt ? new Date(prod.assignedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}</span>
                  </div>
                ))
              )}
                </div>
          )}
        </QuickAccessSection>
                  </div>

      {/* Location tracking dialog */}
      <LocationDialog
        open={showLocationDialog}
        onOpenChange={setShowLocationDialog}
        onEnable={handleEnableLocation}
      />

      {/* Location status indicator */}
      {locationEnabled && (
        <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-full shadow-lg px-4 py-2 flex items-center gap-2 border">
          <div className="h-2 w-2 rounded-full bg-green-500"></div>
          <span className="text-xs font-medium">{t('locationTrackingEnabled')}</span>
                </div>
              )}

      {/* Report Detail Modal */}
        <Dialog open={!!selectedReport} onOpenChange={(open: boolean) => !open && setSelectedReport(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('reportDetails')}</DialogTitle>
            <DialogDescription asChild>
              {selectedReport && (
                <div className="space-y-2 mt-2">
                  <div><span className="font-semibold">{t('date')}:</span> {format(new Date(selectedReport.date), 'PPP')}</div>
                  <div><span className="font-semibold">{t('type')}:</span> {selectedReport.type}</div>
                  <div><span className="font-semibold">{t('status')}:</span> <span className={
                    selectedReport.status === 'approved' ? 'text-green-600' :
                    selectedReport.status === 'rejected' ? 'text-red-600' :
                    'text-yellow-600'
                  }>{selectedReport.status}</span></div>
                  <div><span className="font-semibold">{t('notes')}:</span> {selectedReport.notes || t('noNotes')}</div>
                  {selectedReport.details && (
                    <div><span className="font-semibold">{t('details')}:</span> <pre className="bg-muted rounded p-2 text-xs overflow-x-auto">{JSON.stringify(selectedReport.details, null, 2)}</pre></div>
                  )}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
      {/* Edit Report Modal */}
        <Dialog open={!!editReport} onOpenChange={(open: boolean) => !open && setEditReport(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editReport')}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={async e => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const formData = Object.fromEntries(new FormData(form));
            await handleEdit({ ...editReport, ...formData });
          }}>
            <div>
              <label className="block text-xs font-medium mb-1">{t('type')}</label>
              <select name="type" defaultValue={editReport?.type || ''} required className="border rounded px-2 py-1 w-full">
                <option value="">{t('selectType')}</option>
                <option value="time">{t('time')}</option>
                <option value="absence">{t('absence')}</option>
                <option value="sales">{t('sales')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{t('notes')}</label>
              <textarea name="notes" defaultValue={editReport?.notes || ''} className="border rounded px-2 py-1 w-full" rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={() => setEditReport(null)}>{t('cancel')}</Button>
              <Button type="submit">{t('save')}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteConfirm.open} onOpenChange={(open: boolean) => { if (!open) setShowDeleteConfirm({ open: false, id: null }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteReport')}</DialogTitle>
            <DialogDescription>{t('deleteConfirmation')}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowDeleteConfirm({ open: false, id: null })}>{t('cancel')}</Button>
            <Button variant="destructive" onClick={async () => {
              if (showDeleteConfirm.id) await handleDelete(showDeleteConfirm.id);
              setShowDeleteConfirm({ open: false, id: null });
            }}>{t('delete')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialogs */}
      <Dialog open={confirmCheckIn} onOpenChange={setConfirmCheckIn}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('confirmCheckIn')}</DialogTitle>
            <DialogDescription>{t('confirmCheckInDescription')}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setConfirmCheckIn(false)}>{t('cancel')}</Button>
              <Button onClick={async () => { setConfirmCheckIn(false); await handleCheckIn(); }} disabled={isCheckingIn}>
                {isCheckingIn ? (
                  <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {t('confirm')}</span>
                ) : t('confirm')}
              </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmCheckOut} onOpenChange={setConfirmCheckOut}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('confirmCheckOut')}</DialogTitle>
            <DialogDescription>{t('confirmCheckOutDescription')}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setConfirmCheckOut(false)}>{t('cancel')}</Button>
              <Button onClick={async () => { setConfirmCheckOut(false); await handleCheckOut(); }} disabled={isCheckingOut}>
                {isCheckingOut ? (
                  <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {t('confirm')}</span>
                ) : t('confirm')}
              </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmUndoCheckIn} onOpenChange={setConfirmUndoCheckIn}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('undoCheckIn')}</DialogTitle>
            <DialogDescription>{t('undoCheckInDescription')}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setConfirmUndoCheckIn(false)}>{t('cancel')}</Button>
              <Button onClick={async () => { setConfirmUndoCheckIn(false); await handleUndoCheckIn(); }} disabled={isUndoingCheckIn}>
                {isUndoingCheckIn ? (
                  <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {t('confirm')}</span>
                ) : t('confirm')}
              </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmUndoCheckOut} onOpenChange={setConfirmUndoCheckOut}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('undoCheckOut')}</DialogTitle>
            <DialogDescription>{t('undoCheckOutDescription')}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setConfirmUndoCheckOut(false)}>{t('cancel')}</Button>
              <Button onClick={async () => { setConfirmUndoCheckOut(false); setUndoUsed(true); await handleUndoCheckOut(); }} disabled={isUndoingCheckOut}>
                {isUndoingCheckOut ? (
                  <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {t('confirm')}</span>
                ) : t('confirm')}
              </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster />

        <div className="text-sm text-gray-500">
          Last updated: {displayData?.serverNow ? formatTime(displayData.serverNow) : 'Loading...'}
    </div>
      </div>
    </ErrorBoundary>
  )
}

function StatsCard({
  title,
  icon: Icon,
  iconColor,
  bgColor,
  children,
}: {
  title: string
  icon: React.ElementType
  iconColor: string
  bgColor: string
  children: React.ReactNode
}) {
  return (
    <Card className="transition duration-200 hover:shadow-lg hover:scale-105">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className={`${bgColor} ${iconColor} p-2 rounded-md`}>
            <Icon className="h-5 w-5" />
          </div>
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function QuickAccessSection({
  t,
  title,
  viewAllLink,
  children,
}: {
  t: ReturnType<typeof useTranslations>
  title: string
  viewAllLink: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <Button variant="ghost" size="sm" asChild className="gap-1 text-xs">
            <a href={viewAllLink}>
              {t('viewAll')}
              <ArrowRight className="h-3 w-3" />
            </a>
          </Button>
        </div>
        <Separator />
      </CardHeader>
      <CardContent>{children}</CardContent>
          </Card>
  )
}

function AnimatedCounter({ value }: { value: number }) {
  return (
    <motion.div
      key={value}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-xl font-bold"
    >
      {value.toLocaleString()}
    </motion.div>
  )
}

function SkeletonDashboard() {
  // Render skeleton loaders for dashboard cards
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-32 w-full" />
      ))}
    </div>
  )
}

function SectionSkeleton() {
  return (
    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
      {[...Array(3)].map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
