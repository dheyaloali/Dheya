import type { Metadata } from "next"

import { EmployeeSalesContent } from "@/components/employee/sales-content"
import { EmployeeLayout } from "@/components/layouts/employee-layout"


export const metadata: Metadata = {
  title: "Sales | Employee Management System",
  description: "Track and manage your sales performance",
}

export default function EmployeeSalesPage() {
  return (
      <EmployeeSalesContent />
  )
}
