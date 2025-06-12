"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { AlertCircle, Package, Search } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { PaginationControls } from "@/components/pagination-controls"
import { useEmployeeSocket } from "@/hooks/useEmployeeSocket"
import { useNotifications } from "@/hooks/useNotifications"
import NotificationPanel from "@/components/ui/NotificationPanel"
import { useToast } from "@/components/ui/use-toast"

const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function ProductsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const { toast } = useToast()
  const { socket: employeeSocket } = useEmployeeSocket()
  const { notifications, mutate: mutateNotifications } = useNotifications()
  
  // Pagination state
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(8)
  const { data, error, isLoading, mutate } = useSWR("/api/employee/product", fetcher, {
    refreshInterval: 10000,
    revalidateOnFocus: true,
  })
  const products = data?.products || []

  // Add WebSocket listener for product updates
  useEffect(() => {
    if (!employeeSocket) return;

    const handleProductUpdate = (data: any) => {
      // Refresh product data
      mutate();
      // Show notification
      toast({
        title: "Product Update",
        description: data.message || "A product has been updated"
      });
      // Refresh notifications
      mutateNotifications();
    };

    const handleProductAssignment = (data: any) => {
      // Refresh product data
      mutate();
      // Show notification
      toast({
        title: "New Product Assignment",
        description: data.message || "You have been assigned a new product",
        action: {
          label: "View Product",
          onClick: () => {
            // Scroll to the product if it's in the current page
            const productElement = document.getElementById(`product-${data.productId}`);
            if (productElement) {
              productElement.scrollIntoView({ behavior: "smooth" });
              productElement.classList.add("highlight");
              setTimeout(() => productElement.classList.remove("highlight"), 2000);
            }
          }
        }
      });
      // Refresh notifications
      mutateNotifications();
    };

    const handleStockUpdate = (data: any) => {
      // Refresh product data
      mutate();
      // Show notification
      toast({
        title: "Stock Update",
        description: data.message || "Product stock has been updated",
        action: {
          label: "View Product",
          onClick: () => {
            // Scroll to the product if it's in the current page
            const productElement = document.getElementById(`product-${data.productId}`);
            if (productElement) {
              productElement.scrollIntoView({ behavior: "smooth" });
              productElement.classList.add("highlight");
              setTimeout(() => productElement.classList.remove("highlight"), 2000);
            }
          }
        }
      });
      // Refresh notifications
      mutateNotifications();
    };

    const handleProductDeletion = (data: any) => {
      // Refresh product data
      mutate();
      // Show notification
      toast({
        title: "Product Removed",
        description: data.message || "A product has been removed from your assignments",
        variant: "destructive"
      });
      // Refresh notifications
      mutateNotifications();
    };

    // Listen for all notification types
    employeeSocket.on("notification", (data: any) => {
      switch (data.type) {
        case "employee_product_assigned":
          handleProductAssignment(data);
          break;
        case "employee_stock_updated":
          handleStockUpdate(data);
          break;
        case "employee_product_updated":
          handleProductUpdate(data);
          break;
        case "employee_product_deleted":
          handleProductDeletion(data);
          break;
        default:
          handleProductUpdate(data);
      }
    });

    return () => {
      employeeSocket.off("notification");
    };
  }, [employeeSocket, mutate, mutateNotifications, toast]);

  // Filter products based on search query
  const filteredProducts = products.filter(
    (product: any) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  // Pagination logic
  const total = filteredProducts.length
  const totalPages = Math.ceil(total / pageSize)
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const pagedProducts = filteredProducts.slice((page - 1) * pageSize, page * pageSize)

  // Count low stock products
  const lowStockCount = products.filter((product: any) => product.stock <= 5).length

  return (
    <div className="container max-w-7xl mx-auto p-4 md:p-6 pb-20 pt-4 md:pt-0">
      <NotificationPanel />
      <div className="sticky top-0 bg-background z-10 pt-4 pb-4 mb-6 border-b">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">My Products</h1>
            <p className="text-muted-foreground">Products assigned to you for sales and inventory management</p>
          </div>

          <div className="relative w-full md:w-auto">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search products..."
              className="pl-8 w-full md:w-[250px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load products. Please try again later.
          </AlertDescription>
        </Alert>
      )}

      {/* Low stock alert */}
      {!isLoading && !error && lowStockCount > 0 && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Low Stock Alert</AlertTitle>
          <AlertDescription>
            {lowStockCount} product{lowStockCount > 1 ? "s" : ""} {lowStockCount > 1 ? "are" : "is"} running low on
            stock. Please contact inventory management.
          </AlertDescription>
        </Alert>
      )}

      {/* Products grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {isLoading ? (
          // Loading skeletons
          Array.from({ length: pageSize }).map((_, index) => (
            <Card key={index}>
              <CardContent className="p-0">
                <Skeleton className="h-[200px] w-full rounded-t-lg" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <div className="flex justify-between pt-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : pagedProducts.length > 0 ? (
          // Actual products
          pagedProducts.map((product: any) => (
            <Card 
              key={product.id} 
              id={`product-${product.id}`}
              className="overflow-hidden transition-all hover:shadow-md"
            >
              <CardContent className="p-0">
                <img
                  src={product.image || "/placeholder.svg"}
                  alt={product.name}
                  className="h-[200px] w-full object-cover"
                />
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold">{product.name}</h3>
                    <span className="font-bold text-right">${product.price}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{product.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{product.stock} in stock</span>
                    </div>
                    {product.stock <= 5 && (
                      <Badge variant="outline" className="text-red-500 border-red-200 bg-red-50">
                        Low Stock
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          // No results
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No products found</h3>
            <p className="text-muted-foreground">We couldn't find any products matching your search.</p>
          </div>
        )}
      </div>

      {/* Pagination controls below the grid */}
      <div className="mt-8">
        <PaginationControls
          page={page}
          setPage={setPage}
          totalPages={totalPages}
          pageSize={pageSize}
          setPageSize={setPageSize}
          total={total}
          from={from}
          to={to}
        />
      </div>
    </div>
  )
}
