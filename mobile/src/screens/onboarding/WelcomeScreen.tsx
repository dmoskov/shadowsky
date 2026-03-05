import React, { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";
import {fontSize} from '../../utils/typography';

export interface WelcomeScreenProps {
  onContinue: () => void;
  onSkip: () => void;
}

export const WelcomeScreen = memo(function WelcomeScreen({
  onContinue,
  onSkip,
}: WelcomeScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 40,
          paddingBottom: insets.bottom + 20,
        },
      ]}
    >
      <View style={styles.content}>
        <View
          style={[styles.iconContainer, { backgroundColor: colors.surface }]}
        >
          <Text style={styles.iconText}>{"\u{1F98B}"}</Text>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>
          Welcome to Asphodel
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Your advanced Bluesky analytics & notifications companion
        </Text>

        <View
          style={[styles.stepsCard, { backgroundColor: colors.surface }]}
        >
          <Text style={[styles.stepsTitle, { color: colors.text }]}>
            {"Let's personalize your experience"}
          </Text>
          <Text
            style={[styles.stepsDescription, { color: colors.textSecondary }]}
          >
            {"We'll help you set up Asphodel in just a few steps:"}
          </Text>

          <View style={styles.stepsList}>
            {[
              "Choose topics and interests you care about",
              "Discover interesting feeds and accounts to follow",
              "Customize your content preferences",
            ].map((text, i) => (
              <View key={i} style={styles.stepRow}>
                <Text style={[styles.stepNumber, { color: colors.primary }]}>
                  {i + 1}.
                </Text>
                <Text
                  style={[styles.stepText, { color: colors.textSecondary }]}
                >
                  {text}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.buttonsContainer}>
          <Pressable
            onPress={onContinue}
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Get Started"
          >
            <Text style={[styles.primaryButtonText, { color: colors.textOnPrimary }]}>Get Started</Text>
          </Pressable>

          <Pressable
            onPress={onSkip}
            style={[
              styles.secondaryButton,
              { borderColor: colors.border },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Skip setup"
          >
            <Text
              style={[
                styles.secondaryButtonText,
                { color: colors.textSecondary },
              ]}
            >
              Skip setup
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  content: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  iconText: {
    fontSize: fontSize.largeTitle,
  },
  title: {
    fontSize: fontSize.title1,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: fontSize.callout,
    textAlign: "center",
    marginBottom: 32,
  },
  stepsCard: {
    width: "100%",
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  stepsTitle: {
    fontSize: fontSize.headline,
    fontWeight: "600",
    marginBottom: 8,
  },
  stepsDescription: {
    fontSize: fontSize.subheadline,
    marginBottom: 16,
  },
  stepsList: {
    gap: 8,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  stepNumber: {
    fontSize: fontSize.subheadline,
    fontWeight: "600",
  },
  stepText: {
    fontSize: fontSize.subheadline,
    flex: 1,
  },
  buttonsContainer: {
    width: "100%",
    gap: 12,
    marginBottom: 20,
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: fontSize.body,
    fontWeight: "600",
  },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: fontSize.body,
    fontWeight: "500",
  },
});
