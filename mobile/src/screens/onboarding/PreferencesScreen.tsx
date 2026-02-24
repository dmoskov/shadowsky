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

interface ContentPreferences {
  hideReposts: boolean;
  hideReplies: boolean;
  showAdultContent: boolean;
}

interface PreferenceOption {
  key: keyof ContentPreferences;
  icon: string;
  activeIcon: string;
  title: string;
  description: string;
}

const PREFERENCE_OPTIONS: PreferenceOption[] = [
  {
    key: "hideReposts",
    icon: "\u{1F501}",
    activeIcon: "\u{1F6AB}",
    title: "Hide reposts",
    description:
      "Don't show posts that others have reposted in your timeline",
  },
  {
    key: "hideReplies",
    icon: "\u{1F4AC}",
    activeIcon: "\u{1F6AB}",
    title: "Hide replies",
    description: "Only show original posts, not replies to other posts",
  },
  {
    key: "showAdultContent",
    icon: "\u{1F512}",
    activeIcon: "\u{1F441}",
    title: "Show adult content",
    description: "Display posts marked as adult or sensitive content",
  },
];

export interface PreferencesScreenProps {
  initialPreferences?: ContentPreferences;
  onContinue: (preferences: ContentPreferences) => void;
  onBack: () => void;
}

const PreferenceToggle = memo(function PreferenceToggle({
  option,
  isActive,
  onToggle,
}: {
  option: PreferenceOption;
  isActive: boolean;
  onToggle: (key: keyof ContentPreferences) => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={() => onToggle(option.key)}
      style={[styles.preferenceCard, { backgroundColor: colors.surface }]}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={`${option.title}: ${option.description}`}
    >
      <View style={styles.preferenceContent}>
        <View
          style={[
            styles.preferenceIcon,
            { backgroundColor: colors.border },
            isActive && { backgroundColor: colors.primary },
          ]}
        >
          <Text style={styles.preferenceIconText}>
            {isActive ? option.activeIcon : option.icon}
          </Text>
        </View>
        <View style={styles.preferenceTextContainer}>
          <Text style={[styles.preferenceTitle, { color: colors.text }]}>
            {option.title}
          </Text>
          <Text
            style={[
              styles.preferenceDescription,
              { color: colors.textSecondary },
            ]}
          >
            {option.description}
          </Text>
        </View>
        {isActive && (
          <View style={[styles.checkBadge, { backgroundColor: colors.success }]}>
            <Text style={[styles.checkText, { color: colors.textOnPrimary }]}>{"\u2713"}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
});

export const PreferencesScreen = memo(function PreferencesScreen({
  initialPreferences = {
    hideReposts: false,
    hideReplies: false,
    showAdultContent: false,
  },
  onContinue,
  onBack,
}: PreferencesScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [preferences, setPreferences] =
    useState<ContentPreferences>(initialPreferences);

  const togglePreference = useCallback((key: keyof ContentPreferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const handleComplete = useCallback(() => {
    onContinue(preferences);
  }, [onContinue, preferences]);

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
        <View
          style={[
            styles.headerIcon,
            { backgroundColor: colors.glowPrimary },
          ]}
        >
          <Text style={styles.headerIconText}>{"\u2699\uFE0F"}</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>
          Content preferences
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Customize what you see in your timeline
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {PREFERENCE_OPTIONS.map((option) => (
          <PreferenceToggle
            key={option.key}
            option={option}
            isActive={preferences[option.key]}
            onToggle={togglePreference}
          />
        ))}

        <View
          style={[
            styles.infoBox,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            These preferences can be changed anytime in Settings. Content
            moderation labels from Bluesky will still apply.
          </Text>
        </View>
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
          <Text
            style={[styles.backButtonText, { color: colors.textSecondary }]}
          >
            Back
          </Text>
        </Pressable>

        <Pressable
          onPress={handleComplete}
          style={[
            styles.completeButton,
            { backgroundColor: colors.primary },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Continue"
        >
          <Text style={[styles.completeButtonText, { color: colors.textOnPrimary }]}>Continue</Text>
        </Pressable>
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
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  headerIconText: {
    fontSize: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  preferenceCard: {
    borderRadius: 12,
    padding: 16,
  },
  preferenceContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  preferenceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  preferenceIconText: {
    fontSize: 20,
  },
  preferenceTextContainer: {
    flex: 1,
  },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  preferenceDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  checkText: {
    fontSize: 14,
    fontWeight: "700",
  },
  infoBox: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginTop: 4,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
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
    fontSize: 15,
    fontWeight: "500",
  },
  completeButton: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
  },
  completeButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
