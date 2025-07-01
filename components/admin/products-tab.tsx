"use client"

import { useState, useEffect } from "react"
import { Search, Edit } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import EditProductModal from "./edit-price-modal"
import useSWR from "swr"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { X } from "lucide-react"
import { toast, useToast } from "@/components/ui/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { LoadingButton } from "@/components/ui/LoadingButton"
import { useAdminSocket } from "@/hooks/useAdminSocket"
import { useNotifications } from "@/hooks/useNotifications"
import NotificationPanel from "@/components/ui/NotificationPanel"
import adminApiClient, { adminFetcher, fetchWithCSRF } from "@/lib/admin-api-client"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { notifyUserOrEmployee } from "@/lib/notifications"
import { useSession } from "next-auth/react"
import debounce from "lodash.debounce"
import { useCurrency } from "@/components/providers/currency-provider"

type Product = {
  id: string | number;
  name: string;
  price: number;
  stockLevel: number;
  description?: string;
  imageUrl?: string | null;
}

export default function ProductsTab() {
  const { data: session } = useSession()
  const { toast } = useToast();
  const { socket: adminSocket } = useAdminSocket();
  const { notifications, mutate: mutateNotifications } = useNotifications();
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addForms, setAddForms] = useState([
    { name: "", price: "", stockLevel: "0", description: "", imageFile: null as File | null, imagePreview: null as string | null, imageUrl: null as string | null, uploading: false, uploadError: "" }
  ])
  const [addError, setAddError] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [showAddConfirm, setShowAddConfirm] = useState(false)
  const [isAddingProducts, setIsAddingProducts] = useState(false)
  const [addProductError, setAddProductError] = useState<string | null>(null)
  const [isDeletingProduct, setIsDeletingProduct] = useState(false)
  const [isUpdatingProduct, setIsUpdatingProduct] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState<Product | null>(null)
  const { formatAmount } = useCurrency();

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchTerm])

  // Build the API URL with search and pagination
  const apiUrl = `/api/products?page=${page}&pageSize=${pageSize}` + (debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : "")

  const { data, error, isLoading, mutate } = useSWR(apiUrl, adminFetcher)
  const products = data?.products || []
  const total = data?.total || 0
  const pageCount = Math.ceil(total / pageSize)

  // Debounced mutate for WebSocket events
  const debouncedMutate = debounce(() => mutate(), 300, { leading: true, trailing: true });

  // Add WebSocket listener for product updates
  useEffect(() => {
    if (!adminSocket) return;
    const handleProductUpdate = (data: any) => {
      debouncedMutate();
      toast({
        title: "Product Update",
        description: data.message || "A product has been updated"
      });
      mutateNotifications();
    };
    adminSocket.on("product-update", handleProductUpdate);
    adminSocket.on("product-assigned", handleProductUpdate);
    return () => {
      adminSocket.off("product-update", handleProductUpdate);
      adminSocket.off("product-assigned", handleProductUpdate);
    };
  }, [adminSocket, debouncedMutate, mutateNotifications, toast]);

  // Optimistic Edit
  const handleProductUpdate = async (productId: string | number, updatedFields: Partial<Product>) => {
    setIsUpdatingProduct(true);
    setActionError(null);
    const prevProducts = products;
    try {
      // Optimistically update UI
      const updatedProducts = products.map(p => p.id === productId ? { ...p, ...updatedFields } : p);
      mutate({ products: updatedProducts, total }, false);
      const response = await fetchWithCSRF(`/api/admin/products/${productId}`, {
        method: "PATCH",
        body: JSON.stringify(updatedFields),
      });
      if (!response.ok) throw new Error("Failed to update product");
      toast({ title: "Success", description: "Product updated successfully" });
    } catch (error) {
      mutate({ products: prevProducts, total }, false); // Revert
      setActionError("Failed to update product");
      toast({ title: "Error", description: "Failed to update product", variant: "destructive" });
    } finally {
      setIsUpdatingProduct(false);
    }
  };

  // Optimistic Delete
  const handleDeleteProduct = async (productId: string | number) => {
    setIsDeletingProduct(true);
    setActionError(null);
    const prevProducts = products;
    try {
      // Optimistically remove from UI
      const updatedProducts = products.filter(p => p.id !== productId);
      mutate({ products: updatedProducts, total: total - 1 }, false);
      const response = await fetchWithCSRF(`/api/products/${productId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete product");
      toast({ title: "Success", description: "Product deleted successfully" });
      setDeleteConfirmProduct(null);
    } catch (error: any) {
      mutate({ products: prevProducts, total }, false); // Revert
      setActionError(error.message || "Failed to delete product");
      toast({ title: "Error", description: error.message || "Failed to delete product", variant: "destructive" });
    } finally {
      setIsDeletingProduct(false);
    }
  };

  // Add a new empty product row
  const handleAddRow = () => {
    setAddForms(forms => [
      ...forms,
      { name: "", price: "", stockLevel: "0", description: "", imageFile: null, imagePreview: null, imageUrl: null, uploading: false, uploadError: "" }
    ])
  }

  // Remove a product row
  const handleRemoveRow = (idx: number) => {
    setAddForms(forms => forms.length > 1 ? forms.filter((_, i) => i !== idx) : forms)
  }

  // Handle file selection and upload for a row
  const handleFileChange = async (idx: number, file: File | null) => {
    setAddForms(forms => forms.map((f, i) => i === idx ? { ...f, imageFile: file, uploading: !!file, uploadError: "" } : f))
    if (!file) {
      setAddForms(forms => forms.map((f, i) => i === idx ? { ...f, imagePreview: null, imageUrl: null, uploading: false } : f))
      return
    }
    // Preview
    const reader = new FileReader()
    reader.onload = ev => setAddForms(forms => forms.map((f, i) => i === idx ? { ...f, imagePreview: ev.target?.result as string } : f))
    reader.readAsDataURL(file)
    // Upload
    const formData = new FormData()
    formData.append("file", file)
    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData })
      const result = await res.json()
      if (result.success && result.url) {
        setAddForms(forms => forms.map((f, i) => i === idx ? { ...f, imageUrl: result.url, uploading: false } : f))
      } else {
        setAddForms(forms => forms.map((f, i) => i === idx ? { ...f, uploadError: result.error || "Upload failed", uploading: false } : f))
      }
    } catch (err) {
      setAddForms(forms => forms.map((f, i) => i === idx ? { ...f, uploadError: "Upload failed", uploading: false } : f))
    }
  }

  // Handle field change for a row
  const handleFieldChange = (idx: number, field: string, value: string) => {
    setAddForms(forms => forms.map((f, i) => i === idx ? { ...f, [field]: value } : f))
  }

  // Optimistic Batch Add
  const doAddProducts = async () => {
    setAddError("");
    setIsAddingProducts(true);
    setActionError(null);
    const prevProducts = products;
    try {
      // Validate all rows
      for (const form of addForms) {
        if (!form.name.trim() || !form.price.trim()) throw new Error("Name and price are required for all products.");
        if (form.uploading) throw new Error("Please wait for all images to finish uploading.");
        if (form.uploadError) throw new Error("Please fix all image upload errors before submitting.");
        }
      // Optimistically add
      const optimisticProducts = addForms.map(form => ({
        id: Date.now() + Math.random(),
        name: form.name,
        price: parseFloat(form.price),
        stockLevel: parseInt(form.stockLevel) || 0,
        description: form.description,
        imageUrl: form.imageUrl,
      }));
      mutate({ products: [...optimisticProducts, ...products], total: total + optimisticProducts.length }, false);
      // POST each product
      let allSuccess = true;
      for (const form of addForms) {
        try {
          const res = await fetch("/api/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: form.name,
              price: parseFloat(form.price),
              stockLevel: parseInt(form.stockLevel) || 0,
              description: form.description,
              imageUrl: form.imageUrl,
            })
          });
          const result = await res.json();
          if (!res.ok || !result.success) allSuccess = false;
        } catch {
          allSuccess = false;
        }
      }
      await mutate();
      if (allSuccess) {
        toast({ title: "Products Added", description: "All products were added successfully!" });
        setAddForms([{ name: "", price: "", stockLevel: "0", description: "", imageFile: null, imagePreview: null, imageUrl: null, uploading: false, uploadError: "" }]);
      } else {
        throw new Error("Some products failed to add. Please check the list.");
      }
    } catch (err) {
      mutate({ products: prevProducts, total }, false); // Revert
      setActionError(err instanceof Error ? err.message : "Failed to add products");
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to add products", variant: "destructive" });
    } finally {
      setIsAddingProducts(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <NotificationPanel />
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Product Management</h2>
          <div className="flex gap-2 items-center">
            <Button onClick={() => setIsAddModalOpen(true)} variant="default">+ Add Product</Button>
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            </div>
          </div>
        </div>

        <div className="rounded-md border">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Description</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-10 w-10 rounded" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-red-500">Error loading products</TableCell>
                </TableRow>
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">No products found.</TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Image
                        src={product.imageUrl || "/placeholder.svg"}
                        alt={product.name}
                        width={50}
                        height={50}
                        className="rounded-md object-cover"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="hidden md:table-cell max-w-[300px] truncate">{product.description}</TableCell>
                    <TableCell>{formatAmount(product.price)}</TableCell>
                    <TableCell>
                      <StockBadge stock={product.stockLevel ?? 0} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setSelectedProduct(product)
                          setIsEditModalOpen(true)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit price</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-2 mt-4">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {[5, 10, 20, 25, 50, 100].map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1}>First</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>&lt; Prev</Button>
            {Array.from({ length: pageCount }, (_, i) => (
              <Button
                key={i + 1}
                variant={page === i + 1 ? "default" : "outline"}
                size="sm"
                onClick={() => setPage(i + 1)}
              >
                {i + 1}
              </Button>
            ))}
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page === pageCount || pageCount === 0}>Next &gt;</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(pageCount)} disabled={page === pageCount || pageCount === 0}>Last</Button>
          </div>
        </div>
      </CardContent>

      {/* Add Product Dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent style={{ minWidth: 700, maxWidth: 900, maxHeight: '90vh', overflow: 'auto' }}>
          <DialogHeader>
            <DialogTitle>Add Products</DialogTitle>
          </DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault();
            await doAddProducts();
          }} className="space-y-4">
            <div className="overflow-x-auto" style={{ maxHeight: 400, overflowY: 'auto' }}>
              <table className="min-w-full border text-sm">
                <thead>
                  <tr className="bg-muted">
                    <th className="p-2 font-semibold">Image</th>
                    <th className="p-2 font-semibold">Name *</th>
                    <th className="p-2 font-semibold">Price *</th>
                    <th className="p-2 font-semibold">Stock *</th>
                    <th className="p-2 font-semibold">Description</th>
                    <th className="p-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {addForms.map((form, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="p-2 align-middle">
                        <label className="cursor-pointer block w-16 h-16 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                          {form.imagePreview ? (
                            <img src={form.imagePreview} alt="Preview" className="object-cover w-full h-full" />
                          ) : (
                            <span className="text-xs text-gray-400">Upload</span>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => handleFileChange(idx, e.target.files?.[0] || null)}
                          />
                        </label>
                        {form.uploading && <div className="text-xs text-blue-500 mt-1">Uploading...</div>}
                        {form.uploadError && <div className="text-xs text-red-500 mt-1">{form.uploadError}</div>}
                      </td>
                      <td className="p-2 align-middle">
                        <Input
                          value={form.name}
                          onChange={e => handleFieldChange(idx, "name", e.target.value)}
                          required
                          className="w-32"
                        />
                      </td>
                      <td className="p-2 align-middle">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.price}
                          onChange={e => handleFieldChange(idx, "price", e.target.value)}
                          required
                          className="w-24"
                        />
                      </td>
                      <td className="p-2 align-middle">
                        <Input
                          type="number"
                          min="0"
                          value={form.stockLevel}
                          onChange={e => handleFieldChange(idx, "stockLevel", e.target.value)}
                          required
                          className="w-20"
                        />
                      </td>
                      <td className="p-2 align-middle">
                        <Input
                          value={form.description}
                          onChange={e => handleFieldChange(idx, "description", e.target.value)}
                          className="w-40"
                        />
                      </td>
                      <td className="p-2 align-middle">
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => handleRemoveRow(idx)}
                          disabled={addForms.length === 1}
                          title="Remove"
                          className="w-full"
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between items-center mt-2">
              <Button type="button" variant="secondary" onClick={handleAddRow}>+ Add Row</Button>
              {addError && <div className="text-red-500 text-sm ml-4">{addError}</div>}
            </div>
            <AlertDialog open={showAddConfirm} onOpenChange={(open) => {
              setShowAddConfirm(open);
              if (open) setAddProductError(null);
            }}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Add Products</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to add these products?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction asChild>
                    <LoadingButton
                      loading={isAddingProducts}
                      loadingText="Adding..."
                      onClick={async () => {
                        setAddProductError(null);
                        const result = await doAddProducts();
                        if (result && result.success) {
                          setShowAddConfirm(false);
                        } else if (result && result.error) {
                          setAddProductError(result.error);
                        }
                      }}
                    >
                      Confirm
                    </LoadingButton>
                  </AlertDialogAction>
                </AlertDialogFooter>
                {addProductError && <div className="text-red-500 mt-2">{addProductError}</div>}
              </AlertDialogContent>
            </AlertDialog>
            <LoadingButton
              type="button"
              onClick={() => {
                setAddProductError(null);
                setShowAddConfirm(true);
              }}
              loadingText="Adding..."
              disabled={isAdding}
            >
              Add Products
            </LoadingButton>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Product Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <EditProductModal
              product={selectedProduct}
              isOpen={isEditModalOpen}
              onClose={() => {
                setIsEditModalOpen(false);
                setSelectedProduct(null);
              }}
              onSave={handleProductUpdate}
              isLoading={isUpdatingProduct}
            />
          )}
          {actionError && <div className="text-red-500 mt-2">{actionError}</div>}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmProduct} onOpenChange={open => { if (!open) setDeleteConfirmProduct(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <div>Are you sure you want to delete this product?</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmProduct(null)}>Cancel</Button>
            <LoadingButton
              variant="destructive"
              loading={isDeletingProduct}
              loadingText="Deleting..."
              onClick={() => {
                if (deleteConfirmProduct) {
                  handleDeleteProduct(deleteConfirmProduct.id);
                }
              }}
            >
              Delete
            </LoadingButton>
          </DialogFooter>
          {actionError && <div className="text-red-500 mt-2">{actionError}</div>}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function StockBadge({ stock }: { stock: number }) {
  let variant: "default" | "secondary" | "destructive" | "outline" = "default"
  let label = `${stock} in stock`

  if (stock <= 0) {
    variant = "destructive"
    label = "Out of stock"
  } else if (stock < 10) {
    variant = "secondary"
    label = `Low: ${stock} left`
  }

  return <Badge variant={variant}>{label}</Badge>
}
