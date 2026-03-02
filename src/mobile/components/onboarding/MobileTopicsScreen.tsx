/**
 * MobileTopicsScreen Component for React Native
 *
 * Interest selection screen for mobile onboarding.
 * Users select topic categories to personalize their feed.
 */

import { memo, useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import {
  TOPIC_CATEGORIES,
  type TopicCategory,
} from "../../../services/onboarding-service";
import { useDynamicType, type ScaledFontFn } from "../../hooks/useDynamicType";

import { spacing } from "../../../theme/spacing";
function createStyles(scaledFont: ScaledFontFn) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#000000",
    } as ViewStyle,
    header: {
      paddingHorizontal: spacing.xl,
      paddingTop: 60,
      paddingBottom: spacing.lg,
      alignItems: "center",
    } as ViewStyle,
    title: {
      fontSize: scaledFont(26),
      fontWeight: "700",
      color: "#ffffff",
      textAlign: "center",
      marginBottom: spacing.sm,
    } as TextStyle,
    subtitle: {
      fontSize: scaledFont(15),
      color: "#8a8a9a",
      textAlign: "center",
      marginBottom: spacing.sm,
    } as TextStyle,
    counter: {
      fontSize: scaledFont(13),
      color: "#555566",
    } as TextStyle,
    scrollView: {
      flex: 1,
    } as ViewStyle,
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
      gap: spacing.md,
    } as ViewStyle,
    topicCard: {
      backgroundColor: "#111122",
      borderRadius: 12,
      padding: spacing.lg,
      borderWidth: 2,
      borderColor: "transparent",
    } as ViewStyle,
    topicCardSelected: {
      borderColor: "#6366f1",
      backgroundColor: "rgba(99, 102, 241, 0.1)",
    } as ViewStyle,
    topicCardContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    } as ViewStyle,
    topicIcon: {
      fontSize: scaledFont(28),
    } as TextStyle,
    topicTextContainer: {
      flex: 1,
    } as ViewStyle,
    topicName: {
      fontSize: scaledFont(16),
      fontWeight: "600",
      color: "#ffffff",
      marginBottom: spacing.xxs,
    } as TextStyle,
    topicDescription: {
      fontSize: scaledFont(13),
      color: "#8a8a9a",
    } as TextStyle,
    checkBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: "#6366f1",
      justifyContent: "center",
      alignItems: "center",
    } as ViewStyle,
    checkText: {
      fontSize: scaledFont(14),
      color: "#ffffff",
      fontWeight: "700",
    } as TextStyle,
    navigation: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: "#1a1a2e",
    } as ViewStyle,
    backButton: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "#333344",
    } as ViewStyle,
    backButtonText: {
      fontSize: scaledFont(15),
      fontWeight: "500",
      color: "#8a8a9a",
    } as TextStyle,
    rightButtons: {
      flexDirection: "row",
      gap: spacing.md,
    } as ViewStyle,
    skipButton: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "#333344",
    } as ViewStyle,
    skipButtonText: {
      fontSize: scaledFont(15),
      fontWeight: "500",
      color: "#8a8a9a",
    } as TextStyle,
    continueButton: {
      backgroundColor: "#6366f1",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: 10,
    } as ViewStyle,
    continueButtonDisabled: {
      opacity: 0.5,
    } as ViewStyle,
    continueButtonText: {
      fontSize: scaledFont(15),
      fontWeight: "600",
      color: "#ffffff",
    } as TextStyle,
  });
}

type Styles = ReturnType<typeof createStyles>;

export interface MobileTopicsScreenProps {
  initialSelected?: string[];
  onContinue: (selectedTopics: string[]) => void;
  onBack: () => void;
  onSkip: () => void;
}

const TopicCard = memo(function TopicCard({
  topic,
  isSelected,
  onToggle,
  styles,
}: {
  topic: TopicCategory;
  isSelected: boolean;
  onToggle: (id: string) => void;
  styles: Styles;
}) {
  return (
    <Pressable
      onPress={() => onToggle(topic.id)}
      style={[styles.topicCard, isSelected && styles.topicCardSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`${topic.name}: ${topic.description}`}
    >
      <View style={styles.topicCardContent}>
        <Text style={styles.topicIcon}>{topic.icon}</Text>
        <View style={styles.topicTextContainer}>
          <Text style={styles.topicName}>{topic.name}</Text>
          <Text style={styles.topicDescription}>{topic.description}</Text>
        </View>
        {isSelected && (
          <View style={styles.checkBadge}>
            <Text style={styles.checkText}>{"✓"}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
});

export const MobileTopicsScreen = memo(function MobileTopicsScreen({
  initialSelected = [],
  onContinue,
  onBack,
  onSkip,
}: MobileTopicsScreenProps) {
  const { scaledFont } = useDynamicType();
  const styles = useMemo(() => createStyles(scaledFont), [scaledFont]);

  const [selectedTopics, setSelectedTopics] =
    useState<string[]>(initialSelected);

  const toggleTopic = useCallback((topicId: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topicId)
        ? prev.filter((id) => id !== topicId)
        : [...prev, topicId],
    );
  }, []);

  const handleContinue = useCallback(() => {
    onContinue(selectedTopics);
  }, [onContinue, selectedTopics]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>What interests you?</Text>
        <Text style={styles.subtitle}>
          Select topics to personalize your feed and discover relevant content
        </Text>
        <Text style={styles.counter}>
          {selectedTopics.length > 0
            ? `${selectedTopics.length} topic${selectedTopics.length !== 1 ? "s" : ""} selected`
            : "Select at least one topic to continue"}
        </Text>
      </View>

      {/* Topics Grid */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {TOPIC_CATEGORIES.map((topic: TopicCategory) => (
          <TopicCard
            key={topic.id}
            topic={topic}
            isSelected={selectedTopics.includes(topic.id)}
            onToggle={toggleTopic}
            styles={styles}
          />
        ))}
      </ScrollView>

      {/* Navigation */}
      <View style={styles.navigation}>
        <Pressable
          onPress={onBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>

        <View style={styles.rightButtons}>
          <Pressable
            onPress={onSkip}
            style={styles.skipButton}
            accessibilityRole="button"
            accessibilityLabel="Skip"
          >
            <Text style={styles.skipButtonText}>Skip</Text>
          </Pressable>

          <Pressable
            onPress={handleContinue}
            disabled={selectedTopics.length === 0}
            style={[
              styles.continueButton,
              selectedTopics.length === 0 && styles.continueButtonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Continue"
            accessibilityState={{ disabled: selectedTopics.length === 0 }}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
});
