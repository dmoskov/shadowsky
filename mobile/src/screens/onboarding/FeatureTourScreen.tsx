import React, { memo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";

interface TourFeature {
  icon: string;
  title: string;
  description: string;
}

const TOUR_FEATURES: TourFeature[] = [
  {
    icon: "\u{1F4CA}",
    title: "Analytics Dashboard",
    description:
      "Track your post performance, follower growth, and engagement metrics in real-time.",
  },
  {
    icon: "\u{1F514}",
    title: "Smart Notifications",
    description:
      "Get notified about likes, reposts, follows, and mentions with customizable filters.",
  },
  {
    icon: "\u{1F4DD}",
    title: "Scheduled Posts",
    description:
      "Write posts now and schedule them to publish at the perfect time for your audience.",
  },
  {
    icon: "\u{1F516}",
    title: "Bookmark Collections",
    description:
      "Save posts to organized collections so you can find them easily later.",
  },
  {
    icon: "\u{1F50D}",
    title: "Advanced Search",
    description:
      "Search posts, profiles, and feeds with powerful filters and suggestions.",
  },
  {
    icon: "\u{1F3A8}",
    title: "Custom Feeds",
    description:
      "Discover and pin curated feeds to your timeline for content tailored to your interests.",
  },
];

export interface FeatureTourScreenProps {
  onComplete: () => void;
  onBack: () => void;
}

const FeatureCard = memo(function FeatureCard({
  feature,
}: {
  feature: TourFeature;
}) {
  const { colors } = useTheme();

  return (
    <View style={[styles.featureCard, { backgroundColor: colors.surface }]}>
      <View style={styles.featureContent}>
        <View
          style={[
            styles.featureIconContainer,
            { backgroundColor: colors.glowPrimary },
          ]}
        >
          <Text style={styles.featureIcon}>{feature.icon}</Text>
        </View>
        <View style={styles.featureTextContainer}>
          <Text style={[styles.featureTitle, { color: colors.text }]}>
            {feature.title}
          </Text>
          <Text
            style={[
              styles.featureDescription,
              { color: colors.textSecondary },
            ]}
          >
            {feature.description}
          </Text>
        </View>
      </View>
    </View>
  );
});

export const FeatureTourScreen = memo(function FeatureTourScreen({
  onComplete,
  onBack,
}: FeatureTourScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

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
          <Text style={styles.headerIconText}>{"\u{1F680}"}</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>
          {"You're all set!"}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {"Here's what you can do with Asphodel"}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {TOUR_FEATURES.map((feature) => (
          <FeatureCard key={feature.title} feature={feature} />
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
          <Text
            style={[styles.backButtonText, { color: colors.textSecondary }]}
          >
            Back
          </Text>
        </Pressable>

        <Pressable
          onPress={onComplete}
          style={[
            styles.completeButton,
            { backgroundColor: colors.primary },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Start Exploring"
        >
          <Text style={styles.completeButtonText}>Start Exploring</Text>
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
  featureCard: {
    borderRadius: 12,
    padding: 16,
  },
  featureContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  featureIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  featureIcon: {
    fontSize: 22,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  featureDescription: {
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
    color: "#ffffff",
  },
});
