import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Image } from "@/components/ui/image";
import { LoadingButton } from "@/components/ui/loading-button";

export default function AddProductModal({
  isOpen,
  onClose,
  onAdd,
}: AddProductModalProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "",
    price: "",
    stockLevel: "0",
    description: "",
    imageFile: null as File | null,
    imagePreview: null as string | null,
    imageUrl: null as string | null,
    uploading: false,
    uploadError: "",
  });
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setForm(prev => ({ ...prev, uploading: true, uploadError: "" }));
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error("Failed to upload image");
      }
      const data = await response.json();
      setForm(prev => ({
        ...prev,
        imageUrl: data.url,
        uploading: false,
      }));
    } catch (err) {
      setForm(prev => ({
        ...prev,
        uploading: false,
        uploadError: err instanceof Error ? err.message : "Failed to upload image",
      }));
    }
  };

  const handleAdd = async () => {
    if (!form.name.trim() || !form.price || parseFloat(form.price) <= 0) {
      setActionError("Name and price are required and must be valid.");
      return;
    }
    if (form.uploading) {
      setActionError("Please wait for the image to finish uploading.");
      return;
    }
    if (form.uploadError) {
      setActionError("Please fix the image upload error before submitting.");
      return;
    }

    setIsAddingProduct(true);
    setActionError(null);
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          price: parseFloat(form.price),
          stockLevel: parseInt(form.stockLevel) || 0,
          description: form.description,
          imageUrl: form.imageUrl,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add product");
      }
      await onAdd({
        name: form.name,
        price: parseFloat(form.price),
        stockLevel: parseInt(form.stockLevel) || 0,
        description: form.description,
        imageUrl: form.imageUrl,
      });
      toast({
        title: "Product Added",
        description: "Product has been added successfully!",
      });
      onClose();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to add product");
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to add product",
        variant: "destructive",
      });
    } finally {
      setIsAddingProduct(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Product</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={e => handleChange("name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Price</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={e => handleChange("price", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Stock Level</Label>
              <Input
                type="number"
                min="0"
                value={form.stockLevel}
                onChange={e => handleChange("stockLevel", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Image</Label>
              <Input type="file" accept="image/*" onChange={handleImageChange} />
              {form.uploading && <div className="text-sm text-gray-500">Uploading...</div>}
              {form.uploadError && <div className="text-sm text-red-500">{form.uploadError}</div>}
              {form.imageUrl && (
                <div className="relative w-20 h-20">
                  <Image
                    src={form.imageUrl}
                    alt={form.name}
                    fill
                    className="object-cover rounded-md"
                  />
                </div>
              )}
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={e => handleChange("description", e.target.value)} />
            </div>
          </div>
          {actionError && <div className="text-red-500 text-sm mt-2">{actionError}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <LoadingButton
              onClick={handleAdd}
              loading={isAddingProduct}
              loadingText="Adding..."
              disabled={!!actionError || form.uploading}
            >
              Add Product
            </LoadingButton>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
} 