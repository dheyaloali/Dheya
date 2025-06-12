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
      <Card className="w-full p-0">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-6 w-full">
            <div>
              <CardTitle>Employee Directory</CardTitle>
              <CardDescription>Manage your employees, view their details, and track their performance.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <EmployeeTablePage />
        </CardContent>
      </Card>
        )
}
