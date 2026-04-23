import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import reportsClient from '../api/reportsClient';

export const getErrorMessage = (error) =>
    error?.response?.data?.message || error?.message || 'Unknown error';

const buildMonthParams = (selectedMonth, selectedYear) => {
    if (selectedMonth === 'all') return {};
    if (selectedMonth === 'current') {
        return {
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
        };
    }
    return {
        month: parseInt(selectedMonth),
        year: selectedYear,
    };
};

/**
 * Available months dropdown
 * Real-time updates handled by SocketContext (report:new event)
 */
export const useAvailableMonthsQuery = () =>
    useQuery({
        queryKey: ['reports', 'availableMonths'],
        queryFn: async () => {
            const res = await reportsClient.getAvailableMonths();
            return res.data.data;
        },
        staleTime: 1000 * 60,
        refetchOnWindowFocus: true,
        // Polling dihapus → data diperbarui via WebSocket event report:new
    });

/**
 * Host: daftar laporan milik sendiri
 * Real-time updates handled by SocketContext (report:new, report:statusChanged)
 */
export const useMyReportsQuery = (filter, selectedMonth, selectedYear, page = 1, limit = 10) => {
    const params = {
        ...(filter !== 'ALL' ? { status: filter } : {}),
        ...buildMonthParams(selectedMonth, selectedYear),
        page,
        limit,
    };

    return useQuery({
        queryKey: ['reports', 'mine', params],
        queryFn: async () => {
            const res = await reportsClient.getMine(params);
            return res.data.data; // { reports, pagination }
        },
        keepPreviousData: true,
        refetchOnWindowFocus: true,
        // Polling dihapus → data diperbarui via WebSocket event
    });
};

/**
 * Manager: semua laporan
 * Real-time updates handled by SocketContext (report:new, report:statusChanged)
 */
export const useAllReportsQuery = (filter, selectedMonth, selectedYear, page = 1, limit = 10) => {
    const params = {
        ...(filter !== 'ALL' ? { status: filter } : {}),
        ...buildMonthParams(selectedMonth, selectedYear),
        page,
        limit,
    };

    return useQuery({
        queryKey: ['reports', 'all', params],
        queryFn: async () => {
            const res = await reportsClient.getAll(params);
            return res.data.data; // { reports, pagination }
        },
        keepPreviousData: true,
        refetchOnWindowFocus: true,
        // Polling dihapus → data diperbarui via WebSocket event
    });
};

/**
 * Manager: statistik laporan
 * Real-time updates handled by SocketContext
 */
export const useReportStatisticsQuery = (selectedMonth, selectedYear) => {
    const params = buildMonthParams(selectedMonth, selectedYear);

    return useQuery({
        queryKey: ['reports', 'statistics', params],
        queryFn: async () => {
            const res = await reportsClient.getStatistics(params);
            return res.data.data;
        },
        keepPreviousData: true,
        refetchOnWindowFocus: true,
        // Polling dihapus → data diperbarui via WebSocket event
    });
};

/**
 * Manager: statistik host bulanan
 * Real-time updates handled by SocketContext
 */
export const useHostStatisticsQuery = (selectedMonth, selectedYear) => {
    const params = buildMonthParams(selectedMonth, selectedYear);

    return useQuery({
        queryKey: ['reports', 'hostStats', params],
        queryFn: async () => {
            const res = await reportsClient.getMonthlyHostStatistics(params);
            return res.data.data;
        },
        keepPreviousData: true,
        refetchOnWindowFocus: true,
        // Polling dihapus → data diperbarui via WebSocket event
    });
};

/**
 * Mutation: update status laporan (Manager)
 * Setelah mutasi berhasil, cache di-invalidate secara lokal.
 * Backend juga akan emit socket event → SocketContext invalidate untuk semua client.
 */
export const useUpdateReportStatusMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, status, notes }) => reportsClient.updateStatus(id, status, notes),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reports', 'all'] });
            queryClient.invalidateQueries({ queryKey: ['reports', 'mine'] });
            queryClient.invalidateQueries({ queryKey: ['reports', 'statistics'] });
            queryClient.invalidateQueries({ queryKey: ['reports', 'hostStats'] });
        },
    });
};
