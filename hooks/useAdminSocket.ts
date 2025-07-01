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
let heartbeatInterval: NodeJS.Timeout | null = null;
let reconnectThrottleTimeout: NodeJS.Timeout | null = null;

// Add listener for beforeunload to capture connection state between navigations
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    connectedGlobally = globalSocket?.connected || false;
    // Clear any intervals/timeouts when page unloads
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (reconnectThrottleTimeout) clearTimeout(reconnectThrottleTimeout);
  });
  
  // Add a global function to synchronize connection state
  // @ts-ignore - Adding custom property to window
  window.syncAdminSocketState = (connected: boolean) => {
    connectedGlobally = connected;
    
    // Dispatch a custom event that other components can listen to
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('admin-socket-state-changed', { 
        detail: { connected } 
      }));
    }
  };
}

// Connection throttling to prevent rapid reconnection attempts
const THROTTLE_RECONNECT_MS = 5000; // 5 seconds minimum between connection attempts
const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds between heartbeats

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
    // IMMEDIATELY force connection state to match settings (source of truth)
    if (shouldBeConnected) {
      // Ensure we have a socket and it's connected
      if (!socket) {
        // Create socket immediately if it doesn't exist
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || (
          typeof window !== 'undefined' 
            ? `${window.location.protocol}//${window.location.hostname}:3001`
            : 'http://localhost:3001'
        );
        
        const token = Cookies.get("next-auth.session-token") || 
          Object.entries(Cookies.get())
            .find(([key]) => key.startsWith("next-auth.session-token"))?.[1];
            
        if (token && session?.user?.id) {
          // Throttle connection attempts
          const now = Date.now();
          if (now - lastConnectAttempt < THROTTLE_RECONNECT_MS) {
            // If we've tried to connect recently, wait before trying again
            if (!reconnectThrottleTimeout) {
              reconnectThrottleTimeout = setTimeout(() => {
                reconnectThrottleTimeout = null;
                lastConnectAttempt = Date.now();
                initializeSocket(token, session.user.id);
              }, THROTTLE_RECONNECT_MS - (now - lastConnectAttempt));
            }
            return;
          }
          
          lastConnectAttempt = now;
          initializeSocket(token, session.user.id);
        }
      } else if (!socket.connected) {
        // Connect existing socket
        socket.connect();
      }
    } else {
      // We should NOT be connected according to settings
      if (socket && socket.connected) {
        socket.disconnect();
      }
      
      // Always update state to match settings
      if (connected) {
        setConnected(false);
        connectedGlobally = false;
      }
    }
    
    function initializeSocket(token: string, userId: string) {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || (
        typeof window !== 'undefined' 
          ? `${window.location.protocol}//${window.location.hostname}:3001`
          : 'http://localhost:3001'
      );
      
          globalSocket = io(wsUrl, {
            auth: {
          userId: userId,
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
            setConnected(true);
            connectedGlobally = true;
            hasShownErrorRef.current = false;
            reconnectAttemptsRef.current = 0;
        
        // Update global state
        window.syncAdminSocketState(true);
            
            // Dispatch event to notify other components
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('admin-socket-connected'));
            }
        
        // Start heartbeat to keep connection alive
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(() => {
          if (globalSocket && globalSocket.connected) {
            globalSocket.emit('heartbeat', { timestamp: Date.now() });
          }
        }, HEARTBEAT_INTERVAL_MS);
      });
      
      // Add heartbeat response handler
      globalSocket.on("heartbeat_ack", (data) => {
        // Connection is confirmed alive, ensure UI shows connected
        if (!connectedGlobally) {
          setConnected(true);
          connectedGlobally = true;
          window.syncAdminSocketState(true);
            }
          });
          
          globalSocket.on("disconnect", (reason) => {
            setConnected(false);
            connectedGlobally = false;
        
        // Update global state
        window.syncAdminSocketState(false);
        
        // Clear heartbeat on disconnect
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
            
            // Dispatch event to notify other components
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('admin-socket-disconnected'));
            }
          });
          
          // Connect immediately
          globalSocket.connect();
    }
  }, [settings?.adminRealtimeEnabled, status, session, socket, connected, shouldBeConnected]);

  useEffect(() => {
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
    if (status !== "authenticated" || !session?.user?.isAdmin || settings?.adminRealtimeEnabled === false) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        globalSocket = null;
        setSocket(null);
        setConnected(false);
        connectedGlobally = false;
        
        // Clear any intervals
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
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
      socketRef.current = globalSocket;
      setSocket(globalSocket);
      setConnected(true);
      connectedGlobally = true;
      return;
    }

    // If we get here, either no socket exists or it's in a bad state after navigation
    // Disconnect and clean up any existing socket before creating a new one
    if (globalSocket) {
      try {
        globalSocket.disconnect();
      } catch (e) {
        // Error disconnecting socket - silent fail
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

    // Reset reconnect attempts if we're making a fresh connection
    if (!socketRef.current) {
      reconnectAttemptsRef.current = 0;
    }

    // Throttle connection attempts
    const now = Date.now();
    if (now - lastConnectAttempt < THROTTLE_RECONNECT_MS) {
      // If we've tried to connect recently, wait before trying again
      if (!reconnectThrottleTimeout) {
        reconnectThrottleTimeout = setTimeout(() => {
          reconnectThrottleTimeout = null;
          lastConnectAttempt = Date.now();
          initializeSocket();
        }, THROTTLE_RECONNECT_MS - (now - lastConnectAttempt));
      }
      return;
    }
    
    lastConnectAttempt = now;
    initializeSocket();

    function initializeSocket() {
      try {
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
            reconnectionDelay: 500,
            reconnectionDelayMax: 2000,
            timeout: 10000,
          forceNew: true,
        });
        
        socketRef.current = globalSocket;
        setSocket(globalSocket);

          // Setup listeners immediately
          globalSocket.on("connect", () => {
        setConnected(true);
        connectedGlobally = true;
        hasShownErrorRef.current = false;
        reconnectAttemptsRef.current = 0;

            // Start heartbeat to keep connection alive
            if (heartbeatInterval) {
              clearInterval(heartbeatInterval);
            }
            heartbeatInterval = setInterval(() => {
              if (globalSocket && globalSocket.connected) {
                globalSocket.emit('heartbeat', { timestamp: Date.now() });
              }
            }, HEARTBEAT_INTERVAL_MS);
            
            // Dispatch event to notify other components
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('admin-socket-connected'));
        }
      });

      globalSocket.on("connect_error", (error) => {
        setConnected(false);
        connectedGlobally = false;
        
            // Only show error once
        if (!hasShownErrorRef.current) {
          toast({
                title: "Connection Error",
                description: "Failed to connect to real-time server. Some features may be limited.",
            variant: "destructive",
          });
          hasShownErrorRef.current = true;
        }

            // Increment reconnect attempts
            reconnectAttemptsRef.current++;
        
            // If we've exceeded max reconnect attempts, stop trying
            if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          toast({
                title: "Connection Failed",
                description: "Maximum reconnection attempts reached. Please refresh the page.",
            variant: "destructive",
          });
              return;
            }
          
            // Exponential backoff for reconnect
            const delay = Math.min(1000 * (2 ** reconnectAttemptsRef.current), 30000);
            reconnectTimeoutRef.current = setTimeout(() => {
          if (globalSocket) {
                globalSocket.connect();
              }
            }, delay);
          });
          
          globalSocket.on("error", (error) => {
          toast({
            title: "Server Error",
              description: "An error occurred with the real-time connection.",
            variant: "destructive",
          });
      });

      globalSocket.on("disconnect", (reason) => {
        setConnected(false);
        connectedGlobally = false;
        
            // Clear heartbeat on disconnect
            if (heartbeatInterval) {
              clearInterval(heartbeatInterval);
              heartbeatInterval = null;
            }
            
            // Only show disconnect toast for unexpected disconnects
            if (reason !== "io client disconnect" && reason !== "io server disconnect") {
          toast({
                title: "Disconnected",
                description: "Lost connection to real-time server. Attempting to reconnect...",
                variant: "default",
          });
            }
            
            // Dispatch event to notify other components
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('admin-socket-disconnected', { 
                detail: { reason } 
              }));
        }
      });

      globalSocket.on("notification", (data) => {
        toast({
              title: data.title || "Notification",
          description: data.message,
              variant: data.type === "error" ? "destructive" : "default",
        });
      });

          // Add heartbeat response handler
          globalSocket.on("heartbeat_ack", (data) => {
            // Connection is confirmed alive, could update UI or log if needed
            console.debug("WebSocket heartbeat acknowledged", data);
          });
          
          // Connect immediately
          globalSocket.connect();
        } else {
          // If we already have a socket but it's disconnected, reconnect
          if (!globalSocket.connected) {
            globalSocket.connect();
          }
        }
      } catch (error) {
        // Fail silently but show toast
        toast({
          title: "Connection Error",
          description: "Failed to initialize real-time connection.",
          variant: "destructive",
        });
      }
    }
    
    return () => {
      // Clear any reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
      
      // Clear heartbeat interval
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
    };
  }, [status, session, settings?.adminRealtimeEnabled, toast]);

  const connect = () => {
    if (socket && !socket.connected) {
      // Throttle connection attempts
      const now = Date.now();
      if (now - lastConnectAttempt < THROTTLE_RECONNECT_MS) {
        return; // Prevent rapid connection attempts
      }
      lastConnectAttempt = now;
      socket.connect();
    }
    
    // Also update settings via API
    fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminRealtimeEnabled: true })
    }).then(() => mutate());
  };

  const disconnect = () => {
    if (socket && socket.connected) {
      socket.disconnect();
      
      // Clear heartbeat on manual disconnect
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
    }
    
    // Also update settings via API
    fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminRealtimeEnabled: false })
    }).then(() => mutate());
  };

  return { socket, connected, connect, disconnect };
} 