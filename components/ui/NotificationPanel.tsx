"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Bell, X, CheckCircle, AlertTriangle, Info, ChevronRight, FileText, Check, RefreshCw, Wifi, WifiOff, Search, Filter, Calendar, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useNotifications, Notification } from "@/hooks/useNotifications"
import { formatDistanceToNow, format, subDays, startOfToday, startOfYesterday, startOfMonth, endOfMonth, subMonths } from "date-fns"
import { useEmployeeSocket } from "@/hooks/useEmployeeSocket"
import { useSession } from "next-auth/react"
import { useToast } from "@/components/ui/use-toast"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAdminSocket } from "@/hooks/useAdminSocket"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { addDays } from "date-fns"
import { useTranslations } from "next-intl"
import Cookies from "js-cookie"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Define Socket notification event data type for better type safety
interface NotificationEvent extends Notification {
  broadcastTo?: {
    admin?: boolean;
    employee?: boolean;
  };
}

// Helper function to get appropriate icon for notification type
const getNotificationIcon = (type: string | undefined) => {
  if (!type) return <Bell />;
  
  if (type.includes("error") || type.includes("rejected") || type.includes("failed")) {
    return <AlertTriangle className="text-red-500" />;
  } else if (type.includes("success") || type.includes("approved") || type.includes("completed")) {
    return <CheckCircle className="text-green-500" />;
  } else if (type.includes("document") || type.includes("report")) {
    return <FileText className="text-blue-500" />;
  } else if (type.includes("info") || type.includes("update")) {
    return <Info className="text-blue-500" />;
  }
  
  return <Bell className="text-purple-500" />;
};

export default function NotificationPanel() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;
  const [hasMoreNotifications, setHasMoreNotifications] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [groupedNotifications, setGroupedNotifications] = useState<Record<string, Notification[]>>({});
  
  // 🚀 ANALYTICS: Add analytics state
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsTimeRange, setAnalyticsTimeRange] = useState<'day' | 'week' | 'month'>('day');
  
  const {
    notifications,
    unreadCount,
    markAsRead,
    deleteNotification,
    markAllAsRead,
    mutate,
    reset,
    lastSyncTime,
    isValidating,
    loadMore: fetchMoreNotifications,
  } = useNotifications(PAGE_SIZE);
  
  const { data: session } = useSession();
  const isAdmin = session?.user?.isAdmin;
  const { socket: employeeSocket, connected: employeeConnected } = useEmployeeSocket();
  const { socket: adminSocket, connected: adminConnected } = useAdminSocket();
  const socket = isAdmin ? adminSocket : employeeSocket;
  const isConnected = isAdmin ? adminConnected : employeeConnected;
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const wasPanelOpen = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showConnectionStatus, setShowConnectionStatus] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "admin" | "employee" | "system">("all");
  const [readFilter, setReadFilter] = useState<"all" | "read" | "unread">("all");
  const [datePreset, setDatePreset] = useState("all");
  const [customRange, setCustomRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });

  // Get translations based on user's language preference
  const locale = Cookies.get('locale') || 'en';
  const t = useTranslations('Notifications');
  const dashboardT = useTranslations('Dashboard');

  // 🚀 ANALYTICS: Fetch analytics data
  const fetchAnalytics = useCallback(async () => {
    if (!isAdmin) return;
    
    setAnalyticsLoading(true);
    try {
      // Use a mock response for now since the analytics endpoint is not available
      // This prevents the error from appearing in the console
      setAnalyticsData({
        summary: {
          total: 0,
          delivered: 0,
          failed: 0,
          pending: 0,
          retrying: 0,
          deliveryRate: 0,
          failureRate: 0,
          engagementRate: 0,
          averageEngagement: 0,
          timeRange: analyticsTimeRange
        },
        breakdown: {
          byStatus: [],
          byType: [],
          byCategory: []
        },
        issues: {
          topFailedNotifications: []
        },
        trends: []
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast({
        title: "Error",
        description: "Analytics feature temporarily unavailable",
        variant: "destructive",
      });
    } finally {
      setAnalyticsLoading(false);
    }
  }, [isAdmin, analyticsTimeRange, toast]);

  // 🚀 ANALYTICS: Open analytics dialog
  const handleOpenAnalytics = useCallback(() => {
    setShowAnalytics(true);
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Function to translate notification message
  const translateNotification = (message: string): string => {
    if (isAdmin) return message; // Don't translate for admin
    
    // Try to find a direct translation for this notification message
    try {
      // Check if there's a direct translation key that matches this message
      const translationKeys = Object.keys(t.raw());
      for (const key of translationKeys) {
        if (t.raw()[key] === message) {
          return t(key);
        }
      }
      
      // If no direct translation key found, return the original message
      return message;
    } catch (error) {
      console.error("[NotificationPanel] Error translating notification:", error);
      return message; // Fallback to original message
    }
  };

  // Group notifications by date
  const groupNotificationsByDate = useCallback((notificationList: Notification[]) => {
    if (!notificationList?.length) return {};
    
    const byDate: Record<string, Notification[]> = {};
    
    notificationList.forEach(notification => {
      const date = new Date(notification.createdAt);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      let dateGroup;
      if (date.toDateString() === today.toDateString()) {
        dateGroup = "Today";
      } else if (date.toDateString() === yesterday.toDateString()) {
        dateGroup = "Yesterday";
      } else if (date > new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7)) {
        dateGroup = "This Week";
      } else if (date > new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30)) {
        dateGroup = "This Month";
      } else {
        dateGroup = "Older";
      }
      
      if (!byDate[dateGroup]) {
        byDate[dateGroup] = [];
      }
      
      byDate[dateGroup].push(notification);
    });
    
    return byDate;
  }, []);
  
  // Calculate filtered notifications based on search and filters
  const filteredNotifications = useMemo(() => {
    if (!notifications) return [];
    
    return notifications.filter((notification) => {
      // Search filter
      if (searchQuery && !notification.message.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Type filter
      if (typeFilter !== "all") {
        if (typeFilter === "admin" && !notification.type?.startsWith("admin_")) {
          return false;
        }
        if (typeFilter === "employee" && !notification.type?.startsWith("employee_")) {
          return false;
        }
        if (typeFilter === "system" && (notification.type?.startsWith("admin_") || notification.type?.startsWith("employee_"))) {
          return false;
        }
      }
      
      // Read/unread filter
      if (readFilter !== "all") {
        if (readFilter === "read" && !notification.read) {
          return false;
        }
        if (readFilter === "unread" && notification.read) {
          return false;
        }
      }
      
      // Date filter
      if (datePreset !== "all") {
        const notificationDate = new Date(notification.createdAt);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const last7Days = new Date(today);
        last7Days.setDate(last7Days.getDate() - 7);
        
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        
        if (datePreset === "today" && notificationDate < today) {
          return false;
        }
        if (datePreset === "yesterday" && (notificationDate < yesterday || notificationDate >= today)) {
          return false;
        }
        if (datePreset === "last7" && notificationDate < last7Days) {
          return false;
        }
        if (datePreset === "thisMonth" && notificationDate < thisMonthStart) {
          return false;
        }
        if (datePreset === "lastMonth" && (notificationDate < lastMonthStart || notificationDate > lastMonthEnd)) {
          return false;
        }
        if (datePreset === "custom") {
          const from = customRange.from ? new Date(customRange.from) : undefined;
          const to = customRange.to ? new Date(customRange.to) : undefined;
          
          if (from && notificationDate < from) {
            return false;
          }
          
          if (to) {
            const endOfDay = new Date(to);
            endOfDay.setHours(23, 59, 59, 999);
            if (notificationDate > endOfDay) {
              return false;
            }
          }
        }
      }
      
      return true;
    });
  }, [notifications, searchQuery, typeFilter, readFilter, datePreset, customRange]);

  // Calculate unread counts by type
  const unreadEmployeeActions = useMemo(() => {
    if (!notifications) return 0;
    return notifications.filter(n => !n.read && n.type?.startsWith("employee_")).length;
  }, [notifications]);
  
  const unreadAdminActions = useMemo(() => {
    if (!notifications) return 0;
    return notifications.filter(n => !n.read && n.type?.startsWith("admin_")).length;
  }, [notifications]);

  // Update grouped notifications when notifications change
  useEffect(() => {
    if (notifications?.length) {
      const grouped = groupNotificationsByDate(filteredNotifications);
      setGroupedNotifications(grouped);
    } else {
      setGroupedNotifications({});
    }
  }, [filteredNotifications, groupNotificationsByDate]);
  
  // Implement load more functionality
  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMoreNotifications) return;
    
    setIsLoadingMore(true);
    try {
      const hasMore = await fetchMoreNotifications();
      setHasMoreNotifications(hasMore);
      setPage(prev => prev + 1);
    } catch (error) {
      console.error("[NotificationPanel] Error loading more notifications:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMoreNotifications, fetchMoreNotifications]);
  
  // Implement intersection observer for infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !isPanelOpen) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && hasMoreNotifications) {
          handleLoadMore();
        }
      },
      { threshold: 0.5 }
    );
    
    observer.observe(loadMoreRef.current);
    
    return () => {
      observer.disconnect();
    };
  }, [isPanelOpen, isLoadingMore, hasMoreNotifications, handleLoadMore]);

  // Enhanced refresh with visual feedback and counter sync
  const refreshNotifications = useCallback(async () => {
    setIsRefreshing(true);
    setPage(0);
    setHasMoreNotifications(true);
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

  // Improved mark all as read with optimistic UI update
  const handleMarkAllAsRead = async () => {
    try {
      // Optimistically update UI
      const previousCount = unreadCount;
      
      // Mark all notifications as read in the UI first
      setGroupedNotifications(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(group => {
          updated[group] = updated[group].map(n => ({ ...n, read: true }));
        });
        return updated;
      });
      
      // Call API
      await markAllAsRead();
      
      toast({
        title: "All caught up!",
        description: "All notifications have been marked as read.",
        variant: "default",
      });
    } catch (error) {
      console.error("[NotificationPanel] Error marking all as read:", error);
      
      // Revert the UI changes on error
      mutate();
      
      toast({
        title: "Error",
        description: "Failed to mark notifications as read.",
        variant: "destructive",
      });
    }
  };

  // Improved individual mark as read with optimistic UI update
  const handleMarkAsRead = async (id: number) => {
    try {
      // Optimistically update UI
      setGroupedNotifications(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(group => {
          updated[group] = updated[group].map(n => 
            n.id === id ? { ...n, read: true } : n
          );
        });
        return updated;
      });
      
      // Call API
      await markAsRead(id);
    } catch (error) {
      console.error("[NotificationPanel] Error marking notification as read:", error);
      
      // Revert the UI changes on error
      mutate();
      
      toast({
        title: "Error",
        description: "Failed to mark notification as read.",
        variant: "destructive",
      });
    }
  };

  // Handle delete notification
  const handleDeleteNotification = async (id: number) => {
    try {
      await deleteNotification(id);
      toast({
        title: "Success",
        description: "Notification deleted successfully.",
        variant: "default",
      });
    } catch (error) {
      console.error("[NotificationPanel] Error deleting notification:", error);
      toast({
        title: "Error",
        description: "Failed to delete notification.",
        variant: "destructive",
      });
    }
  };

  // Socket notification handler
  useEffect(() => {
    if (socket) {
      const handleSocketNotification = (data: NotificationEvent) => {
        console.log("[NotificationPanel] Received socket notification:", data);
        
        // Show toast notification with translated message for employees
        if (!isAdmin) {
          // Translate the notification message
          const translatedMessage = translateNotification(data.message);
          
          // Show toast with translated message
          toast({
            title: data.type?.startsWith("admin_") ? "Admin Action" :
                  data.type?.startsWith("employee_") ? "Employee Action" :
                  "Notification",
            description: translatedMessage,
            variant: "default",
          });
        } else {
          // For admin, show original message
          toast({
            title: data.type?.startsWith("admin_") ? "Admin Action" :
                  data.type?.startsWith("employee_") ? "Employee Action" :
                  "Notification",
            description: data.message,
            variant: "default",
          });
        }
        
        // Refresh notifications
        mutate();
      };
      
      socket.on("notification", handleSocketNotification);
      
      return () => {
        socket.off("notification", handleSocketNotification);
      };
    }
  }, [socket, isAdmin, toast, mutate, translateNotification]);

  // Render notification content with grouping
  const renderNotificationContent = () => {
    if (isValidating && !notifications?.length) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-500" />
          <p>{dashboardT('loading')}</p>
        </div>
      );
    }
    
    if (!notifications?.length) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
          <Bell className="mb-2 h-12 w-12 opacity-20" />
          <p>{isAdmin ? "No notifications" : "Tidak ada notifikasi"}</p>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col">
        {Object.entries(groupedNotifications).map(([dateGroup, notifs]) => (
          <div key={dateGroup} className="mb-4">
            <h3 className="mb-2 px-4 text-sm font-medium text-muted-foreground">{dateGroup}</h3>
            <div className="divide-y">
              {notifs.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "flex items-start gap-3 p-4 transition-colors hover:bg-muted/30",
                    !notification.read && "bg-muted/40"
                  )}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/50">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("text-sm font-medium", !notification.read && "font-semibold")}>
                        {notification.type?.startsWith("admin_") ? "Admin Action" :
                         notification.type?.startsWith("employee_") ? "Employee Action" :
                         "Notification"}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {isAdmin ? notification.message : translateNotification(notification.message)}
                    </p>
                    {notification.actionUrl && (
                      <div className="pt-1">
                        <Link
                          href={notification.actionUrl}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          onClick={(e) => {
                            // 🚀 PRODUCTION: Handle potential broken links gracefully
                            try {
                              // Validate URL format before navigation
                              const url = new URL(notification.actionUrl!, window.location.origin);
                              if (!url.pathname || url.pathname === '/') {
                                e.preventDefault();
                                toast({
                                  title: "Invalid Link",
                                  description: "This notification link is not properly configured.",
                                  variant: "destructive",
                                });
                                return;
                              }
                              
                              // Mark as read and track click
                              handleMarkAsRead(notification.id);
                            } catch (error) {
                              e.preventDefault();
                              toast({
                                title: "Invalid Link",
                                description: "This notification link is not properly configured.",
                                variant: "destructive",
                              });
                              console.warn(`[NotificationPanel] Invalid actionUrl: ${notification.actionUrl}`, error);
                            }
                          }}
                        >
                          {notification.actionLabel || "View details"}
                          <ChevronRight className="h-3 w-3" />
                        </Link>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!notification.read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => handleMarkAsRead(notification.id)}
                      >
                        <Check className="h-4 w-4" />
                        <span className="sr-only">Mark as read</span>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                      onClick={() => handleDeleteNotification(notification.id)}
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        
        {hasMoreNotifications && (
          <div
            ref={loadMoreRef}
            className="flex items-center justify-center p-4"
          >
            {isLoadingMore ? (
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
            ) : (
              <Button variant="ghost" onClick={handleLoadMore}>
                Load more
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

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
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {unreadCount}
                  </Badge>
                )}
                {!isConnected && (
                  <span className="text-xs ml-2 text-red-500">(Offline)</span>
                )}
              </h2>
              {isAdmin && unreadCount > 0 && (
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
              {/* 🚀 ANALYTICS: Analytics icon for admin */}
              {isAdmin && (
                <Button
                  onClick={handleOpenAnalytics}
                  variant="outline"
                  size="sm"
                  title="View Analytics"
                  className="flex items-center gap-1"
                >
                  <BarChart3 className="h-4 w-4" />
                </Button>
              )}
              {unreadCount > 0 && (
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

          {/* Search and Filters */}
          <div className="p-4 border-b">
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search notifications..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>

              {/* Filter Controls */}
              <div className="flex flex-wrap gap-2">
                {/* Type Filter */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-1">
                      <Filter className="h-4 w-4" />
                      {typeFilter === "all" ? "All Types" :
                        typeFilter === "admin" ? "Admin Actions" :
                        typeFilter === "employee" ? "Employee Actions" : "System"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="z-[9999]">
                    <DropdownMenuItem onClick={() => setTypeFilter("all")}>All Types</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTypeFilter("admin")}>Admin Actions</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTypeFilter("employee")}>Employee Actions</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTypeFilter("system")}>System</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Read/Unread Filter */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" />
                      {readFilter === "all" ? "All" :
                        readFilter === "read" ? "Read" : "Unread"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="z-[9999]">
                    <DropdownMenuItem onClick={() => setReadFilter("all")}>All</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setReadFilter("read")}>Read</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setReadFilter("unread")}>Unread</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Date Filter */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {datePreset === "all" ? "All Dates" :
                        datePreset === "today" ? "Today" :
                        datePreset === "yesterday" ? "Yesterday" :
                        datePreset === "last7" ? "Last 7 Days" :
                        datePreset === "thisMonth" ? "This Month" :
                        datePreset === "lastMonth" ? "Last Month" :
                        datePreset === "custom" ? "Custom Range" : "All Dates"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="z-[9999]">
                    <DropdownMenuItem onClick={() => setDatePreset("all")}>All Dates</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDatePreset("today")}>Today</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDatePreset("yesterday")}>Yesterday</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDatePreset("last7")}>Last 7 Days</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDatePreset("thisMonth")}>This Month</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDatePreset("lastMonth")}>Last Month</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.preventDefault();
                        setDatePreset("custom");
                      }}
                      className="flex justify-center"
                    >
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full justify-start">
                            Custom Range
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            initialFocus
                            mode="range"
                            defaultMonth={customRange.from}
                            selected={{
                              from: customRange.from,
                              to: customRange.to,
                            }}
                            onSelect={(range) => {
                              setCustomRange({
                                from: range?.from,
                                to: range?.to || range?.from,
                              });
                              setDatePreset("custom");
                            }}
                            numberOfMonths={2}
                          />
                        </PopoverContent>
                      </Popover>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Notification Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {renderNotificationContent()}
          </div>
        </div>
      </div>

      {/* 🚀 ANALYTICS: Analytics Dialog */}
      <Dialog open={showAnalytics} onOpenChange={setShowAnalytics}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Notification Analytics
            </DialogTitle>
            <DialogDescription>
              Monitor notification delivery, engagement, and performance metrics
            </DialogDescription>
          </DialogHeader>

          {analyticsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
              <span className="ml-2">Loading analytics...</span>
            </div>
          ) : analyticsData ? (
            <div className="space-y-6">
              {/* Time Range Selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Time Range:</span>
                <Select value={analyticsTimeRange} onValueChange={(value: any) => setAnalyticsTimeRange(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Last 24h</SelectItem>
                    <SelectItem value="week">Last 7 days</SelectItem>
                    <SelectItem value="month">Last 30 days</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={fetchAnalytics} variant="outline" size="sm">
                  Refresh
                </Button>
              </div>

              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Notifications</CardTitle>
                    <Bell className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analyticsData.summary.total.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      {analyticsData.summary.timeRange === 'day' ? 'Last 24 hours' : 
                       analyticsData.summary.timeRange === 'week' ? 'Last 7 days' : 'Last 30 days'}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analyticsData.summary.deliveryRate}%</div>
                    <p className="text-xs text-muted-foreground">
                      {analyticsData.summary.delivered.toLocaleString()} delivered
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Failure Rate</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analyticsData.summary.failureRate}%</div>
                    <p className="text-xs text-muted-foreground">
                      {analyticsData.summary.failed.toLocaleString()} failed
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analyticsData.summary.engagementRate}%</div>
                    <p className="text-xs text-muted-foreground">
                      Avg: {analyticsData.summary.averageEngagement}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Analytics */}
              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="issues">Issues</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Delivery Status Breakdown */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Delivery Status</CardTitle>
                        <CardDescription>Breakdown by delivery status</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {analyticsData.breakdown.byStatus.map((item: any) => (
                            <div key={item.status} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${
                                  item.status === 'delivered' ? 'bg-green-500' :
                                  item.status === 'failed' ? 'bg-red-500' :
                                  item.status === 'pending' ? 'bg-yellow-500' :
                                  'bg-blue-500'
                                }`} />
                                <span className="capitalize">{item.status}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{item.count}</span>
                                <Badge variant="outline">
                                  {item.percentage}%
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Notification Types */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Notification Types</CardTitle>
                        <CardDescription>Most common notification types</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {analyticsData.breakdown.byType.slice(0, 5).map((item: any) => (
                            <div key={item.type} className="flex items-center justify-between">
                              <span className="text-sm">{item.type}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{item.count}</span>
                                <Badge variant="outline">
                                  {item.percentage}%
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="issues" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Failed Notifications</CardTitle>
                      <CardDescription>Top failed notifications with error details</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {analyticsData.issues.topFailedNotifications.map((notification: any) => (
                          <div key={notification.id} className="border rounded-lg p-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="destructive">{notification.type}</Badge>
                                  <span className="text-sm text-muted-foreground">
                                    {new Date(notification.createdAt).toLocaleString()}
                                  </span>
                                </div>
                                <p className="text-sm font-medium">{notification.message}</p>
                                <p className="text-xs text-red-600">{notification.errorMessage}</p>
                                <p className="text-xs text-muted-foreground">
                                  Recipient: {notification.recipient} | 
                                  Attempts: {notification.deliveryAttempts}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                        {analyticsData.issues.topFailedNotifications.length === 0 && (
                          <div className="text-center py-8">
                            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                            <p className="text-muted-foreground">No failed notifications in this time range</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <p className="text-muted-foreground">No analytics data available</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
