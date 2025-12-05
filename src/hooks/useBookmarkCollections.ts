import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { BookmarkCollection } from "../services/bookmark-collections";
import { bookmarkServiceV2 } from "../services/bookmark-service-v2";

export function useBookmarkCollections() {
  const queryClient = useQueryClient();

  const {
    data: collections = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["bookmarkCollections"],
    queryFn: () => bookmarkServiceV2.getAllCollections(),
    staleTime: 30000,
  });

  const createCollectionMutation = useMutation({
    mutationFn: (
      collection: Omit<
        BookmarkCollection,
        "id" | "createdAt" | "updatedAt" | "bookmarkCount"
      >,
    ) => bookmarkServiceV2.createCollection(collection),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmarkCollections"] });
    },
  });

  const updateCollectionMutation = useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<
        Omit<BookmarkCollection, "id" | "createdAt" | "bookmarkCount">
      >;
    }) => bookmarkServiceV2.updateCollection(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmarkCollections"] });
    },
  });

  const deleteCollectionMutation = useMutation({
    mutationFn: (id: string) => bookmarkServiceV2.deleteCollection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmarkCollections"] });
      queryClient.invalidateQueries({ queryKey: ["collectionBookmarks"] });
    },
  });

  const addToCollectionMutation = useMutation({
    mutationFn: ({
      postUri,
      collectionId,
    }: {
      postUri: string;
      collectionId: string;
    }) => bookmarkServiceV2.addBookmarkToCollection(postUri, collectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmarkCollections"] });
      queryClient.invalidateQueries({ queryKey: ["collectionBookmarks"] });
      queryClient.invalidateQueries({ queryKey: ["bookmarkInCollections"] });
    },
  });

  const removeFromCollectionMutation = useMutation({
    mutationFn: ({
      postUri,
      collectionId,
    }: {
      postUri: string;
      collectionId: string;
    }) => bookmarkServiceV2.removeBookmarkFromCollection(postUri, collectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmarkCollections"] });
      queryClient.invalidateQueries({ queryKey: ["collectionBookmarks"] });
      queryClient.invalidateQueries({ queryKey: ["bookmarkInCollections"] });
    },
  });

  const createCollection = useCallback(
    (
      collection: Omit<
        BookmarkCollection,
        "id" | "createdAt" | "updatedAt" | "bookmarkCount"
      >,
    ) => createCollectionMutation.mutateAsync(collection),
    [createCollectionMutation],
  );

  const updateCollection = useCallback(
    (
      id: string,
      updates: Partial<
        Omit<BookmarkCollection, "id" | "createdAt" | "bookmarkCount">
      >,
    ) => updateCollectionMutation.mutateAsync({ id, updates }),
    [updateCollectionMutation],
  );

  const deleteCollection = useCallback(
    (id: string) => deleteCollectionMutation.mutateAsync(id),
    [deleteCollectionMutation],
  );

  const addToCollection = useCallback(
    (postUri: string, collectionId: string) =>
      addToCollectionMutation.mutateAsync({ postUri, collectionId }),
    [addToCollectionMutation],
  );

  const removeFromCollection = useCallback(
    (postUri: string, collectionId: string) =>
      removeFromCollectionMutation.mutateAsync({ postUri, collectionId }),
    [removeFromCollectionMutation],
  );

  return {
    collections,
    isLoading,
    error,
    refetch,
    createCollection,
    updateCollection,
    deleteCollection,
    addToCollection,
    removeFromCollection,
    isCreating: createCollectionMutation.isPending,
    isUpdating: updateCollectionMutation.isPending,
    isDeleting: deleteCollectionMutation.isPending,
    isAddingToCollection: addToCollectionMutation.isPending,
    isRemovingFromCollection: removeFromCollectionMutation.isPending,
  };
}

export function useBookmarkInCollections(postUri: string) {
  const { data: collectionIds = [], isLoading } = useQuery({
    queryKey: ["bookmarkInCollections", postUri],
    queryFn: () => bookmarkServiceV2.getBookmarkCollections(postUri),
    enabled: !!postUri,
    staleTime: 30000,
  });

  return { collectionIds, isLoading };
}

export function useCollectionBookmarks(collectionId: string | null) {
  const {
    data: bookmarks = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["collectionBookmarks", collectionId],
    queryFn: async () => {
      if (!collectionId) {
        return bookmarkServiceV2.getBookmarkedPosts();
      }
      if (collectionId === "__uncategorized__") {
        return bookmarkServiceV2.getUncategorizedBookmarks();
      }
      return bookmarkServiceV2.getBookmarksInCollection(collectionId);
    },
    enabled: true,
    staleTime: 30000,
  });

  return { bookmarks, isLoading, error, refetch };
}
