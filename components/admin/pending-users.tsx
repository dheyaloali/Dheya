"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getAvatarImage, getAvatarInitials } from "@/lib/avatar-utils"

interface PendingUser {
  id: string
  name: string
  email: string
  image?: string
  employee?: {
    position: string
    city: string
    pictureUrl?: string
  }
}

export function PendingUsers({ users }: { users: PendingUser[] }) {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>(users)
  const { toast } = useToast()
  const router = useRouter()

  const handleApprove = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/approve`, {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to approve user")
      }

      // Remove the approved user from the list
      setPendingUsers((prev) => prev.filter((user) => user.id !== userId))

      toast({
        title: "User Approved",
        description: "The user has been approved successfully.",
      })

      // Refresh the page to update the list
      router.refresh()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve user. Please try again.",
        variant: "destructive",
      })
    }
  }

  if (pendingUsers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Approvals</CardTitle>
          <CardDescription>No pending user approvals</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Approvals</CardTitle>
        <CardDescription>Review and approve new user registrations</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {pendingUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center space-x-4">
                <Avatar>
                  <AvatarImage 
                    src={getAvatarImage({ 
                      image: user.image, 
                      pictureUrl: user.employee?.pictureUrl 
                    })} 
                  />
                  <AvatarFallback>
                    {getAvatarInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  {user.employee && (
                    <p className="text-sm text-muted-foreground">
                      {user.employee.position} • {user.employee.city}
                    </p>
                  )}
                </div>
              </div>
              <Button onClick={() => handleApprove(user.id)}>Approve</Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
} 