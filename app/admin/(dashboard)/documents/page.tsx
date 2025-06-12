import type { Metadata } from "next"

import DocumentsContent from "@/components/admin/documents-content"

export const metadata: Metadata = {
  title: "Documents | Employee Management System",
  description: "Manage employee documents in the Employee Management System",
}

export default function DocumentsPage() {
  return <DocumentsContent />
}
