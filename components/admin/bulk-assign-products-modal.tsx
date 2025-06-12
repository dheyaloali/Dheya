import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { LoadingButton } from '@/components/ui/loading-button';

export default function BulkAssignProductsModal({
  employees,
  products,
  selectedEmployeeIds,
  selectedProductIds,
  onEmployeeIdsChange,
  onProductIdsChange,
  isOpen,
  onClose,
  onAssign,
  isLoading,
}: BulkAssignProductsModalProps) {
  const { toast } = useToast();
  const [actionError, setActionError] = useState<string | null>(null);

  const handleAssign = async () => {
    if (selectedEmployeeIds.length === 0) {
      setActionError("Please select at least one employee.");
      return;
    }
    if (selectedProductIds.length === 0) {
      setActionError("Please select at least one product.");
      return;
    }

    setActionError(null);
    try {
      await onAssign(selectedEmployeeIds, selectedProductIds);
      toast({
        title: "Products Assigned",
        description: "Products have been assigned successfully!",
      });
      onClose();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to assign products");
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to assign products",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Assign Products</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Select Employees</Label>
              <div className="max-h-[200px] overflow-y-auto border rounded-md p-2">
                {employees.map(employee => (
                  <div key={employee.id} className="flex items-center space-x-2 py-1">
                    <Checkbox
                      id={`employee-${employee.id}`}
                      checked={selectedEmployeeIds.includes(employee.id)}
                      onCheckedChange={checked => {
                        const newIds = checked
                          ? [...selectedEmployeeIds, employee.id]
                          : selectedEmployeeIds.filter(id => id !== employee.id);
                        onEmployeeIdsChange(newIds);
                      }}
                    />
                    <Label htmlFor={`employee-${employee.id}`}>{employee.user?.name}</Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Select Products</Label>
              <div className="max-h-[200px] overflow-y-auto border rounded-md p-2">
                {products.map(product => (
                  <div key={product.id} className="flex items-center space-x-2 py-1">
                    <Checkbox
                      id={`product-${product.id}`}
                      checked={selectedProductIds.includes(product.id)}
                      onCheckedChange={checked => {
                        const newIds = checked
                          ? [...selectedProductIds, product.id]
                          : selectedProductIds.filter(id => id !== product.id);
                        onProductIdsChange(newIds);
                      }}
                    />
                    <Label htmlFor={`product-${product.id}`} className="flex items-center space-x-2">
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
                      <span>{product.name}</span>
                      <span className="text-sm text-gray-500">${product.price}</span>
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {actionError && <div className="text-red-500 text-sm mt-2">{actionError}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <LoadingButton
              onClick={handleAssign}
              loading={isLoading}
              loadingText="Assigning..."
              disabled={!!actionError}
            >
              Assign Products
            </LoadingButton>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
} 