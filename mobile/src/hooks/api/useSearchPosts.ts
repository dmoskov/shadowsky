import {useInfiniteQuery} from '@tanstack/react-query';
import {searchPosts} from '../../services/atproto/feeds';

export interface SearchFilters {
  sort?: 'top' | 'latest';
  since?: string;
  until?: string;
  lang?: string;
  author?: string;
  mentions?: string;
  domain?: string;
  url?: string;
  tag?: string[];
}

/**
 * Create a stable, deterministic string key from a filters object.
 * Sorting keys ensures {a:1,b:2} and {b:2,a:1} produce the same string,
 * and using a primitive in the queryKey avoids referential-identity issues
 * that cause duplicate cache entries when callers pass inline objects.
 */
function stableFilterKey(filters: SearchFilters): string {
  return JSON.stringify(filters, Object.keys(filters).sort());
}

/**
 * Hook to search posts with filters and infinite scroll
 */
export function useSearchPosts(query: string, filters: SearchFilters = {}) {
  return useInfiniteQuery({
    queryKey: ['searchPosts', query, stableFilterKey(filters)],
    queryFn: ({pageParam}) =>
      searchPosts(query, {
        cursor: pageParam,
        sort: filters.sort,
        since: filters.since,
        until: filters.until,
        lang: filters.lang,
        author: filters.author,
        mentions: filters.mentions,
        domain: filters.domain,
        url: filters.url,
        tag: filters.tag,
      }),
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined as string | undefined,
    enabled: query.length > 0,
    maxPages: 10,
  });
}
