import useSWR from 'swr';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAdminSocket } from './useAdminSocket';
import { useEmployeeSocket } from './useEmployeeSocket';
import { useSession } from 'next-auth/react';

// Define a notification type for better type safety
export interface Notification {
  id: number;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
  actionLabel?: string;
  userId?: string;
  employeeId?: number;
}

// Add a caching parameter to reduce network requests
const fetcher = (url: string) => 
  fetch(url, {
    // Use cache: 'no-cache' for the most critical requests
    // otherwise allow the browser to use its HTTP cache
    cache: url.includes('unread-count') ? 'no-cache' : 'default',
  }).then(res => {
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
  });

export function useNotifications(pageSize = 20) {
  const [page, setPage] = useState(0);
  const [accumulated, setAccumulated] = useState<Notification[]>([]);
  const prevPage = useRef(0);
  const isMounted = useRef(true);
  const lastSyncTime = useRef<Date>(new Date());
  const { data: session } = useSession();
  const isAdmin = session?.user?.isAdmin;
  const { socket: adminSocket } = useAdminSocket();
  const { socket: employeeSocket } = useEmployeeSocket();
  const socket = isAdmin ? adminSocket : employeeSocket;

  // Add dedicated config to allow stale data while revalidating
  // This reduces the number of network requests while ensuring fresh data
  const { data, mutate, isValidating } = useSWR(
    `/api/notifications?skip=${page * pageSize}&take=${pageSize}`,
    fetcher,
    {
      revalidateOnFocus: false, // Don't revalidate when window regains focus
      revalidateIfStale: true,  // Do revalidate if data is stale
      revalidateOnReconnect: true, // Revalidate if the user reconnects
      dedupingInterval: 2000, // Deduplicate requests within 2 seconds
      refreshInterval: 5000, // Refresh every 5 seconds to ensure sync
    }
  );
  
  const { data: unreadData, mutate: mutateUnread } = useSWR(
    '/api/notifications/unread-count',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 2000,
      refreshInterval: 5000, // Refresh unread count every 5 seconds
    }
  );

  // Optimistic update for real-time notifications
  const addNotificationOptimistically = useCallback((notification: Notification) => {
    if (!isMounted.current) return;

    // Update the accumulated state with the new notification
    setAccumulated(prev => {
      // Check if notification already exists to prevent duplicates
      const exists = prev.some(n => n.id === notification.id);
      if (exists) return prev;
      
      // Add new notification at the beginning (most recent)
      return [notification, ...prev];
    });
    
    // Update unread count
    mutateUnread();
    
    // Record the sync time
    lastSyncTime.current = new Date();
  }, [mutateUnread]);

  // Listen for real-time notifications
  useEffect(() => {
    if (!socket) return;

    const handleNotification = (notification: Notification) => {
      console.log("[useNotifications] Received real-time notification:", notification);
      
      // Force refresh both notifications and unread count
      mutate();
      mutateUnread();
      
      // Update accumulated state
      addNotificationOptimistically(notification);
    };

    socket.on("notification", handleNotification);

    return () => {
      socket.off("notification", handleNotification);
    };
  }, [socket, mutate, mutateUnread, addNotificationOptimistically]);

  // When component unmounts, set isMounted to false
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // When page is reset to 0, clear accumulated notifications
  useEffect(() => {
    if (page === 0) setAccumulated([]);
  }, [page]);

  // When new data arrives for a new page, accumulate
  useEffect(() => {
    if (!isMounted.current) return;
    
    // Check if data is an array (direct response from API)
    if (Array.isArray(data)) {
      if (page === 0) {
        setAccumulated(data);
      } else if (page !== prevPage.current) {
        setAccumulated((prev) => [...prev, ...data]);
      }
    } 
    // Handle nested format if API changes in future
    else if (data?.notifications) {
      if (page === 0) {
        setAccumulated(data.notifications);
      } else if (page !== prevPage.current) {
        setAccumulated((prev) => [...prev, ...data.notifications]);
      }
    }
    prevPage.current = page;
  }, [data, page]);

  // Get total count from data or default to accumulated length
  const totalCount = Array.isArray(data) 
    ? data.length 
    : (data?.totalCount || accumulated.length);
    
  const hasMore = accumulated.length < totalCount;

  // Optimistic update for marking as read
  const markAsRead = async (id: number) => {
    // Optimistically update the UI first
    setAccumulated(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, read: true } 
          : notification
      )
    );
    
    try {
      // Then send the API request
      await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
      
      // Update data from the server
      mutate();
      mutateUnread();
    } catch (error) {
      console.error("[useNotifications] Error marking notification as read:", error);
      
      // If there's an error, revert the optimistic update
      mutate();
    }
  };

  // Optimistic update for deleting notification
  const deleteNotification = async (id: number) => {
    // Optimistically update the UI first
    setAccumulated(prev => prev.filter(notification => notification.id !== id));
    
    try {
      // Then send the API request
      await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
      
      // Update data from the server
      mutate();
      mutateUnread();
    } catch (error) {
      console.error("[useNotifications] Error deleting notification:", error);
      
      // If there's an error, revert the optimistic update
      mutate();
    }
  };

  // Optimistic update for marking all as read
  const markAllAsRead = async () => {
    // Optimistically update the UI first
    setAccumulated(prev => prev.map(notification => ({ ...notification, read: true })));
    
    try {
      // Then send the API request
      await fetch('/api/notifications/mark-all-read', { method: 'PUT' });
      
      // Reset page and update from server
      setPage(0);
      mutate();
      mutateUnread();
    } catch (error) {
      console.error("[useNotifications] Error marking all notifications as read:", error);
      
      // If there's an error, revert the optimistic update
      mutate();
    }
  };

  const loadMore = async () => {
    if (hasMore && !isValidating) {
      const nextPage = page + 1;
      setPage(nextPage);
      
      try {
        // Manually fetch the next page
        const response = await fetch(`/api/notifications?skip=${nextPage * pageSize}&take=${pageSize}`);
        if (!response.ok) throw new Error('Failed to fetch more notifications');
        
        const newData = await response.json();
        const newNotifications = Array.isArray(newData) ? newData : newData?.notifications || [];
        
        // Update accumulated with new data
        setAccumulated(prev => [...prev, ...newNotifications]);
        
        // Return true if there are more pages to load
        return newNotifications.length === pageSize;
      } catch (error) {
        console.error("[useNotifications] Error loading more notifications:", error);
        return false;
      }
    }
    return false;
  };

  const reset = () => {
    setPage(0);
    mutate();
    mutateUnread();
    lastSyncTime.current = new Date();
  };

  return {
    notifications: accumulated,
    unreadCount: unreadData?.count || 0,
    markAsRead,
    deleteNotification,
    markAllAsRead,
    loadMore,
    hasMore,
    page,
    isValidating,
    mutate,
    reset,
    lastSyncTime: lastSyncTime.current,
  };
} 