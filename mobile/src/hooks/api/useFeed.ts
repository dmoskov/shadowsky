import {useInfiniteQuery, useQuery} from '@tanstack/react-query';
import {getTimeline, getFeed, getAuthorFeed, getActorLikes, getPostThread, AuthorFeedFilter} from '../../services/atproto/feeds';

/**
 * Hook to fetch the user's timeline with infinite scroll
 */
export function useTimeline() {
  return useInfiniteQuery({
    queryKey: ['timeline'],
    queryFn: ({pageParam}) => getTimeline({cursor: pageParam}),
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined as string | undefined,
    maxPages: 10,
  });
}

/**
 * Hook to fetch a custom feed with infinite scroll
 */
export function useCustomFeed(feedUri: string) {
  return useInfiniteQuery({
    queryKey: ['feed', feedUri],
    queryFn: ({pageParam}) => getFeed(feedUri, {cursor: pageParam}),
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!feedUri,
    maxPages: 10,
  });
}

/**
 * Hook to fetch an author's feed with infinite scroll
 */
export function useAuthorFeed(actor: string, filter?: AuthorFeedFilter) {
  return useInfiniteQuery({
    queryKey: ['authorFeed', actor, filter],
    queryFn: ({pageParam}) => getAuthorFeed(actor, {cursor: pageParam, filter}),
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!actor,
    maxPages: 10,
  });
}

/**
 * Hook to fetch an actor's likes with infinite scroll
 */
export function useActorLikes(actor: string) {
  return useInfiniteQuery({
    queryKey: ['actorLikes', actor],
    queryFn: ({pageParam}) => getActorLikes(actor, {cursor: pageParam}),
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!actor,
    maxPages: 10,
  });
}

/**
 * Hook to fetch a post thread
 */
export function usePostThread(uri: string) {
  return useQuery({
    queryKey: ['thread', uri],
    queryFn: () => getPostThread(uri),
    enabled: !!uri,
    staleTime: 2 * 60 * 1000,
  });
}
