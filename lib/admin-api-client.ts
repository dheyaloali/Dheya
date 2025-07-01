import { getCsrfTokenFromCookie } from './csrf';

// Utility for admin API calls with CSRF protection and retry logic
export const fetchWithCSRF = async (url: string, options: RequestInit = {}, retries = 3): Promise<Response> => {
  const csrfToken = getCsrfTokenFromCookie();
  
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        credentials: 'include', // This enables CSRF protection
      });
      
      if (res.ok) return res;
      
      // Handle CSRF token errors
      if (res.status === 403 && res.headers.get('X-CSRF-Protection')) {
        // Refresh the page to get a new CSRF token
        window.location.reload();
        throw new Error('CSRF token invalid, refreshing page');
      }
      
      // Only retry on server errors
      if (res.status >= 500) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }
      return res;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries reached');
};

// Standard fetcher for SWR
export const adminFetcher = async (url: string): Promise<any> => {
  const res = await fetchWithCSRF(url, {
    method: 'GET'
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to fetch data' }));
    throw new Error(error.message || 'Failed to fetch data');
  }
  
  return res.json();
};

// Admin API client with CSRF protection
const adminApiClient = {
  // Dashboard
  getDashboardStats: async () => {
    const res = await fetchWithCSRF('/api/admin/dashboard-stats');
    if (!res.ok) throw new Error('Failed to fetch dashboard stats');
    return res.json();
  },
  
  getTopPerformers: async (limit = 10, offset = 0, city?: string) => {
    const cityParam = city && city !== 'All' ? `&city=${encodeURIComponent(city)}` : '';
    const res = await fetchWithCSRF(`/api/admin/top-performers?limit=${limit}&offset=${offset}${cityParam}`);
    if (!res.ok) throw new Error('Failed to fetch top performers');
    return res.json();
  },
  
  // Employees
  getEmployees: async (page = 1, pageSize = 10, filters = {}) => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      ...filters
    });
    
    const res = await fetchWithCSRF(`/api/admin/employees?${params}`);
    if (!res.ok) throw new Error('Failed to fetch employees');
    return res.json();
  },
  
  // Documents
  getDocuments: async (page = 1, pageSize = 10, filters = {}) => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      ...filters
    });
    
    const res = await fetchWithCSRF(`/api/admin/documents?${params}`);
    if (!res.ok) throw new Error('Failed to fetch documents');
    return res.json();
  },
  
  deleteDocument: async (id: string) => {
    const res = await fetchWithCSRF(`/api/admin/documents/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete document');
    return res.json();
  },
  
  // Reports
  updateReport: async (reportId: string, data: any) => {
    const res = await fetchWithCSRF(`/api/admin/reports/${reportId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update report');
    return res.json();
  },
  
  // Settings
  updateSettings: async (data: any) => {
    const res = await fetchWithCSRF('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update settings');
    return res.json();
  },
  
  // Location tracking
  fetchEmployeeLocations: async (city?: string) => {
    const params = new URLSearchParams();
    if (city && city !== 'All') {
      params.append('city', city);
    }
    
    const url = `/api/admin/employee-locations${params.toString() ? `?${params.toString()}` : ''}`;
    
    const res = await fetchWithCSRF(url, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    if (!res.ok) throw new Error('Failed to fetch employee locations');
    return res.json();
  },
  
  fetchLocationHistory: async (
    employeeId: string,
    startDate: Date,
    endDate: Date,
    page?: number,
    pageSize?: number,
    orderBy: 'asc' | 'desc' = 'asc'
  ) => {
    const params = new URLSearchParams({
      employeeId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });
    
    if (page !== undefined) params.append('page', String(page + 1)); // 1-based for API
    if (pageSize !== undefined) params.append('pageSize', String(pageSize));
    if (orderBy) params.append('orderBy', orderBy);
    
    const res = await fetchWithCSRF(`/api/admin/location-history?${params}`, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    if (!res.ok) throw new Error('Failed to fetch location history');
    return res.json();
  }
};

export default adminApiClient; 