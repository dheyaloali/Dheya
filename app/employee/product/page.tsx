"use client"

import useSWR from "swr";
import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Search, Package, CalendarDays, History, ChevronDown, ChevronUp, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useToast } from '@/components/ui/use-toast';
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
import { PaginationControls } from "@/components/pagination-controls"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTranslations } from "next-intl";

const fetcher = (url: string) => fetch(url).then(res => res.json());

function formatDate(date: string | Date) {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString();
}

const PAGE_SIZE_OPTIONS = [4, 8, 16, 24, 32];

function TodayAssignmentsTable({ pageSizeOptions }: { pageSizeOptions: number[] }) {
  const t = useTranslations('Product');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingSale, setPendingSale] = useState<any>(null);
  const [soldLoading, setSoldLoading] = useState<string | null>(null);
  const [soldQuantities, setSoldQuantities] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(pageSizeOptions[1] || 8);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Calculate local start and end of today
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  // Format as ISO strings with timezone offset
  const from = startOfToday.toISOString();
  const to = endOfToday.toISOString();
  let apiUrl = `/api/employee/product?page=${page}&pageSize=${pageSize}&from=${from}&to=${to}`;
  const { data, error, isLoading, mutate } = useSWR(apiUrl, fetcher, { refreshInterval: 10000, revalidateOnFocus: true });
  let products = data?.products || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);
  const filteredProducts = products.filter((product: any) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.description.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const { toast } = useToast();
  function isAssignedToday(date: string | Date) {
    const today = new Date();
    const assigned = new Date(date);
    return (
      assigned.getDate() === today.getDate() &&
      assigned.getMonth() === today.getMonth() &&
      assigned.getFullYear() === today.getFullYear()
    );
  }

  // Initialize soldQuantities to current sold quantity when products change
  useEffect(() => {
    if (products.length > 0) {
      const initial: Record<string, number> = {};
      products.forEach((p: any) => {
        const rowId = p.id + p.assignedAt;
        initial[rowId] = p.soldQuantity ?? 0;
      });
      setSoldQuantities(initial);
    }
  }, [products]);

  return (
    <div className="relative">
      <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 260px)" }}>
        <div className="hidden md:grid grid-cols-9 gap-4 px-4 py-2 bg-gray-100 sticky top-0 z-10 font-semibold text-sm text-gray-700 border-b border-gray-300">
          <div>{t('product')}</div>
          <div>{t('name')}</div>
          <div>{t('price')}</div>
          <div>{t('assigned')}</div>
          <div>{t('quantitySold')}</div>
          <div>{t('status')}</div>
          <div>{t('info')}</div>
          <div>{t('action')}</div>
          <div></div>
        </div>
        <div className="divide-y divide-border">
          {isLoading ? (
            Array.from({ length: pageSize }).map((_, index) => (
              <div key={index} className="flex flex-col md:grid md:grid-cols-9 gap-4 px-4 py-4 animate-pulse bg-background">
                <div className="h-12 w-12 bg-muted rounded" />
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-4 w-16 bg-muted rounded" />
                <div className="h-4 w-12 bg-muted rounded" />
                <div className="h-4 w-20 bg-muted rounded" />
                <div className="h-4 w-8 bg-muted rounded self-center" />
                <div className="h-4 w-16 bg-muted rounded" />
                <div className="h-4 w-16 bg-muted rounded" />
                <div></div>
              </div>
            ))
          ) : filteredProducts.length > 0 ? (
            filteredProducts.map((product: any) => {
              const rowId = product.id + product.assignedAt;
              const isOpen = expanded.has(rowId);
              const assignedToday = isAssignedToday(product.assignedAt);
              const status = product.status;
              const isSold = status === "sold";
              const isExpired = status === "expired";
              const isPartiallySold = status === "partially_sold";
              const maxQty = product.quantity;
              return (
                <div key={rowId} className={`group bg-background transition hover:bg-muted/40 focus-within:bg-muted/40 outline-none`}>
                  <div
                    className="flex flex-col md:grid md:grid-cols-9 gap-4 px-4 py-4 items-center cursor-pointer select-none"
                    tabIndex={0}
                    aria-expanded={isOpen}
                    onClick={() => {
                      setExpanded(prev => {
                        const next = new Set(prev);
                        if (next.has(rowId)) {
                          next.delete(rowId);
                        } else {
                          next.add(rowId);
                        }
                        return next;
                      });
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setExpanded(prev => {
                          const next = new Set(prev);
                          if (next.has(rowId)) {
                            next.delete(rowId);
                          } else {
                            next.add(rowId);
                          }
                          return next;
                        });
                      }
                    }}
                  >
                    <div className="flex items-center justify-center">
                      <img
                        src={product.image || "/placeholder.svg"}
                        alt={product.name}
                        className="h-12 w-12 object-cover rounded-md border bg-white"
                        style={{ background: 'white' }}
                      />
                      {assignedToday && (
                        <span className="ml-2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full shadow animate-pulse">New</span>
                      )}
                    </div>
                    <div className="font-semibold text-base md:text-sm truncate w-full">{product.name}</div>
                    <div className="text-black font-bold text-base md:text-sm">${product.price}</div>
                    <div>
                      <Badge variant="secondary" className="px-2 py-0.5 text-xs">{product.quantity}</Badge>
                    </div>
                    <div className="flex items-center gap-2 w-full justify-center">
                      <Badge className="bg-blue-100 text-black hover:bg-blue-100 hover:text-black">
                        {product.soldQuantity && product.soldQuantity > 0 ? product.soldQuantity : ""}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-center px-4 mr-4 min-w-[90px]">
                      <Badge className="bg-blue-100 text-black hover:bg-blue-100 hover:text-black font-semibold px-3 py-1 text-xs rounded-md">
                        {status === "sold"
                          ? "Sold"
                          : status === "partially_sold"
                          ? "Partially Sold"
                          : status === "expired"
                          ? "Expired"
                          : "Assigned"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-center">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="hover:bg-blue-100">
                            <Info className="h-5 w-5 text-blue-600" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-xs">
                          <DialogHeader>
                            <DialogTitle>Product Info</DialogTitle>
                          </DialogHeader>
                          <div className="text-sm mb-2">
                            <span className="font-medium">{t('assignedDate')}:</span> {formatDate(product.assignedAt)}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">{t('notes')}:</span> {product.description || "No description."}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <div className="flex items-center justify-center px-4 ml-4 min-w-[140px]">
                      {status === "assigned" && (
                        <>
                          <Input
                            type="number"
                            min={1}
                            max={maxQty}
                            value={soldQuantities[rowId] ?? 1}
                            className="w-20 text-center"
                            onChange={e => {
                              let v = parseInt(e.target.value, 10);
                              if (isNaN(v) || v < 1) v = 1;
                              if (v > maxQty) v = maxQty;
                              setSoldQuantities(q => ({ ...q, [rowId]: v }));
                            }}
                            disabled={soldLoading === rowId}
                          />
                          <Button
                            size="sm"
                            className="ml-2 flex items-center gap-1"
                            disabled={soldLoading === rowId}
                            onClick={e => {
                              e.stopPropagation();
                              const qty = soldQuantities[rowId];
                              if (qty === undefined || qty === null || isNaN(qty) || qty < 1) {
                                toast({
                                  title: "Invalid Quantity",
                                  description: "Please enter a valid quantity greater than 0 to record a sale.",
                                  variant: "destructive"
                                });
                                return;
                              }
                              if (qty > maxQty) {
                                toast({
                                  title: "Invalid Quantity",
                                  description: `Please enter a valid quantity (1 to ${maxQty}) to mark as sold.`,
                                  variant: "destructive"
                                });
                                return;
                              }
                              setPendingSale({ product, soldQty: qty, rowId });
                              setConfirmOpen(true);
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" /></svg>
                            {soldLoading === rowId ? "Saving..." : "Submit"}
                          </Button>
                        </>
                      )}
                    </div>
                    <div></div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">{t('noProductsFound')}</h3>
              <p className="text-muted-foreground">{t('noAssignedProducts')}</p>
            </div>
          )}
        </div>
      </div>
      <div className="mt-8">
        <PaginationControls
          page={page}
          setPage={setPage}
          totalPages={totalPages}
          pageSize={pageSize}
          setPageSize={setPageSize}
          total={total}
          from={total === 0 ? 0 : (page - 1) * pageSize + 1}
          to={Math.min(page * pageSize, total)}
        />
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmMarkAsSold')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('confirmMarkAsSoldDescription', { productName: pendingSale?.product?.name, soldQty: pendingSale?.soldQty })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!pendingSale) return;
                setSoldLoading(pendingSale.rowId);
                setConfirmOpen(false);
                try {
                  let res, result;
                  if (pendingSale.soldQty === 0) {
                    res = await fetch(`/api/employee/sales`, {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ productId: pendingSale.product.id }),
                    });
                  } else {
                    res = await fetch("/api/employee/sales", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        productId: pendingSale.product.id,
                        quantity: pendingSale.soldQty,
                        amount: pendingSale.soldQty * pendingSale.product.price,
                      }),
                    });
                  }
                  let text = await res.text();
                  try {
                    result = JSON.parse(text);
                  } catch {
                    result = {};
                  }
                  if (!res.ok) throw new Error(result.error || "Failed to record sale");
                  toast({ title: "Sale updated successfully!", description: "The assignment will update shortly.", variant: "default" });
                  await mutate();
                } catch (err) {
                  console.error("Sale error", err);
                  toast({ title: "Failed to record sale", description: "Please try again. " + (err instanceof Error ? err.message : ""), variant: "destructive" });
                } finally {
                  setSoldLoading(null);
                  setPendingSale(null);
                }
              }}
            >
              {t('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function ProductsPage() {
  const t = useTranslations('Product');
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <TooltipProvider>
      <div className="container max-w-7xl mx-auto p-4 md:p-6 pb-20 pt-4 md:pt-0">
        {/* Sticky header and filters */}
        <div className="sticky top-0 bg-background z-20 pt-4 pb-4 mb-6 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Package className="h-6 w-6 text-blue-600" /> {t('myProducts')}
              </h1>
              <p className="text-muted-foreground">{t('productsAssigned')}</p>
            </div>
          </div>
        </div>
        {/* Error state */}
        {/* ... existing error logic ... */}
        {/* Only render Today's Assignments table */}
        <TodayAssignmentsTable pageSizeOptions={PAGE_SIZE_OPTIONS} />
      </div>
    </TooltipProvider>
  );
}
