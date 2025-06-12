import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { useToast } from "@/components/ui/use-toast";

interface AssignTargetModalProps {
  employee: {
    id: number;
    user?: {
      name: string;
    };
  };
  isOpen: boolean;
  onClose: () => void;
  onAssign: (data: { employeeId: number; target: number; month: number; year: number }) => Promise<void>;
  isLoading: boolean;
}

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function AssignTargetModal({
  employee,
  isOpen,
  onClose,
  onAssign,
  isLoading,
}: AssignTargetModalProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    target: "",
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  const handleChange = (field: keyof typeof form, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleAssign = async () => {
    if (!form.target || parseFloat(form.target) <= 0) {
      setActionError("Target amount is required and must be greater than 0.");
      return;
    }

    setActionError(null);
    setShowConfirm(true);
  };

  const handleConfirmAssign = async () => {
    setIsAssigning(true);
    setActionError(null);
    try {
      await onAssign({
        employeeId: employee.id,
        target: parseFloat(form.target),
        month: form.month,
        year: form.year,
      });
      toast({
        title: "Target Assigned",
        description: "Sales target has been assigned successfully!",
      });
      setShowConfirm(false);
      onClose();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to assign target");
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to assign target",
        variant: "destructive",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Sales Target</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Employee</Label>
              <div className="font-semibold text-lg">{employee.user?.name}</div>
            </div>
            <div className="space-y-2">
              <Label>Target Amount</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.target}
                onChange={e => handleChange("target", e.target.value)}
                placeholder="Enter target amount"
              />
            </div>
            <div className="space-y-2">
              <Label>Month</Label>
              <select 
                className="border rounded px-2 py-1 w-full h-10"
                value={form.month.toString()}
                onChange={e => handleChange("month", parseInt(e.target.value))}
              >
                {months.map((month, index) => (
                  <option key={index + 1} value={(index + 1).toString()}>
                    {month}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Input
                type="number"
                min={new Date().getFullYear()}
                value={form.year}
                onChange={e => handleChange("year", parseInt(e.target.value))}
              />
            </div>
          </div>
          {actionError && <div className="text-red-500 text-sm mt-2">{actionError}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <LoadingButton
              onClick={handleAssign}
              loading={isLoading}
              loadingText="Assigning..."
              disabled={!!actionError || isAssigning}
            >
              Assign Target
            </LoadingButton>
          </DialogFooter>
        </div>
      </DialogContent>

      <AlertDialog open={showConfirm} onOpenChange={(open) => {
        setShowConfirm(open);
        if (open) setActionError(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Target Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to assign a target of ${form.target} to {employee.user?.name} for {months[form.month - 1]} {form.year}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <LoadingButton
                onClick={handleConfirmAssign}
                loading={isAssigning}
                loadingText="Assigning..."
                disabled={isLoading}
              >
                Confirm
              </LoadingButton>
            </AlertDialogAction>
          </AlertDialogFooter>
          {actionError && <div className="text-red-500 mt-2">{actionError}</div>}
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
} 