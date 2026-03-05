import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import {fontSize} from '../../../utils/typography';

interface MessageInputProps {
  messageText: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  isSending: boolean;
  colors: any;
}

function MessageInputInner({
  messageText,
  onChangeText,
  onSend,
  isSending,
  colors,
}: MessageInputProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.inputContainer}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={messageText}
          onChangeText={onChangeText}
          placeholder="Type a message..."
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={1000}
        />

        <TouchableOpacity
          style={[
            styles.sendButton,
            (!messageText.trim() || isSending) && styles.sendButtonDisabled,
          ]}
          onPress={onSend}
          disabled={!messageText.trim() || isSending}
        >
          {isSending ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const MessageInput = React.memo(MessageInputInner);

function createStyles(colors: any) {
  return StyleSheet.create({
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
      fontSize: fontSize.callout,
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
      fontSize: fontSize.callout,
      fontWeight: "600",
    },
  });
}
