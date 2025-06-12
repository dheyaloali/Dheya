// Client-side API wrapper
const apiClient = {
  // Auth
  login: async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    if (!response.ok) {
      throw new Error('Login failed');
    }
    
    return response.json();
  },

  register: async (userData: any) => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    
    if (!response.ok) {
      throw new Error('Registration failed');
    }
    
    return response.json();
  },

  // Employees
  getEmployees: async (page = 1, pageSize = 10, filters = {}) => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      ...filters
    });
    
    const response = await fetch(`/api/admin/employees?${params}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch employees');
    }
    
    return response.json();
  },

  getEmployeeById: async (id: string) => {
    const response = await fetch(`/api/admin/employees/${id}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch employee');
    }
    
    return response.json();
  },

  // Attendance
  getAttendanceRecords: async (employeeId: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams({ employeeId });
    
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const response = await fetch(`/api/admin/attendance?${params}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch attendance records');
    }
    
    return response.json();
  },

  createAttendanceRecord: async (record: any) => {
    const response = await fetch('/api/admin/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    
    if (!response.ok) {
      throw new Error('Failed to create attendance record');
    }
    
    return response.json();
  },

  // Salary
  getSalaryRecords: async (employeeId: string, year?: number) => {
    const params = new URLSearchParams({ employeeId });
    
    if (year) params.append('year', year.toString());
    
    const response = await fetch(`/api/admin/salaries?${params}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch salary records');
    }
    
    return response.json();
  },

  // Documents
  getEmployeeDocuments: async (employeeId: string, status?: string) => {
    const params = new URLSearchParams({ employeeId });
    
    if (status) params.append('status', status);
    
    const response = await fetch(`/api/admin/documents?${params}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch documents');
    }
    
    return response.json();
  },

  // Sales
  getSalesRecords: async (page = 1, pageSize = 10, filters = {}) => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      ...filters
    });
    
    const response = await fetch(`/api/admin/sales?${params}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch sales records');
    }
    
    return response.json();
  },

  getProducts: async () => {
    const response = await fetch('/api/admin/products');
    
    if (!response.ok) {
      throw new Error('Failed to fetch products');
    }
    
    return response.json();
  },

  getSalesStatistics: async (employeeId: string, year: number, month?: number) => {
    const params = new URLSearchParams({
      employeeId,
      year: year.toString()
    });
    
    if (month !== undefined) params.append('month', month.toString());
    
    const response = await fetch(`/api/admin/sales-statistics?${params}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch sales statistics');
    }
    
    return response.json();
  },

  // Location tracking
  fetchEmployees: async (city?: string) => {
    // Set up request tracking to prevent duplicates
    const requestId = 'fetch-employees';
    
    // Set up AbortController for potential cancellation
    const controller = new AbortController();
    const signal = controller.signal;
    
    // Store the controller in a global map to allow cancellation of pending requests
    if (typeof window !== 'undefined') {
      if (!window._pendingRequests) {
        window._pendingRequests = new Map();
      }
      
      // Cancel any existing request with the same ID
      if (window._pendingRequests.has(requestId)) {
        console.log(`Cancelling duplicate employees request`);
        window._pendingRequests.get(requestId)?.abort();
      }
      
      // Store this request's controller
      window._pendingRequests.set(requestId, controller);
    }
    
    try {
      // Use the actual API endpoint with no cache
      console.log("Fetching employees from API...", city ? `City filter: ${city}` : "No city filter");
      
      // Build the URL with query parameters
      const params = new URLSearchParams();
      if (city && city !== 'All') {
        params.append('city', city);
      }
      
      const url = `/api/admin/employee-locations${params.toString() ? `?${params.toString()}` : ''}`;
      console.log("Request URL:", url);
      
      const response = await fetch(url, {
        signal,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error: ${response.status} - ${errorText}`);
        throw new Error(`Failed to fetch employees: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("Employee data received:", data);
      return data;
    } catch (error: any) {
      // Don't throw if this was a cancellation
      if (error.name === 'AbortError') {
        console.log('Request was cancelled:', requestId);
        return [];
      }
      console.error('Error fetching employees:', error);
      throw error;
    } finally {
      // Clean up the request from the pending map
      if (typeof window !== 'undefined' && window._pendingRequests?.has(requestId)) {
        window._pendingRequests.delete(requestId);
      }
    }
  },

  fetchLocationHistory: async (
    employeeId: string,
    startDate: Date,
    endDate: Date,
    page?: number,
    pageSize?: number,
    orderBy: 'asc' | 'desc' = 'asc'
  ) => {
    // Generate a unique request ID to track this request
    const requestId = `location-history-${employeeId}-${startDate.toISOString()}-${endDate.toISOString()}-${page || 0}-${pageSize || 10}-${orderBy}`;
    
    // Set up AbortController for potential cancellation
    const controller = new AbortController();
    const signal = controller.signal;
    
    // Store the controller in a global map to allow cancellation of pending requests
    if (typeof window !== 'undefined') {
      if (!window._pendingRequests) {
        window._pendingRequests = new Map();
      }
      
      // Cancel any existing request with the same ID
      if (window._pendingRequests.has(requestId)) {
        console.log(`Cancelling duplicate location history request: ${requestId}`);
        window._pendingRequests.get(requestId)?.abort();
      }
      
      // Store this request's controller
      window._pendingRequests.set(requestId, controller);
    }
    
    try {
      const params = new URLSearchParams({
        employeeId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      
      if (page !== undefined) params.append('page', String(page + 1)); // 1-based for API
      if (pageSize !== undefined) params.append('pageSize', String(pageSize));
      if (orderBy) params.append('orderBy', orderBy);
      
      const response = await fetch(`/api/admin/location-history?${params}`, {
        signal,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch location history');
      }
      
      const data = await response.json();
      return data;
    } catch (error: any) {
      // Don't throw if this was a cancellation
      if (error.name === 'AbortError') {
        console.log('Request was cancelled:', requestId);
        return { locations: [], total: 0 }; // Return empty data for cancelled requests
      }
      console.error('Error fetching location history:', error);
      throw error;
    } finally {
      // Clean up the request from the pending map
      if (typeof window !== 'undefined' && window._pendingRequests?.has(requestId)) {
        window._pendingRequests.delete(requestId);
      }
    }
  },

  fetchCurrentEmployee: async () => {
    const response = await fetch('/api/employee/current')
    if (!response.ok) {
      throw new Error('Failed to fetch employee data')
    }
    return response.json()
  },

  updateEmployeeLocation: async (data: {
    latitude?: number
    longitude?: number
    timestamp?: number
    isActive?: boolean
  }) => {
    const response = await fetch('/api/location-update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    
    if (!response.ok) {
      throw new Error('Failed to update location')
    }
    return response.json()
  }
}

export default apiClient
