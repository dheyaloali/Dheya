// lib/types.ts
export type DocumentStatus = "Pending" | "Approved" | "Rejected"

export type DocumentType = "ID Document" | "Contract" | "Certificate" | "Report"

export interface Document {
  id: string
  employeeId: string
  employeeName: string
  type: DocumentType
  title: string
  description?: string
  date: string
  status: DocumentStatus
  uploadedDuring?: string
}