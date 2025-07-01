import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { getAvatarImage, getAvatarInitials } from "@/lib/avatar-utils"
import { useCurrency } from "@/components/providers/currency-provider";

export interface TopPerformer {
  id: string;
  name: string;
  location: string;
  sales: number;
  topProducts?: { name: string; amount: number }[];
  avatar?: string;
  user?: {
    image?: string | null;
  };
  employee?: {
    pictureUrl?: string | null;
  };
}

interface TopPerformersByCity {
  city: string;
  performers: TopPerformer[];
}

interface TopPerformersTableProps {
  performers: TopPerformer[];
  total: number;
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
}

export const TopPerformersTable = ({ performers, total, page, pageSize, setPage, setPageSize }: TopPerformersTableProps) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalProducts, setModalProducts] = useState<{ name: string; amount: number; quantity?: number; image?: string }[]>([]);
  const [modalEmployee, setModalEmployee] = useState<{ name: string; avatar?: string } | null>(null);
  const { formatAmount } = useCurrency();

  const openModal = (products: any[], employee: { name: string; avatar?: string }) => {
    setModalProducts(products);
    setModalEmployee(employee);
    setModalOpen(true);
  };

  const totalPages = Math.ceil(total / pageSize);
  return (
    <div className="w-full">
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="px-2 py-2 text-left">Avatar</th>
              <th className="px-2 py-2 text-left">Name</th>
              <th className="px-2 py-2 text-left">City</th>
              <th className="px-2 py-2 text-left">Sales</th>
              <th className="px-2 py-2 text-left">Products Sold</th>
            </tr>
          </thead>
          <tbody>
            {performers.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No top performers found for this period.</td></tr>
            ) : performers.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="px-2 py-2">
                  <Avatar className="h-9 w-9">
                    <AvatarImage 
                      src={getAvatarImage({ 
                        image: p.user?.image, 
                        pictureUrl: p.employee?.pictureUrl 
                      })} 
                      alt={p.name} 
                    />
                    <AvatarFallback>{getAvatarInitials(p.name)}</AvatarFallback>
                  </Avatar>
                </td>
                <td className="px-2 py-2 font-medium">{p.name}</td>
                <td className="px-2 py-2">{p.location}</td>
                <td className="px-2 py-2 font-semibold">{formatAmount(p.sales)}</td>
                <td className="px-2 py-2">
                  {!p.topProducts || p.topProducts.length === 0 ? (
                    <span className="text-muted-foreground">No products</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {p.topProducts.slice(0, 2).map((product, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                        >
                          {product.name} ({formatAmount(product.amount)})
                        </span>
                      ))}
                      {p.topProducts.length > 2 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
                          +{p.topProducts.length - 2} more
                        </span>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Pagination Controls */}
      <div className="flex items-center justify-between mt-4 mb-6 pl-4">
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={pageSize}
            onChange={e => setPageSize(Number(e.target.value))}
          >
            {[4, 8, 12, 20, 50].map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1}>First</Button>
          <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>&lt; Prev</Button>
          {Array.from({ length: totalPages }, (_, i) => (
            <Button
              key={i + 1}
              variant={page === i + 1 ? "default" : "outline"}
              size="sm"
              onClick={() => setPage(i + 1)}
            >
              {i + 1}
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages || totalPages === 0}>Next &gt;</Button>
          <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page === totalPages || totalPages === 0}>Last</Button>
        </div>
      </div>
      {/* Modal for all products */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl w-full">
          <DialogHeader>
            <DialogTitle>All Products Sold by {modalEmployee?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto grid gap-4 grid-cols-1 sm:grid-cols-2 mt-2">
            {modalProducts.length === 0 ? (
              <div className="text-muted-foreground text-center py-8 col-span-full">No products</div>
            ) : (
              modalProducts.map((tp, i) => (
                <div key={tp.name} className="flex items-center gap-4 bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
                  {tp.image ? (
                    <img src={tp.image} alt={tp.name} className="w-16 h-16 object-cover rounded-md border" />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 rounded-md flex items-center justify-center text-gray-400 border">
                      <span className="text-xs">No Image</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-base truncate">{tp.name}</div>
                    <div className="text-blue-700 font-bold text-lg">{formatAmount(tp.amount)}</div>
                    {tp.quantity !== undefined && <div className="text-xs text-muted-foreground mt-1">Quantity: {tp.quantity}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export const TopPerformersTableSkeleton = () => (
  <div className="space-y-8">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="flex items-center">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="ml-4 space-y-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="ml-auto h-4 w-16" />
      </div>
    ))}
  </div>
); 