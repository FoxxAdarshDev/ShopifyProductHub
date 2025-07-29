import { useQuery } from '@tanstack/react-query';

export interface StatusCounts {
  total: number;
  shopifyContent: number;
  newLayout: number;
  draftMode: number;
  noContent: number;
}

export function useStatusCounts() {
  return useQuery<StatusCounts>({
    queryKey: ['/api/products/status-counts'],
    queryFn: async () => {
      const response = await fetch('/api/products/status-counts');
      if (!response.ok) {
        throw new Error('Failed to fetch status counts');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}