import useSWR from 'swr';

export type SalesView = 'city' | 'product';

export function useSalesPerformance(year: number, view: SalesView) {
  const url = view === 'city'
    ? `/api/admin/sales-by-city?year=${year}`
    : `/api/admin/sales-by-product?year=${year}`;
  const { data, error, isLoading, mutate } = useSWR<any[]>(url, (url) => fetch(url).then(res => {
    if (!res.ok) throw new Error('Failed to fetch sales performance');
    return res.json();
  }));
  return {
    data,
    isLoading,
    error,
    mutate,
  };
} 