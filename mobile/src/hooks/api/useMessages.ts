import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../contexts/AuthContext";
import { dmService } from "../../services/dm-service";
import { useAdaptivePolling } from "../useAdaptivePolling";

// Polling intervals for conversations list
const CONVERSATIONS_POLL_ACTIVE = 30000;   // 30s (was 10s — excessive for a list)
const CONVERSATIONS_POLL_REALTIME = 120000; // 2min when Jetstream connected

// Polling intervals for active conversation messages
const CONVERSATION_POLL_ACTIVE = 10000;    // 10s when viewing a conversation (was 5s)
const CONVERSATION_POLL_REALTIME = 60000;  // 1min when Jetstream connected

/**
 * Hook to fetch all DM conversations.
 * Polling pauses when app is backgrounded and adapts to Jetstream state.
 */
export function useConversations() {
  const { session } = useAuth();
  const refetchInterval = useAdaptivePolling({
    activeInterval: CONVERSATIONS_POLL_ACTIVE,
    activeRealtimeInterval: CONVERSATIONS_POLL_REALTIME,
  });

  return useQuery({
    queryKey: ["dm-conversations"],
    queryFn: () => dmService.listConversations(),
    enabled: !!session,
    refetchInterval,
    refetchIntervalInBackground: false,
    staleTime: 5000,
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
 * Hook to fetch a specific conversation and its messages.
 * Polls more frequently since the user is actively viewing it,
 * but still pauses when backgrounded.
 */
export function useConversation(conversationId: string | null) {
  const { session } = useAuth();
  const refetchInterval = useAdaptivePolling({
    activeInterval: CONVERSATION_POLL_ACTIVE,
    activeRealtimeInterval: CONVERSATION_POLL_REALTIME,
  });

  return useQuery({
    queryKey: ["dm-conversation", conversationId],
    queryFn: () =>
      conversationId
        ? dmService.getConversation(conversationId)
        : Promise.resolve(null),
    enabled: !!conversationId && !!session,
    refetchInterval: conversationId ? refetchInterval : false,
    refetchIntervalInBackground: false,
    staleTime: 2000,
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

/**
 * Hook to mute a conversation
 */
export function useMuteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) =>
      dmService.muteConversation(conversationId),
    onSuccess: (_, conversationId) => {
      // Invalidate conversations list and the specific conversation
      queryClient.invalidateQueries({ queryKey: ["dm-conversations"] });
      queryClient.invalidateQueries({
        queryKey: ["dm-conversation", conversationId],
      });
    },
  });
}

/**
 * Hook to unmute a conversation
 */
export function useUnmuteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) =>
      dmService.unmuteConversation(conversationId),
    onSuccess: (_, conversationId) => {
      // Invalidate conversations list and the specific conversation
      queryClient.invalidateQueries({ queryKey: ["dm-conversations"] });
      queryClient.invalidateQueries({
        queryKey: ["dm-conversation", conversationId],
      });
    },
  });
}

/**
 * Hook to leave (delete) a conversation
 */
export function useLeaveConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) =>
      dmService.leaveConversation(conversationId),
    onSuccess: () => {
      // Invalidate conversations list to refresh after deletion
      queryClient.invalidateQueries({ queryKey: ["dm-conversations"] });
    },
  });
}
