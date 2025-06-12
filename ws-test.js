// Simple WebSocket server test script
const { io } = require("socket.io-client");

// Get WebSocket URL from command line or use default
const wsUrl = process.argv[2] || "http://localhost:3001";

console.log(`Attempting to connect to WebSocket server at ${wsUrl}`);

// Create socket connection
const socket = io(wsUrl, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  timeout: 60000,
});

// Connection handlers
socket.on("connect", () => {
  console.log("Connected to WebSocket server!");
  console.log("Socket ID:", socket.id);
  
  // Send test message
  socket.emit("test", { message: "Hello from test client" });
  
  // Close after 5 seconds
  setTimeout(() => {
    console.log("Test complete, disconnecting...");
    socket.disconnect();
    process.exit(0);
  }, 5000);
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