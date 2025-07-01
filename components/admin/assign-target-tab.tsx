"use client"

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { useAdminEmployees } from "@/hooks/useAdminEmployees";
import useSWR, { mutate } from "swr";
import { toast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { LoadingButton } from "@/components/ui/loading-button";
import BulkAssignTargetModal from "./bulk-assign-target-modal";
import AssignTargetModal from "./assign-target-modal";
import { adminFetcher, fetchWithCSRF } from "@/lib/admin-api-client";
import debounce from "lodash.debounce";

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const years = Array.from({ length: 2050 - 2020 + 1 }, (_, i) => 2020 + i);

export default function AssignTargetTab() {
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const {
    employees,
    total,
    pageCount,
    currentPage,
    pageSize,
    isLoading: employeesLoading,
    handlePageChange,
    handlePageSizeChange,
    handleSearch,
    searchQuery,
  } = useAdminEmployees();

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const allIds = employees.map(e => e.id);
  const allSelected = selectedIds.length === allIds.length && allIds.length > 0;
  const someSelected = selectedIds.length > 0 && selectedIds.length < allIds.length;

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : allIds);
  };
  const toggleSelect = (id: number) => {
    setSelectedIds(selectedIds.includes(id) ? selectedIds.filter(i => i !== id) : [...selectedIds, id]);
  };

  const [bulkTarget, setBulkTarget] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  if (typeof window !== 'undefined') {
    console.log('EMPLOYEES', employees);
  }
  const targetsKey = `/api/admin/sales-target?month=${selectedMonth + 1}&year=${selectedYear}`;
  const salesKey = employees.length > 0 ? `/api/sales?groupBy=employee&month=${selectedMonth + 1}&year=${selectedYear}` : null;

  const { data: targetsData, isLoading: targetsLoading, mutate: mutateTargets } = useSWR(targetsKey, adminFetcher);
  const { data: salesTotalsData, isLoading: salesTotalsLoading } = useSWR(salesKey, adminFetcher);

  if (typeof window !== 'undefined') {
    console.log('EMPLOYEES', employees.map(e => ({ id: e.id, name: e.user?.name })));
    console.log('TARGETS', targetsData?.targets);
  }

  const salesMap = useMemo(() => {
    const map: Record<number, number> = {};
    (salesTotalsData?.totals || []).forEach((t: any) => {
      map[Number(t.employeeId)] = t.totalSales;
    });
    return map;
  }, [salesTotalsData]);
  const targetMap = useMemo(() => {
    const map: Record<number, number | null> = {};
    (targetsData?.targets || []).forEach((t: any) => {
      map[Number(t.employeeId)] = t.targetAmount;
    });
    return map;
  }, [targetsData]);

  const [editTarget, setEditTarget] = useState<{ [id: number]: string }>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const getTarget = (id: number) => targetMap[id] ?? null;
  const getSales = (id: number) => salesMap[id] ?? 0;

  const handleSingleAssign = async (id: number, value: string) => {
    if (!value) return;
    setSavingId(id);
    const prevTargets = targetsData?.targets || [];
    const optimisticTargets = prevTargets.map(t => t.employeeId === id ? { ...t, targetAmount: Number(value) } : t);
    mutateTargets({ ...targetsData, targets: optimisticTargets }, false);
    try {
      await fetchWithCSRF("/api/admin/sales-target", {
        method: "POST",
        body: JSON.stringify({
          employeeId: id,
          month: selectedMonth + 1,
          year: selectedYear,
          targetAmount: Number(value),
        }),
      });
      await Promise.all([
        mutateTargets(),
        mutate(salesKey, undefined, { revalidate: true }),
      ]);
      setEditTarget(t => { const copy = { ...t }; delete copy[id]; return copy; });
      toast({ title: "Success", description: "Target assigned/updated." });
    } catch (err: any) {
      mutateTargets({ ...targetsData, targets: prevTargets }, false);
      toast({ title: "Error", description: err.message || "Failed to assign/update target.", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };
  const handleSingleDelete = async (id: number) => {
    setDeletingId(id);
    const prevTargets = targetsData?.targets || [];
    const optimisticTargets = prevTargets.filter(t => t.employeeId !== id);
    mutateTargets({ ...targetsData, targets: optimisticTargets }, false);
    try {
      const params = new URLSearchParams({
        employeeId: String(id),
        month: String(selectedMonth + 1),
        year: String(selectedYear),
      });
      const res = await fetchWithCSRF(`/api/admin/sales-target?${params.toString()}`, { method: "DELETE" });
      const data = await res.json();
      await Promise.all([
        mutateTargets(),
        mutate(salesKey, undefined, { revalidate: true }),
      ]);
      setEditTarget(t => { const copy = { ...t }; delete copy[id]; return copy; });
      if (data.success) {
        toast({ title: "Success", description: "Target deleted." });
      } else {
        mutateTargets({ ...targetsData, targets: prevTargets }, false);
        toast({ title: "Error", description: "Target not found or already deleted.", variant: "destructive" });
      }
    } catch (err: any) {
      mutateTargets({ ...targetsData, targets: prevTargets }, false);
      toast({ title: "Error", description: err.message || "Failed to delete target.", variant: "destructive" });
    }
    setDeletingId(null);
  };

  const handleBulkAssign = async () => {
    if (!bulkTarget || selectedIds.length === 0) return;
    setBulkSaving(true);
    setBulkError(null);
    const prevTargets = targetsData?.targets || [];
    const optimisticTargets = [
      ...selectedIds.map(id => ({
        employeeId: id,
        targetAmount: Number(bulkTarget),
        month: selectedMonth + 1,
        year: selectedYear,
      })),
      ...prevTargets.filter(t => !selectedIds.includes(t.employeeId)),
    ];
    mutateTargets({ ...targetsData, targets: optimisticTargets }, false);
    try {
      await Promise.all(
        selectedIds.map(id =>
          fetchWithCSRF("/api/admin/sales-target", {
            method: "POST",
            body: JSON.stringify({
              employeeId: id,
              month: selectedMonth + 1,
              year: selectedYear,
              targetAmount: Number(bulkTarget),
            }),
          })
        )
      );
      await Promise.all([
        mutateTargets(),
        mutate(salesKey, undefined, { revalidate: true }),
      ]);
      setBulkTarget("");
      setSelectedIds([]);
      toast({ title: "Success", description: "Bulk target assignment complete." });
    } catch (err: any) {
      mutateTargets({ ...targetsData, targets: prevTargets }, false);
      setBulkError(err.message || "Failed to assign targets");
      toast({ title: "Error", description: err.message || "Failed to assign targets.", variant: "destructive" });
    }
    setBulkSaving(false);
  };
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkDeleteLoading(true);
    setBulkError(null);
    const prevTargets = targetsData?.targets || [];
    const optimisticTargets = prevTargets.filter(t => !selectedIds.includes(t.employeeId));
    mutateTargets({ ...targetsData, targets: optimisticTargets }, false);
    try {
      await Promise.all(
        selectedIds.map(id =>
          fetchWithCSRF("/api/admin/sales-target", {
            method: "POST",
            body: JSON.stringify({
              employeeId: id,
              month: selectedMonth + 1,
              year: selectedYear,
              targetAmount: 0,
            }),
          })
        )
      );
      await Promise.all([
        mutateTargets(),
        mutate(salesKey, undefined, { revalidate: true }),
      ]);
      setSelectedIds([]);
      toast({ title: "Success", description: "Bulk target deletion complete." });
    } catch (err: any) {
      mutateTargets({ ...targetsData, targets: prevTargets }, false);
      setBulkError(err.message || "Failed to delete targets");
      toast({ title: "Error", description: err.message || "Failed to delete targets.", variant: "destructive" });
    }
    setBulkDeleteLoading(false);
  };

  const rows = useMemo(() => {
    if (!employees) return [];
    return employees
      .filter(emp => !searchQuery || emp.user.name?.toLowerCase().includes(searchQuery.toLowerCase()))
      .map(emp => ({
        id: emp.id,
        name: emp.user.name,
        email: emp.user.email,
        city: emp.city,
        position: emp.position,
        totalSales: getSales(emp.id),
        target: getTarget(emp.id),
      }));
  }, [employees, salesMap, targetMap, searchQuery]);

  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isBulkAssignModalOpen, setIsBulkAssignModalOpen] = useState(false);
  const [isDeletingTarget, setIsDeletingTarget] = useState(false);
  const [isAssigningTarget, setIsAssigningTarget] = useState(false);
  const [isBulkAssigningTarget, setIsBulkAssigningTarget] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<SalesTarget | null>(null);

  const handleAssignTarget = async (data: { employeeId: number; target: number; month: number; year: number }) => {
    setIsAssigningTarget(true);
    setActionError(null);
    try {
      const response = await fetch("/api/admin/sales-target", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: data.employeeId,
          month: data.month,
          year: data.year,
          targetAmount: data.target,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to assign target");
      }
      await Promise.all([
        mutate(targetsKey, undefined, { revalidate: true }),
        mutate(salesKey, undefined, { revalidate: true }),
      ]);
      toast({
        title: "Target Assigned",
        description: "Sales target has been assigned successfully!",
      });
      setIsAssignModalOpen(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to assign target");
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to assign target",
        variant: "destructive",
      });
    } finally {
      setIsAssigningTarget(false);
    }
  };

  const handleBulkAssignTarget = async (data: { employeeIds: number[]; target: number; month: number; year: number }) => {
    setIsBulkAssigningTarget(true);
    setActionError(null);
    try {
      await Promise.all(
        data.employeeIds.map(id =>
          fetch("/api/admin/sales-target", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              employeeId: id,
              month: data.month,
              year: data.year,
              targetAmount: data.target,
            }),
          })
        )
      );
      await Promise.all([
        mutate(targetsKey, undefined, { revalidate: true }),
        mutate(salesKey, undefined, { revalidate: true }),
      ]);
      toast({
        title: "Targets Assigned",
        description: "Sales targets have been assigned successfully!",
      });
      setIsBulkAssignModalOpen(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to assign targets");
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to assign targets",
        variant: "destructive",
      });
    } finally {
      setIsBulkAssigningTarget(false);
    }
  };

  const handleDeleteTarget = async (targetId: string | number) => {
    setIsDeletingTarget(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/sales-targets/${targetId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete target");
      }
      await mutateTargets();
      toast({
        title: "Target Deleted",
        description: "Sales target has been deleted successfully!",
      });
      setDeleteConfirmTarget(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete target");
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete target",
        variant: "destructive",
      });
    } finally {
      setIsDeletingTarget(false);
    }
  };

  return (
    <Card className="max-w-5xl mx-auto">
      <CardHeader>
        <CardTitle>Assign Sales Target (Bulk)</CardTitle>
        <CardDescription>
          Assign, update, or delete holistic sales targets for employees for a specific month and year. Progress is shown for each employee.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-4 sticky top-0 z-20 bg-white pb-2 pt-2">
          <div className="flex-1">
            <label className="block mb-1 font-medium">Month</label>
            <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {months.map((m, i) => (
                  <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <label className="block mb-1 font-medium">Year</label>
            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {selectedIds.length > 0 && (
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block mb-1 font-medium">Bulk Target</label>
              <Input
                type="number"
                value={bulkTarget}
                onChange={e => setBulkTarget(e.target.value)}
                min={0}
                placeholder="Enter target amount"
              />
            </div>
            <Button 
              onClick={() => {
                // Update the button click to pass values to modal
                setIsBulkAssignModalOpen(true);
              }} 
              disabled={!bulkTarget || selectedIds.length === 0}
            >
              Assign/Update Target
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleteLoading || selectedIds.length === 0}>
              {bulkDeleteLoading ? "Deleting..." : "Delete Target(s)"}
            </Button>
          </div>
        )}
        {bulkError && <div className="text-red-600 text-sm mt-1">{bulkError}</div>}
        <div className="rounded-md border overflow-x-auto max-h-[500px] overflow-y-auto">
          <Table className="min-w-full">
            <TableHeader className="sticky top-0 bg-white z-10">
              <TableRow>
                <TableHead>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Current Target</TableHead>
                <TableHead>Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employeesLoading || targetsLoading || salesTotalsLoading || !targetsData ? (
                Array.from({ length: pageSize }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-4 rounded" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">No employees found.</TableCell>
                </TableRow>
              ) : (
                rows.map(row => {
                  const isEditing = editTarget[row.id] !== undefined;
                  const target = row.target;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="w-[40px]">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(row.id)}
                          onChange={() => toggleSelect(row.id)}
                          className="rounded border-gray-300"
                        />
                      </TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.city}</TableCell>
                      <TableCell>
                        {editTarget[row.id] !== undefined ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              value={editTarget[row.id]}
                              onChange={(e) => setEditTarget({ ...editTarget, [row.id]: e.target.value })}
                              className="w-28"
                            />
                            <Button
                              size="sm"
                              onClick={() => handleSingleAssign(row.id, editTarget[row.id])}
                              disabled={savingId === row.id}
                            >
                              {savingId === row.id ? "..." : "Save"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditTarget(prev => {
                                const copy = { ...prev };
                                delete copy[row.id];
                                return copy;
                              })}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div>
                              {row.target !== null ? (
                                <div>
                                  {row.target.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                </div>
                              ) : (
                                <div className="text-muted-foreground italic">No target</div>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => {
                                const employee = employees.find(e => e.id === row.id);
                                if (employee) {
                                  setSelectedEmployee(employee);
                                  setIsAssignModalOpen(true);
                                }
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                                </Button>
                            {row.target !== null && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-destructive"
                                        onClick={() => handleSingleDelete(row.id)}
                                        disabled={deletingId === row.id}
                                      >
                                {deletingId === row.id ? "..." : <Trash2 className="h-4 w-4" />}
                                </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.target !== null && row.totalSales > 0 ? (
                          <div className="space-y-1">
                            <Progress value={Math.min(100, (row.totalSales / row.target) * 100)} />
                            <div className="text-xs text-right">
                              {Math.round((row.totalSales / row.target) * 100)}%
                            </div>
                          </div>
                        ) : (
                          <div className="text-muted-foreground italic">No data</div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex justify-between items-center mt-4">
          <div>
            Showing {employees.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, total)} of {total}
          </div>
          <div className="flex gap-2 items-center">
            <Button size="sm" variant="outline" onClick={() => handlePageChange(1)} disabled={currentPage === 1}>First</Button>
            <Button size="sm" variant="outline" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>Prev</Button>
            <span>Page {currentPage} of {pageCount}</span>
            <Button size="sm" variant="outline" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === pageCount}>Next</Button>
            <Button size="sm" variant="outline" onClick={() => handlePageChange(pageCount)} disabled={currentPage === pageCount}>Last</Button>
            <Select value={String(pageSize)} onValueChange={v => handlePageSizeChange(Number(v))}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 100].map(size => (
                  <SelectItem key={size} value={String(size)}>{size} / page</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Sales Target</DialogTitle>
            </DialogHeader>
            {selectedEmployee && (
              <AssignTargetModal
                employee={selectedEmployee}
                isOpen={isAssignModalOpen}
                onClose={() => {
                  setIsAssignModalOpen(false);
                  setSelectedEmployee(null);
                }}
                onAssign={handleAssignTarget}
                isLoading={isAssigningTarget}
              />
            )}
            {actionError && <div className="text-red-500 mt-2">{actionError}</div>}
          </DialogContent>
        </Dialog>

        <Dialog open={isBulkAssignModalOpen} onOpenChange={setIsBulkAssignModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bulk Assign Sales Targets</DialogTitle>
            </DialogHeader>
            <BulkAssignTargetModal
              employees={employees}
              isOpen={isBulkAssignModalOpen}
              onClose={() => setIsBulkAssignModalOpen(false)}
              onAssign={handleBulkAssignTarget}
              isLoading={isBulkAssigningTarget}
              preSelectedMonth={selectedMonth + 1}
              preSelectedYear={selectedYear}
              preSelectedTarget={bulkTarget}
              preSelectedEmployeeIds={selectedIds}
            />
            {actionError && <div className="text-red-500 mt-2">{actionError}</div>}
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteConfirmTarget} onOpenChange={open => { if (!open) setDeleteConfirmTarget(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Delete</DialogTitle>
            </DialogHeader>
            <div>Are you sure you want to delete this sales target?</div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmTarget(null)}>Cancel</Button>
              <LoadingButton
                variant="destructive"
                loading={isDeletingTarget}
                loadingText="Deleting..."
                onClick={() => {
                  if (deleteConfirmTarget) {
                    handleDeleteTarget(deleteConfirmTarget.id);
                  }
                }}
              >
                Delete
              </LoadingButton>
            </DialogFooter>
            {actionError && <div className="text-red-500 mt-2">{actionError}</div>}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
} 