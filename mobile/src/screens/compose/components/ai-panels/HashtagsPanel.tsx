import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import type { HashtagSuggestion } from "../../../../services/ai-service";

interface HashtagsPanelProps {
  hashtags: HashtagSuggestion[] | null;
  isLoading: boolean;
  onRequest: () => void;
  onInsert: (tag: string) => void;
  hasText: boolean;
  colors: any;
  styles: any;
}

export function HashtagsPanel({
  hashtags,
  isLoading,
  onRequest,
  onInsert,
  hasText,
  colors,
  styles,
}: HashtagsPanelProps) {
  return (
    <View>
      <Text style={styles.sectionDesc}>
        Get AI-suggested hashtags to increase your post's reach.
      </Text>

      {!hashtags && (
        <TouchableOpacity
          style={[
            styles.actionButton,
            (!hasText || isLoading) && styles.actionButtonDisabled,
          ]}
          onPress={onRequest}
          disabled={!hasText || isLoading}
          activeOpacity={0.7}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Text style={styles.actionButtonText}>Suggest Hashtags</Text>
          )}
        </TouchableOpacity>
      )}

      {hashtags && hashtags.length > 0 && (
        <View style={styles.hashtagGrid}>
          {hashtags.map((ht) => (
            <TouchableOpacity
              key={ht.tag}
              style={[
                styles.hashtagChip,
                ht.isTrending && styles.hashtagChipTrending,
              ]}
              activeOpacity={0.7}
              onPress={() => onInsert(ht.tag)}
            >
              <Text style={styles.hashtagText}>#{ht.tag}</Text>
              {ht.isTrending && (
                <Text style={styles.trendingBadge}>trending</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {hashtags && hashtags.length > 0 && (
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={onRequest}
          disabled={isLoading}
          activeOpacity={0.7}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.refreshButtonText}>Refresh Suggestions</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}
