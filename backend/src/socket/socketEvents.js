/**
 * Socket.io Event Constants
 * Digunakan oleh backend (emit) dan frontend (listen) agar nama event konsisten.
 */
const SOCKET_EVENTS = {
    // Report events
    REPORT_NEW:            'report:new',
    REPORT_STATUS_CHANGED: 'report:statusChanged',

    // User events
    PENDING_COUNT_CHANGED: 'users:pendingCountChanged',

    // Connection lifecycle (bawaan socket.io, didefinisikan di sini untuk referensi)
    CONNECT:       'connect',
    DISCONNECT:    'disconnect',
    CONNECT_ERROR: 'connect_error',
};

module.exports = SOCKET_EVENTS;
