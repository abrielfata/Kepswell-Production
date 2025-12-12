import { QueryClient } from '@tanstack/react-query';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 30, // 30s
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
});

export default queryClient;

