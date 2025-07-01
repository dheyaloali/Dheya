import useSWR from 'swr';
import { useState } from 'react';

// Define AttendanceStatus locally instead of importing from mock-data
export type AttendanceStatus = 'Present' | 'Late' | 'Absent';

export interface AttendanceRecord {
  id: number;
  employeeId: number;
  employeeName: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: AttendanceStatus;
  workHours: string;
  notes?: string;
}

interface AttendanceResponse {
  records: AttendanceRecord[];
  total: number;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const error: Error & { status?: number; info?: any } = new Error(
      errorData.error || 'Failed to fetch attendance records'
    );
    error.status = res.status;
    error.info = errorData;
    throw error;
  }
  return res.json();
};

export function useAttendanceRecords(initialPage = 1, initialPageSize = 10) {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  
  // Build the query URL with parameters
  const url = `/api/admin/attendance?page=${page}&pageSize=${pageSize}`;
  
  const { data, error, isLoading, mutate } = useSWR<AttendanceResponse>(
    url, 
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval: 15000,       // Refresh every 15 seconds for attendance
      dedupingInterval: 5000,       // Prevent duplicate requests within 5 seconds
      errorRetryCount: 3,           // Retry failed requests 3 times
      keepPreviousData: true,       // Keep showing previous data while loading new data
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
  
  return {
    records: data?.records || [],
    total: data?.total || 0,
    page,
    pageSize,
    setPage,
    setPageSize,
    isLoading,
    error,
    mutate,
    refresh: () => mutate()
  };
} 