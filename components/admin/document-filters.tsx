"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox" 
import type { DocumentStatus, DocumentType } from "@/lib/types"

interface DocumentFiltersProps {
  selectedStatus: DocumentStatus | "All"
  onStatusChange: (status: DocumentStatus | "All") => void
  selectedTypes?: string[]
  onTypesChange?: (types: string[]) => void
  isRegistrationOnly?: boolean
  onRegistrationFilterChange?: (isRegistrationOnly: boolean) => void
}

export default function DocumentFilters({ 
  selectedStatus, 
  onStatusChange,
  selectedTypes = [],
  onTypesChange = () => {},
  isRegistrationOnly = false,
  onRegistrationFilterChange = () => {} 
}: DocumentFiltersProps) {
  const documentTypes = [
    { label: "Passport", value: "passport" },
    { label: "National ID", value: "national_id" }
  ];

  const handleTypeChange = (type: string, checked: boolean) => {
    if (checked) {
      onTypesChange([...selectedTypes, type]);
    } else {
      onTypesChange(selectedTypes.filter(t => t !== type));
    }
  };

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Filters</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-3">Document Status</h3>
            <RadioGroup
              defaultValue={selectedStatus}
              value={selectedStatus}
              onValueChange={(value) => onStatusChange(value as DocumentStatus | "All")}
              className="flex flex-col space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="All" id="status-all" />
                <Label htmlFor="status-all" className="cursor-pointer">
                  All Documents
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Pending" id="status-pending" />
                <Label htmlFor="status-pending" className="cursor-pointer">
                  Pending
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Approved" id="status-approved" />
                <Label htmlFor="status-approved" className="cursor-pointer">
                  Approved
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Rejected" id="status-rejected" />
                <Label htmlFor="status-rejected" className="cursor-pointer">
                  Rejected
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3">Document Type</h3>
            <div className="space-y-2">
              {documentTypes.map((type) => (
                <div key={type.value} className="flex items-center">
                  <Checkbox 
                    id={`type-${type.value}`}
                    checked={selectedTypes.includes(type.value)}
                    onCheckedChange={(checked) => 
                      handleTypeChange(type.value, checked === true)
                    }
                  />
                  <label 
                    htmlFor={`type-${type.value}`} 
                    className="ml-2 text-sm cursor-pointer"
                  >
                    {type.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3">Document Purpose</h3>
            <div className="space-y-2">
              <div className="flex items-center">
                <Checkbox
                  id="registration-docs"
                  checked={isRegistrationOnly}
                  onCheckedChange={(checked) => 
                    onRegistrationFilterChange(checked === true)
                  }
                />
                <label htmlFor="registration-docs" className="ml-2 text-sm cursor-pointer">
                  Registration Documents Only
                </label>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
