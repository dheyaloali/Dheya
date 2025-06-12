"use client";

import useSWR from "swr";
import { useState } from "react";

// Define response types
export interface Assignment {
  id: number;
  employeeId: number;
  employeeName: string;
  employeeEmail: string;
  employeeImage?: string;
  productId: number;
  productName: string;
  productPrice: number;
  quantity: number;
  assignedAt: string;
  totalValue: number;
}

export interface AssignmentsResponse {
  assignments: Assignment[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useAdminAssignments({
  initialPage = 1,
  initialPageSize = 50,
  employeeId,
  productId,
  dateFrom,
  dateTo,
}: {
  initialPage?: number;
  initialPageSize?: number;
  employeeId?: number;
  productId?: number;
  dateFrom?: string;
  dateTo?: string;
}) {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // Build the query string
  const queryParams = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  });

  if (employeeId) {
    queryParams.append("employeeId", employeeId.toString());
  }
  
  if (productId) {
    queryParams.append("productId", productId.toString());
  }

  if (dateFrom) {
    queryParams.append("dateFrom", dateFrom);
  }

  if (dateTo) {
    queryParams.append("dateTo", dateTo);
  }

  // Create the full URL
  const url = `/api/admin/assignments?${queryParams.toString()}`;

  // Fetch data using SWR
  const { data, error, isLoading, mutate } = useSWR<AssignmentsResponse>(url, fetcher);

  // Create a new assignment
  const createAssignment = async (assignmentData: {
    employeeId: number;
    productId: number;
    quantity: number;
  }) => {
    try {
      const response = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(assignmentData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create assignment");
      }

      // Refresh the data
      mutate();
      return { success: true, data: result.assignment };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  };

  // Update an existing assignment
  const updateAssignment = async (id: number, quantity: number) => {
    try {
      const response = await fetch("/api/admin/assignments", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, quantity }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update assignment");
      }

      // Refresh the data
      mutate();
      return { success: true, data: result.assignment };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  };

  // Delete an assignment
  const deleteAssignment = async (id: number) => {
    try {
      const response = await fetch(`/api/admin/assignments?id=${id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete assignment");
      }

      // Refresh the data
      mutate();
      return { success: true, data: result.deletedId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  };

  // Bulk assign products to multiple employees
  const bulkAssign = async (employeeIds: number[], assignments: Array<{ productId: number; quantity: number }>) => {
    try {
      const response = await fetch("/api/employees/bulk-assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ employeeIds, assignments }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to bulk assign products");
      }

      // Refresh the data
      mutate();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  };

  // Change page handler
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  // Change page size handler
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1); // Reset to first page
  };

  return {
    assignments: data?.assignments || [],
    total: data?.total || 0,
    pageCount: data?.pageCount || 0,
    currentPage: page,
    pageSize,
    isLoading,
    error,
    mutate,
    handlePageChange,
    handlePageSizeChange,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    bulkAssign,
  };
} 