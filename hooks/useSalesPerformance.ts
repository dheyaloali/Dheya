import useSWR from 'swr';

export type SalesView = 'city' | 'product';

interface FetchError extends Error {
  info?: any;
  status?: number;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('Failed to fetch sales performance') as FetchError;
    error.info = await res.json();
    error.status = res.status;
    throw error;
  }
  return res.json();
};

export function useSalesPerformance(year: number, view: SalesView) {
  const url = view === 'city'
    ? `/api/admin/sales-by-city?year=${year}`
    : `/api/admin/sales-by-product?year=${year}`;

  const { data, error, isLoading, mutate } = useSWR<any[]>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000, // Dedupe requests within 5 seconds
      errorRetryCount: 3,
      onError: (err) => {
        console.error('Error fetching sales performance:', err);
      },
    }
  );

  return {
    data,
    isLoading,
    error,
    mutate,
  };
} 