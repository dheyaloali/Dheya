import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ProductsTab from "@/components/admin/products-tab"
import HistoryTab from "@/components/admin/product-history-tab"
import { ProductAssignmentManager } from "@/components/admin/product-assignment-manager"
import AssignTargetTab from "@/components/admin/assign-target-tab"

export default function AdminDashboard() {
  return (
    <div className="w-full py-6 space-y-6 overflow-x-hidden">
      <div className="pl-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Admin Product Management</h1>
      </div>
      <Tabs defaultValue="employees" className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-[calc(100vw-220px)]">
          <TabsTrigger value="employees">Employee Assignments</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="target">Assign Target</TabsTrigger>
        </TabsList>
          <TabsContent value="employees" className="space-y-4 overflow-x-auto">
          <ProductAssignmentManager />
        </TabsContent>
          <TabsContent value="products" className="space-y-4 overflow-x-auto">
          <ProductsTab />
        </TabsContent>
          <TabsContent value="history" className="space-y-4 overflow-x-auto">
          <HistoryTab />
        </TabsContent>
          <TabsContent value="target" className="space-y-4 overflow-x-auto">
          <AssignTargetTab />
        </TabsContent>
      </Tabs>
      </div>
    </div>
  )
}
