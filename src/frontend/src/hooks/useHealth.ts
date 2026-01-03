import { useQuery } from '@tanstack/react-query';
import { checkHealth } from '../api/client';

/**
 * Hook to check API health status
 * Useful for showing connection status to users
 */
export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: checkHealth,
    // Check health every 30 seconds
    refetchInterval: 30000,
    // Don't retry too aggressively
    retry: 1,
    // Consider stale after 10 seconds
    staleTime: 10000,
  });
}
