import type { Metadata } from "next"

import { ReportsContent } from "@/components/admin/reports-content"

export const metadata: Metadata = {
  title: "Reports | Employee Management System",
  description: "Generate and view reports for the Employee Management System",
}

export default function ReportsPage() {
  return <ReportsContent />
}
