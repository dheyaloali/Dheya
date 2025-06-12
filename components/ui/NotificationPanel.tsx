"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Bell, X, CheckCircle, AlertTriangle, Info, ChevronRight, FileText, Check, RefreshCw, Wifi, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useNotifications, Notification } from "@/hooks/useNotifications"
import { formatDistanceToNow } from "date-fns"
import { useEmployeeSocket } from "@/hooks/useEmployeeSocket"
import { useSession } from "next-auth/react"
import { useToast } from "@/components/ui/use-toast"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAdminSocket } from "@/hooks/useAdminSocket"

// Define Socket notification event data type for better type safety
interface NotificationEvent extends Notification {
  broadcastTo?: {
    admin?: boolean;
    employee?: boolean;
  };
}

export default function NotificationPanel() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    markAsRead,
    deleteNotification,
    markAllAsRead,
    mutate,
    reset,
    lastSyncTime,
  } = useNotifications();
  const { data: session } = useSession();
  const isAdmin = session?.user?.isAdmin;
  const { socket: employeeSocket, connected: employeeConnected } = useEmployeeSocket();
  const { socket: adminSocket, connected: adminConnected } = useAdminSocket();
  const socket = isAdmin ? adminSocket : employeeSocket;
  const isConnected = isAdmin ? adminConnected : employeeConnected;
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const wasPanelOpen = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showConnectionStatus, setShowConnectionStatus] = useState(false);
  
  // Enhanced refresh with visual feedback
  const refreshNotifications = useCallback(async () => {
    setIsRefreshing(true);
    await reset();
    
    // Add a slight delay to make the refresh animation visible
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
    
    // Temporary connection status indicator
    setShowConnectionStatus(true);
    setTimeout(() => {
      setShowConnectionStatus(false);
    }, 2000);
  }, [reset]);

  // Handle mark all as read action with optimistic UI update
  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      toast({
        title: "All caught up!",
        description: "All notifications have been marked as read.",
        variant: "default",
      });
    } catch (error) {
      console.error("[NotificationPanel] Error marking all as read:", error);
      toast({
        title: "Error",
        description: "Failed to mark notifications as read.",
        variant: "destructive",
      });
    }
  };

  // Refresh when panel is opened
  useEffect(() => {
    if (isPanelOpen && !wasPanelOpen.current) {
      console.log("[NotificationPanel] Panel opened, refreshing data");
      refreshNotifications();
      wasPanelOpen.current = true;
    } else if (!isPanelOpen) {
      wasPanelOpen.current = false;
    }
  }, [isPanelOpen, refreshNotifications]);

  // Handle real-time notifications and optimistic UI updates
  useEffect(() => {
    if (!socket) return;

    // Socket.IO event handling for notifications
    const handleNotification = (data: NotificationEvent) => {
      console.log("[NotificationPanel] Received notification via Socket.IO:", data);
      
      // Force mutate when notification is received to ensure UI updates
      mutate();
      
      // Show toast notification
      toast({
        title: data.type?.startsWith("admin_") ? "Admin Action" :
               data.type?.startsWith("employee_") ? "Employee Action" :
               "Notification",
        description: data.message || "You have a new notification.",
        variant: "default",
      });
      
      // If the panel is open, scroll to bottom to show new notification
      if (isPanelOpen && bottomRef.current) {
        setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    };

    // Debug connection status
    console.log("[NotificationPanel] Socket connection status:", { 
      isConnected, 
      socketId: socket?.id,
      isAdmin
    });

    // Register Socket.IO event listener
    socket.on("notification", handleNotification);
    
    // Force refresh on socket connect/reconnect
    socket.on("connect", () => {
      console.log("[NotificationPanel] Socket connected, refreshing data");
      mutate();
    });
    
    // Cleanup function
    return () => {
      socket.off("notification", handleNotification);
      socket.off("connect");
    };
  }, [socket, toast, isPanelOpen, mutate, isAdmin, isConnected]);

  // Refresh notifications periodically
  useEffect(() => {
    if (!isPanelOpen) return;

    const interval = setInterval(() => {
      console.log("[NotificationPanel] Periodic refresh");
      mutate();
    }, 5000); // Refresh every 5 seconds when panel is open

    return () => clearInterval(interval);
  }, [isPanelOpen, mutate]);

  // Handle individual notification mark as read
  const handleMarkAsRead = async (id: number) => {
    try {
      await markAsRead(id);
    } catch (error) {
      console.error("[NotificationPanel] Error marking notification as read:", error);
      toast({
        title: "Error",
        description: "Failed to mark notification as read.",
        variant: "destructive",
      });
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "admin_document_approved":
      case "admin_document_rejected":
      case "admin_registration_approved":
      case "admin_registration_rejected":
        return "📄";
      case "employee_document_uploaded":
        return "📤";
      case "admin_attendance_record_created":
      case "admin_attendance_record_updated":
      case "admin_attendance_record_deleted":
      case "employee_attendance_checkin":
      case "employee_attendance_checkout":
        return "⏰";
      case "profile_update":
        return "👤";
      default:
        return "🔔";
    }
  };

  // Count unread notifications by type
  const unreadAdminActions = notifications?.filter((n: Notification) => !n.read && n.type?.startsWith('admin_')).length || 0;
  const unreadEmployeeActions = notifications?.filter((n: Notification) => !n.read && n.type?.startsWith('employee_')).length || 0;
  const hasUnreadNotifications = unreadCount > 0;

  return (
    <>
      {/* Notification Button */}
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-[290]">
        <Button
          onClick={() => {
            setIsPanelOpen(!isPanelOpen);
            if (!isPanelOpen) {
              refreshNotifications();
            }
          }}
          className={`
          relative h-10 rounded-l-lg rounded-r-none bg-gradient-to-r from-blue-500 to-purple-600 
          hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl
          transition-all duration-300 ease-in-out transform hover:scale-105
          ${isPanelOpen ? "pr-0.5 pl-1" : "pr-1 pl-0.5"}
        `}
          size="sm"
        >
          <div className="flex items-center">
            {isPanelOpen ? (
              <ChevronRight className="h-4 w-4 text-white" />
            ) : (
              <>
                <Bell className={`h-4 w-4 text-white ${unreadCount > 0 ? 'animate-bounce' : ''}`} />
                {unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -left-1 h-4 w-4 rounded-full p-0 flex items-center justify-center text-[10px] animate-bounce"
                  >
                    {unreadCount}
                  </Badge>
                )}
              </>
            )}
          </div>
        </Button>
      </div>

      {/* Connection Status Indicator - Only shows temporarily when needed */}
      {showConnectionStatus && (
        <div className={`fixed bottom-4 right-4 z-[300] flex items-center gap-2 px-3 py-2 rounded-full text-xs ${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} shadow-md transition-all duration-300 transform animate-fade-in`}>
          {isConnected ? (
            <>
              <Wifi className="h-3 w-3" /> Connected
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3" /> Offline
            </>
          )}
        </div>
      )}

      {/* Overlay */}
      {isPanelOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[280] transition-opacity duration-300"
          onClick={() => setIsPanelOpen(false)}
        />
      )}

      {/* Notification Panel */}
      <div
        className={`
          fixed top-0 right-0 h-full w-96 bg-white/95 backdrop-blur-md shadow-2xl z-[300]
          transform transition-transform duration-300 ease-in-out border-l border-gray-200
          ${isPanelOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <h2 className="text-lg font-semibold flex items-center">
                Notifications
                {hasUnreadNotifications && (
                  <Badge variant="destructive" className="ml-2">
                    {unreadCount}
                  </Badge>
                )}
                {!isConnected && (
                  <span className="text-xs ml-2 text-red-500">(Offline)</span>
                )}
              </h2>
              {isAdmin && hasUnreadNotifications && (
                <div className="text-xs text-gray-500 mt-1">
                  {unreadEmployeeActions > 0 && (
                    <span className="mr-3">Employee: {unreadEmployeeActions}</span>
                  )}
                  {unreadAdminActions > 0 && (
                    <span>Admin: {unreadAdminActions}</span>
                  )}
                </div>
              )}
              <div className="text-xs text-gray-400 mt-1">
                Last updated: {formatDistanceToNow(new Date(lastSyncTime), { addSuffix: true })}
              </div>
            </div>
            <div className="flex gap-2">
              {hasUnreadNotifications && (
                <Button
                  onClick={handleMarkAllAsRead}
                  variant="outline"
                  size="sm"
                  title="Mark all as read"
                  className="flex items-center gap-1"
                >
                  <Check className="h-3 w-3" /> All
                </Button>
              )}
              <Button
                onClick={refreshNotifications}
                variant="outline"
                size="sm"
                title="Refresh notifications"
                disabled={isRefreshing}
                className={isRefreshing ? 'animate-spin' : ''}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => setIsPanelOpen(false)}
                variant="ghost"
                size="sm"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto p-4">
            {!notifications || notifications.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <div className="text-5xl mb-2">📭</div>
                <p>No notifications</p>
                <p className="text-xs text-gray-400 mt-2">
                  {isConnected 
                    ? "You're all caught up! New notifications will appear here."
                    : "You're currently offline. Connect to receive real-time notifications."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`
                      p-4 rounded-lg border transition-all duration-200
                      ${notification.read ? "bg-white" : "bg-blue-50"}
                      hover:shadow-md
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <p className="text-sm font-medium">
                            {notification.message}
                          </p>
                          {isAdmin && (
                            <span className="text-xs text-gray-500 px-1.5 py-0.5 bg-gray-100 rounded-full">
                              {notification.type?.startsWith('admin_') 
                                ? 'Admin' 
                                : notification.type?.startsWith('employee_') 
                                  ? 'Employee' 
                                  : 'System'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {notification.createdAt && formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                          <br />
                          {notification.createdAt && new Date(notification.createdAt).toLocaleString()}
                        </p>
                        {notification.actionUrl && (
                          <Link
                            href={notification.actionUrl}
                            className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                          >
                            {notification.actionLabel || "View details"}
                          </Link>
                        )}
                      </div>
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="text-xs hover:bg-blue-100"
                        >
                          Mark as read
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      </div>
    </>
  );
}
