import React, { memo, useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";
import {
  TOPIC_CATEGORIES,
  type TopicCategory,
} from "../../services/onboarding/onboarding-service";
import {fontSize} from '../../utils/typography';

export interface TopicsScreenProps {
  initialSelected?: string[];
  onContinue: (selectedTopics: string[]) => void;
  onBack: () => void;
  onSkip: () => void;
}

const TOPIC_ICONS: Record<string, string> = {
  news: "\u{1F4F0}",
  tech: "\u{1F4BB}",
  science: "\u{1F52C}",
  art: "\u{1F3A8}",
  gaming: "\u{1F3AE}",
  music: "\u{1F3B5}",
  sports: "\u26BD",
  food: "\u{1F373}",
  books: "\u{1F4DA}",
  movies: "\u{1F3AC}",
  nature: "\u{1F33F}",
  fashion: "\u{1F457}",
};

const TopicCard = memo(function TopicCard({
  topic,
  isSelected,
  onToggle,
}: {
  topic: TopicCategory;
  isSelected: boolean;
  onToggle: (id: string) => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={() => onToggle(topic.id)}
      style={[
        styles.topicCard,
        { backgroundColor: colors.surface },
        isSelected && {
          borderColor: colors.primary,
          backgroundColor: colors.glowPrimary,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`${topic.name}: ${topic.description}`}
    >
      <View style={styles.topicCardContent}>
        <Text style={styles.topicIcon}>
          {TOPIC_ICONS[topic.id] || "\u2B50"}
        </Text>
        <View style={styles.topicTextContainer}>
          <Text style={[styles.topicName, { color: colors.text }]}>
            {topic.name}
          </Text>
          <Text
            style={[styles.topicDescription, { color: colors.textSecondary }]}
          >
            {topic.description}
          </Text>
        </View>
        {isSelected && (
          <View
            style={[styles.checkBadge, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.checkText, { color: colors.textOnPrimary }]}>{"\u2713"}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
});

export const TopicsScreen = memo(function TopicsScreen({
  initialSelected = [],
  onContinue,
  onBack,
  onSkip,
}: TopicsScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          What interests you?
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Select topics to personalize your feed and discover relevant content
        </Text>
        <Text style={[styles.counter, { color: colors.textTertiary }]}>
          {selectedTopics.length > 0
            ? `${selectedTopics.length} topic${selectedTopics.length !== 1 ? "s" : ""} selected`
            : "Select at least one topic to continue"}
        </Text>
      </View>

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
          />
        ))}
      </ScrollView>

      <View
        style={[
          styles.navigation,
          {
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        <Pressable
          onPress={onBack}
          style={[styles.backButton, { borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={[styles.backButtonText, { color: colors.textSecondary }]}>
            Back
          </Text>
        </Pressable>

        <View style={styles.rightButtons}>
          <Pressable
            onPress={onSkip}
            style={[styles.skipButton, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="Skip"
          >
            <Text
              style={[styles.skipButtonText, { color: colors.textSecondary }]}
            >
              Skip
            </Text>
          </Pressable>

          <Pressable
            onPress={handleContinue}
            disabled={selectedTopics.length === 0}
            style={[
              styles.continueButton,
              { backgroundColor: colors.primary },
              selectedTopics.length === 0 && styles.continueButtonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Continue"
            accessibilityState={{ disabled: selectedTopics.length === 0 }}
          >
            <Text style={[styles.continueButtonText, { color: colors.textOnPrimary }]}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    alignItems: "center",
  },
  title: {
    fontSize: fontSize.title1,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: fontSize.subheadline,
    textAlign: "center",
    marginBottom: 8,
  },
  counter: {
    fontSize: fontSize.footnote,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  topicCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: "transparent",
  },
  topicCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  topicIcon: {
    fontSize: fontSize.title1,
  },
  topicTextContainer: {
    flex: 1,
  },
  topicName: {
    fontSize: fontSize.callout,
    fontWeight: "600",
    marginBottom: 2,
  },
  topicDescription: {
    fontSize: fontSize.footnote,
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  checkText: {
    fontSize: fontSize.subheadline,
    fontWeight: "700",
  },
  navigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
  },
  backButtonText: {
    fontSize: fontSize.subheadline,
    fontWeight: "500",
  },
  rightButtons: {
    flexDirection: "row",
    gap: 10,
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
  },
  skipButtonText: {
    fontSize: fontSize.subheadline,
    fontWeight: "500",
  },
  continueButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    fontSize: fontSize.subheadline,
    fontWeight: "600",
  },
});
