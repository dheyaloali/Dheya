"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
// Load environment variables
dotenv_1.default.config();
console.log("NEXTAUTH_SECRET in ws-server:", process.env.NEXTAUTH_SECRET);
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const JWT_SECRET = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'dev_secret';
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*', // Adjust for production
        methods: ['GET', 'POST']
    }
});
const prisma = new client_1.PrismaClient();
// --- Socket.IO Authentication Middleware ---
io.use((socket, next) => {
    // Accept JWT from handshake auth or query (as sent by NextAuth.js client)
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
        return next(new Error('Authentication token required'));
    }
    try {
        console.log("Incoming JWT:", token); // Debug log
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        console.log("Decoded payload:", payload); // Debug log
        // Check required fields
        if (!payload.id || !payload.isApproved) {
            return next(new Error('Invalid or unapproved user'));
        }
        if (!payload.isApproved) {
            return next(new Error('User not approved'));
        }
        // Attach user info to socket
        socket.user = {
            id: payload.id,
            isAdmin: payload.isAdmin,
            isApproved: payload.isApproved,
            mfaEnabled: payload.mfaEnabled,
            email: payload.email,
            name: payload.name,
        };
        next();
    }
    catch (err) {
        console.error("JWT verification error:", err); // Debug log
        next(new Error('Invalid authentication token'));
    }
});
// --- Socket.IO Connection Handler ---
io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`User connected: ${user?.id || 'unknown'} (isAdmin: ${user?.isAdmin}, isApproved: ${user?.isApproved})`);
    // Send initial employee locations
    socket.on('get-employees', async () => {
        const employees = await prisma.employee.findMany({
            include: { user: true, locations: { orderBy: { timestamp: 'desc' }, take: 1 } }
        });
        socket.emit('employees', employees);
    });
    // Listen for location updates from clients (if allowed)
    socket.on('update-location', async (data) => {
        // Validate and update location in DB, then broadcast
        // ... implement validation and update logic here ...
        io.emit('location-update', data); // Broadcast to all clients
    });
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${user?.id || 'unknown'}`);
    });
});
// --- Express REST endpoint for health check ---
app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});
server.listen(PORT, () => {
    console.log(`WebSocket server running on port ${PORT}`);
});
// If you see linter errors about missing modules, run `pnpm install` or `npm install` in ws-server/ to install dependencies. 
