import { io } from 'socket.io-client';

/**
 * Ambil Socket.io server URL dari env.
 * Di production, REACT_APP_SOCKET_URL harus diisi (Render backend URL).
 * Di development, default ke localhost:5000.
 */
const getSocketUrl = () => {
    const fromEnv = process.env.REACT_APP_SOCKET_URL;
    if (fromEnv) return fromEnv;

    if (process.env.NODE_ENV === 'production') {
        // Fallback: coba ambil dari REACT_APP_API_BASE_URL (strip /api)
        const apiUrl = process.env.REACT_APP_API_BASE_URL || '';
        return apiUrl.replace(/\/api$/, '');
    }

    return 'http://localhost:5000';
};

/** @type {import('socket.io-client').Socket|null} */
let socket = null;

const socketService = {
    /**
     * Buat dan kembalikan koneksi socket.
     * Jika sudah terhubung, kembalikan instance yang ada.
     * @param {string} token - JWT token dari localStorage
     * @returns {import('socket.io-client').Socket}
     */
    connect(token) {
        if (socket && socket.connected) return socket;

        // Jika socket ada tapi disconnected, disconnect dulu bersih
        if (socket) {
            socket.disconnect();
        }

        socket = io(getSocketUrl(), {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            reconnectionDelay: 2000,
            timeout: 10000,
        });

        return socket;
    },

    /**
     * Putuskan koneksi socket.
     */
    disconnect() {
        if (socket) {
            socket.disconnect();
            socket = null;
        }
    },

    /**
     * Kembalikan instance socket aktif.
     * @returns {import('socket.io-client').Socket|null}
     */
    getSocket() {
        return socket;
    },

    /**
     * Daftarkan event listener.
     * @param {string} event
     * @param {Function} handler
     */
    on(event, handler) {
        socket?.on(event, handler);
    },

    /**
     * Hapus event listener.
     * @param {string} event
     * @param {Function} handler
     */
    off(event, handler) {
        socket?.off(event, handler);
    },
};

export default socketService;
