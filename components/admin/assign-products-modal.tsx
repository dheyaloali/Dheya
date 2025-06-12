import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { LoadingButton } from '@/components/ui/loading-button';

interface AssignProductsModalProps {
  employee: any;
  products: any[];
  selectedProducts: any[];
  onProductsChange: (products: any[]) => void;
  isOpen: boolean;
  onClose: () => void;
  onAssign: (employeeId: string, productIds: string[]) => Promise<void>;
  isLoading: boolean;
}

export default function AssignProductsModal({
  employee,
  products,
  selectedProducts,
  onProductsChange,
  isOpen,
  onClose,
  onAssign,
  isLoading,
}: AssignProductsModalProps) {
  const { toast } = useToast();
  const [actionError, setActionError] = useState<string | null>(null);

  const handleAssign = async () => {
    if (selectedProducts.length === 0) {
      setActionError("Please select at least one product.");
      return;
    }

    setActionError(null);
    try {
      await onAssign(employee.id, selectedProducts.map(p => p.id));
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
          <DialogTitle>Assign Products</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-gray-500">
            Employee: {employee.user?.name}
          </div>
          <div className="space-y-2">
            <Label>Select Products</Label>
            <div className="max-h-[300px] overflow-y-auto border rounded-md p-2">
              {products.map(product => (
                <div key={product.id} className="flex items-center space-x-2 py-1">
                  <Checkbox
                    id={`product-${product.id}`}
                    checked={selectedProducts.some(p => p.id === product.id)}
                    onCheckedChange={checked => {
                      const newProducts = checked
                        ? [...selectedProducts, product]
                        : selectedProducts.filter(p => p.id !== product.id);
                      onProductsChange(newProducts);
                    }}
                  />
                  <Label htmlFor={`product-${product.id}`} className="flex items-center space-x-2">
                    {product.imageUrl && (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-8 h-8 rounded object-cover"
                        style={{ minWidth: 32, minHeight: 32 }}
                      />
                    )}
                    <span>{product.name}</span>
                    <span className="text-sm text-gray-500">${product.price}</span>
                  </Label>
                </div>
              ))}
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