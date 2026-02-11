import {useQuery, useInfiniteQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {getUserLists, getList, getListFeed, createList, deleteList} from '../../services/atproto/lists';

/**
 * Hook to fetch the user's lists
 */
export function useLists() {
  return useQuery({
    queryKey: ['lists'],
    queryFn: getUserLists,
  });
}

/**
 * Hook to fetch a specific list
 */
export function useList(listUri: string) {
  return useQuery({
    queryKey: ['list', listUri],
    queryFn: () => getList(listUri),
    enabled: !!listUri,
  });
}

/**
 * Hook to fetch a list's feed with infinite scroll
 */
export function useListFeed(listUri: string) {
  return useInfiniteQuery({
    queryKey: ['listFeed', listUri],
    queryFn: ({pageParam}) => getListFeed(listUri, {cursor: pageParam}),
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!listUri,
  });
}

/**
 * Hook to create a new list
 */
export function useCreateList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({name, description}: {name: string; description?: string}) =>
      createList(name, description),
    onSuccess: () => {
      // Invalidate lists query to refetch
      queryClient.invalidateQueries({queryKey: ['lists']});
    },
  });
}

/**
 * Hook to delete a list
 */
export function useDeleteList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (listUri: string) => deleteList(listUri),
    onSuccess: () => {
      // Invalidate lists query to refetch
      queryClient.invalidateQueries({queryKey: ['lists']});
    },
  });
}
