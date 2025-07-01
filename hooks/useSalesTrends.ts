import useSWR from 'swr';
import { adminFetcher } from '@/lib/admin-api-client';

export interface SalesTrendsFilters {
  year?: number;
  view?: 'monthly' | 'yearly';
  productId?: string[];
  employeeId?: string[];
}

function buildTrendsQuery(filters: SalesTrendsFilters) {
  const params = new URLSearchParams();
  if (filters.year) params.append('year', String(filters.year));
  if (filters.productId && filters.productId.length > 0) params.append('productId', filters.productId.join(','));
  if (filters.employeeId && filters.employeeId.length > 0) params.append('employeeId', filters.employeeId.join(','));
  // No explicit view param, but could be added if API supports
  return `/api/sales?${params.toString()}`;
}

export function useSalesTrends(filters: SalesTrendsFilters) {
  const url = buildTrendsQuery(filters);
  const { data, error, isLoading, mutate } = useSWR(url, adminFetcher);
  return {
    data: data || [],
    isLoading,
    error,
    mutate,
  };
} 