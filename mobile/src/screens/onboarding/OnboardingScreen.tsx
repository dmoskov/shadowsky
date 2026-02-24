/**
 * OnboardingScreen
 *
 * Orchestrates the multi-step mobile onboarding flow.
 * Steps: Welcome -> Topics -> Follows -> Feeds -> Preferences -> Feature Tour
 *
 * State is persisted via the MMKV-backed onboardingService so that
 * progress is saved if the user leaves mid-flow.
 */

import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../../contexts/ThemeContext";
import { onboardingService } from "../../services/onboarding/onboarding-service";
import { WelcomeScreen } from "./WelcomeScreen";
import { TopicsScreen } from "./TopicsScreen";
import { FollowsScreen } from "./FollowsScreen";
import { FeedsScreen } from "./FeedsScreen";
import { PreferencesScreen } from "./PreferencesScreen";
import { FeatureTourScreen } from "./FeatureTourScreen";

type OnboardingStep =
  | "welcome"
  | "topics"
  | "follows"
  | "feeds"
  | "preferences"
  | "tour";

const STEPS: OnboardingStep[] = [
  "welcome",
  "topics",
  "follows",
  "feeds",
  "preferences",
  "tour",
];

function useSuggestedUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await onboardingService.getSuggestedUsers(20);
        if (!cancelled) setUsers(result);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { users, isLoading };
}

function useSuggestedFeeds() {
  const [feeds, setFeeds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await onboardingService.getSuggestedFeeds(20);
        if (!cancelled) setFeeds(result);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { feeds, isLoading };
}

export const OnboardingScreen = memo(function OnboardingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");

  const { users: suggestedUsers, isLoading: usersLoading } =
    useSuggestedUsers();
  const { feeds: suggestedFeeds, isLoading: feedsLoading } =
    useSuggestedFeeds();

  // Resume from saved state on mount
  useEffect(() => {
    const state = onboardingService.getState();
    if (state.completed) {
      router.replace("/(app)/(tabs)/(home)");
    } else if (state.currentStep > 0 && state.currentStep < STEPS.length) {
      setCurrentStep(STEPS[state.currentStep]);
    }
  }, [router]);

  const initialTopics = useMemo(
    () => onboardingService.getState().selectedTopics,
    [],
  );

  const initialPreferences = useMemo(
    () => onboardingService.getState().contentPreferences,
    [],
  );

  const finishOnboarding = useCallback(() => {
    onboardingService.markCompleted();
    router.replace("/(app)/(tabs)/(home)");
  }, [router]);

  // ---- Welcome handlers ----
  const handleWelcomeContinue = useCallback(() => {
    onboardingService.updateState({ currentStep: 1 });
    setCurrentStep("topics");
  }, []);

  const handleWelcomeSkip = useCallback(() => {
    finishOnboarding();
  }, [finishOnboarding]);

  // ---- Topics handlers ----
  const handleTopicsContinue = useCallback((selectedTopics: string[]) => {
    onboardingService.updateState({ currentStep: 2, selectedTopics });
    setCurrentStep("follows");
  }, []);

  const handleTopicsBack = useCallback(() => {
    onboardingService.updateState({ currentStep: 0 });
    setCurrentStep("welcome");
  }, []);

  const handleTopicsSkip = useCallback(() => {
    onboardingService.updateState({ currentStep: 2 });
    onboardingService.markStepSkipped("topics");
    setCurrentStep("follows");
  }, []);

  // ---- Follows handlers ----
  const handleFollowsContinue = useCallback((followedDids: string[]) => {
    onboardingService.updateState({
      currentStep: 3,
      followedUsers: followedDids,
    });
    setCurrentStep("feeds");
  }, []);

  const handleFollowsBack = useCallback(() => {
    onboardingService.updateState({ currentStep: 1 });
    setCurrentStep("topics");
  }, []);

  const handleFollowsSkip = useCallback(() => {
    onboardingService.updateState({ currentStep: 3 });
    onboardingService.markStepSkipped("follows");
    setCurrentStep("feeds");
  }, []);

  const handleFollowToggle = useCallback(async (did: string) => {
    return onboardingService.followUser(did);
  }, []);

  // ---- Feeds handlers ----
  const handleFeedsContinue = useCallback((savedFeeds: string[]) => {
    onboardingService.updateState({
      currentStep: 4,
      selectedFeeds: savedFeeds,
    });
    setCurrentStep("preferences");
  }, []);

  const handleFeedsBack = useCallback(() => {
    onboardingService.updateState({ currentStep: 2 });
    setCurrentStep("follows");
  }, []);

  const handleFeedsSkip = useCallback(() => {
    onboardingService.updateState({ currentStep: 4 });
    onboardingService.markStepSkipped("feeds");
    setCurrentStep("preferences");
  }, []);

  const handleSaveFeed = useCallback(async (feedUri: string) => {
    return onboardingService.saveFeed(feedUri);
  }, []);

  // ---- Preferences handlers ----
  const handlePreferencesContinue = useCallback(
    (preferences: {
      hideReposts: boolean;
      hideReplies: boolean;
      showAdultContent: boolean;
    }) => {
      onboardingService.updateState({
        currentStep: 5,
        contentPreferences: preferences,
      });
      setCurrentStep("tour");
    },
    [],
  );

  const handlePreferencesBack = useCallback(() => {
    onboardingService.updateState({ currentStep: 3 });
    setCurrentStep("feeds");
  }, []);

  // ---- Feature Tour handlers ----
  const handleTourComplete = useCallback(() => {
    finishOnboarding();
  }, [finishOnboarding]);

  const handleTourBack = useCallback(() => {
    onboardingService.updateState({ currentStep: 4 });
    setCurrentStep("preferences");
  }, []);

  const renderStep = () => {
    switch (currentStep) {
      case "welcome":
        return (
          <WelcomeScreen
            onContinue={handleWelcomeContinue}
            onSkip={handleWelcomeSkip}
          />
        );
      case "topics":
        return (
          <TopicsScreen
            initialSelected={initialTopics}
            onContinue={handleTopicsContinue}
            onBack={handleTopicsBack}
            onSkip={handleTopicsSkip}
          />
        );
      case "follows":
        return (
          <FollowsScreen
            suggestedUsers={suggestedUsers}
            isLoading={usersLoading}
            onFollowToggle={handleFollowToggle}
            onContinue={handleFollowsContinue}
            onBack={handleFollowsBack}
            onSkip={handleFollowsSkip}
          />
        );
      case "feeds":
        return (
          <FeedsScreen
            suggestedFeeds={suggestedFeeds}
            isLoading={feedsLoading}
            onSaveFeed={handleSaveFeed}
            onContinue={handleFeedsContinue}
            onBack={handleFeedsBack}
            onSkip={handleFeedsSkip}
          />
        );
      case "preferences":
        return (
          <PreferencesScreen
            initialPreferences={initialPreferences}
            onContinue={handlePreferencesContinue}
            onBack={handlePreferencesBack}
          />
        );
      case "tour":
        return (
          <FeatureTourScreen
            onComplete={handleTourComplete}
            onBack={handleTourBack}
          />
        );
      default:
        return null;
    }
  };

  return <View style={[styles.container, { backgroundColor: colors.background }]}>{renderStep()}</View>;
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
