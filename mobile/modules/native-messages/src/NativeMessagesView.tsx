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
import { useImagePicker } from '../../../src/hooks/useImagePicker';
import {
  dmService,
  DmConversation,
} from '../../../src/services/dm-service';
import { getAtProtoClient } from '../../../src/services/atproto/client';
import { createLogger } from '../../../src/utils/logger';

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
  onPickImage?: () => void;
  onMarkAsRead?: (event: { nativeEvent: { conversationId: string } }) => void;
  onProfilePress?: (event: { nativeEvent: { handle: string } }) => void;
}

// MARK: - Props Types

export interface NativeMessagesProps extends ViewProps, MessagesViewEvents {
  isLoading?: boolean;
  isLoadingMessages?: boolean;
  error?: string | null;
  currentUserDid?: string;
  selectedConversationId?: string | null;
  searchText?: string;
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
      onConversationPress,
      onBack,
      onRefresh,
      onNewConversation,
      onDeleteConversation,
      onToggleMute,
      onSendMessage,
      onDeleteMessage,
      onPickImage,
      onMarkAsRead,
      onProfilePress,
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
        onConversationPress={onConversationPress}
        onBack={onBack}
        onRefresh={onRefresh}
        onNewConversation={onNewConversation}
        onDeleteConversation={onDeleteConversation}
        onToggleMute={onToggleMute}
        onSendMessage={onSendMessage}
        onDeleteMessage={onDeleteMessage}
        onPickImage={onPickImage}
        onMarkAsRead={onMarkAsRead}
        onProfilePress={onProfilePress}
      />
    );
  },
);

NativeMessagesView.displayName = 'NativeMessagesView';

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
    messages: conversationData.messages.map((msg) => ({
      id: msg.id,
      rev: msg.rev,
      text: msg.text,
      sentAt: msg.sentAt,
      senderDid: msg.sender.did,
      embed: msg.embed
        ? {
            images: msg.embed.images?.map((img: any) => ({
              refLink: img.image?.ref?.$link,
              mimeType: img.image?.mimeType,
              size: img.image?.size,
              alt: img.alt,
            })),
          }
        : null,
    })),
  };
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
  const [searchText] = useState('');

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

  // Image picker
  const {
    pickFromLibrary,
    selectedImages,
    clearImages,
    setIsUploading,
  } = useImagePicker();

  // Bridge conversations data to native
  useEffect(() => {
    if (conversations && NativeMessagesModule) {
      const json = serializeConversations(conversations);
      NativeMessagesModule.updateConversations(json);
    }
  }, [conversations]);

  // Bridge messages data to native
  useEffect(() => {
    if (conversationData && NativeMessagesModule) {
      const json = serializeConversationMessages(conversationData);
      if (json) {
        NativeMessagesModule.updateMessages(json);
      }
    }
  }, [conversationData]);

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
      const images = selectedImages.map((img) => ({ uri: img.uri, alt: img.altText }));

      setIsUploading(true);
      try {
        await sendMessageMutation.mutateAsync({
          conversationId: selectedConversation,
          text,
          images: images.length > 0 ? images : undefined,
        });
        clearImages();
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
      } finally {
        setIsUploading(false);
      }
    },
    [selectedConversation, selectedImages, sendMessageMutation, clearImages, setIsUploading, refetchMessages],
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

  const handlePickImage = useCallback(() => {
    pickFromLibrary(true);
  }, [pickFromLibrary]);

  const handleProfilePress = useCallback(
    (event: { nativeEvent: { handle: string } }) => {
      onNavigateToProfile?.(event.nativeEvent.handle);
    },
    [onNavigateToProfile],
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
      onConversationPress={handleConversationPress}
      onBack={handleBack}
      onRefresh={handleRefresh}
      onNewConversation={handleNewConversation}
      onDeleteConversation={handleDeleteConversation}
      onToggleMute={handleToggleMute}
      onSendMessage={handleSendMessage}
      onDeleteMessage={handleDeleteMessage}
      onPickImage={handlePickImage}
      onProfilePress={handleProfilePress}
      style={{ flex: 1 }}
    />
  );
});

NativeMessages.displayName = 'NativeMessages';

export default NativeMessages;
