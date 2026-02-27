import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import type { StyleAnalysisResult } from "../../../../services/ai-service";

interface StylePanelProps {
  analysis: StyleAnalysisResult | null;
  isLoading: boolean;
  onRequest: () => void;
  hasText: boolean;
  colors: any;
  styles: any;
}

export function StylePanel({
  analysis,
  isLoading,
  onRequest,
  hasText,
  colors,
  styles,
}: StylePanelProps) {
  return (
    <View>
      <Text style={styles.sectionDesc}>
        Compare your draft against your historical writing style.
      </Text>

      {!analysis && (
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
            <Text style={styles.actionButtonText}>Analyze Style</Text>
          )}
        </TouchableOpacity>
      )}

      {analysis && (
        <View style={styles.styleContainer}>
          <View style={styles.styleMatchBadge}>
            <Text style={styles.styleMatchText}>
              {analysis.matchesStyle
                ? "\u2705 Matches your style"
                : "\u26A1 Differs from your usual style"}
            </Text>
          </View>

          <Text style={styles.styleSummary}>{analysis.userStyleSummary}</Text>

          {analysis.styleNotes.length > 0 && (
            <View style={styles.styleNotes}>
              <Text style={styles.styleNotesTitle}>Notes:</Text>
              {analysis.styleNotes.map((note, i) => (
                <Text key={`note-${i}`} style={styles.changeItem}>
                  {"\u2022"} {note}
                </Text>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={onRequest}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.refreshButtonText}>Re-analyze</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
