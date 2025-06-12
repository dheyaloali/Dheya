// Employee Dashboard API Helper
// Usage: import { fetchEmployeeDashboard } from "@/lib/api/employee/fetch-dashboard"

export async function fetchEmployeeDashboard(employeeId: string) {
  const res = await fetch(`/api/employee/dashboard?employeeId=${employeeId}`)
  if (!res.ok) {
    throw new Error("Failed to fetch employee dashboard data")
  }
  return res.json()
} 