import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import {
  dmService,
  DmConversation,
} from "../../services/dm-service";
import { getAtProtoClient } from "../../services/atproto/client";
import { LoadingState } from "../../components/LoadingState";
import { ErrorState } from "../../components/ErrorState";
import { EmptyState } from "../../components/EmptyState";
import { NewConversationModal } from "../../components/NewConversationModal";
import { LockIcon, ChatBubbleIcon, ArrowLeftIcon, SearchIcon, CloseIcon, PlusIcon, BellIcon, BellSlashIcon } from "../../components/icons";
import { useConversations, useConversation, useSendMessage, useMarkAsRead, useMuteConversation, useUnmuteConversation, useLeaveConversation, useDeleteMessage } from "../../hooks/api";
import { useTheme } from "../../contexts/ThemeContext";
import { useAppNavigation } from "../../hooks/useNavigation";
import { SkeletonShimmer } from "../../components/SkeletonShimmer";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ConversationListView } from "./components/ConversationListView";
import { MessageThread } from "./components/MessageThread";
import { MessageInput } from "./components/MessageInput";

import { createLogger } from '../../utils/logger';
import {fontSize} from '../../utils/typography';

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
  const { session, isOAuth } = useAuth();
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
  const [isRefreshingConversations, setIsRefreshingConversations] = useState(false);

  const [showNewConversationModalNative, setShowNewConversationModalNative] = useState(false);

  const styles = useMemo(() => createStyles(colors), [colors]);

  // OAuth sessions can't access DMs — Bluesky hasn't added chat scopes yet
  if (isOAuth) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionErrorContainer}>
          <View style={{marginBottom: 16}}>
            <ChatBubbleIcon size={64} color={colors.primary} />
          </View>
          <Text style={styles.permissionErrorTitle}>
            Direct Messages Coming Soon
          </Text>
          <Text style={styles.permissionErrorText}>
            DMs aren't available yet for OAuth sign-ins. Bluesky is working on adding chat permissions to their OAuth scopes.
          </Text>
          <Text style={styles.permissionErrorSteps}>
            In the meantime, you can access DMs by signing in with an app password:{"\n"}
            {"\n"}
            1. Go to bsky.app \u2192 Settings \u2192 App Passwords{"\n"}
            2. Create a new app password{"\n"}
            3. Sign in to ShadowSky with your handle + app password
          </Text>
        </View>
      </View>
    );
  }

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
            <Text style={{ fontSize: fontSize.body, fontWeight: '600', color: colors.text, flex: 1, textAlign: 'center', marginRight: 36 }}>Messages</Text>
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

  const handleRefreshConversations = async () => {
    setIsRefreshingConversations(true);
    await refetchConversations();
    setIsRefreshingConversations(false);
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
        <ConversationListView
          conversations={filteredConversations || []}
          selectedConversation={selectedConversation}
          onSelectConversation={setSelectedConversation}
          onDeleteConversation={handleDeleteConversation}
          searchText={searchText}
          sessionDid={session?.did}
          colors={colors}
          onRefresh={handleRefreshConversations}
          isRefreshing={isRefreshingConversations}
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
        <MessageThread
          messages={conversationData.messages}
          sessionDid={session?.did}
          onDeleteMessage={handleDeleteMessage}
          colors={colors}
        />
      )}

      {/* Input */}
      <MessageInput
        messageText={messageText}
        onChangeText={setMessageText}
        onSend={handleSendMessage}
        isSending={sendMessageMutation.isPending}
        colors={colors}
      />
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
    fontSize: fontSize.title2,
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
    fontSize: fontSize.callout,
  },
  avatarText: {
    color: colors.text,
    fontSize: fontSize.title3,
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
    fontSize: fontSize.callout,
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
    fontSize: fontSize.callout,
    fontWeight: "600",
  },
  chatHandle: {
    color: colors.textSecondary,
    fontSize: fontSize.subheadline,
  },
  permissionErrorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  permissionErrorTitle: {
    color: colors.text,
    fontSize: fontSize.title3,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
  permissionErrorText: {
    color: colors.textSecondary,
    fontSize: fontSize.callout,
    textAlign: "center",
    marginBottom: 16,
  },
  permissionErrorSteps: {
    color: colors.textSecondary,
    fontSize: fontSize.subheadline,
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
    fontSize: fontSize.callout,
  },
  });
}
