import {QueryClient, InvalidateQueryFilters} from '@tanstack/react-query';

/**
 * Invalidate multiple query keys concurrently using Promise.all
 * instead of sequential calls that create waterfall requests.
 */
export function invalidateMany(
  queryClient: QueryClient,
  filters: InvalidateQueryFilters[],
): Promise<void[]> {
  return Promise.all(filters.map((f) => queryClient.invalidateQueries(f)));
}

/**
 * Cancel multiple query keys concurrently using Promise.all
 * instead of sequential awaits that create waterfall cancellations.
 */
export function cancelMany(
  queryClient: QueryClient,
  filters: InvalidateQueryFilters[],
): Promise<void[]> {
  return Promise.all(filters.map((f) => queryClient.cancelQueries(f)));
}
