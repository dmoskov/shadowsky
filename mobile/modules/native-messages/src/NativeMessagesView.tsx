/**
 * Native Messages View Component
 *
 * React Native wrapper for the native SwiftUI MessagesView.
 * Provides both a low-level native view and a high-level component
 * that handles data bridging from React Query hooks to native.
 */

import React, {
  useEffect,
  useCallback,
  useMemo,
  useState,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { requireNativeViewManager, requireNativeModule } from 'expo-modules-core';
import { ViewProps, Platform, View, Alert } from 'react-native';
import { useAuth } from '../../../src/contexts/AuthContext';
import {
  useConversations,
  useConversation,
  useSendMessage,
  useMarkAsRead,
  useMuteConversation,
  useUnmuteConversation,
  useLeaveConversation,
  useDeleteMessage,
} from '../../../src/hooks/api/useMessages';
import { useMessageSearch, MessageSearchResult } from '../../../src/hooks/api/useMessageSearch';
import {
  dmService,
  DmConversation,
} from '../../../src/services/dm-service';
import { getAtProtoClient } from '../../../src/services/atproto/client';
import { createLogger } from '../../../src/utils/logger';
import { fetchLinkMetadata, LinkMetadata } from '../../../src/services/ai-service';

const logger = createLogger('NativeMessages');

// Lazy-load native modules (only available on iOS)
let NativeMessagesNative: React.ComponentType<any> | null = null;
let NativeMessagesModule: any = null;

if (Platform.OS === 'ios') {
  try {
    NativeMessagesNative = requireNativeViewManager('NativeMessages');
    NativeMessagesModule = requireNativeModule('NativeMessages');
  } catch (e) {
    // Module not available, will fallback to JS view
  }
}

// MARK: - Event Types

export interface MessagesViewEvents {
  onConversationPress?: (event: { nativeEvent: { conversationId: string } }) => void;
  onBack?: () => void;
  onRefresh?: () => void;
  onNewConversation?: () => void;
  onDeleteConversation?: (event: { nativeEvent: { conversationId: string } }) => void;
  onToggleMute?: (event: { nativeEvent: { conversationId: string; isMuted: boolean } }) => void;
  onSendMessage?: (event: { nativeEvent: { text: string } }) => void;
  onDeleteMessage?: (event: { nativeEvent: { messageId: string } }) => void;
  onMarkAsRead?: (event: { nativeEvent: { conversationId: string } }) => void;
  onProfilePress?: (event: { nativeEvent: { handle: string } }) => void;
  onSearchTextChange?: (event: { nativeEvent: { text: string } }) => void;
  onReaction?: (event: { nativeEvent: { messageId: string; emoji: string } }) => void;
}

// MARK: - Props Types

export interface NativeMessagesProps extends ViewProps, MessagesViewEvents {
  isLoading?: boolean;
  isLoadingMessages?: boolean;
  error?: string | null;
  currentUserDid?: string;
  selectedConversationId?: string | null;
  searchText?: string;
  isSearching?: boolean;
}

// MARK: - Low-level Native View

export const NativeMessagesView = forwardRef<any, NativeMessagesProps>(
  (props, _ref) => {
    const {
      isLoading = false,
      isLoadingMessages = false,
      error = null,
      currentUserDid = '',
      selectedConversationId = null,
      searchText = '',
      isSearching = false,
      onConversationPress,
      onBack,
      onRefresh,
      onNewConversation,
      onDeleteConversation,
      onToggleMute,
      onSendMessage,
      onDeleteMessage,
      onMarkAsRead,
      onProfilePress,
      onSearchTextChange,
      onReaction,
      ...viewProps
    } = props;

    if (Platform.OS !== 'ios' || !NativeMessagesNative) {
      return <View {...viewProps} />;
    }

    return (
      <NativeMessagesNative
        {...viewProps}
        isLoading={isLoading}
        isLoadingMessages={isLoadingMessages}
        error={error}
        currentUserDid={currentUserDid}
        selectedConversationId={selectedConversationId}
        searchText={searchText}
        isSearching={isSearching}
        onConversationPress={onConversationPress}
        onBack={onBack}
        onRefresh={onRefresh}
        onNewConversation={onNewConversation}
        onDeleteConversation={onDeleteConversation}
        onToggleMute={onToggleMute}
        onSendMessage={onSendMessage}
        onDeleteMessage={onDeleteMessage}
        onMarkAsRead={onMarkAsRead}
        onProfilePress={onProfilePress}
        onSearchTextChange={onSearchTextChange}
        onReaction={onReaction}
      />
    );
  },
);

NativeMessagesView.displayName = 'NativeMessagesView';

// MARK: - Link Detection

const URL_REGEX = /https?:\/\/[^\s<>)"']+/i;

function extractFirstUrl(text: string): string | null {
  const match = text.match(URL_REGEX);
  return match?.[0] || null;
}

// MARK: - Serialization Helpers

function serializeConversations(
  conversations: DmConversation[],
): string {
  const serialized = conversations.map((convo) => ({
    id: convo.id,
    rev: convo.rev,
    members: convo.members.map((m) => ({
      did: m.did,
      handle: m.handle,
      displayName: m.displayName,
      avatar: m.avatar,
    })),
    muted: convo.muted,
    unreadCount: convo.unreadCount,
    lastMessage: convo.lastMessage
      ? {
          id: convo.lastMessage.id,
          text: convo.lastMessage.text,
          sentAt: convo.lastMessage.sentAt,
          senderDid: convo.lastMessage.sender.did,
        }
      : null,
  }));
  return JSON.stringify(serialized);
}

function serializeConversationMessages(
  conversationData: {
    conversation: DmConversation;
    messages: any[];
  } | null | undefined,
  linkPreviews: Map<string, LinkMetadata>,
): string | null {
  if (!conversationData) return null;

  const serialized = {
    conversation: {
      id: conversationData.conversation.id,
      rev: conversationData.conversation.rev,
      members: conversationData.conversation.members.map((m) => ({
        did: m.did,
        handle: m.handle,
        displayName: m.displayName,
        avatar: m.avatar,
      })),
      muted: conversationData.conversation.muted,
      unreadCount: conversationData.conversation.unreadCount,
    },
    messages: conversationData.messages.map((msg) => {
      const url = extractFirstUrl(msg.text || '');
      const preview = url ? linkPreviews.get(url) : null;

      return {
        id: msg.id,
        rev: msg.rev,
        text: msg.text,
        sentAt: msg.sentAt,
        senderDid: msg.sender.did,
        linkPreview: preview ? {
          url: preview.url,
          title: preview.title || null,
          description: preview.description || null,
          imageUrl: preview.imageUrl || null,
        } : null,
      };
    }),
  };
  return JSON.stringify(serialized);
}

function serializeSearchResults(
  results: MessageSearchResult[],
  currentUserDid: string,
): string {
  const serialized = results.map((r) => {
    const otherMember =
      r.conversation.members.find((m) => m.did !== currentUserDid) ||
      r.conversation.members[0];
    return {
      conversationId: r.conversationId,
      matchType: r.matchType,
      displayName: otherMember?.displayName || otherMember?.handle || 'Unknown',
      handle: otherMember?.handle || '',
      avatar: otherMember?.avatar || null,
      matchedMessageText: r.matchedMessage?.text || null,
      matchedMessageSentAt: r.matchedMessage?.sentAt || null,
    };
  });
  return JSON.stringify(serialized);
}

// MARK: - High-level Component with Data Bridge

export interface NativeMessagesHandle {
  scrollToTop: () => void;
}

export const NativeMessages = forwardRef<NativeMessagesHandle, ViewProps & {
  onNavigateToProfile?: (handle: string) => void;
  onShowNewConversationModal?: () => void;
}>((props, ref) => {
  const { onNavigateToProfile, onShowNewConversationModal, ...viewProps } = props;
  const { session } = useAuth();

  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const linkPreviewCache = useRef<Map<string, LinkMetadata>>(new Map());
  const linkPreviewFetching = useRef<Set<string>>(new Set());

  // Set up DM service with agent
  useEffect(() => {
    if (session) {
      try {
        const client = getAtProtoClient();
        const agent = client.getAgent();
        dmService.setAgent(agent);
      } catch (error) {
        logger.error('Failed to get agent:', error);
      }
    }
  }, [session]);

  // Data hooks
  const {
    data: conversations,
    isLoading: loadingConversations,
    error: conversationsError,
    refetch: refetchConversations,
  } = useConversations();

  const {
    data: conversationData,
    isLoading: loadingMessages,
    refetch: refetchMessages,
  } = useConversation(selectedConversation);

  // Mutations
  const sendMessageMutation = useSendMessage();
  const markAsReadMutation = useMarkAsRead();
  const muteConversationMutation = useMuteConversation();
  const unmuteConversationMutation = useUnmuteConversation();
  const leaveConversationMutation = useLeaveConversation();
  const deleteMessageMutation = useDeleteMessage();

  // Message search
  const { results: searchResults, isSearching } = useMessageSearch(searchText);

  // Bridge conversations data to native
  useEffect(() => {
    if (conversations && NativeMessagesModule) {
      const json = serializeConversations(conversations);
      NativeMessagesModule.updateConversations(json);
    }
  }, [conversations]);

  // Bridge messages data to native (including link previews)
  useEffect(() => {
    if (conversationData && NativeMessagesModule) {
      // First, push with whatever previews we have cached
      const json = serializeConversationMessages(conversationData, linkPreviewCache.current);
      if (json) {
        NativeMessagesModule.updateMessages(json);
      }

      // Then, fetch any missing link previews
      const urls: string[] = [];
      for (const msg of conversationData.messages) {
        const url = extractFirstUrl(msg.text || '');
        if (url && !linkPreviewCache.current.has(url) && !linkPreviewFetching.current.has(url)) {
          urls.push(url);
        }
      }

      if (urls.length > 0) {
        urls.forEach((url) => linkPreviewFetching.current.add(url));
        Promise.allSettled(
          urls.map(async (url) => {
            try {
              const metadata = await fetchLinkMetadata(url);
              linkPreviewCache.current.set(url, metadata);
            } catch {
              // Ignore failures — just don't show a preview
            } finally {
              linkPreviewFetching.current.delete(url);
            }
          }),
        ).then(() => {
          // Re-serialize with updated previews
          if (conversationData && NativeMessagesModule) {
            const updatedJson = serializeConversationMessages(conversationData, linkPreviewCache.current);
            if (updatedJson) {
              NativeMessagesModule.updateMessages(updatedJson);
            }
          }
        });
      }
    }
  }, [conversationData]);

  // Bridge search results to native
  useEffect(() => {
    if (NativeMessagesModule && searchText.trim().length >= 2) {
      const json = serializeSearchResults(searchResults, session?.did || '');
      NativeMessagesModule.updateSearchResults(json);
    } else if (NativeMessagesModule) {
      NativeMessagesModule.updateSearchResults('[]');
    }
  }, [searchResults, searchText, session?.did]);

  // Mark conversation as read when opened
  useEffect(() => {
    if (
      selectedConversation &&
      conversationData?.conversation?.unreadCount &&
      conversationData.conversation.unreadCount > 0
    ) {
      const timer = setTimeout(() => {
        markAsReadMutation.mutate(selectedConversation);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [selectedConversation, conversationData?.conversation?.unreadCount]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (NativeMessagesModule) {
        NativeMessagesModule.clearData();
      }
    };
  }, []);

  // Error message
  const errorMessage = useMemo(() => {
    if (!conversationsError) return null;
    return conversationsError instanceof Error
      ? conversationsError.message
      : 'Failed to load conversations';
  }, [conversationsError]);

  // Event handlers
  const handleConversationPress = useCallback(
    (event: { nativeEvent: { conversationId: string } }) => {
      setSelectedConversation(event.nativeEvent.conversationId);
    },
    [],
  );

  const handleBack = useCallback(() => {
    setSelectedConversation(null);
  }, []);

  const handleRefresh = useCallback(() => {
    refetchConversations();
  }, [refetchConversations]);

  const handleNewConversation = useCallback(() => {
    onShowNewConversationModal?.();
  }, [onShowNewConversationModal]);

  const handleDeleteConversation = useCallback(
    (event: { nativeEvent: { conversationId: string } }) => {
      const conversationId = event.nativeEvent.conversationId;
      Alert.alert(
        'Delete Conversation',
        'Are you sure you want to delete this conversation? This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await leaveConversationMutation.mutateAsync(conversationId);
                if (selectedConversation === conversationId) {
                  setSelectedConversation(null);
                }
              } catch (error) {
                logger.error('Failed to delete conversation:', error);
                Alert.alert('Error', 'Failed to delete conversation. Please try again.');
              }
            },
          },
        ],
      );
    },
    [leaveConversationMutation, selectedConversation],
  );

  const handleToggleMute = useCallback(
    async (event: { nativeEvent: { conversationId: string; isMuted: boolean } }) => {
      const { conversationId, isMuted } = event.nativeEvent;
      try {
        if (isMuted) {
          await unmuteConversationMutation.mutateAsync(conversationId);
        } else {
          await muteConversationMutation.mutateAsync(conversationId);
        }
      } catch (error) {
        logger.error('Failed to toggle mute:', error);
        Alert.alert('Error', 'Failed to update conversation. Please try again.');
      }
    },
    [muteConversationMutation, unmuteConversationMutation],
  );

  const handleSendMessage = useCallback(
    async (event: { nativeEvent: { text: string } }) => {
      if (!selectedConversation) return;
      const text = event.nativeEvent.text;

      try {
        await sendMessageMutation.mutateAsync({
          conversationId: selectedConversation,
          text,
        });
        if (NativeMessagesModule) {
          NativeMessagesModule.setMessageSent(true, null);
        }
        setTimeout(() => {
          refetchMessages();
        }, 500);
      } catch (error) {
        logger.error('Failed to send message:', error);
        if (NativeMessagesModule) {
          NativeMessagesModule.setMessageSent(false, 'Failed to send message');
        }
        Alert.alert('Error', 'Failed to send message. Please try again.');
      }
    },
    [selectedConversation, sendMessageMutation, refetchMessages],
  );

  const handleDeleteMessage = useCallback(
    (event: { nativeEvent: { messageId: string } }) => {
      if (!selectedConversation) return;
      const messageId = event.nativeEvent.messageId;

      Alert.alert(
        'Delete Message',
        'Are you sure you want to delete this message? This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteMessageMutation.mutateAsync({
                  conversationId: selectedConversation,
                  messageId,
                });
              } catch (error) {
                logger.error('Failed to delete message:', error);
                Alert.alert('Error', 'Failed to delete message. Please try again.');
              }
            },
          },
        ],
      );
    },
    [selectedConversation, deleteMessageMutation],
  );

  const handleProfilePress = useCallback(
    (event: { nativeEvent: { handle: string } }) => {
      onNavigateToProfile?.(event.nativeEvent.handle);
    },
    [onNavigateToProfile],
  );

  const handleSearchTextChange = useCallback(
    (event: { nativeEvent: { text: string } }) => {
      setSearchText(event.nativeEvent.text);
    },
    [],
  );

  const handleReaction = useCallback(
    (event: { nativeEvent: { messageId: string; emoji: string } }) => {
      if (!selectedConversation) return;
      // Reactions are not yet supported by the Bluesky chat API,
      // but we handle the event for future integration
      logger.log('Reaction event:', event.nativeEvent.messageId, event.nativeEvent.emoji);
    },
    [selectedConversation],
  );

  // Expose scroll-to-top
  useImperativeHandle(ref, () => ({
    scrollToTop: () => {
      // SwiftUI handles scroll-to-top natively
    },
  }));

  return (
    <NativeMessagesView
      {...viewProps}
      isLoading={loadingConversations}
      isLoadingMessages={loadingMessages}
      error={errorMessage}
      currentUserDid={session?.did || ''}
      selectedConversationId={selectedConversation}
      searchText={searchText}
      isSearching={isSearching}
      onConversationPress={handleConversationPress}
      onBack={handleBack}
      onRefresh={handleRefresh}
      onNewConversation={handleNewConversation}
      onDeleteConversation={handleDeleteConversation}
      onToggleMute={handleToggleMute}
      onSendMessage={handleSendMessage}
      onDeleteMessage={handleDeleteMessage}
      onProfilePress={handleProfilePress}
      onSearchTextChange={handleSearchTextChange}
      onReaction={handleReaction}
      style={{ flex: 1 }}
    />
  );
});

NativeMessages.displayName = 'NativeMessages';

export default NativeMessages;
