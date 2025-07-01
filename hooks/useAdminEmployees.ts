"use client";

import useSWR from "swr";
import { useState } from "react";
import { adminFetcher } from "@/lib/admin-api-client";

// Define response types
export interface Employee {
  id: number;
  userId: string;
  position: string;
  city: string;
  joinDate?: string;
  pictureUrl?: string;
  user: {
    id: string;
    name: string;
    email: string;
    status: string;
    image?: string;
  };
  assignedProducts: Array<{
    id: number;
    name: string;
    price: number;
    quantity: number;
    assignedAt: string;
  }>;
}

export interface EmployeesResponse {
  employees: Employee[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export function useAdminEmployees(initialPage = 1, initialPageSize = 10, search = "", city = "All") {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [searchQuery, setSearchQuery] = useState(search);

  // Build the query string
  const queryParams = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  });
  
  if (searchQuery) {
    queryParams.append("search", searchQuery);
  }

  if (city && city !== "All") {
    queryParams.append("city", city);
  }

  // Create the full URL
  const url = `/api/admin/employees?${queryParams.toString()}`;

  // Fetch data using SWR with CSRF-protected adminFetcher
  const { data, error, isLoading, mutate } = useSWR<EmployeesResponse>(url, adminFetcher);

  // Change page handler
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  // Change page size handler
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1); // Reset to first page
  };

  // Search handler
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPage(1); // Reset to first page
  };

  return {
    employees: data?.employees || [],
    total: data?.total || 0,
    pageCount: data?.pageCount || 0,
    currentPage: page,
    pageSize,
    isLoading,
    error,
    mutate,
    handlePageChange,
    handlePageSizeChange,
    handleSearch,
    searchQuery,
  };
} 