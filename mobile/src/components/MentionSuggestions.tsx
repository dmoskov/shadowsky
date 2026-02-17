import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { AppBskyActorDefs } from "@atproto/api";
import { Avatar } from "./Avatar";
import { useTheme } from "../contexts/ThemeContext";

interface MentionSuggestionsProps {
  suggestions: AppBskyActorDefs.ProfileView[];
  onSelectMention: (handle: string) => void;
  isLoading?: boolean;
}

export function MentionSuggestions({
  suggestions,
  onSelectMention,
  isLoading = false,
}: MentionSuggestionsProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="small" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      </View>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={suggestions.slice(0, 5)} // Max 5 suggestions
        keyboardDismissMode="on-drag"
        keyExtractor={(item) => item.did}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.suggestionItem}
            onPress={() => onSelectMention(item.handle)}
            activeOpacity={0.7}
          >
            <Avatar uri={item.avatar} size={36} />
            <View style={styles.suggestionContent}>
              <Text style={styles.displayName} numberOfLines={1}>
                {item.displayName || item.handle}
              </Text>
              <Text style={styles.handle} numberOfLines={1}>
                @{item.handle}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      maxHeight: 250,
      shadowColor: colors.borderDark,
      shadowOffset: {
        width: 0,
        height: -2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    loadingContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 16,
      gap: 12,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    suggestionItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    suggestionContent: {
      flex: 1,
    },
    displayName: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "600",
      marginBottom: 2,
    },
    handle: {
      color: colors.textTertiary,
      fontSize: 13,
    },
  });
}
