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
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { mockEmployees, mockProducts } from "@/lib/mock-data"
import { Search } from "lucide-react"

export default function AssignProductModal({ isOpen, onClose, onAssign, preSelectedEmployee = null }) {
  const [selectedEmployees, setSelectedEmployees] = useState([])
  const [selectedProducts, setSelectedProducts] = useState([])
  const [quantities, setQuantities] = useState({})
  const [errors, setErrors] = useState({})
  const [assignmentMode, setAssignmentMode] = useState("single") // "single" or "bulk"

  // Set pre-selected employee when modal opens
  useEffect(() => {
    if (isOpen && preSelectedEmployee) {
      setSelectedEmployees([preSelectedEmployee.id])
      setAssignmentMode("single")
    }
  }, [isOpen, preSelectedEmployee])

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      if (!preSelectedEmployee) {
        setSelectedEmployees([])
      }
      setSelectedProducts([])
      setQuantities({})
      setErrors({})
    }
  }, [isOpen, preSelectedEmployee])

  const handleEmployeeToggle = (employeeId) => {
    setSelectedEmployees((prev) =>
      prev.includes(employeeId) ? prev.filter((id) => id !== employeeId) : [...prev, employeeId],
    )
  }

  const handleProductToggle = (productId) => {
    setSelectedProducts((prev) => {
      if (prev.includes(productId)) {
        const newSelected = prev.filter((id) => id !== productId)
        const newQuantities = { ...quantities }
        delete newQuantities[productId]
        setQuantities(newQuantities)
        return newSelected
      } else {
        return [...prev, productId]
      }
    })
  }

  const handleQuantityChange = (productId, value) => {
    const quantity = Number.parseInt(value, 10)
    setQuantities({ ...quantities, [productId]: quantity })

    // Validate quantity
    const product = mockProducts.find((p) => p.id === productId)
    const newErrors = { ...errors }

    if (isNaN(quantity) || quantity <= 0) {
      newErrors[productId] = "Quantity must be greater than 0"
    } else if (quantity > product.stock) {
      newErrors[productId] = `Maximum available: ${product.stock}`
    } else {
      delete newErrors[productId]
    }

    setErrors(newErrors)
  }

  const handleSubmit = () => {
    // Validate form
    const formErrors = {}
    let hasErrors = false

    selectedProducts.forEach((productId) => {
      if (!quantities[productId] || quantities[productId] <= 0) {
        formErrors[productId] = "Quantity required"
        hasErrors = true
      }
    })

    if (selectedEmployees.length === 0) {
      alert("Please select at least one employee")
      return
    }

    if (selectedProducts.length === 0) {
      alert("Please select at least one product")
      return
    }

    if (hasErrors) {
      setErrors(formErrors)
      return
    }

    // Create assignments
    const newAssignments = []
    let assignmentId = Date.now()

    selectedEmployees.forEach((employeeId) => {
      const employee = mockEmployees.find((e) => e.id === employeeId)

      selectedProducts.forEach((productId) => {
        const product = mockProducts.find((p) => p.id === productId)
        const quantity = quantities[productId]

        newAssignments.push({
          id: assignmentId++,
          employeeId,
          employeeName: employee.name,
          employeePhoto: employee.photo,
          productId,
          productName: product.name,
          productImage: product.image,
          quantity,
          price: product.price,
          date: new Date().toISOString(),
        })
      })
    })

    onAssign(newAssignments)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Assign Products to Employees</DialogTitle>
          <DialogDescription>
            {preSelectedEmployee
              ? `Assign products to ${preSelectedEmployee.name}`
              : "Select employees and products to create assignments"}
          </DialogDescription>
        </DialogHeader>

        {!preSelectedEmployee && (
          <div className="mb-4">
            <RadioGroup value={assignmentMode} onValueChange={setAssignmentMode} className="flex space-x-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="single" id="single" />
                <Label htmlFor="single">Single Employee</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="bulk" id="bulk" />
                <Label htmlFor="bulk">Multiple Employees</Label>
              </div>
            </RadioGroup>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 py-4 overflow-hidden">
          <div
            className={`grid ${!preSelectedEmployee && (assignmentMode === "bulk" || assignmentMode === "single") ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"} gap-6`}
          >
            {!preSelectedEmployee && assignmentMode === "bulk" && (
              <div className="space-y-4">
                <h3 className="font-medium">Select Employees</h3>
                <ScrollArea className="h-[300px] border rounded-md p-4">
                  {mockEmployees.map((employee) => (
                    <div key={employee.id} className="flex items-center space-x-2 py-2">
                      <Checkbox
                        id={`employee-${employee.id}`}
                        checked={selectedEmployees.includes(employee.id)}
                        onCheckedChange={() => handleEmployeeToggle(employee.id)}
                      />
                      <Label htmlFor={`employee-${employee.id}`} className="flex items-center gap-2 cursor-pointer">
                        <img
                          src={employee.photo || "/placeholder.svg"}
                          alt={employee.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div>
                          <p className="font-medium">{employee.name}</p>
                          <p className="text-sm text-muted-foreground">{employee.position}</p>
                        </div>
                      </Label>
                    </div>
                  ))}
                </ScrollArea>
                <div className="text-sm text-muted-foreground">{selectedEmployees.length} employees selected</div>
              </div>
            )}

            {!preSelectedEmployee && assignmentMode === "single" && (
              <div className="space-y-4">
                <h3 className="font-medium">Select Employee</h3>
                <ScrollArea className="h-[300px] border rounded-md p-4">
                  {mockEmployees.map((employee) => (
                    <div key={employee.id} className="flex items-center space-x-2 py-2">
                      <input
                        type="radio"
                        id={`employee-single-${employee.id}`}
                        name="employee-single"
                        checked={selectedEmployees.includes(employee.id)}
                        onChange={() => setSelectedEmployees([employee.id])}
                        className="h-4 w-4 rounded-full"
                      />
                      <Label
                        htmlFor={`employee-single-${employee.id}`}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <img
                          src={employee.photo || "/placeholder.svg"}
                          alt={employee.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div>
                          <p className="font-medium">{employee.name}</p>
                          <p className="text-sm text-muted-foreground">{employee.position}</p>
                        </div>
                      </Label>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="font-medium flex justify-between items-center">
                <span>Select Products & Quantities</span>
                <span className="text-sm text-muted-foreground">{selectedProducts.length} selected</span>
              </h3>
              <div className="relative">
                <Input
                  placeholder="Search products..."
                  className="mb-3"
                  onChange={(e) => {
                    // This would filter products in a real implementation
                    // For now it's just a UI enhancement
                  }}
                />
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
              <div className="border rounded-md overflow-auto h-[300px] p-4">
                <div className="grid grid-cols-1 gap-4 w-full">
                  {mockProducts.map((product) => (
                    <div
                      key={product.id}
                      className={`
                      relative rounded-lg border p-3 transition-all duration-200 
                      ${
                        selectedProducts.includes(product.id)
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "hover:border-muted-foreground/20 hover:bg-muted/50"
                      }
                    `}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <img
                            src={product.image || "/placeholder.svg"}
                            alt={product.name}
                            className="w-16 h-16 rounded-md object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium truncate">{product.name}</h4>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                ${product.price.toFixed(2)} · {product.stock} in stock
                              </p>
                            </div>
                            <Checkbox
                              id={`product-${product.id}`}
                              checked={selectedProducts.includes(product.id)}
                              onCheckedChange={() => handleProductToggle(product.id)}
                              className="h-5 w-5"
                            />
                          </div>

                          {selectedProducts.includes(product.id) && (
                            <div className="mt-3 flex items-center">
                              <Label htmlFor={`quantity-${product.id}`} className="mr-3 text-sm">
                                Quantity:
                              </Label>
                              <div className="flex items-center">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 rounded-r-none"
                                  onClick={() => {
                                    const currentQty = quantities[product.id] || 0
                                    if (currentQty > 1) {
                                      handleQuantityChange(product.id, currentQty - 1)
                                    }
                                  }}
                                  disabled={(quantities[product.id] || 0) <= 1}
                                >
                                  <span>-</span>
                                </Button>
                                <Input
                                  id={`quantity-${product.id}`}
                                  type="number"
                                  min="1"
                                  max={product.stock}
                                  value={quantities[product.id] || ""}
                                  onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                                  className="w-14 h-8 rounded-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 rounded-l-none"
                                  onClick={() => {
                                    const currentQty = quantities[product.id] || 0
                                    if (currentQty < product.stock) {
                                      handleQuantityChange(product.id, currentQty + 1)
                                    }
                                  }}
                                  disabled={(quantities[product.id] || 0) >= product.stock}
                                >
                                  <span>+</span>
                                </Button>
                              </div>
                              {errors[product.id] && <p className="text-xs text-red-500 ml-2">{errors[product.id]}</p>}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-end text-sm text-muted-foreground pt-2">
                {selectedProducts.length > 0 && (
                  <span>
                    Total items: {Object.values(quantities).reduce((sum, qty) => sum + (Number(qty) || 0), 0)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Assign Products</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
