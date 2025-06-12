"use client"
import { useState, useEffect } from "react";
import { EmployeeTable, EmployeeTableSearchInput } from "@/components/employee-table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/components/ui/use-toast";

// Mock data for employees and products
const mockEmployees = [
  { id: 1, name: "John Doe", email: "john@ex.com", position: "Sales Rep", products: [1, 2] },
  { id: 2, name: "Jane Smith", email: "jane@ex.com", position: "Account Manager", products: [3] },
];
const mockProducts = [
  { id: 1, name: "Product A" },
  { id: 2, name: "Product B" },
  { id: 3, name: "Product C" },
];

export default function EmployeeTablePage() {
  const [search, setSearch] = useState("");
  const [assignments, setAssignments] = useState(mockEmployees.map(e => ({ ...e })));
  const [saving, setSaving] = useState<number | null>(null);
  const [success, setSuccess] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    toast({ title: "Employees Page Loaded", description: "This is a demo toast for Employees." });
  }, []);

  const handleProductChange = (employeeId: number, productIds: number[]) => {
    setAssignments(prev => prev.map(e => e.id === employeeId ? { ...e, products: productIds } : e));
    setSuccess(null);
  };
  const handleSave = (employeeId: number) => {
    setSaving(employeeId);
    setTimeout(() => {
      setSaving(null);
      if (employeeId === 1) {
        toast({
          title: "Error",
          description: "Product duplicate name. Please try again.",
          variant: "destructive",
        });
      } else {
        setSuccess(employeeId);
        toast({
          title: "Success",
          description: "Product assignment saved successfully.",
          variant: "default",
        });
      }
    }, 800);
  };

  return (
    <div className="flex flex-col gap-6 w-full mb-6">
      <EmployeeTableSearchInput search={search} setSearch={setSearch} />
      <EmployeeTable search={search} setSearch={setSearch} />
    </div>
  );
} 