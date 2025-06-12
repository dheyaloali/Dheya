"use client"

import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Battery, MapPin } from "lucide-react"
import type { Employee } from "./admin-location-management"

interface EmployeeListProps {
  employees: Employee[]
  selectedEmployee: Employee | null
  onSelectEmployee: (employee: Employee) => void
  isLoading: boolean
}

export function EmployeeList({
  employees,
  selectedEmployee,
  onSelectEmployee,
  isLoading,
}: EmployeeListProps) {
  const [searchQuery, setSearchQuery] = useState("")

  // Filter employees based on search query
  const filteredEmployees = employees.filter(emp => {
    if (!emp || !emp.name) return false;
    
    const nameMatch = emp.name.toLowerCase().includes(searchQuery.toLowerCase());
    const departmentMatch = emp.department ? emp.department.toLowerCase().includes(searchQuery.toLowerCase()) : false;
    
    return nameMatch || departmentMatch;
  })

  // Split employees into checked in and not checked in
  const checkedIn = filteredEmployees.filter(emp => emp.location);
  const notCheckedIn = filteredEmployees.filter(emp => !emp.location);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Input
          placeholder="Search employees..."
          value=""
          disabled
          className="w-full mb-4"
        />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-lg bg-gray-100 animate-pulse"
            >
              <div className="h-10 w-10 rounded-full bg-gray-200" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-24 bg-gray-200 rounded" />
                <div className="h-3 w-32 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (filteredEmployees.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center text-muted-foreground p-8">
        <Input
          placeholder="Search employees..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full mb-4"
        />
        <div className="flex-1 flex flex-col items-center justify-center">
          <span className="text-3xl mb-2">🔍</span>
          <div className="text-lg font-semibold mb-1">No employees found</div>
          <div className="text-sm">Try a different city or search term.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Input
        placeholder="Search employees..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full mb-4"
      />
      <div className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: "calc(100vh - 250px)" }}>
        <div className="space-y-2">
          {/* Checked In Section */}
          <div className="mb-2 text-xs font-semibold text-muted-foreground">
            Checked In ({checkedIn.length})
          </div>
          {checkedIn.map((employee) => {
            const hasLocation = !!employee.location;
            return (
              <button
                key={employee.id}
                onClick={() => onSelectEmployee(employee)}
                className={`flex items-center gap-3 p-3 rounded-lg w-full text-left transition-colors ${
                  selectedEmployee?.id === employee.id
                    ? "bg-primary"
                    : "hover:bg-muted"
                }`}
              >
                <div className="shrink-0">
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={`/abstract-geometric-shapes.png?height=40&width=40&query=${employee.name}`}
                      alt={employee.name}
                    />
                    <AvatarFallback className="bg-muted text-foreground">
                      {employee.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className={`flex-1 min-w-0 ${
                  selectedEmployee?.id === employee.id
                    ? "text-primary-foreground"
                    : ""
                }`}>
                  <div className="font-medium truncate">{employee.name}</div>
                  <div className={`text-sm ${
                    selectedEmployee?.id === employee.id
                      ? "text-primary-foreground/80"
                      : "text-muted-foreground"
                  }`}>
                    {employee.department}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs">
                    <div className="flex items-center gap-1">
                      <Battery className="h-3 w-3" />
                      {hasLocation && typeof employee.location.batteryLevel === 'number'
                        ? `${employee.location.batteryLevel}%`
                        : <span className="text-muted-foreground">—</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {hasLocation && employee.location.timestamp
                        ? new Date(employee.location.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : <span className="text-muted-foreground">No location yet</span>}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

          {/* Not Checked In Section */}
          {notCheckedIn.length > 0 && (
            <>
              <div className="mb-2 mt-4 text-xs font-semibold text-muted-foreground">
                Not Checked In ({notCheckedIn.length})
              </div>
              {notCheckedIn.map((employee) => (
                <div
                  key={employee.id}
                  className="flex items-center gap-3 p-3 rounded-lg w-full text-left bg-gray-50 cursor-not-allowed opacity-70"
                >
                  <div className="shrink-0">
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={`/abstract-geometric-shapes.png?height=40&width=40&query=${employee.name}`}
                        alt={employee.name}
                      />
                      <AvatarFallback className="bg-muted text-foreground">
                        {employee.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{employee.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">No location yet</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}