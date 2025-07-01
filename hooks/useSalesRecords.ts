import useSWR from 'swr';
import { adminFetcher } from '@/lib/admin-api-client';

export interface SalesRecordsFilters {
  page?: number;
  pageSize?: number;
  productId?: string[];
  employeeId?: string[];
  city?: string[];
  status?: string;
  from?: string;
  to?: string;
}

function buildQuery(filters: SalesRecordsFilters) {
  const params = new URLSearchParams();
  params.append('all', '1');
  if (filters.page) params.append('page', String(filters.page));
  if (filters.pageSize) params.append('pageSize', String(filters.pageSize));
  if (filters.productId && filters.productId.length > 0) params.append('productId', filters.productId.join(','));
  if (filters.employeeId && filters.employeeId.length > 0) params.append('employeeId', filters.employeeId.join(','));
  if (filters.city && filters.city.length > 0) params.append('city', filters.city.join(','));
  if (filters.status && filters.status !== 'all') params.append('status', filters.status);
  if (filters.from) params.append('from', filters.from);
  if (filters.to) params.append('to', filters.to);
  return `/api/sales?${params.toString()}`;
}

export function useSalesRecords(filters: SalesRecordsFilters) {
  const url = buildQuery(filters);
  const { data, error, isLoading, mutate } = useSWR(url, adminFetcher);
  return {
    sales: data?.sales || [],
    total: data?.total || 0,
    isLoading,
    error,
    mutate,
  };
} 