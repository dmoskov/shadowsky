import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import type { ThemeColors } from "../../../contexts/ThemeContext";
import type { PostAnalysisResult } from "../../../services/ai-service";
import {fontSize} from '../../../utils/typography';

interface AIAnalysisPanelProps {
  postsCount: number;
  analysisRequested: boolean;
  setAnalysisRequested: (value: boolean) => void;
  isLoadingAnalysis: boolean;
  analysisData: PostAnalysisResult | undefined;
  colors: ThemeColors;
}

function AIAnalysisPanelInner({
  postsCount,
  analysisRequested,
  setAnalysisRequested,
  isLoadingAnalysis,
  analysisData,
  colors,
}: AIAnalysisPanelProps) {
  if (postsCount <= 0) return null;

  return (
    <View style={[styles.section, { backgroundColor: colors.surfaceElevated }]}>
      <View style={styles.aiSectionHeader}>
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.text, marginBottom: 0 },
          ]}
        >
          AI Content Analysis
        </Text>
        {!analysisRequested && (
          <TouchableOpacity
            style={[styles.analyzeButton, { backgroundColor: colors.primary }]}
            onPress={() => setAnalysisRequested(true)}
          >
            <Text style={styles.analyzeButtonText}>Analyze</Text>
          </TouchableOpacity>
        )}
      </View>

      {!analysisRequested && (
        <View
          style={[
            styles.aiPlaceholder,
            { backgroundColor: colors.surface },
          ]}
        >
          <Text
            style={[styles.aiPlaceholderTitle, { color: colors.text }]}
          >
            Get AI-Powered Insights
          </Text>
          <Text
            style={[
              styles.aiPlaceholderText,
              { color: colors.textSecondary },
            ]}
          >
            Discover content themes, writing style patterns, and engagement
            insights from your posts
          </Text>
        </View>
      )}

      {isLoadingAnalysis && (
        <View
          style={[styles.aiLoading, { backgroundColor: colors.surface }]}
        >
          <ActivityIndicator size="small" color={colors.accentPurple} />
          <Text style={[styles.aiLoadingText, { color: colors.text }]}>
            Analyzing your posts...
          </Text>
          <Text
            style={[
              styles.aiLoadingSubtext,
              { color: colors.textSecondary },
            ]}
          >
            This may take a moment
          </Text>
        </View>
      )}

      {analysisData && !isLoadingAnalysis && (
        <View style={styles.aiResults}>
          {/* Summary */}
          <View
            style={[styles.aiCard, { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.aiCardTitle, { color: colors.text }]}>
              Summary
            </Text>
            <Text
              style={[
                styles.aiCardText,
                { color: colors.textSecondary },
              ]}
            >
              {analysisData.summary}
            </Text>
          </View>

          {/* Content Themes */}
          <View
            style={[styles.aiCard, { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.aiCardTitle, { color: colors.text }]}>
              Content Themes
            </Text>
            {analysisData.contentThemes.map((theme) => (
              <View key={theme.theme} style={styles.themeItem}>
                <View style={styles.themeHeader}>
                  <Text style={[styles.themeName, { color: colors.text }]}>
                    {theme.theme}
                  </Text>
                  <View
                    style={[
                      styles.frequencyBadge,
                      {
                        backgroundColor:
                          theme.frequency === "primary"
                            ? "#3b82f6"
                            : theme.frequency === "regular"
                              ? "#8b5cf6"
                              : "#6b7280",
                      },
                    ]}
                  >
                    <Text style={styles.frequencyText}>
                      {theme.frequency}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.themeDescription,
                    { color: colors.textSecondary },
                  ]}
                >
                  {theme.description}
                </Text>
                {theme.examples.length > 0 && (
                  <View style={styles.themeExamples}>
                    {theme.examples.map((example) => (
                      <Text
                        key={example}
                        style={[
                          styles.themeExample,
                          { color: colors.textTertiary },
                        ]}
                        numberOfLines={2}
                      >
                        &ldquo;{example}&rdquo;
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Writing Style */}
          <View
            style={[styles.aiCard, { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.aiCardTitle, { color: colors.text }]}>
              Writing Style
            </Text>
            <View style={styles.styleSection}>
              <Text
                style={[
                  styles.styleLabel,
                  { color: colors.textTertiary },
                ]}
              >
                Tone
              </Text>
              <Text style={[styles.styleValue, { color: colors.text }]}>
                {analysisData.writingStyle.tone}
              </Text>
            </View>
            <View style={styles.styleSection}>
              <Text
                style={[
                  styles.styleLabel,
                  { color: colors.textTertiary },
                ]}
              >
                Characteristics
              </Text>
              {analysisData.writingStyle.characteristics.map((char) => (
                <View key={char} style={styles.characteristicRow}>
                  <Text style={{ color: colors.success }}>
                    {"\u2022"}
                  </Text>
                  <Text
                    style={[
                      styles.characteristicText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {char}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.styleSection}>
              <Text
                style={[
                  styles.styleLabel,
                  { color: colors.textTertiary },
                ]}
              >
                Voice
              </Text>
              <Text
                style={[
                  styles.styleValue,
                  { color: colors.textSecondary },
                ]}
              >
                {analysisData.writingStyle.voiceDescription}
              </Text>
            </View>
          </View>

          {/* Engagement Insights */}
          <View
            style={[styles.aiCard, { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.aiCardTitle, { color: colors.text }]}>
              Engagement Insights
            </Text>

            {analysisData.engagementPatterns.topPerformers.length > 0 && (
              <View style={styles.insightSection}>
                <Text
                  style={[
                    styles.insightLabel,
                    { color: colors.textTertiary },
                  ]}
                >
                  Top Performers
                </Text>
                {analysisData.engagementPatterns.topPerformers.map(
                  (item) => (
                    <View key={item} style={styles.insightRow}>
                      <Text style={{ color: colors.warning }}>
                        {"\u2605"}
                      </Text>
                      <Text
                        style={[
                          styles.insightText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {item}
                      </Text>
                    </View>
                  ),
                )}
              </View>
            )}

            {analysisData.engagementPatterns.contentStrengths.length >
              0 && (
              <View style={styles.insightSection}>
                <Text
                  style={[
                    styles.insightLabel,
                    { color: colors.textTertiary },
                  ]}
                >
                  Your Strengths
                </Text>
                {analysisData.engagementPatterns.contentStrengths.map(
                  (item) => (
                    <View key={item} style={styles.insightRow}>
                      <Text style={{ color: colors.success }}>
                        {"\u2713"}
                      </Text>
                      <Text
                        style={[
                          styles.insightText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {item}
                      </Text>
                    </View>
                  ),
                )}
              </View>
            )}

            {(
              analysisData.engagementPatterns.observations ||
              analysisData.engagementPatterns.suggestions ||
              []
            ).length > 0 && (
              <View style={styles.insightSection}>
                <Text
                  style={[
                    styles.insightLabel,
                    { color: colors.textTertiary },
                  ]}
                >
                  Observations
                </Text>
                {(
                  analysisData.engagementPatterns.observations ||
                  analysisData.engagementPatterns.suggestions ||
                  []
                ).map((item) => (
                  <View key={item} style={styles.insightRow}>
                    <Text style={{ color: colors.accentPurple }}>
                      {"\u2022"}
                    </Text>
                    <Text
                      style={[
                        styles.insightText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Optimal Posting Times from AI */}
          {analysisData.optimalPostingTimes &&
            analysisData.optimalPostingTimes.recommendations.length >
              0 && (
              <View
                style={[
                  styles.aiCard,
                  { backgroundColor: colors.surface },
                ]}
              >
                <Text
                  style={[styles.aiCardTitle, { color: colors.text }]}
                >
                  AI-Recommended Posting Times
                </Text>
                <View style={styles.optimalTimesGrid}>
                  {analysisData.optimalPostingTimes.recommendations.map(
                    (rec, i) => {
                      const dayNames = [
                        "Sunday",
                        "Monday",
                        "Tuesday",
                        "Wednesday",
                        "Thursday",
                        "Friday",
                        "Saturday",
                      ];
                      const recHourStr =
                        rec.hour === 0
                          ? "12:00 AM"
                          : rec.hour === 12
                            ? "12:00 PM"
                            : rec.hour < 12
                              ? `${rec.hour}:00 AM`
                              : `${rec.hour - 12}:00 PM`;
                      const confidenceColor =
                        rec.confidence === "high"
                          ? "#22c55e"
                          : rec.confidence === "medium"
                            ? "#eab308"
                            : "#94a3b8";

                      return (
                        <View
                          key={`${rec.dayOfWeek}-${rec.hour}`}
                          style={[
                            styles.optimalTimeCard,
                            {
                              backgroundColor: colors.surfaceElevated,
                              borderColor:
                                i === 0 ? colors.primary : colors.border,
                              borderWidth: i === 0 ? 2 : 1,
                            },
                          ]}
                        >
                          <View style={styles.optimalTimeHeader}>
                            <Text
                              style={[
                                styles.optimalTimeRank,
                                { color: colors.textSecondary },
                              ]}
                            >
                              {i === 0 ? "Best Time" : `#${i + 1}`}
                            </Text>
                            <View
                              style={[
                                styles.confidenceBadge,
                                { backgroundColor: confidenceColor },
                              ]}
                            >
                              <Text style={styles.confidenceText}>
                                {rec.confidence}
                              </Text>
                            </View>
                          </View>
                          <Text
                            style={[
                              styles.optimalTimeHour,
                              { color: colors.text },
                            ]}
                          >
                            {recHourStr}
                          </Text>
                          <Text
                            style={[
                              styles.optimalTimeDay,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {rec.dayOfWeek === -1
                              ? "Any day"
                              : dayNames[rec.dayOfWeek]}
                          </Text>
                          <Text
                            style={[
                              styles.optimalTimeEngagement,
                              { color: colors.primary },
                            ]}
                          >
                            ~{rec.avgEngagement} avg engagement
                          </Text>
                        </View>
                      );
                    },
                  )}
                </View>
              </View>
            )}

          {/* Hide Analysis button */}
          <TouchableOpacity
            style={[
              styles.hideAnalysisButton,
              { backgroundColor: colors.surface },
            ]}
            onPress={() => setAnalysisRequested(false)}
          >
            <Text
              style={[
                styles.hideAnalysisText,
                { color: colors.textSecondary },
              ]}
            >
              Hide Analysis
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: fontSize.headline,
    fontWeight: "bold",
    marginBottom: 12,
  },
  aiSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  analyzeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  analyzeButtonText: {
    color: "#ffffff",
    fontSize: fontSize.subheadline,
    fontWeight: "600",
  },
  aiPlaceholder: {
    borderRadius: 10,
    padding: 24,
    alignItems: "center",
  },
  aiPlaceholderTitle: {
    fontSize: fontSize.callout,
    fontWeight: "600",
    marginBottom: 8,
  },
  aiPlaceholderText: {
    fontSize: fontSize.footnote,
    textAlign: "center",
    lineHeight: 20,
  },
  aiLoading: {
    borderRadius: 10,
    padding: 32,
    alignItems: "center",
  },
  aiLoadingText: {
    fontSize: fontSize.subheadline,
    fontWeight: "500",
    marginTop: 12,
  },
  aiLoadingSubtext: {
    fontSize: fontSize.caption1,
    marginTop: 4,
  },
  aiResults: {
    gap: 12,
  },
  aiCard: {
    borderRadius: 10,
    padding: 16,
  },
  aiCardTitle: {
    fontSize: fontSize.subheadline,
    fontWeight: "600",
    marginBottom: 12,
  },
  aiCardText: {
    fontSize: fontSize.footnote,
    lineHeight: 20,
  },
  themeItem: {
    marginBottom: 16,
  },
  themeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  themeName: {
    fontSize: fontSize.subheadline,
    fontWeight: "600",
    flex: 1,
  },
  frequencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  frequencyText: {
    color: "#ffffff",
    fontSize: fontSize.caption2,
    fontWeight: "500",
  },
  themeDescription: {
    fontSize: fontSize.footnote,
    lineHeight: 18,
    marginBottom: 4,
  },
  themeExamples: {
    paddingLeft: 12,
    marginTop: 4,
    gap: 4,
  },
  themeExample: {
    fontSize: fontSize.caption1,
    fontStyle: "italic",
    lineHeight: 16,
  },
  styleSection: {
    marginBottom: 12,
  },
  styleLabel: {
    fontSize: fontSize.caption2,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  styleValue: {
    fontSize: fontSize.footnote,
    lineHeight: 18,
  },
  characteristicRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 4,
  },
  characteristicText: {
    fontSize: fontSize.footnote,
    lineHeight: 18,
    flex: 1,
  },
  insightSection: {
    marginBottom: 16,
  },
  insightLabel: {
    fontSize: fontSize.caption2,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  insightRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 6,
  },
  insightText: {
    fontSize: fontSize.footnote,
    lineHeight: 18,
    flex: 1,
  },
  optimalTimesGrid: {
    gap: 10,
  },
  optimalTimeCard: {
    borderRadius: 10,
    padding: 14,
  },
  optimalTimeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  optimalTimeRank: {
    fontSize: fontSize.caption1,
    fontWeight: "500",
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  confidenceText: {
    color: "#ffffff",
    fontSize: fontSize.caption2,
    fontWeight: "500",
  },
  optimalTimeHour: {
    fontSize: fontSize.title3,
    fontWeight: "bold",
  },
  optimalTimeDay: {
    fontSize: fontSize.footnote,
    marginTop: 2,
  },
  optimalTimeEngagement: {
    fontSize: fontSize.caption1,
    marginTop: 6,
  },
  hideAnalysisButton: {
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  hideAnalysisText: {
    fontSize: fontSize.subheadline,
  },
});

export const AIAnalysisPanel = React.memo(AIAnalysisPanelInner);
