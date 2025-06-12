import useSWR from 'swr';
import { useState } from 'react';

export function useTopPerformers(initialPage = 1, initialPageSize = 10, city?: string) {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const cityParam = city && city !== 'All' ? `&city=${encodeURIComponent(city)}` : '';
  const url = `/api/admin/top-performers?limit=${pageSize}&offset=${(page - 1) * pageSize}${cityParam}`;
  const { data, error, isLoading, mutate } = useSWR(url, (url: string) => fetch(url).then(res => res.json()));
  return {
    performers: data?.performers || [],
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