import type { Metadata } from "next"

import { EmployeeDocumentsContent } from "@/components/employee/documents-content"
import { EmployeeLayout } from "@/components/layouts/employee-layout"

export const metadata: Metadata = {
  title: "Documents | Employee Management System",
  description: "Upload and manage your documents",
}

export default function EmployeeDocumentsPage() {
  return (
      <EmployeeDocumentsContent />
      )
}
