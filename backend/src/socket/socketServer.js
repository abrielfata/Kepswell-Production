const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, FRONTEND_URL, FRONTEND_URLS } = require('../config/env');

/** @type {Server|null} */
let io = null;

/**
 * Parse allowed origins dari env (sama logikanya dengan corsMiddleware)
 */
const parseOrigins = (value) =>
    (value || '').split(',').map((s) => s.trim()).filter(Boolean);

const getAllowedOrigins = () => [
    'http://localhost:3000',
    ...parseOrigins(FRONTEND_URL),
    ...parseOrigins(FRONTEND_URLS),
];

const isVercelPreviewOrigin = (origin) => {
    if (!origin) return false;
    try {
        const { hostname, protocol } = new URL(origin);
        if (protocol !== 'https:' || !hostname.endsWith('.vercel.app')) return false;
        const slug = process.env.VERCEL_PROJECT_SLUG || 'kepswell';
        return hostname.includes(slug);
    } catch {
        return false;
    }
};

/**
 * Inisialisasi Socket.io Server.
 * Dipanggil sekali dari server.js setelah http.createServer.
 *
 * @param {import('http').Server} httpServer
 */
const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: (origin, callback) => {
                if (!origin) return callback(null, true);
                const allowed = getAllowedOrigins();
                if (allowed.includes(origin) || isVercelPreviewOrigin(origin)) {
                    return callback(null, true);
                }
                return callback(new Error(`CORS: origin ${origin} not allowed`));
            },
            methods: ['GET', 'POST'],
            credentials: true,
        },
        // Gunakan websocket dulu, fallback ke polling
        transports: ['websocket', 'polling'],
    });

    // ── JWT Authentication Middleware ──────────────────────────────────────────
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;

        if (!token) {
            return next(new Error('Authentication error: token missing'));
        }

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            socket.user = decoded; // { id, role, ... }
            next();
        } catch (err) {
            return next(new Error('Authentication error: invalid token'));
        }
    });

    // ── Connection Handler ─────────────────────────────────────────────────────
    io.on('connection', (socket) => {
        const { id: userId, role } = socket.user;

        // Join room berdasarkan role
        if (role === 'MANAGER') {
            socket.join('room:managers');
            console.log(`[Socket] Manager ${userId} connected → joined room:managers`);
        } else if (role === 'HOST') {
            socket.join(`room:host:${userId}`);
            console.log(`[Socket] Host ${userId} connected → joined room:host:${userId}`);
        }

        socket.on('disconnect', (reason) => {
            console.log(`[Socket] User ${userId} (${role}) disconnected: ${reason}`);
        });

        socket.on('error', (err) => {
            console.error(`[Socket] Error from user ${userId}:`, err.message);
        });
    });

    console.log('✅ Socket.io server initialized');
    return io;
};

// ── Emitter Helpers ────────────────────────────────────────────────────────────

/**
 * Emit event ke semua Manager yang sedang terhubung.
 * @param {string} event
 * @param {object} data
 */
const emitToManagers = (event, data) => {
    if (!io) return;
    io.to('room:managers').emit(event, data);
};

/**
 * Emit event ke Host spesifik berdasarkan user ID dari database.
 * @param {number|string} userId
 * @param {string} event
 * @param {object} data
 */
const emitToHost = (userId, event, data) => {
    if (!io) return;
    io.to(`room:host:${userId}`).emit(event, data);
};

/**
 * Emit event ke semua client yang terhubung.
 * @param {string} event
 * @param {object} data
 */
const emitToAll = (event, data) => {
    if (!io) return;
    io.emit(event, data);
};

/**
 * Dapatkan instance io (untuk kebutuhan custom lainnya).
 * @returns {Server|null}
 */
const getIO = () => io;

module.exports = {
    initSocket,
    emitToManagers,
    emitToHost,
    emitToAll,
    getIO,
};
