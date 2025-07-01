import useSWR from 'swr';
import { adminFetcher } from '@/lib/admin-api-client';
import { useEffect, useState } from 'react';

// Define the DashboardStats interface locally to avoid import issues
interface DashboardStats {
  totalEmployees: number;
  employeeGrowth: number;
  attendanceToday: number;
  attendanceRate: number;
  totalSales: number;
  salesGrowth: number;
  pendingSalaries: number;
  pendingSalariesCount: number;
};

// Define minimal stats interface
interface MinimalDashboardStats {
  totalEmployees: number;
  attendanceToday: number;
}

export function useDashboardStats() {
  // Track if we've loaded the minimal stats first
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  
  // Fetch minimal stats first for faster initial load
  const { 
    data: minimalData, 
    error: minimalError 
  } = useSWR<MinimalDashboardStats>(
    '/api/admin/dashboard-stats/minimal',
    adminFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 30000, // Prevent duplicate requests within 30 seconds
    }
  );
  
  // Effect to track when minimal data is loaded
  useEffect(() => {
    if (minimalData && !initialDataLoaded) {
      setInitialDataLoaded(true);
    }
  }, [minimalData, initialDataLoaded]);
  
  // Fetch full stats with a delay if minimal stats are loaded
  const { 
    data: fullData, 
    error: fullError, 
    isLoading: fullIsLoading, 
    mutate 
  } = useSWR<DashboardStats>(
    initialDataLoaded ? '/api/admin/dashboard-stats' : null, 
    adminFetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval: 60000,        // Refresh every 60 seconds (increased from 10s)
      dedupingInterval: 30000,       // Prevent duplicate requests within 30 seconds
      errorRetryCount: 3,            // Retry failed requests 3 times
      onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
        // Never retry on 404s or rate limit errors
        if (error.status === 404 || error.status === 429) return;
        
        // Only retry up to specified count
        if (retryCount >= (config.errorRetryCount || 3)) return;
        
        // Retry with exponential backoff
        setTimeout(() => revalidate({ retryCount }), 
          Math.min(1000 * 2 ** retryCount, 30000)
        );
      }
    }
  );
  
  // Combine data sources - use minimal data for initial display, then full data when available
  const combinedData = fullData || (minimalData ? {
    totalEmployees: minimalData.totalEmployees,
    attendanceToday: minimalData.attendanceToday,
    employeeGrowth: 0,
    attendanceRate: 0,
    totalSales: 0,
    salesGrowth: 0,
    pendingSalaries: 0,
    pendingSalariesCount: 0
  } : undefined);
  
  const isLoading = !combinedData;
  const error = fullError || minimalError;
  
  return {
    stats: combinedData,
    isLoading,
    error,
    mutate,
    isMinimalData: !!minimalData && !fullData
  };
} 