import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ProductsTab from "@/components/admin/products-tab"
import HistoryTab from "@/components/admin/product-history-tab"
import { ProductAssignmentManager } from "@/components/admin/product-assignment-manager"
import AssignTargetTab from "@/components/admin/assign-target-tab"

export default function AdminDashboard() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Admin Product Management</h1>
      </div>

      <Tabs defaultValue="employees" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="employees">Employee Assignments</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="target">Assign Target</TabsTrigger>
        </TabsList>
        <TabsContent value="employees" className="mt-6">
          <ProductAssignmentManager />
        </TabsContent>
        <TabsContent value="products" className="mt-6">
          <ProductsTab />
        </TabsContent>
        <TabsContent value="history" className="mt-6">
          <HistoryTab />
        </TabsContent>
        <TabsContent value="target" className="mt-6">
          <AssignTargetTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
