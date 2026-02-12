import {useQuery, useInfiniteQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {
  getUserLists,
  getList,
  getListFeed,
  createList,
  deleteList,
  getListMembers,
  addUserToList,
  removeUserFromList,
  updateList,
} from '../../services/atproto/lists';

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
    mutationFn: ({
      name,
      description,
      purpose,
    }: {
      name: string;
      description?: string;
      purpose?: string;
    }) => createList(name, description, purpose),
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

/**
 * Hook to fetch list members with infinite scroll
 */
export function useListMembers(listUri: string) {
  return useInfiniteQuery({
    queryKey: ['listMembers', listUri],
    queryFn: ({pageParam}) => getListMembers(listUri, {cursor: pageParam}),
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!listUri,
  });
}

/**
 * Hook to add a user to a list
 */
export function useAddToList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({listUri, did}: {listUri: string; did: string}) =>
      addUserToList(listUri, did),
    onSuccess: (_, {listUri}) => {
      // Invalidate list members and list details to refetch
      queryClient.invalidateQueries({queryKey: ['listMembers', listUri]});
      queryClient.invalidateQueries({queryKey: ['list', listUri]});
    },
  });
}

/**
 * Hook to remove a user from a list
 */
export function useRemoveFromList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({listItemUri, listUri}: {listItemUri: string; listUri: string}) =>
      removeUserFromList(listItemUri),
    onSuccess: (_, {listUri}) => {
      // Invalidate list members and list details to refetch
      queryClient.invalidateQueries({queryKey: ['listMembers', listUri]});
      queryClient.invalidateQueries({queryKey: ['list', listUri]});
    },
  });
}

/**
 * Hook to update a list's metadata
 */
export function useUpdateList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      listUri,
      updates,
    }: {
      listUri: string;
      updates: {name?: string; description?: string; purpose?: string};
    }) => updateList(listUri, updates),
    onSuccess: (_, {listUri}) => {
      // Invalidate list queries to refetch
      queryClient.invalidateQueries({queryKey: ['list', listUri]});
      queryClient.invalidateQueries({queryKey: ['lists']});
    },
  });
}
