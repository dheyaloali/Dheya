"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { ShoppingCart, Loader2, X, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from '@/components/ui/use-toast'
import useSWR, { mutate as globalMutate } from 'swr'
import { useTranslations } from "next-intl"
import { useCurrency } from "@/components/providers/currency-provider"

export function RecordSaleDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [quantities, setQuantities] = useState<{ [productId: string]: string }>({})
  const [notes, setNotes] = useState<{ [productId: string]: string }>({})
  const [bulkQuantity, setBulkQuantity] = useState("")
  const [bulkNote, setBulkNote] = useState("")
  const [mode, setMode] = useState<'bulk' | 'per-product'>('bulk')
  const [submitting, setSubmitting] = useState(false)
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const from = startOfToday.toISOString();
  const to = endOfToday.toISOString();
  const SWR_PRODUCTS_KEY = `/api/employee/product?page=1&pageSize=8&from=${from}&to=${to}`;
  const { data, isLoading, mutate } = useSWR(SWR_PRODUCTS_KEY, (url) => fetch(url).then(res => res.json()))
  const products = data?.products || [];
  const { toast } = useToast()
  const t = useTranslations('Sales')
  const { formatAmount } = useCurrency()

  // Initialize quantities to current sold quantity when products change or dialog opens
  useEffect(() => {
    if (isOpen && products.length > 0) {
      const initial: { [productId: string]: string } = {};
      products.forEach((p: any) => {
        initial[p.id] = String(p.soldQuantity ?? "");
      });
      setQuantities(initial);
    }
  }, [isOpen, products]);

  useEffect(() => {
    if (isOpen) {
      mutate(); // Always revalidate product data when dialog opens
    }
  }, [isOpen, mutate]);

  const handleProductChange = (productId: string) => {
    setSelectedProducts((prev) => {
      if (mode === 'per-product') {
        // Only one product can be selected in per-product mode
        return prev.includes(productId) ? [] : [productId];
      } else {
        // Multiple products can be selected in bulk mode
        return prev.includes(productId)
          ? prev.filter((id) => id !== productId)
          : [...prev, productId];
      }
    });
    setSelectorOpen(false);
  }

  const handleRemoveProduct = (productId: string) => {
    setSelectedProducts((prev) => prev.filter((id) => id !== productId))
    setQuantities((prev) => { const q = { ...prev }; delete q[productId]; return q })
    setNotes((prev) => { const n = { ...prev }; delete n[productId]; return n })
  }

  const handleQuantityChange = (productId: string, value: string) => {
    setQuantities((prev) => ({ ...prev, [productId]: value }))
  }
  const handleNotesChange = (productId: string, value: string) => {
    setNotes((prev) => ({ ...prev, [productId]: value }))
  }

  const isValid = mode === 'bulk'
    ? selectedProducts.length > 0 && Number(bulkQuantity) > 0 && bulkQuantity !== ""
    : selectedProducts.length > 0 && selectedProducts.every((id) => Number(quantities[id]) > 0 && quantities[id] !== "")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return
    setSubmitting(true)
    try {
      let sales;
      if (mode === 'bulk') {
        sales = selectedProducts
          .map((productId) => {
            const product = products.find((p: any) => p.id === productId)
            if (!product || product.status === 'sold' || product.status === 'partially_sold') return null;
            const price = product?.price || 0
            const qty = Number(bulkQuantity)
            return { productId, quantity: qty, notes: bulkNote, amount: qty * price }
          })
          .filter(Boolean);
      } else {
        sales = selectedProducts
          .map((productId) => {
            const product = products.find((p: any) => p.id === productId)
            if (!product || product.status === 'sold' || product.status === 'partially_sold') return null;
            const price = product?.price || 0
            const qty = Number(quantities[productId])
            return { productId, quantity: qty, notes: notes[productId] || "", amount: qty * price }
          })
          .filter(Boolean);
      }
      // For each sale, if quantity is 0, send DELETE; else, send POST
      for (const sale of sales) {
        if (!sale) continue;
        let res, result;
        if (sale.quantity === 0) {
          res = await fetch('/api/employee/sales', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId: sale.productId }),
          })
        } else {
          res = await fetch('/api/employee/sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sale),
          })
        }
        result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed to record sales')
      }
      toast({
        title: 'Sales updated successfully!',
        description: 'Your sales have been saved.',
        variant: 'default',
      })
      setIsOpen(false)
      setSelectedProducts([])
      setQuantities({})
      setNotes({})
      setBulkQuantity("")
      setBulkNote("")
      await mutate()
      await globalMutate(SWR_PRODUCTS_KEY)
      await globalMutate('/api/employee/product?assignedToday=true')
      await globalMutate('/api/employee/sales/assigned-products')
    } catch (err) {
      toast({
        title: 'Error',
        description: (err as Error).message,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleModeChange = (newMode: 'bulk' | 'per-product') => {
    setMode(newMode);
    setSelectedProducts([]);
    setQuantities({});
    setNotes({});
    setBulkQuantity("");
    setBulkNote("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <ShoppingCart className="h-4 w-4" />
          {t('recordSale')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[600px]">
        <form onSubmit={handleSubmit} className="flex flex-col h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t('recordSalesTitle')}</DialogTitle>
            <DialogDescription>
              {t('recordSalesDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto pb-6">
            <div className="flex gap-4 items-center">
              <Label className="font-medium">{t('entryMode')}</Label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="bulk"
                  checked={mode === 'bulk'}
                  onChange={() => handleModeChange('bulk')}
                />
                <span>{t('sameForAll')}</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="per-product"
                  checked={mode === 'per-product'}
                  onChange={() => handleModeChange('per-product')}
                />
                <span>{t('customPerProduct')}</span>
              </label>
            </div>
            <div>
              <Label>{t('products')}</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full mt-2 mb-2 justify-between"
                onClick={() => setSelectorOpen((v) => !v)}
              >
                {selectedProducts.length === 0 ? t('selectProducts') : t('selectedCount', { count: selectedProducts.length })}
                <span className="ml-2">▼</span>
              </Button>
              {selectorOpen && (
                <div className="border rounded-md p-2 max-h-40 overflow-y-auto bg-white z-20 absolute w-[90%] shadow-lg">
                  {isLoading ? (
                    <div className="text-muted-foreground text-sm">{t('loadingProducts')}</div>
                  ) : products.length === 0 ? (
                    <div className="text-muted-foreground text-sm">{t('noProductsAssigned')}</div>
                  ) : (
                    products.map((p: any, idx: number) => (
                      <label key={p.id + '-' + idx} className="flex items-center gap-2 py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedProducts.includes(p.id)}
                          onChange={() => handleProductChange(p.id)}
                          className="accent-blue-600"
                          disabled={
                            p.status === 'sold' ||
                            p.status === 'partially_sold' ||
                            (mode === 'per-product' && selectedProducts.length > 0 && !selectedProducts.includes(p.id))
                          }
                        />
                        <span>{p.name}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{formatAmount(p.price)}</span>
                        {p.status === 'sold' && <span className="ml-2 text-green-600 font-semibold">{t('sold')}</span>}
                        {p.status === 'partially_sold' && <span className="ml-2 text-yellow-600 font-semibold">{t('partiallySold')}</span>}
                      </label>
                    ))
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedProducts.map((id, idx) => {
                  const product = products.find((p: any) => p.id === id)
                  return (
                    <span key={id + '-' + idx} className="bg-blue-100 text-blue-800 rounded-full px-3 py-1 flex items-center gap-1 text-sm">
                      {product?.name}
                      <button type="button" onClick={() => handleRemoveProduct(id)} className="ml-1">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )
                })}
              </div>
            </div>
            {selectedProducts.length > 0 && mode === 'bulk' && (
              <>
                <div className="flex flex-col gap-4 max-w-md mx-auto mt-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="bulk-quantity">Quantity (applies to all)</Label>
                    <Input
                      id="bulk-quantity"
                      type="number"
                      min="0"
                      max={Math.min(...selectedProducts.map(id => {
                        const product = products.find((p: any) => p.id === id)
                        return product ? product.quantity : 1
                      }))}
                      value={bulkQuantity}
                      onChange={e => {
                        let v = parseInt(e.target.value, 10);
                        if (isNaN(v) || v < 0) v = 0;
                        const maxAllowed = Math.min(...selectedProducts.map(id => {
                          const product = products.find((p: any) => p.id === id)
                          return product ? product.quantity : 1
                        }));
                        if (v > maxAllowed) v = maxAllowed;
                        setBulkQuantity(String(v));
                      }}
                      placeholder="Quantity"
                      className="w-full"
                      required
                      disabled={selectedProducts.some(id => {
                        const product = products.find((p: any) => p.id === id)
                        return product?.status === 'sold' || product?.status === 'partially_sold';
                      })}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="bulk-note">Notes (applies to all)</Label>
                    <Textarea
                      id="bulk-note"
                      value={bulkNote}
                      onChange={e => setBulkNote(e.target.value)}
                      placeholder="Add notes (optional)"
                      className="w-full"
                      rows={2}
                    />
                  </div>
                </div>
                {/* Bulk summary table */}
                <div className="mt-8">
                  <hr className="mb-4" />
                  <div className="flex items-center font-medium mb-3 text-lg">
                    <span className="mr-2 text-blue-500"><svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg></span>
                    Summary
                  </div>
                  <div className="rounded-xl shadow border overflow-hidden bg-white">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-2">Product</th>
                          <th className="text-right px-4 py-2">Assigned</th>
                          <th className="text-right px-4 py-2">To Record</th>
                          <th className="text-right px-4 py-2">Status</th>
                          <th className="text-right px-4 py-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedProducts.map((id, idx) => {
                          const product = products.find((p: any) => p.id === id)
                          const assignedQty = product?.quantity || 0
                          const toRecordQty = Number(bulkQuantity) || 0
                          const price = product?.price || 0
                          const total = price * toRecordQty
                          let status = "assigned";
                          if (toRecordQty === assignedQty && toRecordQty > 0) status = "sold";
                          else if (toRecordQty > 0 && toRecordQty < assignedQty) status = "partially_sold";
                          return (
                            <tr key={id + '-' + idx} className={
                              (idx % 2 === 0 ? 'bg-white' : 'bg-gray-50') +
                              ' hover:bg-blue-50 transition-colors'
                            }>
                              <td className="px-4 py-2 font-medium">{product?.name}</td>
                              <td className="px-4 py-2 text-right">{assignedQty}</td>
                              <td className="px-4 py-2 text-right">{toRecordQty}</td>
                              <td className="px-4 py-2 text-right">
                                {status === "sold" ? <span className="text-green-600 font-semibold">Sold</span> :
                                 status === "partially_sold" ? <span className="text-yellow-600 font-semibold">Partially Sold</span> :
                                 <span className="text-gray-500">Assigned</span>}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold">{formatAmount(total)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
            {selectedProducts.length > 0 && mode === 'per-product' && (
              <div className="flex flex-col gap-4 max-h-96 overflow-y-auto">
                {selectedProducts.map((id, idx) => {
                  const product = products.find((p: any) => p.id === id)
                  const price = product?.price || 0
                  const qty = Number(quantities[id]) || 0
                  const total = price * qty
                  return (
                    <div key={id + '-' + idx} className="border rounded-lg bg-gray-50 shadow-sm">
                      <div className="flex items-center gap-2 px-4 py-2">
                        <span className="font-medium flex-1 truncate text-base">{product?.name}</span>
                        <span className="text-xs text-muted-foreground mr-2">{formatAmount(price)}</span>
                      </div>
                      <div className="flex items-center gap-3 px-4 pb-4">
                        <div className="flex flex-col w-28">
                          <Label htmlFor={`quantity-${id}`}>Qty</Label>
                          <Input
                            id={`quantity-${id}`}
                            type="number"
                            min="0"
                            max={product ? product.quantity : 1}
                            value={quantities[id] ?? (product?.soldQuantity ?? 0)}
                            onChange={e => {
                              let v = parseInt(e.target.value, 10);
                              if (isNaN(v) || v < 0) v = 0;
                              if (product && v > product.quantity) v = product.quantity;
                              handleQuantityChange(id, String(v));
                            }}
                            required
                            disabled={product?.status === 'sold' || product?.status === 'partially_sold'}
                          />
                        </div>
                        <div className="flex flex-col flex-1">
                          <Label htmlFor={`notes-${id}`}>Notes</Label>
                          <Input
                            id={`notes-${id}`}
                            value={notes[id] || ""}
                            onChange={e => handleNotesChange(id, e.target.value)}
                            placeholder="Add notes (optional)"
                            className="w-full"
                          />
                        </div>
                        <div className="flex flex-col w-32 text-right">
                          <span className="text-xs text-muted-foreground">Total</span>
                          <span className="font-semibold">{formatAmount(total)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {/* Per-product summary table */}
                <div className="mt-8">
                  <hr className="mb-4" />
                  <div className="flex items-center font-medium mb-3 text-lg">
                    <span className="mr-2 text-blue-500"><svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg></span>
                    Summary
                  </div>
                  <div className="rounded-xl shadow border overflow-hidden bg-white">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-2">Product</th>
                          <th className="text-right px-4 py-2">Assigned</th>
                          <th className="text-right px-4 py-2">To Record</th>
                          <th className="text-right px-4 py-2">Status</th>
                          <th className="text-right px-4 py-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedProducts.map((id, idx) => {
                          const product = products.find((p: any) => p.id === id)
                          const assignedQty = product?.quantity || 0
                          const toRecordQty = Number(quantities[id]) || 0
                          const price = product?.price || 0
                          const total = price * toRecordQty
                          let status = "assigned";
                          if (toRecordQty === assignedQty && toRecordQty > 0) status = "sold";
                          else if (toRecordQty > 0 && toRecordQty < assignedQty) status = "partially_sold";
                          return (
                            <tr key={id + '-' + idx} className={
                              (idx % 2 === 0 ? 'bg-white' : 'bg-gray-50') +
                              ' hover:bg-blue-50 transition-colors'
                            }>
                              <td className="px-4 py-2 font-medium">{product?.name}</td>
                              <td className="px-4 py-2 text-right">{assignedQty}</td>
                              <td className="px-4 py-2 text-right">{toRecordQty}</td>
                              <td className="px-4 py-2 text-right">
                                {status === "sold" ? <span className="text-green-600 font-semibold">Sold</span> :
                                 status === "partially_sold" ? <span className="text-yellow-600 font-semibold">Partially Sold</span> :
                                 <span className="text-gray-500">Assigned</span>}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold">{formatAmount(total)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* Grand total */}
          {(selectedProducts.length > 0) && (
            <div className="flex justify-end items-center my-6 text-base font-semibold text-muted-foreground">
              Grand Total:&nbsp;
              <span className="text-black font-bold">
                ${mode === 'bulk'
                  ? selectedProducts.reduce((sum, id) => {
                      const product = products.find((p: any) => p.id === id)
                      const price = product?.price || 0
                      const qty = Number(bulkQuantity) || 0
                      return sum + price * qty
                    }, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
                  : selectedProducts.reduce((sum, id) => {
                      const product = products.find((p: any) => p.id === id)
                      const price = product?.price || 0
                      const qty = Number(quantities[id]) || 0
                      return sum + price * qty
                    }, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
                }
              </span>
            </div>
          )}
          <DialogFooter className="bg-white pt-4 pb-2 -mx-6 px-6 border-t">
            <Button type="submit" disabled={!isValid || submitting} className="w-full">
              {submitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
              Record Sale(s)
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
