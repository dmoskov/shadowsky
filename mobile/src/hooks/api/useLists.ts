import {useQuery, useInfiniteQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {AppBskyGraphDefs} from '@atproto/api';
import {useAuth} from '../../contexts/AuthContext';
import {useToast} from '../../contexts/ToastContext';
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
  ListsResponse,
} from '../../services/atproto/lists';
import {cancelMany, invalidateMany} from '../../utils/query-helpers';

interface InfiniteData<T> {
  pages: T[];
  pageParams: unknown[];
}

/**
 * Hook to fetch the user's lists with cursor-based pagination
 */
export function useLists() {
  const {session} = useAuth();
  return useInfiniteQuery({
    queryKey: ['lists'],
    queryFn: ({pageParam}) => getUserLists({cursor: pageParam}),
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!session,
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
    maxPages: 10,
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
  const {showToast} = useToast();

  return useMutation({
    mutationFn: (listUri: string) => deleteList(listUri),
    onMutate: async (listUri) => {
      await queryClient.cancelQueries({queryKey: ['lists']});

      const previousLists = queryClient.getQueryData<InfiniteData<ListsResponse>>(['lists']);

      // Optimistically remove the list from all pages
      if (previousLists) {
        queryClient.setQueryData<InfiniteData<ListsResponse>>(['lists'], {
          ...previousLists,
          pages: previousLists.pages.map((page) => ({
            ...page,
            lists: page.lists.filter((list) => list.uri !== listUri),
          })),
        });
      }

      return {previousLists};
    },
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['lists']});
    },
    onError: (_error, _listUri, context) => {
      if (context?.previousLists) {
        queryClient.setQueryData(['lists'], context.previousLists);
      }
      showToast('Failed to delete list', {type: 'error'});
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
    maxPages: 10,
  });
}

/**
 * Hook to add a user to a list
 */
export function useAddToList() {
  const queryClient = useQueryClient();
  const {showToast} = useToast();

  return useMutation({
    mutationFn: ({listUri, did}: {listUri: string; did: string}) =>
      addUserToList(listUri, did),
    onMutate: async ({listUri}) => {
      await cancelMany(queryClient, [
        {queryKey: ['listMembers', listUri]},
        {queryKey: ['list', listUri]},
      ]);

      const previousList = queryClient.getQueryData<AppBskyGraphDefs.ListView>(['list', listUri]);

      return {previousList, listUri};
    },
    onSuccess: (_, {listUri}) => {
      invalidateMany(queryClient, [
        {queryKey: ['listMembers', listUri]},
        {queryKey: ['list', listUri]},
      ]);
    },
    onError: (_error, {listUri}, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(['list', listUri], context.previousList);
      }
      showToast('Failed to add user to list', {type: 'error'});
    },
  });
}

/**
 * Hook to remove a user from a list
 */
export function useRemoveFromList() {
  const queryClient = useQueryClient();
  const {showToast} = useToast();

  type ListMembersPage = {items: AppBskyGraphDefs.ListItemView[]; cursor?: string};

  return useMutation({
    mutationFn: ({listItemUri, listUri: _listUri}: {listItemUri: string; listUri: string}) =>
      removeUserFromList(listItemUri),
    onMutate: async ({listItemUri, listUri}) => {
      await cancelMany(queryClient, [
        {queryKey: ['listMembers', listUri]},
        {queryKey: ['list', listUri]},
      ]);

      const previousMembers = queryClient.getQueryData<InfiniteData<ListMembersPage>>(
        ['listMembers', listUri],
      );

      // Optimistically remove the member from the list
      if (previousMembers) {
        queryClient.setQueryData<InfiniteData<ListMembersPage>>(
          ['listMembers', listUri],
          {
            ...previousMembers,
            pages: previousMembers.pages.map((page) => ({
              ...page,
              items: page.items.filter((item) => item.uri !== listItemUri),
            })),
          },
        );
      }

      return {previousMembers, listUri};
    },
    onSuccess: (_, {listUri}) => {
      invalidateMany(queryClient, [
        {queryKey: ['listMembers', listUri]},
        {queryKey: ['list', listUri]},
      ]);
    },
    onError: (_error, {listUri}, context) => {
      if (context?.previousMembers) {
        queryClient.setQueryData(['listMembers', listUri], context.previousMembers);
      }
      showToast('Failed to remove user from list', {type: 'error'});
    },
  });
}

/**
 * Hook to update a list's metadata
 */
export function useUpdateList() {
  const queryClient = useQueryClient();
  const {showToast} = useToast();

  return useMutation({
    mutationFn: ({
      listUri,
      updates,
    }: {
      listUri: string;
      updates: {name?: string; description?: string; purpose?: string};
    }) => updateList(listUri, updates),
    onMutate: async ({listUri, updates}) => {
      await cancelMany(queryClient, [
        {queryKey: ['list', listUri]},
        {queryKey: ['lists']},
      ]);

      const previousList = queryClient.getQueryData<AppBskyGraphDefs.ListView>(['list', listUri]);

      // Optimistically update the list details
      if (previousList) {
        queryClient.setQueryData<AppBskyGraphDefs.ListView>(['list', listUri], {
          ...previousList,
          name: updates.name !== undefined ? updates.name : previousList.name,
          description: updates.description !== undefined ? updates.description : previousList.description,
          purpose: updates.purpose !== undefined ? updates.purpose : previousList.purpose,
        });
      }

      return {previousList, listUri};
    },
    onSuccess: (_, {listUri}) => {
      invalidateMany(queryClient, [
        {queryKey: ['list', listUri]},
        {queryKey: ['lists']},
      ]);
    },
    onError: (_error, {listUri}, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(['list', listUri], context.previousList);
      }
      showToast('Failed to update list', {type: 'error'});
    },
  });
}
