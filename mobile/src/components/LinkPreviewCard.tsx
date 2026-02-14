import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { colors } from "../constants/theme";
import type { LinkMetadata } from "../services/ai-service";

interface LinkPreviewCardProps {
  metadata: LinkMetadata;
  onDismiss: () => void;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function LinkPreviewCard({ metadata, onDismiss }: LinkPreviewCardProps) {
  return (
    <View style={styles.container}>
      {metadata.imageUrl && (
        <Image source={{ uri: metadata.imageUrl }} style={styles.thumbnail} />
      )}
      <View style={styles.textContainer}>
        {metadata.title ? (
          <Text style={styles.title} numberOfLines={1}>
            {metadata.title}
          </Text>
        ) : null}
        {metadata.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {metadata.description}
          </Text>
        ) : null}
        <Text style={styles.domain}>{extractDomain(metadata.url)}</Text>
      </View>
      <TouchableOpacity onPress={onDismiss} style={styles.dismissButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.dismissText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginHorizontal: 16,
    marginVertical: 8,
    overflow: "hidden",
  },
  thumbnail: {
    width: 72,
    height: 72,
    backgroundColor: colors.surfaceElevated,
  },
  textContainer: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: "center",
    gap: 2,
  },
  title: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  description: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  domain: {
    color: colors.textTertiary,
    fontSize: 11,
  },
  dismissButton: {
    padding: 8,
    alignSelf: "flex-start",
  },
  dismissText: {
    color: colors.textTertiary,
    fontSize: 14,
  },
});
