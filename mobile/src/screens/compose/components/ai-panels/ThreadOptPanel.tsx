import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { CheckIcon } from "../../../../components/icons";
import type { ThreadOptimizationResult } from "../../../../services/ai-service";

interface ThreadOptPanelProps {
  result: ThreadOptimizationResult | null;
  isLoading: boolean;
  onRequest: () => void;
  onApply: () => void;
  hasText: boolean;
  colors: any;
  styles: any;
}

export function ThreadOptPanel({
  result,
  isLoading,
  onRequest,
  onApply,
  hasText,
  colors,
  styles,
}: ThreadOptPanelProps) {
  return (
    <View>
      <Text style={styles.sectionDesc}>
        Split long text into an optimized thread with smart segmentation.
      </Text>

      {!result && (
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
            <Text style={styles.actionButtonText}>Optimize Thread</Text>
          )}
        </TouchableOpacity>
      )}

      {result && (
        <View style={styles.threadContainer}>
          <Text style={styles.threadSummary}>{result.summary}</Text>
          <Text style={styles.threadMeta}>
            {result.totalPosts} posts {"\u2022"} Format:{" "}
            {result.suggestedFormat === "simple"
              ? "1/n"
              : result.suggestedFormat === "brackets"
                ? "[1/n]"
                : result.suggestedFormat === "thread"
                  ? "\uD83E\uDDF5 1/n"
                  : "1\u2022n"}
          </Text>

          {result.segments.map((segment, index) => (
            <View
              key={`segment-${index}`}
              style={[
                styles.segmentBox,
                segment.isStandalone && styles.segmentBoxStandalone,
              ]}
            >
              <View style={styles.segmentHeader}>
                <Text style={styles.segmentNumber}>
                  Post {index + 1} {"\u2022"} {segment.text.length} chars
                </Text>
                {segment.isStandalone && (
                  <View style={styles.standaloneBadge}>
                    <Text style={styles.standaloneBadgeText}>Standalone</Text>
                  </View>
                )}
              </View>
              <Text style={styles.segmentText}>{segment.text}</Text>
            </View>
          ))}

          <View style={styles.threadActions}>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={onRequest}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.refreshButtonText}>Re-optimize</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.applyButton}
              onPress={onApply}
              activeOpacity={0.7}
            >
              <CheckIcon size={16} color={colors.text} />
              <Text style={styles.applyButtonText}>Apply as Thread</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
