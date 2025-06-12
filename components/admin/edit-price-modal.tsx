"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Image from "next/image"
import { useToast } from "@/components/ui/use-toast"
import { LoadingButton } from "@/components/ui/loading-button"

// Add Product type (or import if available)
type Product = {
  id: string | number
  name: string
  price: number
  stockLevel: number
  description?: string
  imageUrl?: string | null
}

interface EditProductModalProps {
  product: Product
  isOpen: boolean
  onClose: () => void
  onSave: (id: string | number, updated: Partial<Product>) => void
}

function initialStateFromProduct(product: Product) {
  return {
    name: product?.name || "",
    price: product?.price?.toString() || "0",
    stockLevel: product?.stockLevel?.toString() || "0",
    description: product?.description || "",
    imageUrl: product?.imageUrl || null,
    imageFile: null as File | null,
    imagePreview: product?.imageUrl || null,
    uploading: false,
    uploadError: ""
  };
}

export default function EditProductModal({ product, isOpen, onClose, onSave }: EditProductModalProps) {
  const { toast } = useToast();
  const [form, setForm] = useState(initialStateFromProduct(product));
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setForm(initialStateFromProduct(product));
  }, [product]);

  // Handle field changes
  const handleChange = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }))
  }

  // Handle file selection and upload
  const handleFileChange = async (file: File | null) => {
    setForm(f => ({ ...f, imageFile: file, uploading: !!file, uploadError: "" }))
    if (!file) {
      setForm(f => ({ ...f, imagePreview: null, imageUrl: null, uploading: false }))
      return
    }
    // Preview
    const reader = new FileReader()
    reader.onload = ev => setForm(f => ({ ...f, imagePreview: ev.target?.result as string }))
    reader.readAsDataURL(file)
    // Upload
    const formData = new FormData()
    formData.append("file", file)
    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData })
      const result = await res.json()
      if (result.success && result.url) {
        setForm(f => ({ ...f, imageUrl: result.url, uploading: false }))
    } else {
        setForm(f => ({ ...f, uploadError: result.error || "Upload failed", uploading: false }))
      }
    } catch (err) {
      setForm(f => ({ ...f, uploadError: "Upload failed", uploading: false }))
    }
  }

  const handleSave = async () => {
    setIsUpdatingPrice(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: parseFloat(form.price) }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update price");
      }
      await onSave(product.id, { price: parseFloat(form.price) });
      toast({
        title: "Price Updated",
        description: "Product price has been updated successfully!",
      });
      onClose();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update price");
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update price",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingPrice(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent style={{ minWidth: 400, maxWidth: 500, maxHeight: '80vh', padding: '16px', overflowY: 'auto' }}>
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
          <DialogDescription>
            Update all details for <b>{product?.name}</b>.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <label className="cursor-pointer block w-12 h-12 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                {form.imagePreview ? (
                  <Image src={form.imagePreview} alt="Preview" width={48} height={48} className="object-cover w-full h-full" />
                ) : (
                  <span className="text-xs text-gray-400">Upload</span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => handleFileChange(e.target.files?.[0] || null)}
                />
              </label>
              {form.uploading && <div className="text-xs text-blue-500 mt-1">Uploading...</div>}
              {form.uploadError && <div className="text-xs text-red-500 mt-1">{form.uploadError}</div>}
            </div>
            <Label>Name *</Label>
            <Input value={form.name} onChange={e => handleChange("name", e.target.value)} required />
            <Label>Price *</Label>
            <Input type="number" min="0" step="0.01" value={form.price} onChange={e => handleChange("price", e.target.value)} required />
            <Label>Stock *</Label>
            <Input type="number" min="0" value={form.stockLevel} onChange={e => handleChange("stockLevel", e.target.value)} required />
            <Label>Description</Label>
            <Input value={form.description} onChange={e => handleChange("description", e.target.value)} />
            {actionError && <div className="text-red-500 text-sm mt-2">{actionError}</div>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton
            onClick={handleSave}
            loading={isUpdatingPrice}
            loadingText="Updating..."
            disabled={!!actionError || form.uploading || !form.price || parseFloat(form.price) <= 0}
          >
            Save Changes
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
