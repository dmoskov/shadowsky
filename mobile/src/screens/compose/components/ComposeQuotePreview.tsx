import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Avatar } from "../../../components/Avatar";
import { useTheme } from "../../../contexts/ThemeContext";

export interface QuoteToPost {
  uri: string;
  cid: string;
  author: {
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  text: string;
}

export interface ComposeQuotePreviewProps {
  quoteTo: QuoteToPost;
}

export function ComposeQuotePreview({ quoteTo }: ComposeQuotePreviewProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.quotePreview}>
      <View style={styles.quoteCard}>
        <View style={styles.quoteHeader}>
          <Avatar uri={quoteTo.author.avatar} size={32} />
          <View style={styles.quoteAuthorInfo}>
            <Text style={styles.quoteAuthorName} numberOfLines={1}>
              {quoteTo.author.displayName || quoteTo.author.handle}
            </Text>
            <Text style={styles.quoteAuthorHandle} numberOfLines={1}>
              @{quoteTo.author.handle}
            </Text>
          </View>
        </View>
        <Text style={styles.quoteText} numberOfLines={6}>
          {quoteTo.text}
        </Text>
      </View>
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
  quotePreview: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  quoteCard: {
    borderWidth: 1,
    borderColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.background,
  },
  quoteHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  quoteAuthorInfo: {
    flex: 1,
  },
  quoteAuthorName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  quoteAuthorHandle: {
    color: colors.textTertiary,
    fontSize: 13,
  },
  quoteText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 18,
  },
  });
}
