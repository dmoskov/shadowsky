import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Animated,
} from "react-native";
import { formatDistanceToNow } from "date-fns";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { useAuth } from "../../contexts/AuthContext";
import {
  dmService,
  DmConversation,
  DmMessage,
} from "../../services/dm-service";
import { getAtProtoClient } from "../../services/atproto/client";
import { LoadingState } from "../../components/LoadingState";
import { ErrorState } from "../../components/ErrorState";
import { EmptyState } from "../../components/EmptyState";
import { NewConversationModal } from "../../components/NewConversationModal";
import { LockIcon, ChatBubbleIcon, ArrowLeftIcon, SearchIcon, CloseIcon, PlusIcon, TrashIcon, BellIcon, BellSlashIcon } from "../../components/icons";
import { useConversations, useConversation, useSendMessage, useMarkAsRead, useMuteConversation, useUnmuteConversation, useLeaveConversation, useDeleteMessage } from "../../hooks/api";
import { useTheme } from "../../contexts/ThemeContext";
import { useAppNavigation } from "../../hooks/useNavigation";
import { InlineErrorBoundary } from "../../components/ui/InlineErrorBoundary";
import { SkeletonShimmer } from "../../components/SkeletonShimmer";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { createLogger } from '../../utils/logger';

const logger = createLogger('MessagesScreen');

// Feature flag for native messages view on iOS
const USE_NATIVE_MESSAGES = Platform.OS === 'ios';

// Lazy-load native messages module to avoid crashes on Android
let NativeMessagesComponent: React.ComponentType<any> | null = null;
if (USE_NATIVE_MESSAGES) {
  try {
    const mod = require('../../../modules/native-messages');
    NativeMessagesComponent = mod.NativeMessages;
  } catch (e) {
    // Native module not available, fall back to JS
  }
}

export function MessagesScreen() {
  const { colors } = useTheme();
  const { navigateToProfile } = useAppNavigation();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(null);
  const [messageText, setMessageText] = useState("");
  const [searchText, setSearchText] = useState("");
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const [showNewConversationModalNative, setShowNewConversationModalNative] = useState(false);

  const styles = useMemo(() => createStyles(colors), [colors]);

  // On iOS, render the native SwiftUI messages view
  if (USE_NATIVE_MESSAGES && NativeMessagesComponent) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ paddingTop: insets.top, backgroundColor: colors.background, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', height: 44 }}>
            <TouchableOpacity
              onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)/(home)')}
              style={{ paddingLeft: 8, paddingRight: 4, padding: 8 }}
              accessibilityLabel="Go back"
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ArrowLeftIcon size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text, flex: 1, textAlign: 'center', marginRight: 36 }}>Messages</Text>
          </View>
        </View>
        <NativeMessagesComponent
          style={{ flex: 1 }}
          onNavigateToProfile={navigateToProfile}
          onShowNewConversationModal={() => setShowNewConversationModalNative(true)}
        />
        <NewConversationModal
          visible={showNewConversationModalNative}
          onClose={() => setShowNewConversationModalNative(false)}
          onSelectUser={async (userDid: string) => {
            setShowNewConversationModalNative(false);
            try {
              const client = getAtProtoClient();
              const agent = client.getAgent();
              dmService.setAgent(agent);
              await dmService.getConvoForMembers([userDid]);
            } catch (error) {
              logger.error('Failed to create conversation:', error);
              const errorMsg =
                error instanceof Error ? error.message : "Failed to start conversation";
              Alert.alert("Error", errorMsg);
            }
          }}
        />
      </View>
    );
  }

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

  // Fetch conversations list using hook
  const {
    data: conversations,
    isLoading: loadingConversations,
    error: conversationsError,
    refetch: refetchConversations,
  } = useConversations();

  // Fetch messages for selected conversation using hook
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
  }, [selectedConversation, conversationData, markAsReadMutation]);

  // Scroll to bottom when messages load
  useEffect(() => {
    if (conversationData?.messages.length) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [conversationData?.messages.length]);

  const handleSendMessage = async () => {
    if (!selectedConversation || !messageText.trim() || sendMessageMutation.isPending) return;

    const text = messageText.trim();
    setMessageText("");

    try {
      await sendMessageMutation.mutateAsync({
        conversationId: selectedConversation,
        text,
      });

      // Refresh messages after sending
      setTimeout(() => {
        refetchMessages();
      }, 500);
    } catch (error) {
      logger.error('Failed to send message:', error);
      Alert.alert("Error", "Failed to send message. Please try again.");
      setMessageText(text); // Restore message on error
    }
  };

  const handleStartNewConversation = async (userDid: string) => {
    setShowNewConversationModal(false);
    setIsCreatingConversation(true);

    try {
      // Get or create conversation with this user
      const conversation = await dmService.getConvoForMembers([userDid]);

      // Refresh conversations list to include the new/found conversation
      await refetchConversations();

      // Select the conversation
      setSelectedConversation(conversation.id);
    } catch (error) {
      logger.error('Failed to create conversation:', error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to start conversation";
      Alert.alert("Error", errorMessage);
    } finally {
      setIsCreatingConversation(false);
    }
  };

  const handleDeleteConversation = (conversationId: string) => {
    const conversation = conversations?.find((c) => c.id === conversationId);
    const otherMember = conversation ? getOtherMember(conversation) : null;
    const displayName = otherMember?.displayName || otherMember?.handle || "this user";

    Alert.alert(
      "Delete Conversation",
      `Are you sure you want to delete your conversation with ${displayName}? This cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await leaveConversationMutation.mutateAsync(conversationId);
              if (selectedConversation === conversationId) {
                setSelectedConversation(null);
              }
            } catch (error) {
              logger.error('Failed to delete conversation:', error);
              Alert.alert("Error", "Failed to delete conversation. Please try again.");
            }
          },
        },
      ]
    );
  };

  const handleToggleMute = async (conversationId: string, isMuted: boolean) => {
    try {
      if (isMuted) {
        await unmuteConversationMutation.mutateAsync(conversationId);
      } else {
        await muteConversationMutation.mutateAsync(conversationId);
      }
    } catch (error) {
      logger.error('Failed to toggle mute:', error);
      Alert.alert("Error", "Failed to update conversation. Please try again.");
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    if (!selectedConversation) return;

    Alert.alert(
      "Delete Message",
      "Are you sure you want to delete this message? This cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMessageMutation.mutateAsync({
                conversationId: selectedConversation,
                messageId,
              });
            } catch (error) {
              logger.error('Failed to delete message:', error);
              Alert.alert("Error", "Failed to delete message. Please try again.");
            }
          },
        },
      ]
    );
  };

  // Filter conversations based on search text
  const filteredConversations = useMemo(() => {
    if (!conversations || !searchText.trim()) return conversations;

    const search = searchText.toLowerCase();
    return conversations.filter((convo) => {
      const otherMember = convo.members.find((m) => m.did !== session?.did) || convo.members[0];
      const displayName = (otherMember.displayName || "").toLowerCase();
      const handle = (otherMember.handle || "").toLowerCase();
      const lastMessage = (convo.lastMessage?.text || "").toLowerCase();

      return (
        displayName.includes(search) ||
        handle.includes(search) ||
        lastMessage.includes(search)
      );
    });
  }, [conversations, searchText, session?.did]);

  const getOtherMember = (conversation: DmConversation) => {
    return (
      conversation.members.find((member) => member.did !== session?.did) ||
      conversation.members[0]
    );
  };

  const formatMessageTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return "";
    }
  };

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
    conversationId: string
  ) => {
    const trans = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [0, 80],
      extrapolate: "clamp",
    });

    return (
      <Animated.View
        style={[
          styles.swipeActions,
          {
            transform: [{ translateX: trans }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.deleteAction}
          onPress={() => handleDeleteConversation(conversationId)}
        >
          <TrashIcon size={24} color={colors.text} />
          <Text style={styles.actionText}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderConversationItem = ({
    item,
  }: {
    item: DmConversation;
  }) => {
    const otherMember = getOtherMember(item);
    const isSelected = selectedConversation === item.id;

    return (
      <InlineErrorBoundary silent context="ConversationItem">
      <Swipeable
        renderRightActions={(progress, dragX) =>
          renderRightActions(progress, dragX, item.id)
        }
        overshootRight={false}
      >
        <TouchableOpacity
          style={[styles.conversationItem, isSelected && styles.selectedConversation]}
          onPress={() => setSelectedConversation(item.id)}
        >
          <View style={styles.conversationContent}>
            {otherMember.avatar ? (
              <Image
                source={{ uri: otherMember.avatar }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {(
                    otherMember.displayName ||
                    otherMember.handle ||
                    "U"
                  )[0].toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.conversationDetails}>
              <View style={styles.conversationHeader}>
                <View style={styles.conversationNameRow}>
                  <Text style={styles.displayName} numberOfLines={1}>
                    {otherMember.displayName ||
                      otherMember.handle ||
                      "Unknown User"}
                  </Text>
                  {item.muted && (
                    <BellSlashIcon size={16} color={colors.textSecondary} />
                  )}
                </View>
                {item.unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadCount}>{item.unreadCount}</Text>
                  </View>
                )}
              </View>
              {otherMember.handle && (
                <Text style={styles.handle} numberOfLines={1}>
                  @{otherMember.handle}
                </Text>
              )}
              {item.lastMessage && (
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {item.lastMessage.text}
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Swipeable>
      </InlineErrorBoundary>
    );
  };

  const renderMessage = ({ item }: { item: DmMessage }) => {
    const isOwnMessage = item.sender.did === session?.did;

    // Determine delivery status for own messages
    // If message exists on server, it's delivered
    const deliveryStatus = isOwnMessage ? (item.id ? "delivered" : "sent") : null;

    const messageBubbleContent = (
      <>
        {item.text && (
          <Text
            style={[
              styles.messageText,
              isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
            ]}
          >
            {item.text}
          </Text>
        )}

        <View style={styles.messageFooter}>
          <Text
            style={[
              styles.messageTime,
              isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime,
            ]}
          >
            {formatMessageTime(item.sentAt)}
          </Text>
          {isOwnMessage && deliveryStatus && (
            <Text
              style={[
                styles.deliveryStatus,
                isOwnMessage && styles.ownDeliveryStatus,
              ]}
            >
              {deliveryStatus === "delivered" ? "✓✓" : "✓"}
            </Text>
          )}
        </View>
      </>
    );

    return (
      <InlineErrorBoundary silent context="MessageBubble">
        <View
          style={[
            styles.messageContainer,
            isOwnMessage ? styles.ownMessage : styles.otherMessage,
          ]}
        >
          {isOwnMessage ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onLongPress={() => handleDeleteMessage(item.id)}
              style={[styles.messageBubble, styles.ownMessageBubble]}
            >
              {messageBubbleContent}
            </TouchableOpacity>
          ) : (
            <View
              style={[styles.messageBubble, styles.otherMessageBubble]}
            >
              {messageBubbleContent}
            </View>
          )}
        </View>
      </InlineErrorBoundary>
    );
  };

  // Handle error state
  if (conversationsError) {
    const errorMessage =
      conversationsError instanceof Error
        ? conversationsError.message
        : "Failed to load conversations";

    // Check if it's a permission error
    if (errorMessage.includes("permission") || errorMessage.includes("403")) {
      return (
        <View style={styles.container}>
          <View style={styles.permissionErrorContainer}>
            <View style={{marginBottom: 16}}>
              <LockIcon size={64} color={colors.textSecondary} />
            </View>
            <Text style={styles.permissionErrorTitle}>
              App Password Required
            </Text>
            <Text style={styles.permissionErrorText}>
              Direct Messages require an app password with chat permissions.
            </Text>
            <Text style={styles.permissionErrorSteps}>
              To enable DMs:{"\n"}
              1. Go to Settings → App Passwords on Bluesky{"\n"}
              2. Create a new app password with "Direct Messages" enabled{"\n"}
              3. Log out and log back in with the new app password
            </Text>
          </View>
        </View>
      );
    }

    return (
      <ErrorState
        message={errorMessage}
        onRetry={refetchConversations}
      />
    );
  }

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(app)/(tabs)/(home)' as any);
    }
  };

  // Show loading state
  if (loadingConversations) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
              <View style={styles.backButtonContent}>
                <ArrowLeftIcon size={20} color={colors.primary} />
                <Text style={styles.backButtonText}>Back</Text>
              </View>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Messages</Text>
            <View style={{ width: 60 }} />
          </View>
        </View>
        {[...Array(5)].map((_, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' }}>
            <SkeletonShimmer width={48} height={48} borderRadius={24} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <SkeletonShimmer width={150} height={16} />
              <View style={{ marginTop: 6 }}>
                <SkeletonShimmer width={200} height={12} />
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  }

  // Show empty state if no conversations
  if (!conversations || conversations.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
            <View style={styles.backButtonContent}>
              <ArrowLeftIcon size={20} color={colors.primary} />
              <Text style={styles.backButtonText}>Back</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Messages</Text>
          <TouchableOpacity
            onPress={() => setShowNewConversationModal(true)}
            style={styles.newMessageButton}
          >
            <PlusIcon size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <EmptyState
          icon={<ChatBubbleIcon size={64} color={colors.textSecondary} />}
          message="No conversations yet. Tap + to start a new conversation!"
        />
        <NewConversationModal
          visible={showNewConversationModal}
          onClose={() => setShowNewConversationModal(false)}
          onSelectUser={handleStartNewConversation}
        />
        {isCreatingConversation && (
          <View style={styles.creatingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.creatingText}>Starting conversation...</Text>
          </View>
        )}
      </View>
    );
  }

  // Conversation list view (no conversation selected)
  if (!selectedConversation) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
              <View style={styles.backButtonContent}>
                <ArrowLeftIcon size={20} color={colors.primary} />
                <Text style={styles.backButtonText}>Back</Text>
              </View>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Messages</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() => {
                  setIsSearchVisible(!isSearchVisible);
                  if (isSearchVisible) setSearchText("");
                }}
                style={styles.searchToggle}
              >
                {isSearchVisible ? (
                  <CloseIcon size={24} color={colors.primary} />
                ) : (
                  <SearchIcon size={24} color={colors.primary} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowNewConversationModal(true)}
                style={styles.newMessageButton}
              >
                <PlusIcon size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
          {isSearchVisible && (
            <View style={styles.searchContainer}>
              <SearchIcon size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Search conversations..."
                placeholderTextColor={colors.textTertiary}
                autoFocus
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => setSearchText("")}>
                  <CloseIcon size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
        <FlatList
          data={filteredConversations}
          renderItem={renderConversationItem}
          keyExtractor={(item) => item.id}
          style={styles.conversationsList}
          removeClippedSubviews={true}
          windowSize={10}
          maxToRenderPerBatch={10}
          initialNumToRender={10}
          updateCellsBatchingPeriod={50}
          ListEmptyComponent={
            searchText.length > 0 ? (
              <EmptyState
                icon={<SearchIcon size={64} color={colors.textSecondary} />}
                message="No conversations found"
              />
            ) : null
          }
        />
        <NewConversationModal
          visible={showNewConversationModal}
          onClose={() => setShowNewConversationModal(false)}
          onSelectUser={handleStartNewConversation}
        />
        {isCreatingConversation && (
          <View style={styles.creatingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.creatingText}>Starting conversation...</Text>
          </View>
        )}
      </View>
    );
  }

  // Conversation view (conversation selected)
  if (!conversationData) {
    return <LoadingState />;
  }

  const otherMember = getOtherMember(conversationData.conversation);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.chatHeader}>
        <View style={styles.chatHeaderTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setSelectedConversation(null)}
          >
            <View style={styles.backButtonContent}>
              <ArrowLeftIcon size={20} color={colors.primary} />
              <Text style={styles.backButtonText}>Back</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.muteButton}
            onPress={() => handleToggleMute(selectedConversation, conversationData.conversation.muted)}
          >
            {conversationData.conversation.muted ? (
              <BellSlashIcon size={24} color={colors.primary} />
            ) : (
              <BellIcon size={24} color={colors.primary} />
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.chatHeaderContent}>
          {otherMember.avatar ? (
            <Image
              source={{ uri: otherMember.avatar }}
              style={styles.chatAvatar}
            />
          ) : (
            <View style={styles.chatAvatarPlaceholder}>
              <Text style={styles.avatarText}>
                {(
                  otherMember.displayName ||
                  otherMember.handle ||
                  "U"
                )[0].toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.chatHeaderText}>
            <Text style={styles.chatDisplayName} numberOfLines={1}>
              {otherMember.displayName ||
                otherMember.handle ||
                "Unknown User"}
            </Text>
            {otherMember.handle && (
              <Text style={styles.chatHandle}>@{otherMember.handle}</Text>
            )}
          </View>
        </View>
      </View>

      {/* Messages */}
      {loadingMessages ? (
        <LoadingState />
      ) : (
        <FlatList
          ref={flatListRef}
          data={conversationData.messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
        />
      )}

      {/* Input */}
      <View style={styles.inputContainer}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={messageText}
            onChangeText={setMessageText}
            placeholder="Type a message..."
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={1000}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              (!messageText.trim() || sendMessageMutation.isPending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!messageText.trim() || sendMessageMutation.isPending}
          >
            {sendMessageMutation.isPending ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "bold",
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchToggle: {
    padding: 4,
  },
  newMessageButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
  },
  conversationsList: {
    flex: 1,
  },
  conversationItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
    padding: 16,
  },
  selectedConversation: {
    backgroundColor: colors.surface,
  },
  conversationContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "600",
  },
  conversationDetails: {
    flex: 1,
    marginLeft: 12,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  conversationNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  displayName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    flexShrink: 1,
  },
  handle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  lastMessage: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  unreadCount: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  chatHeader: {
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
    padding: 12,
  },
  chatHeaderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  backButton: {
    paddingVertical: 4,
  },
  muteButton: {
    padding: 4,
  },
  backButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: 16,
  },
  chatHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  chatAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  chatAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  chatHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  chatDisplayName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  chatHandle: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  messageContainer: {
    marginVertical: 4,
    maxWidth: "80%",
  },
  ownMessage: {
    alignSelf: "flex-end",
  },
  otherMessage: {
    alignSelf: "flex-start",
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
  },
  ownMessageBubble: {
    backgroundColor: colors.primary,
  },
  otherMessageBubble: {
    backgroundColor: colors.surfaceAlt,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: colors.text,
  },
  otherMessageText: {
    color: colors.text,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  messageTime: {
    fontSize: 11,
  },
  ownMessageTime: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  otherMessageTime: {
    color: colors.textSecondary,
  },
  deliveryStatus: {
    fontSize: 11,
  },
  ownDeliveryStatus: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  inputContainer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceAlt,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginLeft: 8,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 60,
  },
  sendButtonDisabled: {
    backgroundColor: colors.surface,
    opacity: 0.5,
  },
  sendButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  permissionErrorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  permissionErrorTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
  permissionErrorText: {
    color: colors.textSecondary,
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  permissionErrorSteps: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: "left",
    lineHeight: 22,
  },
  creatingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  creatingText: {
    color: colors.text,
    fontSize: 16,
  },
  swipeActions: {
    flexDirection: "row",
    width: 80,
  },
  deleteAction: {
    backgroundColor: colors.danger,
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    height: "100%",
  },
  actionText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  });
}
