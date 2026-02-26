import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useTheme } from "../../../contexts/ThemeContext";
import { CloseIcon, CheckIcon } from "../../../components/icons";
import type {
  HashtagSuggestion,
  WritingFeedback,
  StyleAnalysisResult,
  ThreadOptimizationResult,
} from "../../../services/ai-service";

type AIFeatureTab = "hashtags" | "feedback" | "style" | "thread";

interface AIFeatureOption {
  id: AIFeatureTab;
  label: string;
  icon: string;
  description: string;
}

const AI_FEATURES: AIFeatureOption[] = [
  {
    id: "hashtags",
    label: "Hashtags",
    icon: "#\uFE0F\u20E3",
    description: "Suggest relevant hashtags",
  },
  {
    id: "feedback",
    label: "Feedback",
    icon: "\uD83D\uDCDD",
    description: "Get writing feedback",
  },
  {
    id: "style",
    label: "Style",
    icon: "\uD83C\uDFA8",
    description: "Analyze your writing style",
  },
  {
    id: "thread",
    label: "Thread",
    icon: "\uD83E\uDDF5",
    description: "Optimize for thread",
  },
];

export interface ComposeAIPanelProps {
  visible: boolean;
  onClose: () => void;
  text: string;
  onTextChange: (text: string) => void;

  // Hashtag suggestions
  hashtagResult: HashtagSuggestion[] | null;
  isLoadingHashtags: boolean;
  onRequestHashtags: () => void;
  onInsertHashtag: (tag: string) => void;

  // Writing feedback
  writingFeedback: WritingFeedback | null;
  isLoadingFeedback: boolean;
  onRequestFeedback: () => void;
  onApplyCorrected: () => void;
  onApplyEnhanced: () => void;

  // Style analysis
  styleAnalysis: StyleAnalysisResult | null;
  isLoadingStyle: boolean;
  onRequestStyleAnalysis: () => void;

  // Thread optimization
  threadResult: ThreadOptimizationResult | null;
  isLoadingThread: boolean;
  onRequestThreadOptimization: () => void;
  onApplyThreadOptimization: () => void;
}

export function ComposeAIPanel({
  visible,
  onClose,
  text,
  onTextChange: _onTextChange,
  hashtagResult,
  isLoadingHashtags,
  onRequestHashtags,
  onInsertHashtag,
  writingFeedback,
  isLoadingFeedback,
  onRequestFeedback,
  onApplyCorrected,
  onApplyEnhanced,
  styleAnalysis,
  isLoadingStyle,
  onRequestStyleAnalysis,
  threadResult,
  isLoadingThread,
  onRequestThreadOptimization,
  onApplyThreadOptimization,
}: ComposeAIPanelProps) {
  void _onTextChange;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState<AIFeatureTab>("hashtags");

  const handleTabPress = (tab: AIFeatureTab) => {
    setActiveTab(tab);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>AI Features</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <CloseIcon size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Tab Bar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabBar}
            contentContainerStyle={styles.tabBarContent}
          >
            {AI_FEATURES.map((feature) => (
              <TouchableOpacity
                key={feature.id}
                style={[
                  styles.tab,
                  activeTab === feature.id && styles.tabActive,
                ]}
                activeOpacity={0.7}
                onPress={() => handleTabPress(feature.id)}
              >
                <Text style={styles.tabIcon}>{feature.icon}</Text>
                <Text
                  style={[
                    styles.tabLabel,
                    activeTab === feature.id && styles.tabLabelActive,
                  ]}
                >
                  {feature.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Content */}
          <ScrollView
            style={styles.body}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            {activeTab === "hashtags" && (
              <HashtagsPanel
                hashtags={hashtagResult}
                isLoading={isLoadingHashtags}
                onRequest={onRequestHashtags}
                onInsert={onInsertHashtag}
                hasText={text.trim().length > 0}
                colors={colors}
                styles={styles}
              />
            )}
            {activeTab === "feedback" && (
              <FeedbackPanel
                feedback={writingFeedback}
                isLoading={isLoadingFeedback}
                onRequest={onRequestFeedback}
                onApplyCorrected={onApplyCorrected}
                onApplyEnhanced={onApplyEnhanced}
                hasText={text.trim().length > 0}
                originalText={text}
                colors={colors}
                styles={styles}
              />
            )}
            {activeTab === "style" && (
              <StylePanel
                analysis={styleAnalysis}
                isLoading={isLoadingStyle}
                onRequest={onRequestStyleAnalysis}
                hasText={text.trim().length > 0}
                colors={colors}
                styles={styles}
              />
            )}
            {activeTab === "thread" && (
              <ThreadPanel
                result={threadResult}
                isLoading={isLoadingThread}
                onRequest={onRequestThreadOptimization}
                onApply={onApplyThreadOptimization}
                hasText={text.trim().length > 0}
                colors={colors}
                styles={styles}
              />
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// Hashtags sub-panel
function HashtagsPanel({
  hashtags,
  isLoading,
  onRequest,
  onInsert,
  hasText,
  colors,
  styles,
}: {
  hashtags: HashtagSuggestion[] | null;
  isLoading: boolean;
  onRequest: () => void;
  onInsert: (tag: string) => void;
  hasText: boolean;
  colors: any;
  styles: any;
}) {
  return (
    <View>
      <Text style={styles.sectionDesc}>
        Get AI-suggested hashtags to increase your post's reach.
      </Text>

      {!hashtags && (
        <TouchableOpacity
          style={[styles.actionButton, (!hasText || isLoading) && styles.actionButtonDisabled]}
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

// Writing feedback sub-panel
function FeedbackPanel({
  feedback,
  isLoading,
  onRequest,
  onApplyCorrected,
  onApplyEnhanced,
  hasText,
  originalText,
  colors,
  styles,
}: {
  feedback: WritingFeedback | null;
  isLoading: boolean;
  onRequest: () => void;
  onApplyCorrected: () => void;
  onApplyEnhanced: () => void;
  hasText: boolean;
  originalText: string;
  colors: any;
  styles: any;
}) {
  return (
    <View>
      <Text style={styles.sectionDesc}>
        Get AI feedback on clarity, grammar, and engagement potential.
      </Text>

      {!feedback && (
        <TouchableOpacity
          style={[styles.actionButton, (!hasText || isLoading) && styles.actionButtonDisabled]}
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
            <View style={[styles.versionTextBox, styles.versionTextBoxHighlight]}>
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
                <Text style={[styles.useButtonText, styles.useButtonTextPrimary]}>
                  Use This
                </Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.versionTextBox, styles.versionTextBoxHighlight]}>
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

// Style analysis sub-panel
function StylePanel({
  analysis,
  isLoading,
  onRequest,
  hasText,
  colors,
  styles,
}: {
  analysis: StyleAnalysisResult | null;
  isLoading: boolean;
  onRequest: () => void;
  hasText: boolean;
  colors: any;
  styles: any;
}) {
  return (
    <View>
      <Text style={styles.sectionDesc}>
        Compare your draft against your historical writing style.
      </Text>

      {!analysis && (
        <TouchableOpacity
          style={[styles.actionButton, (!hasText || isLoading) && styles.actionButtonDisabled]}
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

          <Text style={styles.styleSummary}>
            {analysis.userStyleSummary}
          </Text>

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

// Thread optimization sub-panel
function ThreadPanel({
  result,
  isLoading,
  onRequest,
  onApply,
  hasText,
  colors,
  styles,
}: {
  result: ThreadOptimizationResult | null;
  isLoading: boolean;
  onRequest: () => void;
  onApply: () => void;
  hasText: boolean;
  colors: any;
  styles: any;
}) {
  return (
    <View>
      <Text style={styles.sectionDesc}>
        Split long text into an optimized thread with smart segmentation.
      </Text>

      {!result && (
        <TouchableOpacity
          style={[styles.actionButton, (!hasText || isLoading) && styles.actionButtonDisabled]}
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

function createStyles(colors: any) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end",
    },
    content: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: "85%",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceElevated,
    },
    title: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "600",
    },
    // Tab bar
    tabBar: {
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceElevated,
    },
    tabBarContent: {
      paddingHorizontal: 12,
      gap: 4,
    },
    tab: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    },
    tabActive: {
      borderBottomColor: colors.primary,
    },
    tabIcon: {
      fontSize: 16,
    },
    tabLabel: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: "500",
    },
    tabLabelActive: {
      color: colors.primary,
      fontWeight: "600",
    },
    // Body
    body: {
      padding: 16,
      maxHeight: 500,
    },
    sectionDesc: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 16,
    },
    // Action button
    actionButton: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: "center",
    },
    actionButtonDisabled: {
      opacity: 0.5,
    },
    actionButtonText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600",
    },
    // Hashtag chips
    hashtagGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 16,
    },
    hashtagChip: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    hashtagChipTrending: {
      borderWidth: 1,
      borderColor: colors.primary,
    },
    hashtagText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "500",
    },
    trendingBadge: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    // Refresh button
    refreshButton: {
      alignItems: "center",
      paddingVertical: 12,
    },
    refreshButtonText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "600",
    },
    // Feedback
    feedbackContainer: {
      gap: 12,
    },
    assessmentBox: {
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
    },
    assessmentGood: {
      backgroundColor: colors.surfaceElevated,
      borderColor: "#22c55e",
    },
    assessmentWarning: {
      backgroundColor: colors.surfaceElevated,
      borderColor: "#eab308",
    },
    assessmentTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "600",
      marginBottom: 6,
    },
    assessmentText: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    // Versions
    versionBox: {
      marginBottom: 4,
    },
    versionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    versionLabel: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "500",
      marginBottom: 6,
    },
    versionTextBox: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 10,
      padding: 12,
    },
    versionTextBoxHighlight: {
      borderWidth: 1,
      borderColor: colors.primary,
    },
    versionText: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 22,
    },
    changesList: {
      marginTop: 8,
      paddingLeft: 4,
    },
    changeItem: {
      color: colors.textTertiary,
      fontSize: 12,
      lineHeight: 18,
    },
    // Use button
    useButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: colors.surfaceElevated,
    },
    useButtonPrimary: {
      backgroundColor: colors.primary,
    },
    useButtonText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: "600",
    },
    useButtonTextPrimary: {
      color: colors.text,
    },
    // Style analysis
    styleContainer: {
      gap: 12,
    },
    styleMatchBadge: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 10,
      padding: 12,
    },
    styleMatchText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "600",
    },
    styleSummary: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      fontStyle: "italic",
    },
    styleNotes: {
      marginTop: 4,
    },
    styleNotesTitle: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "600",
      marginBottom: 4,
    },
    // Thread optimization
    threadContainer: {
      gap: 12,
    },
    threadSummary: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    threadMeta: {
      color: colors.textTertiary,
      fontSize: 12,
    },
    segmentBox: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.surfaceElevated,
    },
    segmentBoxStandalone: {
      borderColor: colors.primary,
    },
    segmentHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    segmentNumber: {
      color: colors.textTertiary,
      fontSize: 12,
      fontWeight: "500",
    },
    standaloneBadge: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    standaloneBadgeText: {
      color: colors.text,
      fontSize: 10,
      fontWeight: "600",
    },
    segmentText: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
    },
    threadActions: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 4,
    },
    applyButton: {
      flexDirection: "row",
      gap: 6,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: "center",
    },
    applyButtonText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "600",
    },
  });
}
