import { useEffect, useRef } from "react";
import { useAdminSocket } from "./useAdminSocket";
import { useEmployeeStore } from "./useEmployeeStore";

export function useAdminSocketEvents(normalizeEmployees?: (data: any[]) => any[]) {
  const { socket, connected } = useAdminSocket();
  const setEmployees = useEmployeeStore((s) => s.setEmployees);
  const updateEmployee = useEmployeeStore((s) => s.updateEmployee);
  const setOnline = useEmployeeStore((s) => s.setOnline);
  const addNotification = useEmployeeStore((s) => s.addNotification);
  const setConnected = useEmployeeStore((s) => s.setConnected);
  
  // Add refs to track last update timestamps to prevent duplicate processing
  const lastUpdateRef = useRef<Record<string, number>>({
    employees: 0,
    locationUpdate: 0,
    employeeOnline: {},
    employeeOffline: {},
  });

  // Immediately update the store's connection state whenever useAdminSocket's connected state changes
  useEffect(() => {
    console.log("[AdminSocketEvents] Admin socket connection state changed:", connected);
    setConnected(connected);
    
    // Dispatch a custom event that other components can listen to
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('admin-socket-state-changed', { 
        detail: { connected } 
      }));
    }
  }, [connected, setConnected]);

  useEffect(() => {
    if (!socket) return;

    // Set initial state based on current socket state
    if (socket.connected !== undefined) {
      setConnected(socket.connected);
    }

    socket.emit("get-employees");

    // Employees event handler
    socket.on("employees", (data) => {
      // Prevent duplicate processing within 500ms
      const now = Date.now();
      if (now - lastUpdateRef.current.employees < 500) {
        console.log("[Socket] Ignoring duplicate employees event");
        return;
      }
      lastUpdateRef.current.employees = now;
      
      if (normalizeEmployees) {
        const normalized = normalizeEmployees(data);
        console.log("[Realtime] Normalized employees:", normalized);
        setEmployees(normalized);
      } else {
        setEmployees(data);
      }
    });
    
    // Location update handler
    socket.on("location-update", (update) => {
      // Prevent duplicate processing of the same location update
      const updateId = `${update.id}-${update.timestamp || Date.now()}`;
      const now = Date.now();
      if (now - (lastUpdateRef.current[updateId] || 0) < 500) {
        console.log("[Socket] Ignoring duplicate location update");
        return;
      }
      lastUpdateRef.current[updateId] = now;
      
      updateEmployee(update);
    });
    
    // Employee online handler
    socket.on("employee-online", (id) => {
      // Prevent duplicate online notifications
      const now = Date.now();
      if (now - (lastUpdateRef.current.employeeOnline[id] || 0) < 5000) {
        console.log("[Socket] Ignoring duplicate employee-online event", id);
        return;
      }
      lastUpdateRef.current.employeeOnline[id] = now;
      
      setOnline(id, true);
      addNotification({ type: "info", message: `Employee ${id} is online` });
    });
    
    // Employee offline handler
    socket.on("employee-offline", (id) => {
      // Prevent duplicate offline notifications
      const now = Date.now();
      if (now - (lastUpdateRef.current.employeeOffline[id] || 0) < 5000) {
        console.log("[Socket] Ignoring duplicate employee-offline event", id);
        return;
      }
      lastUpdateRef.current.employeeOffline[id] = now;
      
      setOnline(id, false);
      addNotification({ type: "info", message: `Employee ${id} is offline` });
    });
    
    socket.on("admin-broadcast", (msg) => {
      addNotification({ type: "success", message: `Broadcast: ${msg}` });
    });
    
    socket.on("error", (err) => {
      addNotification({ type: "error", message: err.message || "Socket error" });
    });

    // Listen for socket connect/disconnect events to ensure store state stays in sync
    socket.on("connect", () => {
      console.log("[AdminSocketEvents] Socket connected event");
      setConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("[AdminSocketEvents] Socket disconnected event");
      setConnected(false);
    });

    return () => {
      socket.off("employees");
      socket.off("location-update");
      socket.off("employee-online");
      socket.off("employee-offline");
      socket.off("admin-broadcast");
      socket.off("error");
      socket.off("connect");
      socket.off("disconnect");
    };
  }, [socket, setEmployees, updateEmployee, setOnline, addNotification, setConnected, normalizeEmployees]);
} 