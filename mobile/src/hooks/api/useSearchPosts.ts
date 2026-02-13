import {useInfiniteQuery} from '@tanstack/react-query';
import {searchPosts, SearchPostsOptions} from '../../services/atproto/feeds';

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
 * Hook to search posts with filters and infinite scroll
 */
export function useSearchPosts(query: string, filters: SearchFilters = {}) {
  return useInfiniteQuery({
    queryKey: ['searchPosts', query, filters],
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
  });
}
