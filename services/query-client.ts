import { QueryClient } from '@tanstack/react-query';

/**
 * TanStack Query client for the Smart Assignment Planner.
 *
 * Configuration:
 * - staleTime: 5 minutes (data is fresh for 5 min after fetch)
 * - retry: 2 attempts on failure, no retry on 4xx client errors
 * - gcTime: 10 minutes (garbage collect inactive queries)
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,      // 5 minutes
      gcTime: 1000 * 60 * 10,        // 10 minutes
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof Error && error.message.includes('4')) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,      // Re-fetch when network comes back online
    },
    mutations: {
      retry: 0,
    },
  },
});

