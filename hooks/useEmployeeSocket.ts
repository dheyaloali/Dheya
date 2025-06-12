import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Cookies from "js-cookie";
import { useToast } from "@/components/ui/use-toast";
import useSWR from "swr";
import { io, Socket } from "socket.io-client";

export function useEmployeeSocket() {
  const { data: session, status } = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const { toast } = useToast();
  const hasShownErrorRef = useRef(false);
  const hasShownDisabledToastRef = useRef(false);
  const { data: settings, mutate } = useSWR("/api/admin/settings", url => fetch(url).then(r => r.json()));
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;

  useEffect(() => {
    // Show explicit toast if real-time is disabled by settings
    if (
      status === "authenticated" &&
      !session?.user?.isAdmin &&
      settings?.employeeRealtimeEnabled === false &&
      !hasShownDisabledToastRef.current
    ) {
      toast({
        title: "Real-time notifications disabled",
        description: "Real-time notifications are disabled by admin settings. You will not receive live updates.",
        variant: "destructive",
      });
      hasShownDisabledToastRef.current = true;
    } else if (settings?.employeeRealtimeEnabled !== false) {
      hasShownDisabledToastRef.current = false;
    }
  }, [status, session, settings?.employeeRealtimeEnabled, toast]);

  useEffect(() => {
    // Only connect if authenticated, user is not admin, and real-time is enabled
    if (
      status !== "authenticated" ||
      session?.user?.isAdmin ||
      settings?.employeeRealtimeEnabled === false ||
      !session?.user?.id
    ) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    // Get session token
    let token = Cookies.get("next-auth.session-token");
    if (!token) {
      const allCookies = Cookies.get();
      token = Object.entries(allCookies)
        .find(([key]) => key.startsWith("next-auth.session-token"))?.[1];
    }

    if (!token) {
      console.error("[EmployeeSocket] No session token found");
      setSocket(null);
      setConnected(false);
      return;
    }

    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    // Construct Socket.IO URL
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || `http://${window.location.hostname}:3001`;
    console.log("[EmployeeSocket] Using WebSocket URL:", wsUrl);

    // Reset reconnect attempts if we're making a fresh connection
    if (!socketRef.current) {
      reconnectAttemptsRef.current = 0;
    }

    try {
      console.log("[EmployeeSocket] Attempting to connect...");
      
      // Create Socket.IO client
      const socket = io(wsUrl, {
        auth: {
          userId: session?.user?.id,
          sessionToken: token,
          isAdmin: false
        },
        transports: ['websocket', 'polling'],
        reconnection: true, // Enable automatic reconnection
        reconnectionAttempts: 10, // Try up to 10 times
        reconnectionDelay: 1000, // Start with 1s delay
        reconnectionDelayMax: 10000, // Max 10s delay
        timeout: 60000,
        forceNew: true
      });
      
      socketRef.current = socket;
      setSocket(socket);

      socket.on("connect", () => {
        console.log("[EmployeeSocket] Connected to Socket.IO server");
        setConnected(true);
        hasShownErrorRef.current = false;
        reconnectAttemptsRef.current = 0;

        toast({
          title: "Connected to real-time server",
          description: "You are now receiving live updates.",
          variant: "default",
        });
      });

      socket.on("disconnect", (reason) => {
        console.log("[EmployeeSocket] Disconnected from Socket.IO server:", reason);
        setConnected(false);
        
        if (!hasShownErrorRef.current) {
          toast({
            title: "Disconnected from real-time server",
            description: "Switched to fallback mode. Data may be delayed.",
            variant: "destructive",
          });
          hasShownErrorRef.current = true;
        }
      });

      socket.on("connect_error", (error) => {
        console.error("[EmployeeSocket] Connection error:", {
          error,
          url: wsUrl,
          timestamp: new Date().toISOString(),
          protocol: window.location.protocol,
          host: window.location.hostname
        });
        setConnected(false);
        if (!hasShownErrorRef.current) {
          toast({
            title: "Real-time server unavailable",
            description: "Switched to fallback mode. Data may be delayed.",
            variant: "destructive",
          });
          hasShownErrorRef.current = true;
        }
      });

      socket.on("error", (error) => {
        console.error("[EmployeeSocket] Server error:", error);
        toast({
          title: "Server Error",
          description: error.message || "An error occurred",
          variant: "destructive",
        });
      });

      // Add notification event listener
      socket.on("notification", (data) => {
        console.log("[EmployeeSocket] Received notification:", data);
        
        // Show toast notification
        toast({
          title: data.type.startsWith("admin_") ? "Admin Action" :
                data.type.startsWith("employee_") ? "Employee Action" :
                "Notification",
          description: data.message,
          variant: "default",
        });
      });

      return () => {
        if (socket.connected) {
          console.log("[EmployeeSocket] Cleaning up connection");
          socket.disconnect();
        }
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
      };
    } catch (error) {
      console.error("[EmployeeSocket] Error creating socket:", error);
      setConnected(false);
    }
  }, [session, status, settings?.employeeRealtimeEnabled, toast]);

  // Add connect/disconnect functions
  const connect = () => {
    if (socketRef.current) {
      socketRef.current.connect();
    }
  };

  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  };

  return { socket, connected, connect, disconnect };
} 