import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../utils/AuthContext';
import socketService from '../services/socketService';

// Mirror dari backend/src/socket/socketEvents.js
const SOCKET_EVENTS = {
    REPORT_NEW:            'report:new',
    REPORT_STATUS_CHANGED: 'report:statusChanged',
    PENDING_COUNT_CHANGED: 'users:pendingCountChanged',
};

const SocketContext = createContext(null);

/**
 * SocketProvider
 * - Connect ke Socket.io saat user login
 * - Disconnect saat user logout
 * - Subscribe ke events dan invalidate React Query cache secara otomatis
 * - Expose { isConnected, pendingCount } ke komponen
 */
export const SocketProvider = ({ children }) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [isConnected, setIsConnected] = useState(false);
    const [pendingCount, setPendingCount] = useState(null);

    const invalidateReports = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['reports', 'all'] });
        queryClient.invalidateQueries({ queryKey: ['reports', 'mine'] });
        queryClient.invalidateQueries({ queryKey: ['reports', 'statistics'] });
        queryClient.invalidateQueries({ queryKey: ['reports', 'hostStats'] });
    }, [queryClient]);

    useEffect(() => {
        // Tidak ada user → pastikan socket diputus
        if (!user) {
            socketService.disconnect();
            setIsConnected(false);
            setPendingCount(null);
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) return;

        // Buat / dapatkan koneksi socket
        const socket = socketService.connect(token);

        // ── Lifecycle ──────────────────────────────────────────────────────────
        const onConnect = () => {
            setIsConnected(true);
            console.log('[Socket] Connected:', socket.id);
        };

        const onDisconnect = (reason) => {
            setIsConnected(false);
            console.log('[Socket] Disconnected:', reason);
        };

        const onConnectError = (err) => {
            console.error('[Socket] Connection error:', err.message);
        };

        // ── Business Events ────────────────────────────────────────────────────

        /**
         * report:new
         * Ketika host submit laporan baru via Telegram Bot.
         * → Invalidate semua query laporan + available months
         */
        const onReportNew = (data) => {
            console.log('[Socket] report:new received', data);
            invalidateReports();
            queryClient.invalidateQueries({ queryKey: ['reports', 'availableMonths'] });
        };

        /**
         * report:statusChanged
         * Ketika manager approve/reject laporan.
         * → Invalidate semua query laporan
         */
        const onReportStatusChanged = (data) => {
            console.log('[Socket] report:statusChanged received', data);
            invalidateReports();
        };

        /**
         * users:pendingCountChanged
         * Ketika manager approve/reject user pendaftar.
         * → Update pendingCount state (digunakan oleh Sidebar)
         */
        const onPendingCountChanged = (data) => {
            console.log('[Socket] users:pendingCountChanged received', data);
            setPendingCount(data.total);
        };

        // Register event listeners
        socket.on('connect',       onConnect);
        socket.on('disconnect',    onDisconnect);
        socket.on('connect_error', onConnectError);
        socket.on(SOCKET_EVENTS.REPORT_NEW,            onReportNew);
        socket.on(SOCKET_EVENTS.REPORT_STATUS_CHANGED, onReportStatusChanged);
        socket.on(SOCKET_EVENTS.PENDING_COUNT_CHANGED,  onPendingCountChanged);

        // Cleanup: hapus listeners saja, JANGAN disconnect
        // (socket dipertahankan selama user masih login)
        return () => {
            socket.off('connect',       onConnect);
            socket.off('disconnect',    onDisconnect);
            socket.off('connect_error', onConnectError);
            socket.off(SOCKET_EVENTS.REPORT_NEW,            onReportNew);
            socket.off(SOCKET_EVENTS.REPORT_STATUS_CHANGED, onReportStatusChanged);
            socket.off(SOCKET_EVENTS.PENDING_COUNT_CHANGED,  onPendingCountChanged);
        };
    }, [user, queryClient, invalidateReports]);

    return (
        <SocketContext.Provider value={{ isConnected, pendingCount, setPendingCount }}>
            {children}
        </SocketContext.Provider>
    );
};

/**
 * Hook untuk menggunakan SocketContext.
 * Returns { isConnected, pendingCount, setPendingCount }
 */
export const useSocket = () => {
    const ctx = useContext(SocketContext);
    if (!ctx) throw new Error('useSocket must be used within SocketProvider');
    return ctx;
};

export default SocketContext;
