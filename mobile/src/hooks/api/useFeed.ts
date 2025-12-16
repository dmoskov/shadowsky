import {useInfiniteQuery, useQuery} from '@tanstack/react-query';
import {getTimeline, getFeed, getAuthorFeed, getActorLikes, getPostThread} from '../../services/atproto/feeds';

/**
 * Hook to fetch the user's timeline with infinite scroll
 */
export function useTimeline() {
  return useInfiniteQuery({
    queryKey: ['timeline'],
    queryFn: ({pageParam}) => getTimeline({cursor: pageParam}),
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined as string | undefined,
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
  });
}

/**
 * Hook to fetch an author's feed with infinite scroll
 */
export function useAuthorFeed(actor: string) {
  return useInfiniteQuery({
    queryKey: ['authorFeed', actor],
    queryFn: ({pageParam}) => getAuthorFeed(actor, {cursor: pageParam}),
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!actor,
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
  });
}
