import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Animated,
} from "react-native";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { DmConversation } from "../../../services/dm-service";
import { TrashIcon, BellSlashIcon, SearchIcon } from "../../../components/icons";
import { InlineErrorBoundary } from "../../../components/ui/InlineErrorBoundary";
import { EmptyState } from "../../../components/EmptyState";

interface ConversationListViewProps {
  conversations: DmConversation[];
  selectedConversation: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  searchText: string;
  sessionDid: string | undefined;
  colors: any;
}

function getOtherMember(conversation: DmConversation, sessionDid: string | undefined) {
  return (
    conversation.members.find((member) => member.did !== sessionDid) ||
    conversation.members[0]
  );
}

function ConversationListViewInner({
  conversations,
  selectedConversation,
  onSelectConversation,
  onDeleteConversation,
  searchText,
  sessionDid,
  colors,
}: ConversationListViewProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);

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
          onPress={() => onDeleteConversation(conversationId)}
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
    const otherMember = getOtherMember(item, sessionDid);
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
            onPress={() => onSelectConversation(item.id)}
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

  return (
    <FlatList
      data={conversations}
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
  );
}

export const ConversationListView = React.memo(ConversationListViewInner);

function createStyles(colors: any) {
  return StyleSheet.create({
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
