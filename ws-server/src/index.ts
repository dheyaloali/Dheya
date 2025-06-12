import express, { Request, Response } from 'express';
import http from 'http';
import { Server } from "socket.io";
import cors from 'cors';
import dotenv from 'dotenv';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { NextFunction } from 'express';

// Load environment variables
dotenv.config();

console.log("NEXTAUTH_SECRET in ws-server:", process.env.NEXTAUTH_SECRET);

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const JWT_SECRET = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'dev_secret';

const app = express();
app.use(cors());
app.use(express.json()); // Make sure JSON body parsing is enabled

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
});

const prisma = new PrismaClient();

// Helper: get admin userId from env
const NOTIFICATION_API_URL = process.env.NOTIFICATION_API_URL || 'http://localhost:3000';

// Add dynamic fetch import for node-fetch (ESM compatibility)
const fetch = (...args: [RequestInfo, RequestInit?]) => import('node-fetch').then(mod => mod.default(...args));

async function getAdminUserId() {
  try {
    const res = await fetch(`${NOTIFICATION_API_URL}/api/admin/current-id`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.adminUserId;
  } catch {
    return null;
  }
}

// Store connected clients
const connectedClients = new Map<string, any>();

io.on("connection", async (socket) => {
  console.log("[WebSocket] Raw handshake auth:", socket.handshake.auth);
  console.log("[WebSocket] Client connected:", socket.id);

  // Handle authentication
  const { userId, sessionToken, isAdmin } = socket.handshake.auth;
  if (!userId || !sessionToken) {
    console.warn("[WebSocket] Client not authenticated:", socket.id);
    socket.disconnect();
    return;
  }

  // Store client info
  connectedClients.set(socket.id, { userId, sessionToken, isAdmin });
  console.log("[WebSocket] Client authenticated:", { userId, isAdmin });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("[WebSocket] Client disconnected:", socket.id);
    connectedClients.delete(socket.id);
  });

  // Handle product assignment
  socket.on("product-assigned", async (data) => {
    try {
      console.log("[WebSocket] Product assignment:", data);
      
      // Notify admin
      const adminSockets = Array.from(connectedClients.entries())
        .filter(([_, client]) => client.isAdmin === true)
        .map(([socketId]) => socketId);
      
      adminSockets.forEach(socketId => {
        io.to(socketId).emit("notification", {
          type: "admin_product_assigned",
          message: `Product ${data.productName} has been assigned to ${data.employeeName}`,
          actionUrl: `/admin/employees/${data.employeeId}`,
          actionLabel: "View Employee",
          createdAt: new Date().toISOString(),
          read: false,
          isAdminMessage: true
        });
      });

      // Notify employee
      const employeeSockets = Array.from(connectedClients.entries())
        .filter(([_, client]) => client.userId === data.employeeId)
        .map(([socketId]) => socketId);
      
      employeeSockets.forEach(socketId => {
        io.to(socketId).emit("notification", {
          type: "employee_product_assigned",
          message: `You have been assigned product ${data.productName}`,
          actionUrl: `/employee/products`,
          actionLabel: "View Products",
          createdAt: new Date().toISOString(),
          read: false,
          isAdminMessage: false
        });
      });
    } catch (error) {
      console.error("[WebSocket] Error handling product assignment:", error);
    }
  });

  // Handle product updates
  socket.on("product-update", async (data) => {
    try {
      console.log("[WebSocket] Product update:", data);
      
      // Notify admin
      const adminSockets = Array.from(connectedClients.entries())
        .filter(([_, client]) => client.isAdmin === true)
        .map(([socketId]) => socketId);
      
      adminSockets.forEach(socketId => {
        io.to(socketId).emit("notification", {
          type: "admin_product_updated",
          message: `Product ${data.productName} has been updated`,
          actionUrl: `/admin/products`,
          actionLabel: "View Products",
          createdAt: new Date().toISOString(),
          read: false,
          isAdminMessage: true
        });
      });

      // Notify assigned employee if any
      if (data.employeeId) {
        const employeeSockets = Array.from(connectedClients.entries())
          .filter(([_, client]) => client.userId === data.employeeId)
          .map(([socketId]) => socketId);
        
        employeeSockets.forEach(socketId => {
          io.to(socketId).emit("notification", {
            type: "employee_product_updated",
            message: `Product ${data.productName} has been updated`,
            actionUrl: `/employee/products`,
            actionLabel: "View Products",
            createdAt: new Date().toISOString(),
            read: false,
            isAdminMessage: false
          });
        });
      }
    } catch (error) {
      console.error("[WebSocket] Error handling product update:", error);
    }
  });

  // Handle stock updates
  socket.on("stock-update", async (data) => {
    try {
      console.log("[WebSocket] Stock update:", data);
      
      // Notify admin
      const adminSockets = Array.from(connectedClients.entries())
        .filter(([_, client]) => client.isAdmin === true)
        .map(([socketId]) => socketId);
      
      adminSockets.forEach(socketId => {
        io.to(socketId).emit("notification", {
          type: "admin_stock_updated",
          message: `Stock for ${data.productName} has been updated to ${data.stockLevel}`,
          actionUrl: `/admin/products`,
          actionLabel: "View Products",
          createdAt: new Date().toISOString(),
          read: false,
          isAdminMessage: true
        });
      });

      // Notify assigned employee if any
      if (data.employeeId) {
        const employeeSockets = Array.from(connectedClients.entries())
          .filter(([_, client]) => client.userId === data.employeeId)
          .map(([socketId]) => socketId);
        
        employeeSockets.forEach(socketId => {
          io.to(socketId).emit("notification", {
            type: "employee_stock_updated",
            message: `Stock for ${data.productName} has been updated to ${data.stockLevel}`,
            actionUrl: `/employee/products`,
            actionLabel: "View Products",
            createdAt: new Date().toISOString(),
            read: false,
            isAdminMessage: false
          });
        });
      }
    } catch (error) {
      console.error("[WebSocket] Error handling stock update:", error);
    }
  });

  // Handle product deletion
  socket.on("product-delete", async (data) => {
    try {
      console.log("[WebSocket] Product deletion:", data);
      
      // Notify admin
      const adminSockets = Array.from(connectedClients.entries())
        .filter(([_, client]) => client.isAdmin === true)
        .map(([socketId]) => socketId);
      
      adminSockets.forEach(socketId => {
        io.to(socketId).emit("notification", {
          type: "admin_product_deleted",
          message: `Product ${data.productName} has been deleted`,
          actionUrl: `/admin/products`,
          actionLabel: "View Products",
          createdAt: new Date().toISOString(),
          read: false,
          isAdminMessage: true
        });
      });

      // Notify assigned employee if any
      if (data.employeeId) {
        const employeeSockets = Array.from(connectedClients.entries())
          .filter(([_, client]) => client.userId === data.employeeId)
          .map(([socketId]) => socketId);
        
        employeeSockets.forEach(socketId => {
          io.to(socketId).emit("notification", {
            type: "employee_product_deleted",
            message: `Product ${data.productName} has been deleted`,
            actionUrl: `/employee/products`,
            actionLabel: "View Products",
            createdAt: new Date().toISOString(),
            read: false,
            isAdminMessage: false
          });
        });
      }
    } catch (error) {
      console.error("[WebSocket] Error handling product deletion:", error);
    }
  });

  // Handle dashboard updates
  socket.on("dashboard-update", async (data) => {
    try {
      console.log("[WebSocket] Dashboard update:", data);
      
      // Notify the specific employee
      const employeeSockets = Array.from(connectedClients.entries())
        .filter(([_, client]) => client.userId === data.employeeId)
        .map(([socketId]) => socketId);
      
      employeeSockets.forEach(socketId => {
        io.to(socketId).emit("dashboard-data", {
          type: data.type, // 'attendance', 'sales', 'products', 'documents'
          data: data.stats,
          timestamp: new Date().toISOString()
        });
      });
    } catch (error) {
      console.error("[WebSocket] Error handling dashboard update:", error);
    }
  });

  // Handle notifications
  socket.on("notification", async (data) => {
    try {
      console.log("[WebSocket] Received notification:", data);

      // Get all connected clients
      const clients = Array.from(connectedClients.entries());
      
      // Handle admin notifications
      if (data.broadcastTo?.admin) {
        const adminSockets = clients
          .filter(([_, client]) => client.isAdmin === true)
          .map(([socketId]) => socketId);
        
        if (adminSockets.length > 0) {
          console.log(`[WebSocket] Sending admin notification to ${adminSockets.length} admin clients`);
          adminSockets.forEach(socketId => {
            io.to(socketId).emit("notification", data);
          });
        }
      }

      // Handle employee notifications
      if (data.broadcastTo?.employee) {
        const employeeSockets = clients
          .filter(([_, client]) => client.isAdmin === false)
          .map(([socketId]) => socketId);
        
        if (employeeSockets.length > 0) {
          console.log(`[WebSocket] Sending employee notification to ${employeeSockets.length} employee clients`);
          employeeSockets.forEach(socketId => {
            io.to(socketId).emit("notification", data);
          });
        }
      }
    } catch (error) {
      console.error("[WebSocket] Error processing notification:", error);
    }
  });
});

// --- Express REST endpoint for health check ---
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// --- Express REST endpoint for broadcasting location updates ---
app.post('/broadcast-location', express.json(), (req: Request, res: Response) => {
  const data = req.body;
  // Optionally validate data here
  io.emit('location-update', data);
  res.json({ status: 'ok' });
});

// --- Express REST endpoint for broadcasting notification (for integration/testing) ---
app.post('/broadcast-notification', async (req: Request, res: Response) => {
  try {
    // Log the full request body for debugging
    console.log('[WebSocket] Broadcast notification request:', req.body);
    
    const { event, data, token } = req.body;
    
    if (!data) {
      console.log("[WebSocket] Missing data field");
      return res.status(400).json({ error: 'Missing data field' });
    }
    
    // Skip token verification in development mode
    const isDev = process.env.NODE_ENV === 'development' || true; // Temporarily always true for testing
    
    if (!isDev && token) {
      try {
        jwt.verify(token, JWT_SECRET);
      } catch (err) {
        console.error('[WebSocket] Token verification failed:', err);
        return res.status(401).json({ error: 'Invalid token' });
      }
    }
    
    // Extract the broadcast targets
    const broadcastToAdmin = data.broadcastTo?.admin !== false;
    const broadcastToEmployee = data.broadcastTo?.employee === true;
    const notificationType = data.type || event || 'notification';
    
    console.log("[WebSocket] Notification details:", { 
      type: notificationType,
      broadcastToAdmin,
      broadcastToEmployee,
      userId: data.userId 
    });
    
    // Prepare the notification object for clients
    const notification = {
      id: data.id,
      type: notificationType,
      message: data.message,
      actionUrl: data.actionUrl,
      actionLabel: data.actionLabel,
      createdAt: data.createdAt || new Date().toISOString(),
      read: false, // Important: New notifications are always unread
      employeeId: data.employeeId, // Include employeeId for targeting
      isAdminMessage: notificationType.startsWith('admin_') // Add flag to identify admin messages
    };
    
    // Get connected clients
    const clients = Array.from(connectedClients.entries());
    let notificationsSent = 0;
    
    // Send to admin clients - ONLY when broadcastToAdmin is true
    if (broadcastToAdmin) {
      const adminSockets = clients
        .filter(([_, client]) => client.isAdmin === true)
        .map(([socketId]) => socketId);
      
      console.log(`[WebSocket] Broadcasting admin notification to ${adminSockets.length} admin socket(s)`);
      
      if (adminSockets.length > 0) {
        adminSockets.forEach(socketId => {
          // Only send admin messages to admin clients
          if (notification.isAdminMessage) {
            io.to(socketId).emit("notification", notification);
            notificationsSent++;
          }
        });
        console.log(`[WebSocket] Successfully sent admin notification to ${adminSockets.length} admin clients`);
      } else {
        console.log(`[WebSocket] No admin clients connected to receive admin notification`);
      }
    }
    
    // Send to employee clients - ONLY when broadcastToEmployee is true
    if (broadcastToEmployee) {
      const employeeSockets = clients
        .filter(([_, client]) => client.isAdmin === false)
        .map(([socketId]) => socketId);
      
      console.log(`[WebSocket] Broadcasting employee notification to ${employeeSockets.length} employee socket(s)`);
      
      if (employeeSockets.length > 0) {
        employeeSockets.forEach(socketId => {
          io.to(socketId).emit("notification", notification);
          notificationsSent++;
        });
        console.log(`[WebSocket] Successfully sent employee notification to ${employeeSockets.length} employee clients`);
      } else {
        console.log(`[WebSocket] No employee clients connected to receive employee notification`);
      }
    }
    
    res.json({ status: 'ok', notificationsSent });
  } catch (error) {
    console.error("[WebSocket] Error processing broadcast notification:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start the server
httpServer.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});