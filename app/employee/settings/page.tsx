import type { Metadata } from "next"

import { EmployeeSettingsContent } from "@/components/employee/settings-content"
import { EmployeeLayout } from "@/components/layouts/employee-layout"

export const metadata: Metadata = {
  title: "Settings | Employee Management System",
  description: "Manage your account settings and preferences",
}

export default function EmployeeSettingsPage() {
  return (
      <EmployeeSettingsContent />
  )
}
