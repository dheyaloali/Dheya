"use client"

import { useState } from "react"
import { Menu, MapPin, Users, History, Settings, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { useTranslations } from "next-intl"

interface EmployeeTrackingLayoutProps {
  children: React.ReactNode
}

export function EmployeeTrackingLayout({ children }: EmployeeTrackingLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const t = useTranslations('Auth')
  
  const menuItems = [
    { icon: <MapPin className="w-5 h-5" />, label: "Real-time Tracking", href: "/tracking" },
    { icon: <Users className="w-5 h-5" />, label: "Employees", href: "/admin/employees" },
    { icon: <History className="w-5 h-5" />, label: "History", href: "/history" },
    { icon: <Settings className="w-5 h-5" />, label: "Settings", href: "/settings" },
  ]

  const SidebarContent = (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b">
        <MapPin className="h-6 w-6 text-blue-600" />
        <span className="text-lg font-bold">Employee Tracker</span>
      </div>

      {/* User Profile */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <Avatar>
            <AvatarImage src="/placeholder-user.png" alt="User" />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">John Doe</div>
            <div className="text-sm text-gray-500">john@example.com</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <div className="flex flex-col gap-2">
          {menuItems.map((item) => (
            <Button
              key={item.href}
              variant="ghost"
              className="w-full justify-start gap-2"
            >
              {item.icon}
              {item.label}
            </Button>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t">
        <Button variant="outline" className="w-full gap-2">
          <LogOut className="w-4 h-4" />
          {t('logout')}
        </Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Menu Button */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="h-4 w-4" />
        </Button>
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 w-[280px]">
          {SidebarContent}
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <div className="hidden md:block fixed inset-y-0 left-0 w-[280px] border-r bg-white">
        {SidebarContent}
      </div>

      {/* Main Content */}
      <main className="md:pl-[280px] p-4">
        {children}
      </main>
    </div>
  )
}