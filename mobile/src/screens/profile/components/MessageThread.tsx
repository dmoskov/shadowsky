import React, { useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { formatDistanceToNow } from "date-fns";
import { DmMessage } from "../../../services/dm-service";
import { InlineErrorBoundary } from "../../../components/ui/InlineErrorBoundary";

interface MessageThreadProps {
  messages: DmMessage[];
  sessionDid: string | undefined;
  onDeleteMessage: (messageId: string) => void;
  colors: any;
}

function formatMessageTime(timestamp: string) {
  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  } catch {
    return "";
  }
}

function MessageThreadInner({
  messages,
  sessionDid,
  onDeleteMessage,
  colors,
}: MessageThreadProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const flatListRef = useRef<FlatList>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [messages.length]);

  const renderMessage = ({ item }: { item: DmMessage }) => {
    const isOwnMessage = item.sender.did === sessionDid;

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
              {deliveryStatus === "delivered" ? "\u2713\u2713" : "\u2713"}
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
              onLongPress={() => onDeleteMessage(item.id)}
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

  return (
    <FlatList
      ref={flatListRef}
      data={messages}
      renderItem={renderMessage}
      keyExtractor={(item) => item.id}
      style={styles.messagesList}
      contentContainerStyle={styles.messagesContent}
      onContentSizeChange={() =>
        flatListRef.current?.scrollToEnd({ animated: false })
      }
    />
  );
}

export const MessageThread = React.memo(MessageThreadInner);

function createStyles(colors: any) {
  return StyleSheet.create({
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
      flexDirection: "row",
      alignItems: "center",
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
  });
}
