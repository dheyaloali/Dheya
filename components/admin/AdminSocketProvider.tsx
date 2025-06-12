"use client";
import { useAdminSocket } from "@/hooks/useAdminSocket";

export function AdminSocketProvider({ children }: { children: React.ReactNode }) {
  useAdminSocket(); // Keeps the admin WebSocket connection alive for all admin pages
  return <>{children}</>;
} 