import React, { useMemo, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CloseIcon } from "../../../components/icons";
import { useTheme } from "../../../contexts/ThemeContext";
import type {
  HashtagSuggestion,
  StyleAnalysisResult,
  ThreadOptimizationResult,
  WritingFeedback,
} from "../../../services/ai-service";
import { FeedbackPanel } from "./ai-panels/FeedbackPanel";
import { HashtagsPanel } from "./ai-panels/HashtagsPanel";
import { StylePanel } from "./ai-panels/StylePanel";
import { ThreadOptPanel } from "./ai-panels/ThreadOptPanel";
import {fontSize} from '../../../utils/typography';

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

  const hasText = text.trim().length > 0;

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
                onPress={() => setActiveTab(feature.id)}
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
                hasText={hasText}
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
                hasText={hasText}
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
                hasText={hasText}
                colors={colors}
                styles={styles}
              />
            )}
            {activeTab === "thread" && (
              <ThreadOptPanel
                result={threadResult}
                isLoading={isLoadingThread}
                onRequest={onRequestThreadOptimization}
                onApply={onApplyThreadOptimization}
                hasText={hasText}
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
      fontSize: fontSize.headline,
      fontWeight: "600",
    },
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
      fontSize: fontSize.callout,
    },
    tabLabel: {
      color: colors.textSecondary,
      fontSize: fontSize.subheadline,
      fontWeight: "500",
    },
    tabLabelActive: {
      color: colors.primary,
      fontWeight: "600",
    },
    body: {
      padding: 16,
      maxHeight: 500,
    },
    sectionDesc: {
      color: colors.textSecondary,
      fontSize: fontSize.subheadline,
      lineHeight: 20,
      marginBottom: 16,
    },
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
      fontSize: fontSize.callout,
      fontWeight: "600",
    },
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
      fontSize: fontSize.subheadline,
      fontWeight: "500",
    },
    trendingBadge: {
      color: colors.primary,
      fontSize: fontSize.caption2,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    refreshButton: {
      alignItems: "center",
      paddingVertical: 12,
    },
    refreshButtonText: {
      color: colors.primary,
      fontSize: fontSize.subheadline,
      fontWeight: "600",
    },
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
      fontSize: fontSize.subheadline,
      fontWeight: "600",
      marginBottom: 6,
    },
    assessmentText: {
      color: colors.textSecondary,
      fontSize: fontSize.subheadline,
      lineHeight: 20,
    },
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
      fontSize: fontSize.footnote,
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
      fontSize: fontSize.subheadline,
      lineHeight: 22,
    },
    changesList: {
      marginTop: 8,
      paddingLeft: 4,
    },
    changeItem: {
      color: colors.textTertiary,
      fontSize: fontSize.caption1,
      lineHeight: 18,
    },
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
      fontSize: fontSize.footnote,
      fontWeight: "600",
    },
    useButtonTextPrimary: {
      color: colors.text,
    },
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
      fontSize: fontSize.subheadline,
      fontWeight: "600",
    },
    styleSummary: {
      color: colors.textSecondary,
      fontSize: fontSize.subheadline,
      lineHeight: 20,
      fontStyle: "italic",
    },
    styleNotes: {
      marginTop: 4,
    },
    styleNotesTitle: {
      color: colors.textSecondary,
      fontSize: fontSize.footnote,
      fontWeight: "600",
      marginBottom: 4,
    },
    threadContainer: {
      gap: 12,
    },
    threadSummary: {
      color: colors.textSecondary,
      fontSize: fontSize.subheadline,
      lineHeight: 20,
    },
    threadMeta: {
      color: colors.textTertiary,
      fontSize: fontSize.caption1,
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
      fontSize: fontSize.caption1,
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
      fontSize: fontSize.caption2,
      fontWeight: "600",
    },
    segmentText: {
      color: colors.text,
      fontSize: fontSize.subheadline,
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
      fontSize: fontSize.subheadline,
      fontWeight: "600",
    },
  });
}
