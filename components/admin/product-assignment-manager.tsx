"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Plus, Trash2, Edit, Check, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminEmployees } from "@/hooks/useAdminEmployees";
import { useAdminAssignments } from "@/hooks/useAdminAssignments";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingButton } from "@/components/ui/LoadingButton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import useSWR from "swr";
import AssignProductsModal from "./assign-products-modal";
import { adminFetcher } from "@/lib/admin-api-client";
import debounce from "lodash.debounce";
import { getAvatarImage, getAvatarInitials } from "@/lib/avatar-utils"
import { useCurrency } from "@/components/providers/currency-provider";

// Helper function to format date
function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Main component for product assignment management
export function ProductAssignmentManager() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("employees");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [editingAssignment, setEditingAssignment] = useState<number | null>(null);
  const [newQuantity, setNewQuantity] = useState(1);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState<number | null>(null);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [selectedCity, setSelectedCity] = useState("All");
  const [selectedProducts, setSelectedProducts] = useState<{ [productId: string]: number }>({});
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkSelectedEmployees, setBulkSelectedEmployees] = useState<number[]>([]);
  const [bulkSelectedProducts, setBulkSelectedProducts] = useState<{ [productId: string]: number }>({});
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [showSingleConfirm, setShowSingleConfirm] = useState(false);
  const [isAssigningSingle, setIsAssigningSingle] = useState(false);
  const [isAssigningBulk, setIsAssigningBulk] = useState(false);
  const [assignErrorSingle, setAssignErrorSingle] = useState<string | null>(null);
  const [assignErrorBulk, setAssignErrorBulk] = useState<string | null>(null);
  const { data: productsData, error: productsError, isLoading: productsLoading, mutate: mutateProducts } = useSWR("/api/products", adminFetcher);
  const { data: employeesData, error: employeesError, isLoading: employeesLoading } = useSWR("/api/employees", adminFetcher);
  const [isAssigningProducts, setIsAssigningProducts] = useState(false);
  const [isRemovingAssignment, setIsRemovingAssignment] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { formatAmount } = useCurrency();

  const selectAllEmployeesRef = useRef<HTMLInputElement>(null);
  const selectAllProductsRef = useRef<HTMLInputElement>(null);

  const { employees, ...rest } = useAdminEmployees(1, 10, searchQuery, selectedCity);

  useEffect(() => {
    if (selectAllEmployeesRef.current) {
      selectAllEmployeesRef.current.indeterminate =
        bulkSelectedEmployees.length > 0 &&
        bulkSelectedEmployees.length < employees.length;
    }
  }, [bulkSelectedEmployees, employees.length]);

  useEffect(() => {
    if (selectAllProductsRef.current) {
      selectAllProductsRef.current.indeterminate =
        Object.keys(bulkSelectedProducts).length > 0 &&
        Object.keys(bulkSelectedProducts).length < products.length;
    }
  }, [bulkSelectedProducts, products.length]);

  // Fetch assignments data - filter by employee if one is selected
  const {
    assignments,
    total: totalAssignments,
    currentPage: assignmentsPage,
    pageCount: assignmentsPageCount,
    isLoading: assignmentsLoading,
    error: assignmentsError,
    handlePageChange: handleAssignmentsPageChange,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    mutate: mutateAssignments,
  } = useAdminAssignments({
    initialPage: 1,
    initialPageSize: 50,
    employeeId: selectedEmployee || undefined,
  });

  // Filter assignments to only today's for the 'All Assignments' tab
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todaysAssignments = assignments.filter(a => {
    const assignedDate = new Date(a.assignedAt);
    assignedDate.setHours(0, 0, 0, 0);
    return assignedDate.getTime() === today.getTime();
  });

  // Load products on component mount
  useEffect(() => {
    async function loadProducts() {
      setIsLoadingProducts(true);
      try {
        const response = await fetch("/api/products");
        const data = await response.json();
        setProducts(data.products || []);
      } catch (error) {
        console.error("Error loading products:", error);
        toast({
          title: "Error",
          description: "Failed to load products. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingProducts(false);
      }
    }
    loadProducts();
  }, [toast]);

  // Handle employee selection for filtering
  const handleEmployeeSelect = (employeeId: number) => {
    setSelectedEmployee(employeeId === selectedEmployee ? null : employeeId);
  };

  // Handle opening the new assignment modal
  const handleOpenAssignmentModal = (employeeId?: number) => {
    if (employeeId) {
      setSelectedEmployee(employeeId);
    }
    setQuantity(1);
    setSelectedProduct(null);
    setAssignmentModalOpen(true);
  };

  // Debounced mutate for WebSocket events (if needed in future)
  // const debouncedMutateAssignments = debounce(() => mutateAssignments(), 300, { leading: true, trailing: true });

  // Optimistic Create Assignment
  const handleCreateAssignment = async () => {
    if (!selectedEmployee || Object.keys(selectedProducts).length === 0) {
      toast({ title: "Error", description: "Please select at least one product.", variant: "destructive" });
      return;
    }
    let allSuccess = true;
    const prevAssignments = assignments;
    // Optimistically add assignments
    const optimisticAssignments = [
      ...Object.keys(selectedProducts).map(productId => ({
        id: Date.now() + Math.random(),
      employeeId: selectedEmployee,
        productId: parseInt(productId),
        quantity: selectedProducts[productId],
        assignedAt: new Date().toISOString(),
        status: "assigned"
      })),
      ...assignments
    ];
    mutateAssignments({ assignments: optimisticAssignments, total: totalAssignments + Object.keys(selectedProducts).length }, false);
    for (const productId of Object.keys(selectedProducts)) {
      const quantity = selectedProducts[productId];
      const result = await createAssignment({ employeeId: selectedEmployee, productId: parseInt(productId), quantity });
      if (!result.success) allSuccess = false;
    }
      setAssignmentModalOpen(false);
    setSelectedProducts({});
    await mutateAssignments();
    if (!allSuccess) {
      mutateAssignments({ assignments: prevAssignments, total: totalAssignments }, false); // Revert
      toast({ title: "Error", description: "Some assignments failed.", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Product(s) assigned successfully." });
    }
  };

  // Optimistic Edit Assignment
  const handleSaveQuantity = async (assignmentId: number) => {
    if (newQuantity <= 0) {
      toast({ title: "Error", description: "Quantity must be greater than 0.", variant: "destructive" });
      return;
    }
    const prevAssignments = assignments;
    const optimisticAssignments = assignments.map(a => a.id === assignmentId ? { ...a, quantity: newQuantity } : a);
    mutateAssignments({ assignments: optimisticAssignments, total: totalAssignments }, false);
    const result = await updateAssignment(assignmentId, newQuantity);
    if (!result.success) {
      mutateAssignments({ assignments: prevAssignments, total: totalAssignments }, false); // Revert
      toast({ title: "Error", description: result.error || "Failed to update assignment.", variant: "destructive" });
    } else {
      setEditingAssignment(null);
      toast({ title: "Success", description: "Assignment updated successfully." });
    }
  };

  // Optimistic Delete Assignment
  const handleConfirmDelete = async () => {
    if (!assignmentToDelete) return;
    const prevAssignments = assignments;
    const optimisticAssignments = assignments.filter(a => a.id !== assignmentToDelete);
    mutateAssignments({ assignments: optimisticAssignments, total: totalAssignments - 1 }, false);
    const result = await deleteAssignment(assignmentToDelete);
    if (!result.success) {
      mutateAssignments({ assignments: prevAssignments, total: totalAssignments }, false); // Revert
      toast({ title: "Error", description: result.error || "Failed to delete assignment.", variant: "destructive" });
    } else {
      setDeleteConfirmOpen(false);
      setAssignmentToDelete(null);
      toast({ title: "Success", description: "Assignment deleted successfully." });
    }
  };

  // Handle initiating the edit mode for an assignment
  const handleEditAssignment = (assignmentId: number, currentQuantity: number) => {
    setEditingAssignment(assignmentId);
    setNewQuantity(currentQuantity);
  };

  // Handle initiating the deletion process
  const handleDeleteClick = (assignmentId: number) => {
    setAssignmentToDelete(assignmentId);
    setDeleteConfirmOpen(true);
  };

  // Optimistic Bulk Assign
  const handleBulkAssign = async () => {
    if (bulkSelectedEmployees.length === 0 || Object.keys(bulkSelectedProducts).length === 0) {
      toast({ title: "Error", description: "Select at least one employee and one product.", variant: "destructive" });
      return;
    }
    let allSuccess = true;
    const prevAssignments = assignments;
    const optimisticAssignments = [
      ...bulkSelectedEmployees.flatMap(employeeId =>
        Object.keys(bulkSelectedProducts).map(productId => ({
          id: Date.now() + Math.random(),
          employeeId,
          productId: parseInt(productId),
          quantity: bulkSelectedProducts[productId],
          assignedAt: new Date().toISOString(),
          status: "assigned"
        }))
      ),
      ...assignments
    ];
    mutateAssignments({ assignments: optimisticAssignments, total: totalAssignments + bulkSelectedEmployees.length * Object.keys(bulkSelectedProducts).length }, false);
    for (const employeeId of bulkSelectedEmployees) {
      for (const productId of Object.keys(bulkSelectedProducts)) {
        const quantity = bulkSelectedProducts[productId];
        const result = await createAssignment({ employeeId, productId: parseInt(productId), quantity });
        if (!result.success) allSuccess = false;
      }
    }
    setBulkDialogOpen(false);
    setBulkSelectedEmployees([]);
    setBulkSelectedProducts({});
    await mutateAssignments();
    if (!allSuccess) {
      mutateAssignments({ assignments: prevAssignments, total: totalAssignments }, false); // Revert
      toast({ title: "Error", description: "Some assignments failed.", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Bulk assignment successful." });
    }
  };

  // Add filtered lists in component logic
  const filteredEmployees = employees.filter(emp =>
    emp.user.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
    emp.city.toLowerCase().includes(employeeSearch.toLowerCase())
  );
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  useEffect(() => {
    if (selectAllEmployeesRef.current) {
      selectAllEmployeesRef.current.indeterminate =
        bulkSelectedEmployees.length > 0 &&
        bulkSelectedEmployees.length < filteredEmployees.length;
    }
  }, [bulkSelectedEmployees, filteredEmployees.length]);

  useEffect(() => {
    if (selectAllProductsRef.current) {
      selectAllProductsRef.current.indeterminate =
        Object.keys(bulkSelectedProducts).length > 0 &&
        Object.keys(bulkSelectedProducts).length < filteredProducts.length;
    }
  }, [bulkSelectedProducts, filteredProducts.length]);

  // Paginate today's assignments
  const todaysAssignmentsPageSize = 10;
  const [todaysAssignmentsPage, setTodaysAssignmentsPage] = useState(1);
  const paginatedTodaysAssignments = todaysAssignments.slice(
    (todaysAssignmentsPage - 1) * todaysAssignmentsPageSize,
    todaysAssignmentsPage * todaysAssignmentsPageSize
  );

  // 1. Group today's assignments by employee
  const groupedTodaysAssignments = useMemo(() => {
    const map: { [employeeId: number]: any[] } = {};
    todaysAssignments.forEach(a => {
      if (!map[a.employeeId]) map[a.employeeId] = [];
      map[a.employeeId].push(a);
    });
    return map;
  }, [todaysAssignments]);
  const groupedEmployeeIds = Object.keys(groupedTodaysAssignments);
  const groupedPageSize = 10;
  const [groupedPage, setGroupedPage] = useState(1);
  const paginatedEmployeeIds = groupedEmployeeIds.slice(
    (groupedPage - 1) * groupedPageSize,
    groupedPage * groupedPageSize
  );
  const [viewMoreEmployeeId, setViewMoreEmployeeId] = useState<number | null>(null);

  const handleAssignProducts = async (employeeId: string | number, productIds: (string | number)[]) => {
    setIsAssigningProducts(true);
    setActionError(null);
    try {
      // For each product, send a POST to /api/admin/assignments
      for (const productId of productIds) {
        const response = await fetch("/api/admin/assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId,
            productId: parseInt(productId as string),
            quantity: 1, // Default quantity, or use selected quantity if available
          }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to assign product");
        }
      }
      await mutateProducts();
      toast({
        title: "Products Assigned",
        description: "Products have been assigned successfully!",
      });
      setAssignmentModalOpen(false);
      setSelectedEmployee(null);
      setSelectedProducts({});
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to assign products");
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to assign products",
        variant: "destructive",
      });
    } finally {
      setIsAssigningProducts(false);
    }
  };

  const handleRemoveAssignment = async (employeeId: string | number, productId: string | number) => {
    setIsRemovingAssignment(true);
    setActionError(null);
    try {
      // DELETE by assignment id (should be updated to use assignment id if available)
      // For now, send DELETE to /api/admin/assignments with body
      const response = await fetch(`/api/admin/assignments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          productId: parseInt(productId as string),
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to remove assignment");
      }
      await mutateProducts();
      toast({
        title: "Assignment Removed",
        description: "Product assignment has been removed successfully!",
      });
      setAssignmentModalOpen(false);
      setSelectedEmployee(null);
      setSelectedProducts({});
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to remove assignment");
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to remove assignment",
        variant: "destructive",
      });
    } finally {
      setIsRemovingAssignment(false);
    }
  };

  if (rest.error || assignmentsError) {
    return (
      <div className="p-6 text-center">
        <h3 className="text-lg font-semibold text-red-500">
          Error loading data. Please try again later.
        </h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Product Assignments</h2>
        <Button onClick={() => setBulkDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Assignment
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="employees">Assign Products</TabsTrigger>
          <TabsTrigger value="assignments">Today's Assignments</TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="space-y-6">
          <div className="flex gap-2 items-center">
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="City" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Cities</SelectItem>
                <SelectItem value="Jakarta">Jakarta</SelectItem>
                <SelectItem value="Surabaya">Surabaya</SelectItem>
                <SelectItem value="Bandung">Bandung</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  rest.handleSearch(e.target.value);
                }}
              />
            </div>
          </div>

          <div className="rounded-md border max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Employee</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rest.isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : employees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      No employees found.
                    </TableCell>
                  </TableRow>
                ) : (
                  employees.map((employee) => (
                    <TableRow
                      key={employee.id}
                      className={
                        selectedEmployee === employee.id
                          ? "bg-muted/50"
                          : undefined
                      }
                      onClick={() => handleEmployeeSelect(employee.id)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-3">
                          <Avatar>
                            <AvatarImage
                              src={getAvatarImage({ 
                                image: employee.user.image, 
                                pictureUrl: employee.pictureUrl 
                              })}
                              alt={employee.user.name}
                            />
                            <AvatarFallback>
                              {getAvatarInitials(employee.user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div>{employee.user.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {employee.user.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{employee.position}</TableCell>
                      <TableCell>{employee.city}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAssignmentModal(employee.id);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" /> Assign
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls for Employees */}
          {rest.pageCount > 1 && (
            <div className="flex items-center justify-end space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => rest.handlePageChange(rest.currentPage - 1)}
                disabled={rest.currentPage === 1}
              >
                Previous
              </Button>
              <div className="text-sm">
                Page {rest.currentPage} of {rest.pageCount}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => rest.handlePageChange(rest.currentPage + 1)}
                disabled={rest.currentPage === rest.pageCount}
              >
                Next
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="assignments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Today's Assignments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border max-h-[400px] overflow-y-auto">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Total Value</TableHead>
                      <TableHead>Assigned Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignmentsLoading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : paginatedEmployeeIds.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center">
                          No assignments found for today.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedEmployeeIds.map(employeeId => {
                        const employeeAssignments = groupedTodaysAssignments[Number(employeeId)];
                        const first = employeeAssignments[0];
                        if (employeeAssignments.length === 1) {
                          // Single assignment, show as normal row
                          return (
                            <TableRow key={first.id}>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Avatar className="h-8 w-8">
                                    <AvatarImage src={first.employeeImage} alt={first.employeeName} />
                                    <AvatarFallback>{first.employeeName.split(" ").map((n: string) => n[0]).join("")}</AvatarFallback>
                              </Avatar>
                                  <span>{first.employeeName}</span>
                            </div>
                          </TableCell>
                              <TableCell>{first.productName}</TableCell>
                              <TableCell>{formatAmount(first.productPrice)}</TableCell>
                          <TableCell>
                                {editingAssignment === first.id ? (
                                <Input
                                  type="number"
                                    min="1"
                                  value={newQuantity}
                                    onChange={e => setNewQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                  className="w-20"
                                  />
                                ) : (
                                  first.quantity
                                )}
                              </TableCell>
                              <TableCell>{formatAmount(first.totalValue)}</TableCell>
                              <TableCell>{formatDate(first.assignedAt)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end space-x-2">
                                  {editingAssignment === first.id ? (
                                    <>
                                      <Button variant="ghost" size="sm" onClick={() => handleSaveQuantity(first.id)}>
                                  <Check className="h-4 w-4" />
                                </Button>
                                      <Button variant="ghost" size="sm" onClick={() => setEditingAssignment(null)}>
                                  <X className="h-4 w-4" />
                                </Button>
                                    </>
                            ) : (
                                    <Button variant="ghost" size="sm" onClick={() => handleEditAssignment(first.id, first.quantity)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                                  )}
                                  <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(first.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                          );
                        } else {
                          // Multiple assignments, show summary row with View More
                          return (
                            <TableRow key={employeeId}>
                              <TableCell colSpan={7}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <Avatar className="h-8 w-8">
                                      <AvatarImage src={first.employeeImage} alt={first.employeeName} />
                                      <AvatarFallback>{first.employeeName.split(" ").map((n: string) => n[0]).join("")}</AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium">{first.employeeName}</span>
                                    <span className="ml-2 text-xs text-muted-foreground">{employeeAssignments.length} assignments</span>
                                  </div>
                                  <Button variant="outline" size="sm" onClick={() => setViewMoreEmployeeId(Number(employeeId))}>
                                    View More
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        }
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls for Today's Assignments */}
              {Math.ceil(groupedEmployeeIds.length / groupedPageSize) > 1 && (
                <div className="flex items-center justify-end space-x-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setGroupedPage(groupedPage - 1)}
                    disabled={groupedPage === 1}
                  >
                    Previous
                  </Button>
                  <div className="text-sm">
                    Page {groupedPage} of {Math.ceil(groupedEmployeeIds.length / groupedPageSize)}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setGroupedPage(groupedPage + 1)}
                    disabled={groupedPage === Math.ceil(groupedEmployeeIds.length / groupedPageSize)}
                  >
                    Next
                  </Button>
                </div>
              )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Assignment Dialog */}
      <Dialog open={assignmentModalOpen} onOpenChange={setAssignmentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Product to Employee</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Employee</Label>
              <div className="font-semibold text-lg">{employees.find(e => e.id === selectedEmployee)?.user.name || ""}</div>
            </div>
            <div className="grid gap-2">
              <Label>Products</Label>
              <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #eee', borderRadius: 4, padding: 8 }}>
                {products.map(product => {
                  const isChecked = !!selectedProducts[product.id];
                  return (
                    <div
                      key={product.id}
                      className={`flex items-center gap-2 mb-2 cursor-pointer rounded px-1 ${isChecked ? 'bg-blue-50' : ''}`}
                      onClick={() => {
                        setSelectedProducts(prev => {
                          const copy = { ...prev };
                          if (isChecked) {
                            delete copy[product.id];
                          } else {
                            copy[product.id] = 1;
                          }
                          return copy;
                        });
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={e => {
                          setSelectedProducts(prev => {
                            const copy = { ...prev };
                            if (isChecked) {
                              delete copy[product.id];
                            } else {
                              copy[product.id] = 1;
                            }
                            return copy;
                          });
                        }}
                        onClick={e => e.stopPropagation()}
                      />
                      <span className="flex-1">{product.name} ({formatAmount(product.price)})</span>
                      {isChecked && (
              <Input
                type="number"
                min="1"
                          value={selectedProducts[product.id]}
                          onChange={e => {
                            const value = Math.max(1, parseInt(e.target.value) || 1);
                            setSelectedProducts(prev => ({ ...prev, [product.id]: value }));
                          }}
                          className="w-20"
                          onClick={e => e.stopPropagation()}
              />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignmentModalOpen(false)}>
              Cancel
            </Button>
            <AlertDialog open={showSingleConfirm} onOpenChange={(open) => {
              setShowSingleConfirm(open);
              if (open) setAssignErrorSingle(null);
            }}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Assignment</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to assign the selected products to this employee?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction asChild>
                    <LoadingButton
                      loading={isAssigningSingle}
                      loadingText="Assigning..."
                      onClick={async () => {
                        setIsAssigningSingle(true);
                        setAssignErrorSingle(null);
                        try {
                          const result = await handleCreateAssignment();
                          if (result && result.success !== false) {
                            setShowSingleConfirm(false);
                          } else {
                            setAssignErrorSingle(result?.error || "Assignment failed.");
                          }
                        } catch (err) {
                          setAssignErrorSingle("An unexpected error occurred.");
                        } finally {
                          setIsAssigningSingle(false);
                        }
                      }}
                    >
                      Confirm
                    </LoadingButton>
                  </AlertDialogAction>
                </AlertDialogFooter>
                {assignErrorSingle && <div className="text-red-500 mt-2">{assignErrorSingle}</div>}
              </AlertDialogContent>
            </AlertDialog>
            <LoadingButton
              onClick={() => {
                setAssignErrorSingle(null);
                setShowSingleConfirm(true);
              }}
              loadingText="Assigning..."
            >
              Assign Products
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete this product assignment?</p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Assignment Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent style={{ maxWidth: 900 }}>
          <DialogHeader>
            <DialogTitle>Bulk Assign Products to Employees</DialogTitle>
          </DialogHeader>
          <div className="flex gap-4" style={{ minHeight: 300 }}>
            {/* Employee List */}
            <div style={{ flex: 1, maxHeight: 300, overflowY: 'auto', border: '1px solid #eee', borderRadius: 4, padding: 8 }}>
              <div className="font-semibold mb-2 flex items-center gap-2">
                Employees
                <input
                  ref={selectAllEmployeesRef}
                  type="checkbox"
                  checked={bulkSelectedEmployees.length === filteredEmployees.length && filteredEmployees.length > 0}
                  onChange={e => {
                    if (e.target.checked) {
                      setBulkSelectedEmployees(filteredEmployees.map(emp => emp.id));
                    } else {
                      setBulkSelectedEmployees([]);
                    }
                  }}
                />
                <span className="text-xs">Select All</span>
              </div>
              <Input
                placeholder="Search employees..."
                value={employeeSearch}
                onChange={e => setEmployeeSearch(e.target.value)}
                className="mb-2"
              />
              {filteredEmployees.map(emp => {
                const isChecked = bulkSelectedEmployees.includes(emp.id);
                return (
                  <div
                    key={emp.id}
                    className={`flex items-center gap-2 mb-2 cursor-pointer rounded px-1 ${isChecked ? 'bg-blue-50' : ''}`}
                    onClick={() => {
                      setBulkSelectedEmployees(prev =>
                        isChecked ? prev.filter(id => id !== emp.id) : [...prev, emp.id]
                      );
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={e => {
                        setBulkSelectedEmployees(prev =>
                          isChecked ? prev.filter(id => id !== emp.id) : [...prev, emp.id]
                        );
                      }}
                      onClick={e => e.stopPropagation()}
                    />
                    <Avatar className="h-7 w-7">
                      <AvatarImage 
                        src={getAvatarImage({ 
                          image: emp.user.image, 
                          pictureUrl: emp.pictureUrl 
                        })} 
                        alt={emp.user.name} 
                      />
                      <AvatarFallback>{getAvatarInitials(emp.user.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{emp.user.name}</div>
                      <div className="text-xs text-muted-foreground">{emp.city}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Product List */}
            <div style={{ flex: 1, maxHeight: 300, overflowY: 'auto', border: '1px solid #eee', borderRadius: 4, padding: 8 }}>
              <div className="font-semibold mb-2 flex items-center gap-2">
                Products
                <input
                  ref={selectAllProductsRef}
                  type="checkbox"
                  checked={Object.keys(bulkSelectedProducts).length === filteredProducts.length && filteredProducts.length > 0}
                  onChange={e => {
                    if (e.target.checked) {
                      const all: { [key: string]: number } = {};
                      filteredProducts.forEach(p => { all[p.id] = 1; });
                      setBulkSelectedProducts(all);
                    } else {
                      setBulkSelectedProducts({});
                    }
                  }}
                />
                <span className="text-xs">Select All</span>
              </div>
              <Input
                placeholder="Search products..."
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                className="mb-2"
              />
              {filteredProducts.map(product => {
                const isChecked = !!bulkSelectedProducts[product.id];
                return (
                  <div
                    key={product.id}
                    className={`flex items-center gap-2 mb-2 cursor-pointer rounded px-1 ${isChecked ? 'bg-blue-50' : ''}`}
                    onClick={() => {
                      setBulkSelectedProducts(prev => {
                        const copy = { ...prev };
                        if (isChecked) {
                          delete copy[product.id];
                        } else {
                          copy[product.id] = 1;
                        }
                        return copy;
                      });
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={e => {
                        setBulkSelectedProducts(prev => {
                          const copy = { ...prev };
                          if (isChecked) {
                            delete copy[product.id];
                          } else {
                            copy[product.id] = 1;
                          }
                          return copy;
                        });
                      }}
                      onClick={e => e.stopPropagation()}
                    />
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-8 h-8 rounded object-cover"
                        style={{ minWidth: 32, minHeight: 32 }}
                      />
                    ) : (
                      <div
                        className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center text-gray-400"
                        style={{ minWidth: 32, minHeight: 32 }}
                      >
                        <span className="text-xs">No Image</span>
                      </div>
                    )}
                    <span className="flex-1">{product.name} ({formatAmount(product.price)})</span>
                    {isChecked && (
                      <Input
                        type="number"
                        min="1"
                        value={bulkSelectedProducts[product.id]}
                        onChange={e => {
                          const value = Math.max(1, parseInt(e.target.value) || 1);
                          setBulkSelectedProducts(prev => ({ ...prev, [product.id]: value }));
                        }}
                        className="w-20"
                        onClick={e => e.stopPropagation()}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
              Cancel
            </Button>
            <AlertDialog open={showBulkConfirm} onOpenChange={(open) => {
              setShowBulkConfirm(open);
              if (open) setAssignErrorBulk(null);
            }}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Bulk Assignment</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to assign the selected products to the selected employees?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction asChild>
                    <LoadingButton
                      loading={isAssigningBulk}
                      loadingText="Assigning..."
                      disabled={isLoadingProducts}
                      onClick={async () => {
                        setIsAssigningBulk(true);
                        setAssignErrorBulk(null);
                        try {
                          const result = await handleBulkAssign();
                          if (result && result.success !== false) {
                            setShowBulkConfirm(false);
                          } else {
                            setAssignErrorBulk(result?.error || "Bulk assignment failed.");
                          }
                        } catch (err) {
                          setAssignErrorBulk("An unexpected error occurred.");
                        } finally {
                          setIsAssigningBulk(false);
                        }
                      }}
                    >
                      Confirm
                    </LoadingButton>
                  </AlertDialogAction>
                </AlertDialogFooter>
                {assignErrorBulk && <div className="text-red-500 mt-2">{assignErrorBulk}</div>}
              </AlertDialogContent>
            </AlertDialog>
            <LoadingButton
              onClick={() => {
                setAssignErrorBulk(null);
                setShowBulkConfirm(true);
              }}
              disabled={isLoadingProducts}
              loadingText="Assigning..."
            >
              Assign Products
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add modal popup for View More */}
      <Dialog open={!!viewMoreEmployeeId} onOpenChange={() => setViewMoreEmployeeId(null)}>
        <DialogContent style={{ maxWidth: 850 }}>
          <DialogHeader>
            <DialogTitle>
              Today's Assignments for {
                viewMoreEmployeeId &&
                groupedTodaysAssignments[viewMoreEmployeeId] &&
                groupedTodaysAssignments[viewMoreEmployeeId].length > 0
                  ? groupedTodaysAssignments[viewMoreEmployeeId][0].employeeName
                  : ""
              }
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto" style={{ maxHeight: 400, overflowY: 'auto' }}>
            {viewMoreEmployeeId && groupedTodaysAssignments[viewMoreEmployeeId] && groupedTodaysAssignments[viewMoreEmployeeId].length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Total Value</TableHead>
                    <TableHead>Assigned Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedTodaysAssignments[viewMoreEmployeeId].map(assignment => (
                    <TableRow key={assignment.id}>
                      <TableCell>{assignment.productName}</TableCell>
                      <TableCell>{formatAmount(assignment.productPrice)}</TableCell>
                      <TableCell>
                        {editingAssignment === assignment.id ? (
                          <Input
                            type="number"
                            min="1"
                            value={newQuantity}
                            onChange={e => setNewQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-20"
                          />
                        ) : (
                          assignment.quantity
                        )}
                      </TableCell>
                      <TableCell>{formatAmount(assignment.totalValue)}</TableCell>
                      <TableCell>{formatDate(assignment.assignedAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          {editingAssignment === assignment.id ? (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => handleSaveQuantity(assignment.id)}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setEditingAssignment(null)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => handleEditAssignment(assignment.id, assignment.quantity)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(assignment.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-lg font-medium">
                No assignments left for this employee.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewMoreEmployeeId(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Products Modal */}
      <Dialog open={assignmentModalOpen} onOpenChange={setAssignmentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Products</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <AssignProductsModal
              employee={employees.find(e => e.id === selectedEmployee) as Employee}
              products={productsData?.products || []}
              selectedProducts={
                Object.keys(selectedProducts)
                  .map(id => (productsData?.products || []).find(p => p.id === parseInt(id)))
                  .filter(Boolean)
              }
              onProductsChange={newProductsArray => {
                const newObj = {};
                newProductsArray.forEach(p => {
                  newObj[p.id] = 1; // default quantity 1, or use previous if you track it
                });
                setSelectedProducts(newObj);
              }}
              isOpen={assignmentModalOpen}
              onClose={() => {
                setAssignmentModalOpen(false);
                setSelectedEmployee(null);
                setSelectedProducts({});
              }}
              onAssign={handleAssignProducts}
              isLoading={isAssigningProducts}
            />
          )}
          {actionError && <div className="text-red-500 mt-2">{actionError}</div>}
        </DialogContent>
      </Dialog>
    </div>
  );
} 