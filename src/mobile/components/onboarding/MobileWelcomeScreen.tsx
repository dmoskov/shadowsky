/**
 * MobileWelcomeScreen Component for React Native
 *
 * First screen of the mobile onboarding flow. Introduces the app
 * and lets the user start setup or skip onboarding entirely.
 */

import { memo, useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useDynamicType, type ScaledFontFn } from "../../hooks/useDynamicType";

import { spacing } from "../../../theme/spacing";
function createStyles(scaledFont: ScaledFontFn) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#000000",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: spacing.xl,
    } as ViewStyle,
    content: {
      width: "100%" as unknown as number,
      maxWidth: 400,
      alignItems: "center",
    } as ViewStyle,
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 20,
      backgroundColor: "#1a1a2e",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: spacing.xl,
    } as ViewStyle,
    iconText: {
      fontSize: scaledFont(40),
    } as TextStyle,
    title: {
      fontSize: scaledFont(28),
      fontWeight: "700",
      color: "#ffffff",
      textAlign: "center",
      marginBottom: spacing.sm,
    } as TextStyle,
    subtitle: {
      fontSize: scaledFont(16),
      color: "#8a8a9a",
      textAlign: "center",
      marginBottom: spacing.xxl,
    } as TextStyle,
    stepsCard: {
      width: "100%" as unknown as number,
      backgroundColor: "#111122",
      borderRadius: 16,
      padding: spacing.xl,
      marginBottom: spacing.xxl,
    } as ViewStyle,
    stepsTitle: {
      fontSize: scaledFont(18),
      fontWeight: "600",
      color: "#ffffff",
      marginBottom: spacing.sm,
    } as TextStyle,
    stepsDescription: {
      fontSize: scaledFont(14),
      color: "#8a8a9a",
      marginBottom: spacing.lg,
    } as TextStyle,
    stepsList: {
      gap: spacing.sm,
    } as ViewStyle,
    stepRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
    } as ViewStyle,
    stepNumber: {
      fontSize: scaledFont(14),
      color: "#6366f1",
      fontWeight: "600",
    } as TextStyle,
    stepText: {
      fontSize: scaledFont(14),
      color: "#8a8a9a",
      flex: 1,
    } as TextStyle,
    buttonsContainer: {
      width: "100%" as unknown as number,
      gap: spacing.md,
      marginBottom: spacing.xl,
    } as ViewStyle,
    primaryButton: {
      backgroundColor: "#6366f1",
      borderRadius: 12,
      paddingVertical: spacing.lg,
      alignItems: "center",
    } as ViewStyle,
    primaryButtonText: {
      fontSize: scaledFont(17),
      fontWeight: "600",
      color: "#ffffff",
    } as TextStyle,
    secondaryButton: {
      borderRadius: 12,
      paddingVertical: spacing.lg,
      alignItems: "center",
      borderWidth: 1,
      borderColor: "#333344",
    } as ViewStyle,
    secondaryButtonText: {
      fontSize: scaledFont(17),
      fontWeight: "500",
      color: "#8a8a9a",
    } as TextStyle,
  });
}

export interface MobileWelcomeScreenProps {
  onContinue: () => void;
  onSkip: () => void;
}

export const MobileWelcomeScreen = memo(function MobileWelcomeScreen({
  onContinue,
  onSkip,
}: MobileWelcomeScreenProps) {
  const { scaledFont } = useDynamicType();
  const styles = useMemo(() => createStyles(scaledFont), [scaledFont]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* App icon placeholder */}
        <View style={styles.iconContainer}>
          <Text style={styles.iconText}>{"🦋"}</Text>
        </View>

        {/* Welcome text */}
        <Text style={styles.title}>Welcome to Asphodel</Text>
        <Text style={styles.subtitle}>
          Your advanced Bluesky analytics & notifications companion
        </Text>

        {/* Setup steps */}
        <View style={styles.stepsCard}>
          <Text style={styles.stepsTitle}>
            {"Let's personalize your experience"}
          </Text>
          <Text style={styles.stepsDescription}>
            {"We'll help you set up Asphodel in just a few steps:"}
          </Text>

          <View style={styles.stepsList}>
            <View style={styles.stepRow}>
              <Text style={styles.stepNumber}>1.</Text>
              <Text style={styles.stepText}>
                Choose topics and interests you care about
              </Text>
            </View>
            <View style={styles.stepRow}>
              <Text style={styles.stepNumber}>2.</Text>
              <Text style={styles.stepText}>
                Discover interesting feeds and accounts to follow
              </Text>
            </View>
            <View style={styles.stepRow}>
              <Text style={styles.stepNumber}>3.</Text>
              <Text style={styles.stepText}>
                Customize your content preferences
              </Text>
            </View>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.buttonsContainer}>
          <Pressable
            onPress={onContinue}
            style={styles.primaryButton}
            accessibilityRole="button"
            accessibilityLabel="Get Started"
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </Pressable>

          <Pressable
            onPress={onSkip}
            style={styles.secondaryButton}
            accessibilityRole="button"
            accessibilityLabel="Skip setup"
          >
            <Text style={styles.secondaryButtonText}>Skip setup</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
});
