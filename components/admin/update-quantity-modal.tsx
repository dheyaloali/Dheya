"use client"

import { useState } from "react"
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
import { mockProducts } from "@/lib/mock-data"

export default function UpdateQuantityModal({ assignment, isOpen, onClose, onUpdate }) {
  const [quantity, setQuantity] = useState(assignment?.quantity || 1)
  const [error, setError] = useState("")

  const product = mockProducts.find((p) => p.id === assignment?.productId)
  const maxQuantity = product?.stock || 0

  const handleQuantityChange = (e) => {
    const value = Number.parseInt(e.target.value, 10)
    setQuantity(value)

    if (isNaN(value) || value <= 0) {
      setError("Please enter a valid quantity greater than 0")
    } else if (value > maxQuantity) {
      setError(`Maximum available: ${maxQuantity}`)
    } else {
      setError("")
    }
  }

  const handleSubmit = () => {
    if (isNaN(quantity) || quantity <= 0 || quantity > maxQuantity) {
      return
    }

    onUpdate(assignment.id, quantity)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Update Assignment Quantity</DialogTitle>
          <DialogDescription>
            Update the quantity of {assignment?.productName} assigned to {assignment?.employeeName}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="quantity" className="text-right">
              Quantity
            </Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              max={maxQuantity}
              value={quantity}
              onChange={handleQuantityChange}
              className="col-span-3"
            />
            {error && <p className="col-span-4 text-sm text-red-500">{error}</p>}
          </div>
          <div className="col-span-4 text-sm">
            <p>Current price: ${assignment?.price.toFixed(2)}</p>
            <p>New total: ${(quantity * assignment?.price).toFixed(2)}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!!error}>
            Update Quantity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
