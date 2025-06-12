import type { Metadata } from "next"

import { EmployeeAttendanceContent } from "@/components/employee/attendance-content"
import { EmployeeLayout } from "@/components/layouts/employee-layout"

export const metadata: Metadata = {
  title: "Attendance | Employee Management System",
  description: "Track and manage your attendance",
}

export default function EmployeeAttendancePage() {
  return (
      <EmployeeAttendanceContent />
  )
}
