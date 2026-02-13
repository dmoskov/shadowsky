import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../contexts/AuthContext";
import { dmService } from "../../services/dm-service";

/**
 * Hook to fetch all DM conversations
 */
export function useConversations() {
  const { session } = useAuth();

  return useQuery({
    queryKey: ["dm-conversations"],
    queryFn: () => dmService.listConversations(),
    enabled: !!session,
    refetchInterval: 10000, // Refresh every 10 seconds
    staleTime: 5000, // Consider data stale after 5 seconds
  });
}

/**
 * Hook to get total unread message count across all conversations
 */
export function useUnreadMessageCount() {
  const { data: conversations } = useConversations();

  const totalUnread = conversations?.reduce(
    (total, convo) => total + (convo.unreadCount || 0),
    0
  ) || 0;

  return totalUnread;
}

/**
 * Hook to fetch a specific conversation and its messages
 */
export function useConversation(conversationId: string | null) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ["dm-conversation", conversationId],
    queryFn: () =>
      conversationId
        ? dmService.getConversation(conversationId)
        : Promise.resolve(null),
    enabled: !!conversationId && !!session,
    refetchInterval: conversationId ? 5000 : false, // Refresh every 5 seconds when viewing
    staleTime: 2000, // Consider data stale after 2 seconds
  });
}

/**
 * Hook to send a message
 */
export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      conversationId,
      text,
      images,
    }: {
      conversationId: string;
      text: string;
      images?: { uri: string; alt: string }[];
    }) => dmService.sendMessage(conversationId, text, images),
    onSuccess: (_, variables) => {
      // Invalidate conversation messages and conversations list
      queryClient.invalidateQueries({
        queryKey: ["dm-conversation", variables.conversationId],
      });
      queryClient.invalidateQueries({ queryKey: ["dm-conversations"] });
    },
  });
}

/**
 * Hook to mark a conversation as read
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) =>
      dmService.updateRead(conversationId),
    onSuccess: () => {
      // Invalidate conversations list to update unread counts
      queryClient.invalidateQueries({ queryKey: ["dm-conversations"] });
    },
  });
}
