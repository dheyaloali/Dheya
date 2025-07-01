export const metadata = {
  title: "Employees | Employee Management System",
  description: "Manage employees in the Employee Management System",
};

import type { Metadata } from "next"

import { AdminLayout } from "@/components/layouts/admin-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PlusCircle } from "lucide-react"
import Link from "next/link"
import EmployeeTablePage from "@/components/employee-table-page"

export default function EmployeesPage() {
  return (
    <>
      <div className="sticky top-0 z-30 bg-white border-b shadow-sm px-6 py-4 mb-4 ml-8">
        <h1 className="text-2xl font-bold">Employee Directory</h1>
        <p className="text-muted-foreground">Manage your employees, view their details, and track their performance.</p>
      </div>
      <Card className="w-full p-0 ml-8">
        <CardContent className="pt-0">
          <EmployeeTablePage />
        </CardContent>
      </Card>
    </>
  )
}
