import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import hostsClient from '../api/hostsClient';

export const useHostsQuery = (statusFilter, activeFilter) => {
    const params = {
        status: statusFilter,
        ...(activeFilter !== 'all' ? { is_active: activeFilter } : {}),
    };

    return useQuery({
        queryKey: ['hosts', params],
        queryFn: async () => {
            const res = await hostsClient.getAll(params);
            return res.data.data;
        },
        keepPreviousData: true,
        refetchInterval: 1000 * 30, // Refetch every 30 seconds for real-time updates
        refetchOnWindowFocus: true,
    });
};

const invalidateHosts = (queryClient) => {
    queryClient.invalidateQueries({ queryKey: ['hosts'] });
};

export const useUpdateHostMutation = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => hostsClient.update(id, data),
        onSuccess: () => invalidateHosts(qc),
    });
};

export const useToggleHostStatusMutation = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => hostsClient.toggleStatus(id),
        onSuccess: () => invalidateHosts(qc),
    });
};

export const useDeleteHostMutation = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => hostsClient.delete(id),
        onSuccess: () => invalidateHosts(qc),
    });
};

