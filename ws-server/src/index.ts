import express, { Request, Response } from 'express';
import http from 'http';
import { Server } from "socket.io";
import cors from 'cors';
import dotenv from 'dotenv';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { NextFunction } from 'express';
import bodyParser from 'body-parser';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const JWT_SECRET = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'dev_secret';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'dev_internal_key';

const app = express();
app.use(cors());
app.use(express.json()); // Make sure JSON body parsing is enabled
app.use(bodyParser.json());

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow connections from any origin
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
// Add last activity tracking for each client
const clientLastActivity = new Map<string, number>();

// --- Employee Status Monitoring ---
// Configuration for alerts (these can be updated via settings API)
let STATIONARY_ALERT_THRESHOLD = 10 * 60 * 1000; // 10 minutes in milliseconds
let LOW_BATTERY_THRESHOLD = 20; // 20% battery level
let OFFLINE_ALERT_THRESHOLD = 5 * 60 * 1000; // 5 minutes offline before alerting

// Alert toggle settings
let STATIONARY_ALERTS_ENABLED = true;
let LOW_BATTERY_ALERTS_ENABLED = true;
let OFFLINE_ALERTS_ENABLED = true;

// Track employee status
interface EmployeeStatus {
  id: string;
  name: string;
  lastMovementTime: number;
  lastLocation: {
    latitude: number;
    longitude: number;
    timestamp: number;
    address?: string;
  };
  batteryLevel: number;
  isOnline: boolean;
  lastOnlineTime: number;
  // Alert flags to prevent duplicate alerts
  alerts: {
    stationaryAlerted: boolean;
    lowBatteryAlerted: boolean;
    offlineAlerted: boolean;
  };
}

const employeeStatusMap = new Map<string, EmployeeStatus>();

// Function to process location update and update employee status
function updateEmployeeStatus(data: any) {
  const { employeeId, latitude, longitude, batteryLevel, isMoving, timestamp, address } = data;
  const now = Date.now();
  const timestampMs = timestamp ? new Date(timestamp).getTime() : now;
  
  // Get or initialize employee status
  let status = employeeStatusMap.get(employeeId);
  if (!status) {
    status = {
      id: employeeId,
      name: data.name || `Employee ${employeeId}`,
      lastMovementTime: timestampMs,
      lastLocation: {
        latitude,
        longitude,
        timestamp: timestampMs,
        address
      },
      batteryLevel: batteryLevel || 100,
      isOnline: true,
      lastOnlineTime: now,
      alerts: {
        stationaryAlerted: false,
        lowBatteryAlerted: false,
        offlineAlerted: false
      }
    };
  } else {
    // Update existing status
    status.lastLocation = {
      latitude,
      longitude,
      timestamp: timestampMs,
      address: address || status.lastLocation.address
    };
    
    // Update battery level if provided
    if (batteryLevel !== undefined && batteryLevel !== null) {
      status.batteryLevel = batteryLevel;
      
      // Reset low battery alert if battery is charged again
      if (batteryLevel > LOW_BATTERY_THRESHOLD + 10) { // +10% buffer to prevent alert flapping
        status.alerts.lowBatteryAlerted = false;
      }
    }
    
    // Update movement timestamp if employee is moving
    if (isMoving) {
      status.lastMovementTime = timestampMs;
      status.alerts.stationaryAlerted = false; // Reset stationary alert
    }
    
    // Always update online status and time
    status.isOnline = true;
    status.lastOnlineTime = now;
    status.alerts.offlineAlerted = false; // Reset offline alert
  }
  
  // Store updated status
  employeeStatusMap.set(employeeId, status);
}

// Function to mark employee as offline
function markEmployeeOffline(employeeId: string) {
  const status = employeeStatusMap.get(employeeId);
  if (status) {
    status.isOnline = false;
    employeeStatusMap.set(employeeId, status);
  }
}

// Function to check employee status and generate alerts
async function checkEmployeeStatus() {
  const now = Date.now();
  const adminSockets = Array.from(connectedClients.entries())
    .filter(([_, client]) => client.isAdmin === true)
    .map(([socketId]) => socketId);
  
  if (adminSockets.length === 0) {
    return; // No admins connected, skip alerts
  }
  
  // Check each employee's status
  for (const [employeeId, status] of employeeStatusMap.entries()) {
    try {
      // 1. Check for stationary employees - only if enabled
      if (STATIONARY_ALERTS_ENABLED) {
        const stationaryTime = now - status.lastMovementTime;
        if (status.isOnline && 
            stationaryTime > STATIONARY_ALERT_THRESHOLD && 
            !status.alerts.stationaryAlerted) {
          
          // Employee has been stationary for too long
          const formattedTime = Math.round(stationaryTime / 60000); // Convert to minutes
          const address = status.lastLocation.address || 
                        `${status.lastLocation.latitude.toFixed(6)}, ${status.lastLocation.longitude.toFixed(6)}`;
          
          // Send notification to admins
          adminSockets.forEach(socketId => {
            io.to(socketId).emit("notification", {
              type: "admin_employee_stationary",
              title: "Employee Not Moving",
              message: `${status.name} has been stationary for ${formattedTime} minutes at ${address}`,
              actionUrl: `/admin/location-tracking`,
              actionLabel: "View Location",
              employeeId,
              createdAt: new Date().toISOString(),
              read: false,
              isAdminMessage: true,
              severity: "warning"
            });
          });
          
          // Mark as alerted to prevent duplicate alerts
          status.alerts.stationaryAlerted = true;
          employeeStatusMap.set(employeeId, status);
          
          // Also store in database for persistence
          try {
            await fetch(`${NOTIFICATION_API_URL}/api/notifications`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'x-internal-api-key': INTERNAL_API_KEY
              },
              body: JSON.stringify({
                type: "admin_employee_stationary",
                message: `${status.name} has been stationary for ${formattedTime} minutes at ${address}`,
                employeeId,
                broadcastTo: { admin: true }
              })
            });
          } catch (err) {
            console.error("[WebSocket] Failed to store stationary notification:", err);
          }
        }
      }
      
      // 2. Check for low battery - only if enabled
      if (LOW_BATTERY_ALERTS_ENABLED) {
        if (status.isOnline && 
            status.batteryLevel <= LOW_BATTERY_THRESHOLD && 
            !status.alerts.lowBatteryAlerted) {
          
          // Employee has low battery
          // Send notification to admins
          adminSockets.forEach(socketId => {
            io.to(socketId).emit("notification", {
              type: "admin_employee_low_battery",
              title: "Low Battery Alert",
              message: `${status.name}'s device battery is low (${status.batteryLevel}%)`,
              actionUrl: `/admin/location-tracking`,
              actionLabel: "View Location",
              employeeId,
              createdAt: new Date().toISOString(),
              read: false,
              isAdminMessage: true,
              severity: "warning"
            });
          });
          
          // Mark as alerted to prevent duplicate alerts
          status.alerts.lowBatteryAlerted = true;
          employeeStatusMap.set(employeeId, status);
          
          // Also store in database for persistence
          try {
            await fetch(`${NOTIFICATION_API_URL}/api/notifications`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'x-internal-api-key': INTERNAL_API_KEY
              },
              body: JSON.stringify({
                type: "admin_employee_low_battery",
                message: `${status.name}'s device battery is low (${status.batteryLevel}%)`,
                employeeId,
                broadcastTo: { admin: true }
              })
            });
          } catch (err) {
            console.error("[WebSocket] Failed to store low battery notification:", err);
          }
        }
      }
      
      // 3. Check for offline employees - only if enabled
      if (OFFLINE_ALERTS_ENABLED) {
        const offlineTime = now - status.lastOnlineTime;
        if (!status.isOnline && 
            offlineTime > OFFLINE_ALERT_THRESHOLD && 
            !status.alerts.offlineAlerted) {
          
          // Employee has been offline for too long
          const formattedTime = Math.round(offlineTime / 60000); // Convert to minutes
          
          // Send notification to admins
          adminSockets.forEach(socketId => {
            io.to(socketId).emit("notification", {
              type: "admin_employee_offline",
              title: "Employee Offline",
              message: `${status.name} has been offline for ${formattedTime} minutes`,
              actionUrl: `/admin/location-tracking`,
              actionLabel: "View Location",
              employeeId,
              createdAt: new Date().toISOString(),
              read: false,
              isAdminMessage: true,
              severity: "error"
            });
          });
          
          // Mark as alerted to prevent duplicate alerts
          status.alerts.offlineAlerted = true;
          employeeStatusMap.set(employeeId, status);
          
          // Also store in database for persistence
          try {
            await fetch(`${NOTIFICATION_API_URL}/api/notifications`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'x-internal-api-key': INTERNAL_API_KEY
              },
              body: JSON.stringify({
                type: "admin_employee_offline",
                message: `${status.name} has been offline for ${formattedTime} minutes`,
                employeeId,
                broadcastTo: { admin: true }
              })
            });
          } catch (err) {
            console.error("[WebSocket] Failed to store offline notification:", err);
          }
        }
      }
    } catch (error) {
      console.error(`[WebSocket] Error checking status for employee ${employeeId}:`, error);
    }
  }
}

// Run status check every minute
setInterval(checkEmployeeStatus, 60000);

// Connection monitoring
setInterval(() => {
  const now = Date.now();
  const inactiveTimeout = 2 * 60 * 1000; // 2 minutes inactivity timeout
  
  // Check for inactive connections
  clientLastActivity.forEach((lastActivity, socketId) => {
    if (now - lastActivity > inactiveTimeout) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        console.log(`[WebSocket] Closing inactive connection: ${socketId}`);
        socket.disconnect(true);
        clientLastActivity.delete(socketId);
      }
    }
  });
  
  // Log connection stats periodically
  console.log(`[WebSocket] Active connections: ${connectedClients.size}`);
}, 60000); // Check every minute

io.on("connection", async (socket) => {
  // Client connected with auth data

  // Handle authentication
  const { userId, sessionToken, isAdmin } = socket.handshake.auth;
  if (!userId || !sessionToken) {
    // Client not authenticated
    socket.disconnect();
    return;
  }

  // Store client info
  connectedClients.set(socket.id, { userId, sessionToken, isAdmin });
  // Initialize last activity timestamp
  clientLastActivity.set(socket.id, Date.now());

  // Handle disconnection
  socket.on("disconnect", () => {
    const clientInfo = connectedClients.get(socket.id);
    if (clientInfo && !clientInfo.isAdmin) {
      // Mark employee as offline when they disconnect
      markEmployeeOffline(clientInfo.userId);
    }
    
    connectedClients.delete(socket.id);
    clientLastActivity.delete(socket.id);
  });

  // Handle heartbeat messages from clients
  socket.on("heartbeat", (data) => {
    // Update last activity timestamp
    clientLastActivity.set(socket.id, Date.now());
    // Send acknowledgment back to client
    socket.emit("heartbeat_ack", { 
      timestamp: Date.now(),
      serverTime: new Date().toISOString(),
      clientTimestamp: data?.timestamp || Date.now(),
      connectionId: socket.id
    });
  });

  // Handle product assignment
  socket.on("product-assigned", async (data) => {
    try {
      // Update last activity timestamp
      clientLastActivity.set(socket.id, Date.now());
      
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
      // Error handling product assignment
    }
  });

  // Handle product updates
  socket.on("product-update", async (data) => {
    try {
      // Update last activity timestamp
      clientLastActivity.set(socket.id, Date.now());
      
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
      // Update last activity timestamp
      clientLastActivity.set(socket.id, Date.now());
      
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
  res.json({ 
    status: 'ok', 
    time: new Date().toISOString(),
    connections: connectedClients.size,
    uptime: process.uptime()
  });
});

// --- Express REST endpoint for broadcasting location updates ---
app.post('/broadcast-location', express.json(), (req: Request, res: Response) => {
  const data = req.body;
  
  // Update employee status with this location data
  updateEmployeeStatus(data);
  
  // Broadcast to all connected clients
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
    const isDev = process.env.NODE_ENV === 'development';
    
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

// --- Express REST endpoint for updating settings ---
app.post('/update-settings', express.json(), (req: Request, res: Response) => {
  try {
    const { settings } = req.body;
    
    if (!settings) {
      return res.status(400).json({ error: 'Missing settings data' });
    }
    
    // Log which specific fields were updated
    if (settings.updatedFields && Array.isArray(settings.updatedFields) && settings.updatedFields.length > 0) {
      console.log(`[WebSocket] Received settings update for fields: ${settings.updatedFields.join(', ')}`);
    } else {
      console.log('[WebSocket] Received settings update:', JSON.stringify(settings));
    }
    
    let updatedSettings = false;
    
    // Update threshold settings if provided
    if (typeof settings.stationaryAlertThreshold === 'number') {
      const oldValue = STATIONARY_ALERT_THRESHOLD / 1000;
      STATIONARY_ALERT_THRESHOLD = settings.stationaryAlertThreshold * 1000; // Convert seconds to milliseconds
      console.log(`[WebSocket] Updated stationary alert threshold: ${oldValue}s → ${settings.stationaryAlertThreshold}s`);
      updatedSettings = true;
    }
    
    if (typeof settings.lowBatteryThreshold === 'number') {
      const oldValue = LOW_BATTERY_THRESHOLD;
      LOW_BATTERY_THRESHOLD = settings.lowBatteryThreshold;
      console.log(`[WebSocket] Updated low battery threshold: ${oldValue}% → ${settings.lowBatteryThreshold}%`);
      updatedSettings = true;
    }
    
    if (typeof settings.offlineAlertThreshold === 'number') {
      const oldValue = OFFLINE_ALERT_THRESHOLD / 1000;
      OFFLINE_ALERT_THRESHOLD = settings.offlineAlertThreshold * 1000; // Convert seconds to milliseconds
      console.log(`[WebSocket] Updated offline alert threshold: ${oldValue}s → ${settings.offlineAlertThreshold}s`);
      updatedSettings = true;
    }
    
    // Update alert toggle settings if provided
    if (typeof settings.stationaryAlertsEnabled === 'boolean') {
      const oldValue = STATIONARY_ALERTS_ENABLED;
      STATIONARY_ALERTS_ENABLED = settings.stationaryAlertsEnabled;
      console.log(`[WebSocket] Stationary alerts: ${oldValue ? 'enabled' : 'disabled'} → ${STATIONARY_ALERTS_ENABLED ? 'enabled' : 'disabled'}`);
      updatedSettings = true;
    }
    
    if (typeof settings.lowBatteryAlertsEnabled === 'boolean') {
      const oldValue = LOW_BATTERY_ALERTS_ENABLED;
      LOW_BATTERY_ALERTS_ENABLED = settings.lowBatteryAlertsEnabled;
      console.log(`[WebSocket] Low battery alerts: ${oldValue ? 'enabled' : 'disabled'} → ${LOW_BATTERY_ALERTS_ENABLED ? 'enabled' : 'disabled'}`);
      updatedSettings = true;
    }
    
    if (typeof settings.offlineAlertsEnabled === 'boolean') {
      const oldValue = OFFLINE_ALERTS_ENABLED;
      OFFLINE_ALERTS_ENABLED = settings.offlineAlertsEnabled;
      console.log(`[WebSocket] Offline alerts: ${oldValue ? 'enabled' : 'disabled'} → ${OFFLINE_ALERTS_ENABLED ? 'enabled' : 'disabled'}`);
      updatedSettings = true;
    }
    
    if (!updatedSettings) {
      console.log('[WebSocket] No settings were actually updated despite receiving update request');
    }
    
    // Broadcast settings update to all admin clients
    const adminSockets = Array.from(connectedClients.entries())
      .filter(([_, client]) => client.isAdmin === true)
      .map(([socketId]) => socketId);
    
    if (adminSockets.length > 0) {
      console.log(`[WebSocket] Broadcasting settings update to ${adminSockets.length} admin client(s)`);
      
      adminSockets.forEach(socketId => {
        io.to(socketId).emit('settings-updated', {
          stationaryAlertThreshold: STATIONARY_ALERT_THRESHOLD / 1000, // Convert back to seconds for UI
          lowBatteryThreshold: LOW_BATTERY_THRESHOLD,
          offlineAlertThreshold: OFFLINE_ALERT_THRESHOLD / 1000, // Convert back to seconds for UI
          stationaryAlertsEnabled: STATIONARY_ALERTS_ENABLED,
          lowBatteryAlertsEnabled: LOW_BATTERY_ALERTS_ENABLED,
          offlineAlertsEnabled: OFFLINE_ALERTS_ENABLED
        });
      });
    } else {
      console.log('[WebSocket] No admin clients connected to receive settings update');
    }
    
    res.json({ 
      status: 'ok',
      settings: {
        stationaryAlertThreshold: STATIONARY_ALERT_THRESHOLD / 1000,
        lowBatteryThreshold: LOW_BATTERY_THRESHOLD,
        offlineAlertThreshold: OFFLINE_ALERT_THRESHOLD / 1000,
        stationaryAlertsEnabled: STATIONARY_ALERTS_ENABLED,
        lowBatteryAlertsEnabled: LOW_BATTERY_ALERTS_ENABLED,
        offlineAlertsEnabled: OFFLINE_ALERTS_ENABLED
      }
    });
  } catch (error) {
    console.error("[WebSocket] Error processing settings update:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start the server
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`WebSocket server running on port ${PORT}, listening on all interfaces`);
});

// Export for testing
export { io, app, httpServer };