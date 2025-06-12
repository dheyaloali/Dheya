import useSWR from 'swr';
import type { DashboardStats } from '@/components/admin/DashboardStatsCards';

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch dashboard stats');
  return res.json();
});

export function useDashboardStats() {
  const { data, error, isLoading, mutate } = useSWR<DashboardStats>('/api/admin/dashboard-stats', fetcher);
  return {
    stats: data,
    isLoading,
    error,
    mutate,
  };
} 