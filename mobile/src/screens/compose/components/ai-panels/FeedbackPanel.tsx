import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { CheckIcon } from "../../../../components/icons";
import type { WritingFeedback } from "../../../../services/ai-service";

interface FeedbackPanelProps {
  feedback: WritingFeedback | null;
  isLoading: boolean;
  onRequest: () => void;
  onApplyCorrected: () => void;
  onApplyEnhanced: () => void;
  hasText: boolean;
  originalText: string;
  colors: any;
  styles: any;
}

export function FeedbackPanel({
  feedback,
  isLoading,
  onRequest,
  onApplyCorrected,
  onApplyEnhanced,
  hasText,
  originalText,
  colors,
  styles,
}: FeedbackPanelProps) {
  return (
    <View>
      <Text style={styles.sectionDesc}>
        Get AI feedback on clarity, grammar, and engagement potential.
      </Text>

      {!feedback && (
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
            <Text style={styles.actionButtonText}>Get Feedback</Text>
          )}
        </TouchableOpacity>
      )}

      {feedback && (
        <View style={styles.feedbackContainer}>
          {/* Assessment */}
          <View
            style={[
              styles.assessmentBox,
              !feedback.assessment.hasIssues
                ? styles.assessmentGood
                : styles.assessmentWarning,
            ]}
          >
            <Text style={styles.assessmentTitle}>
              {!feedback.assessment.hasIssues ? "\u2705 " : "\u26A0\uFE0F "}
              Quality Assessment
            </Text>
            <Text style={styles.assessmentText}>
              {feedback.assessment.summary}
            </Text>
          </View>

          {/* Original */}
          <View style={styles.versionBox}>
            <Text style={styles.versionLabel}>Original</Text>
            <View style={styles.versionTextBox}>
              <Text style={styles.versionText}>{originalText}</Text>
            </View>
          </View>

          {/* Corrected Version */}
          <View style={styles.versionBox}>
            <View style={styles.versionHeader}>
              <Text style={styles.versionLabel}>Corrected</Text>
              <TouchableOpacity
                style={styles.useButton}
                onPress={onApplyCorrected}
                activeOpacity={0.7}
              >
                <CheckIcon size={14} color={colors.primary} />
                <Text style={styles.useButtonText}>Use This</Text>
              </TouchableOpacity>
            </View>
            <View
              style={[styles.versionTextBox, styles.versionTextBoxHighlight]}
            >
              <Text style={styles.versionText}>
                {feedback.correctedVersion.text}
              </Text>
            </View>
            {feedback.correctedVersion.changes.length > 0 && (
              <View style={styles.changesList}>
                {feedback.correctedVersion.changes.map((change, i) => (
                  <Text key={`change-${i}`} style={styles.changeItem}>
                    {"\u2022"} {change}
                  </Text>
                ))}
              </View>
            )}
          </View>

          {/* Enhanced Version */}
          <View style={styles.versionBox}>
            <View style={styles.versionHeader}>
              <Text style={styles.versionLabel}>Enhanced</Text>
              <TouchableOpacity
                style={[styles.useButton, styles.useButtonPrimary]}
                onPress={onApplyEnhanced}
                activeOpacity={0.7}
              >
                <CheckIcon size={14} color={colors.text} />
                <Text
                  style={[styles.useButtonText, styles.useButtonTextPrimary]}
                >
                  Use This
                </Text>
              </TouchableOpacity>
            </View>
            <View
              style={[styles.versionTextBox, styles.versionTextBoxHighlight]}
            >
              <Text style={styles.versionText}>
                {feedback.enhancedVersion.text}
              </Text>
            </View>
            {feedback.enhancedVersion.improvements.length > 0 && (
              <View style={styles.changesList}>
                {feedback.enhancedVersion.improvements.map((improvement, i) => (
                  <Text key={`improvement-${i}`} style={styles.changeItem}>
                    {"\u2022"} {improvement}
                  </Text>
                ))}
              </View>
            )}
          </View>

          {/* Refresh */}
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={onRequest}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.refreshButtonText}>Refresh Feedback</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
