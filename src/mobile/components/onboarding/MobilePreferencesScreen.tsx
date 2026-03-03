/**
 * MobilePreferencesScreen Component for React Native
 *
 * Content preferences screen for mobile onboarding.
 * Users configure timeline display preferences before completing setup.
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
import { spacing } from "../../../theme/spacing";
import {
  scaledLineHeight,
  useDynamicType,
  type ScaledFontFn,
} from "../../hooks/useDynamicType";

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
    icon: "🔁",
    activeIcon: "🚫",
    title: "Hide reposts",
    description: "Don't show posts that others have reposted in your timeline",
  },
  {
    key: "hideReplies",
    icon: "💬",
    activeIcon: "🚫",
    title: "Hide replies",
    description: "Only show original posts, not replies to other posts",
  },
  {
    key: "showAdultContent",
    icon: "🔒",
    activeIcon: "👁",
    title: "Show adult content",
    description: "Display posts marked as adult or sensitive content",
  },
];

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
    headerIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: "rgba(99, 102, 241, 0.15)",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: spacing.lg,
    } as ViewStyle,
    headerIconText: {
      fontSize: scaledFont(28),
    } as TextStyle,
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
    } as TextStyle,
    scrollView: {
      flex: 1,
    } as ViewStyle,
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
      gap: spacing.md,
    } as ViewStyle,
    preferenceCard: {
      backgroundColor: "#111122",
      borderRadius: 12,
      padding: spacing.lg,
    } as ViewStyle,
    preferenceContent: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.lg,
    } as ViewStyle,
    preferenceIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "#1a1a2e",
      justifyContent: "center",
      alignItems: "center",
    } as ViewStyle,
    preferenceIconActive: {
      backgroundColor: "#6366f1",
    } as ViewStyle,
    preferenceIconText: {
      fontSize: scaledFont(20),
    } as TextStyle,
    preferenceTextContainer: {
      flex: 1,
    } as ViewStyle,
    preferenceTitle: {
      fontSize: scaledFont(16),
      fontWeight: "600",
      color: "#ffffff",
      marginBottom: spacing.xs,
    } as TextStyle,
    preferenceDescription: {
      fontSize: scaledFont(13),
      color: "#8a8a9a",
      lineHeight: scaledLineHeight(scaledFont, 13, 18),
    } as TextStyle,
    checkBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: "#22c55e",
      justifyContent: "center",
      alignItems: "center",
      marginTop: spacing.xs,
    } as ViewStyle,
    checkText: {
      fontSize: scaledFont(14),
      color: "#ffffff",
      fontWeight: "700",
    } as TextStyle,
    infoBox: {
      backgroundColor: "#111122",
      borderRadius: 12,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: "#1a1a2e",
      marginTop: spacing.xs,
    } as ViewStyle,
    infoText: {
      fontSize: scaledFont(13),
      color: "#8a8a9a",
      lineHeight: scaledLineHeight(scaledFont, 13, 18),
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
    completeButton: {
      backgroundColor: "#6366f1",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xxl,
      borderRadius: 10,
    } as ViewStyle,
    completeButtonText: {
      fontSize: scaledFont(15),
      fontWeight: "600",
      color: "#ffffff",
    } as TextStyle,
  });
}

type Styles = ReturnType<typeof createStyles>;

export interface MobilePreferencesScreenProps {
  initialPreferences?: ContentPreferences;
  onContinue: (preferences: ContentPreferences) => void;
  onBack: () => void;
}

const PreferenceToggle = memo(function PreferenceToggle({
  option,
  isActive,
  onToggle,
  styles,
}: {
  option: PreferenceOption;
  isActive: boolean;
  onToggle: (key: keyof ContentPreferences) => void;
  styles: Styles;
}) {
  return (
    <Pressable
      onPress={() => onToggle(option.key)}
      style={styles.preferenceCard}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={`${option.title}: ${option.description}`}
    >
      <View style={styles.preferenceContent}>
        <View
          style={[
            styles.preferenceIcon,
            isActive && styles.preferenceIconActive,
          ]}
        >
          <Text style={styles.preferenceIconText}>
            {isActive ? option.activeIcon : option.icon}
          </Text>
        </View>
        <View style={styles.preferenceTextContainer}>
          <Text style={styles.preferenceTitle}>{option.title}</Text>
          <Text style={styles.preferenceDescription}>{option.description}</Text>
        </View>
        {isActive && (
          <View style={styles.checkBadge}>
            <Text style={styles.checkText}>{"✓"}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
});

export const MobilePreferencesScreen = memo(function MobilePreferencesScreen({
  initialPreferences = {
    hideReposts: false,
    hideReplies: false,
    showAdultContent: false,
  },
  onContinue,
  onBack,
}: MobilePreferencesScreenProps) {
  const { scaledFont } = useDynamicType();
  const styles = useMemo(() => createStyles(scaledFont), [scaledFont]);

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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>{"⚙️"}</Text>
        </View>
        <Text style={styles.title}>Content preferences</Text>
        <Text style={styles.subtitle}>
          Customize what you see in your timeline
        </Text>
      </View>

      {/* Preferences */}
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
            styles={styles}
          />
        ))}

        {/* Info note */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            These preferences can be changed anytime in Settings. Content
            moderation labels from Bluesky will still apply.
          </Text>
        </View>
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

        <Pressable
          onPress={handleComplete}
          style={styles.completeButton}
          accessibilityRole="button"
          accessibilityLabel="Complete Setup"
        >
          <Text style={styles.completeButtonText}>Complete Setup</Text>
        </Pressable>
      </View>
    </View>
  );
});
