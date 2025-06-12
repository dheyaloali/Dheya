// Admin socket test script
import { io } from "socket.io-client";
import process from 'node:process';

// Get WebSocket URL from command line or use default
const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";

console.log(`Attempting to connect to WebSocket server as admin at ${wsUrl}`);

// Admin test session token (this would come from the admin's auth cookie in the real app)
const testAdminToken = "test-admin-token";

// Create socket connection with admin auth
const socket = io(wsUrl, {
  auth: {
    userId: "test-admin-user",
    sessionToken: testAdminToken,
    isAdmin: true
  },
  transports: ['websocket', 'polling'],
  reconnection: true,
  timeout: 20000,
});

// Connection handlers
socket.on("connect", () => {
  console.log("Connected to WebSocket server as admin!");
  console.log("Socket ID:", socket.id);
  
  // Send test message
  socket.emit("test", { message: "Hello from admin test client" });
  
  // Keep alive for 10 seconds
  setTimeout(() => {
    console.log("Test complete, disconnecting...");
    socket.disconnect();
    process.exit(0);
  }, 10000);
});

socket.on("connect_error", (error) => {
  console.error("Connection error:", error);
  console.log("Server might not be running or there might be a network issue.");
});

socket.on("disconnect", (reason) => {
  console.log("Disconnected:", reason);
});

socket.on("error", (error) => {
  console.error("Socket error:", error);
});

// Keep process running
process.stdin.resume();

// Handle Ctrl+C
process.on("SIGINT", () => {
  console.log("Disconnecting...");
  socket.disconnect();
  process.exit(0);
}); 