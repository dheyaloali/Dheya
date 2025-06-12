import useSWR from 'swr';
import { useState } from 'react';
import type { AttendanceStatus } from "../lib/mock-data";

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

export function useAttendanceRecords(initialPage = 1, initialPageSize = 10) {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const url = `/api/admin/attendance?page=${page}&pageSize=${pageSize}`;
  const { data, error, isLoading, mutate } = useSWR<{ records: AttendanceRecord[]; total: number }>(url, (url) => fetch(url).then(res => {
    if (!res.ok) throw new Error('Failed to fetch attendance records');
    return res.json();
  }));
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
  };
} 