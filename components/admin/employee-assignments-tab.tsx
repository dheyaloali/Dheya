"use client"

import { useState, useEffect } from "react"
import { Search, Plus, Edit, Trash2, Package, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Image from "next/image"
import AssignProductModal from "./assign-product-modal"
import DeleteAssignmentModal from "./delete-assignment-modal"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useCurrency } from "@/components/providers/currency-provider"

// Placeholder hooks for API data fetching
const useEmployees = () => {
  const [employees, setEmployees] = useState<any[]>([])
  useEffect(() => {
    // TODO: Replace with real API call
    // fetch('/api/admin/employees').then(res => res.json()).then(setEmployees)
  }, [])
  return employees
}

const useAssignments = () => {
  const [assignments, setAssignments] = useState<any[]>([])
  useEffect(() => {
    // TODO: Replace with real API call
    // fetch('/api/admin/assignments').then(res => res.json()).then(setAssignments)
  }, [])
  return [assignments, setAssignments] as const
}

export default function EmployeeAssignmentsTab() {
  const { formatAmount } = useCurrency()
  const [searchTerm, setSearchTerm] = useState("")
  const employees = useEmployees() || []
  const [assignments, setAssignments] = useAssignments()
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null)
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null)
  const [expandedEmployees, setExpandedEmployees] = useState<Record<string, boolean>>({})

  const filteredEmployees = (employees || []).filter(
    (employee: any) =>
      (employee.name ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (employee.position ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (employee.city ?? "").toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const getEmployeeAssignments = (employeeId: string) => {
    return (assignments || []).filter((assignment: any) => assignment.employeeId === employeeId)
  }

  const toggleEmployeeExpanded = (employeeId: string) => {
    setExpandedEmployees((prev) => ({
      ...prev,
      [employeeId]: !prev[employeeId],
    }))
  }

  const handleAssignProducts = (newAssignments: any[]) => {
    setAssignments([...(assignments || []), ...newAssignments])
    setIsAssignModalOpen(false)
    if (newAssignments.length > 0) {
      const employeeId = newAssignments[0].employeeId
      setExpandedEmployees((prev) => ({
        ...prev,
        [employeeId]: true,
      }))
    }
  }

  const handleUpdateQuantity = (assignmentId: string, newQuantity: number) => {
    setAssignments(
      (assignments || []).map((assignment: any) =>
        assignment.id === assignmentId ? { ...assignment, quantity: newQuantity } : assignment,
      ),
    )
    setIsUpdateModalOpen(false)
  }

  const handleDeleteAssignment = (assignmentId: string) => {
    setAssignments((assignments || []).filter((assignment: any) => assignment.id !== assignmentId))
    setIsDeleteModalOpen(false)
  }

  // Add a loading state for skeletons
  const isLoading = employees.length === 0;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Employee Assignments</h2>
          <Button onClick={() => setIsAssignModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Assign Products
          </Button>
        </div>

        <div className="relative w-full md:w-80 mb-6">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead className="w-[80px]">Photo</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Position</TableHead>
                <TableHead className="hidden md:table-cell">City</TableHead>
                <TableHead>Assignments</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-10 w-10 rounded" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                    No employees found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployees.map((employee: any) => {
                  const employeeAssignments = getEmployeeAssignments(employee.id)
                  const isExpanded = expandedEmployees[employee.id] || false

                  return (
                    <>
                      <TableRow key={employee.id} className="hover:bg-muted/50">
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 p-0"
                            onClick={() => toggleEmployeeExpanded(employee.id)}
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <span className="sr-only">Toggle</span>
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Image
                            src={employee.photo || "/placeholder.svg"}
                            alt={employee.name}
                            width={40}
                            height={40}
                            className="rounded-full object-cover"
                          />
                        </TableCell>
                        <TableCell className="font-medium">{employee.name}</TableCell>
                        <TableCell className="hidden md:table-cell">{employee.position}</TableCell>
                        <TableCell className="hidden md:table-cell">{employee.city}</TableCell>
                        <TableCell>
                          <Badge variant={employeeAssignments.length > 0 ? "default" : "outline"}>
                            {employeeAssignments.length} products
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedEmployee(employee)
                              setIsAssignModalOpen(true)
                            }}
                          >
                            <Package className="mr-2 h-4 w-4" />
                            Assign
                          </Button>
                        </TableCell>
                      </TableRow>

                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={7} className="p-0 border-t-0">
                            <div className="bg-muted/50 px-4 py-3">
                              <h3 className="font-medium mb-2">Assigned Products</h3>
                              {employeeAssignments.length === 0 && !isLoading ? (
                                <p className="text-sm text-muted-foreground py-2">
                                  No products assigned to this employee.
                                </p>
                              ) : isLoading ? (
                                <div className="rounded-md border bg-background">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Product</TableHead>
                                        <TableHead>Quantity</TableHead>
                                        <TableHead>Price</TableHead>
                                        <TableHead>Total</TableHead>
                                        <TableHead>Date Assigned</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {Array.from({ length: 3 }).map((_, j) => (
                                        <TableRow key={j}>
                                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                          <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                          <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              ) : (
                                <div className="rounded-md border bg-background">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Product</TableHead>
                                        <TableHead>Quantity</TableHead>
                                        <TableHead>Price</TableHead>
                                        <TableHead>Total</TableHead>
                                        <TableHead>Date Assigned</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {employeeAssignments.map((assignment: any) => (
                                        <TableRow key={assignment.id}>
                                          <TableCell>
                                            <div className="flex items-center gap-2">
                                              <Image
                                                src={assignment.productImage || "/placeholder.svg"}
                                                alt={assignment.productName}
                                                width={32}
                                                height={32}
                                                className="rounded-md object-cover"
                                              />
                                              <span>{assignment.productName}</span>
                                            </div>
                                          </TableCell>
                                          <TableCell>{assignment.quantity}</TableCell>
                                          <TableCell>{formatAmount(assignment.price)}</TableCell>
                                          <TableCell>{formatAmount(assignment.quantity * assignment.price)}</TableCell>
                                          <TableCell>{new Date(assignment.date).toLocaleDateString()}</TableCell>
                                          <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                              <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => {
                                                  setSelectedAssignment(assignment)
                                                  setIsUpdateModalOpen(true)
                                                }}
                                              >
                                                <Edit className="h-4 w-4" />
                                                <span className="sr-only">Edit quantity</span>
                                              </Button>
                                              <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => {
                                                  setSelectedAssignment(assignment)
                                                  setIsDeleteModalOpen(true)
                                                }}
                                              >
                                                <Trash2 className="h-4 w-4" />
                                                <span className="sr-only">Delete assignment</span>
                                              </Button>
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <AssignProductModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        onAssign={handleAssignProducts}
        preSelectedEmployee={selectedEmployee}
      />

      {selectedAssignment && (
        <>
          <UpdateQuantityModal
            assignment={selectedAssignment}
            isOpen={isUpdateModalOpen}
            onClose={() => setIsUpdateModalOpen(false)}
            onUpdate={handleUpdateQuantity}
          />
          <DeleteAssignmentModal
            assignment={selectedAssignment}
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onDelete={handleDeleteAssignment}
          />
        </>
      )}
    </Card>
  )
}
