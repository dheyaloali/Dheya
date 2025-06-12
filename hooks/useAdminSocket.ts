import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Cookies from "js-cookie";
import { useToast } from "@/components/ui/use-toast";
import useSWR from "swr";
import { io, Socket } from "socket.io-client";

// Global socket instance to persist between page navigations
let globalSocket: Socket | null = null;
let connectedGlobally = false;
let lastConnectAttempt = 0;

// Add listener for beforeunload to capture connection state between navigations
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    connectedGlobally = globalSocket?.connected || false;
    console.log("[AdminSocket] Saving connection state before unload:", connectedGlobally);
  });
  
  // Add a global function to synchronize connection state
  // @ts-ignore - Adding custom property to window
  window.syncAdminSocketState = (connected) => {
    console.log("[AdminSocket] Manual sync of connection state:", connected);
    connectedGlobally = connected;
  };
}

export function useAdminSocket() {
  const { data: session, status } = useSession();
  const [socket, setSocket] = useState<Socket | null>(globalSocket);
  const [connected, setConnected] = useState(connectedGlobally);
  const socketRef = useRef<Socket | null>(globalSocket);
  const { toast } = useToast();
  const hasShownErrorRef = useRef(false);
  const hasShownDisabledToastRef = useRef(false);
  const { data: settings, mutate } = useSWR("/api/admin/settings", url => fetch(url).then(r => r.json()));
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 10; // Increased from 5
  
  // Derived state that represents whether we SHOULD be connected based on settings
  const shouldBeConnected = status === "authenticated" && 
                          session?.user?.isAdmin && 
                          settings?.adminRealtimeEnabled === true;

  // Force connection state to align with settings (critical for source of truth)
  useEffect(() => {
    console.log("[AdminSocket] Settings changed, updating connection state:", { 
      shouldBeConnected, 
      adminRealtimeEnabled: settings?.adminRealtimeEnabled
    });
    
    // IMMEDIATELY force connection state to match settings (source of truth)
    if (shouldBeConnected) {
      // Ensure we have a socket and it's connected
      if (!socket) {
        // Create socket immediately if it doesn't exist
        console.log("[AdminSocket] Creating socket and connecting immediately");
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || (
          typeof window !== 'undefined' 
            ? `${window.location.protocol}//${window.location.hostname}:3001`
            : 'http://localhost:3001'
        );
        
        const token = Cookies.get("next-auth.session-token") || 
          Object.entries(Cookies.get())
            .find(([key]) => key.startsWith("next-auth.session-token"))?.[1];
            
        if (token && session?.user?.id) {
          globalSocket = io(wsUrl, {
            auth: {
              userId: session.user.id,
              sessionToken: token,
              isAdmin: true
            },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 500,
            reconnectionDelayMax: 2000,
            timeout: 10000,
            forceNew: true,
          });
          
          socketRef.current = globalSocket;
          setSocket(globalSocket);
          
          // Setup listeners immediately
          globalSocket.on("connect", () => {
            console.log("[AdminSocket] Connected to Socket.IO server");
            setConnected(true);
            connectedGlobally = true;
            hasShownErrorRef.current = false;
            reconnectAttemptsRef.current = 0;
            
            // Dispatch event to notify other components
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('admin-socket-connected'));
            }
          });
          
          globalSocket.on("disconnect", (reason) => {
            console.log("[AdminSocket] Disconnected from Socket.IO server:", reason);
            setConnected(false);
            connectedGlobally = false;
            
            // Dispatch event to notify other components
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('admin-socket-disconnected'));
            }
          });
          
          // Connect immediately
          globalSocket.connect();
        }
      } else if (!socket.connected) {
        // Connect existing socket
        console.log("[AdminSocket] Connecting existing socket immediately");
        socket.connect();
      }
    } else {
      // We should NOT be connected according to settings
      if (socket && socket.connected) {
        console.log("[AdminSocket] Settings indicate we should disconnect - disconnecting immediately");
        socket.disconnect();
      }
      
      // Always update state to match settings
      if (connected) {
        setConnected(false);
        connectedGlobally = false;
      }
    }
  }, [settings?.adminRealtimeEnabled, status, session, socket, connected, shouldBeConnected]);

  console.log("[AdminSocket] Hook called. Status:", status, "Session:", session);

  useEffect(() => {
    console.log("[AdminSocket] useEffect running. Status:", status, "isAdmin:", session?.user?.isAdmin, "adminRealtimeEnabled:", settings?.adminRealtimeEnabled);

    // Show explicit toast if real-time is disabled by settings
    if (
      status === "authenticated" &&
      session?.user?.isAdmin &&
      settings?.adminRealtimeEnabled === false &&
      !hasShownDisabledToastRef.current
    ) {
      toast({
        title: "Real-time notifications disabled",
        description: "Real-time notifications are disabled by admin settings. You will not receive live updates.",
        variant: "destructive",
      });
      hasShownDisabledToastRef.current = true;
    } else if (settings?.adminRealtimeEnabled !== false) {
      hasShownDisabledToastRef.current = false;
    }
  }, [status, session, settings?.adminRealtimeEnabled, toast]);

  useEffect(() => {
    console.log("[AdminSocket] useEffect running. Status:", status, "isAdmin:", session?.user?.isAdmin, "adminRealtimeEnabled:", settings?.adminRealtimeEnabled);

    if (status !== "authenticated" || !session?.user?.isAdmin || settings?.adminRealtimeEnabled === false) {
      console.log("[AdminSocket] Not connecting. Status:", status, "isAdmin:", session?.user?.isAdmin, "adminRealtimeEnabled:", settings?.adminRealtimeEnabled);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        globalSocket = null;
        setSocket(null);
        setConnected(false);
        connectedGlobally = false;
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
      console.error("[AdminSocket] No session token found");
      setSocket(null);
      setConnected(false);
      return;
    }

    // Better connection check: check globalSocket exists AND is connected AND has proper event listeners
    // This helps after page navigation when socket might exist but be in a bad state
    const isSocketHealthy = globalSocket && 
                          globalSocket.connected && 
                          !globalSocket.disconnected;

    if (isSocketHealthy) {
      console.log("[AdminSocket] Reusing existing healthy socket connection");
      socketRef.current = globalSocket;
      setSocket(globalSocket);
      setConnected(true);
      connectedGlobally = true;
      return;
    }

    // If we get here, either no socket exists or it's in a bad state after navigation
    // Disconnect and clean up any existing socket before creating a new one
    if (globalSocket) {
      console.log("[AdminSocket] Existing socket found but not healthy, reconnecting...");
      try {
        globalSocket.disconnect();
      } catch (e) {
        console.error("[AdminSocket] Error disconnecting socket:", e);
      }
    }

    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    // Construct Socket.IO URL with proper protocol handling
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || (
      typeof window !== 'undefined' 
        ? `${window.location.protocol}//${window.location.hostname}:3001`
        : 'http://localhost:3001'
    );
    console.log("[AdminSocket] Using WebSocket URL:", wsUrl);

    // Reset reconnect attempts if we're making a fresh connection
    if (!socketRef.current) {
      reconnectAttemptsRef.current = 0;
    }

    try {
      console.log("[AdminSocket] Attempting to connect...");
      console.log("[AdminSocket] Auth data:", {
        userId: session?.user?.id,
        isAdmin: true
      });
      
      // Don't create a new socket if we already have one
      if (!globalSocket) {
        globalSocket = io(wsUrl, {
          auth: {
            userId: session?.user?.id,
            sessionToken: token,
            isAdmin: true
          },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 20000,
          forceNew: true,
          upgrade: true,
          rememberUpgrade: true
        });
        
        socketRef.current = globalSocket;
        setSocket(globalSocket);
      }

      // Handle successful connection
      globalSocket.on("connected", (data) => {
        console.log("[AdminSocket] Successfully connected:", data);
        setConnected(true);
        connectedGlobally = true;
        hasShownErrorRef.current = false;
        reconnectAttemptsRef.current = 0;

        // Emit a special event for any listeners
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('admin-socket-connected'));
        }

        toast({
          title: "Connected to real-time server",
          description: "You are now receiving live updates.",
          variant: "default",
        });
      });

      // Handle connection errors
      globalSocket.on("connect_error", (error) => {
        console.error("[AdminSocket] Connection error:", {
          error,
          url: wsUrl,
          timestamp: new Date().toISOString(),
          protocol: window.location.protocol,
          host: window.location.hostname
        });
        
        setConnected(false);
        connectedGlobally = false;
        
        if (!hasShownErrorRef.current) {
          toast({
            title: "Connection failed",
            description: error.message || "Failed to connect to real-time server. Retrying...",
            variant: "destructive",
          });
          hasShownErrorRef.current = true;
        }
      });

      // Handle authentication errors
      globalSocket.on("error", (error) => {
        console.error("[AdminSocket] Server error:", error);
        
        if (error.message?.includes("Authentication failed")) {
          // Handle authentication failure
          toast({
            title: "Authentication failed",
            description: "Your session has expired. Please refresh the page.",
            variant: "destructive",
          });
          
          // Disconnect and clear socket
          if (globalSocket) {
            globalSocket.disconnect();
            globalSocket = null;
            socketRef.current = null;
            setSocket(null);
          }
          
          // Force page refresh after a delay
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else {
          // Handle other errors
          toast({
            title: "Server Error",
            description: error.message || "An error occurred",
            variant: "destructive",
          });
        }
      });

      // Handle disconnection
      globalSocket.on("disconnect", (reason) => {
        console.log("[AdminSocket] Disconnected from Socket.IO server:", reason);
        setConnected(false);
        connectedGlobally = false;
        
        // Emit a special event for any listeners
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('admin-socket-disconnected'));
        }
        
        if (!hasShownErrorRef.current) {
          toast({
            title: "Disconnected from real-time server",
            description: "Switched to fallback mode. Data may be delayed.",
            variant: "destructive",
          });
          hasShownErrorRef.current = true;
        }
      });

      globalSocket.on("notification", (data) => {
        console.log("[AdminSocket] Received notification:", data);
        
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
        // Don't disconnect on unmount, keep the socket alive
        // Only remove our local event listeners
        if (globalSocket) {
          // Don't disconnect, just remove listeners for this component
          // Keep the socket connection alive for future page navigations
        }
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
      };
    } catch (error) {
      console.error("[AdminSocket] Error creating socket:", error);
      setConnected(false);
      connectedGlobally = false;
    }
  }, [status, session, settings?.adminRealtimeEnabled, toast, mutate]);

  // Clean, focused API
  const connect = () => {
    console.log("[AdminSocket] Manually connecting socket");
    
    // Only connect the socket if it exists
    if (globalSocket) {
      globalSocket.connect();
    }
  };

  const disconnect = () => {
    console.log("[AdminSocket] Manually disconnecting socket");
    
    // Only disconnect the socket if it exists
    if (globalSocket) {
      globalSocket.disconnect();
    }
  };

  return { socket, connected, connect, disconnect };
} 