/**
 * MobileOnboardingFlow Component for React Native
 *
 * Orchestrates the multi-step mobile onboarding experience.
 * Mirrors the web OnboardingFlow but uses native RN components.
 *
 * Steps: Welcome -> Topics -> Follows -> Feeds -> Preferences
 *
 * State is persisted via the shared onboardingService so that
 * progress is saved if the user leaves mid-flow.
 */

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { onboardingService } from "../../../services/onboarding-service";
import { MobileFeedsScreen } from "./MobileFeedsScreen";
import { MobileFollowsScreen } from "./MobileFollowsScreen";
import { MobilePreferencesScreen } from "./MobilePreferencesScreen";
import { MobileTopicsScreen } from "./MobileTopicsScreen";
import { MobileWelcomeScreen } from "./MobileWelcomeScreen";

type OnboardingStep =
  | "welcome"
  | "topics"
  | "follows"
  | "feeds"
  | "preferences";

const STEPS: OnboardingStep[] = [
  "welcome",
  "topics",
  "follows",
  "feeds",
  "preferences",
];

export interface MobileOnboardingFlowProps {
  onComplete: () => void;
}

/**
 * Hook to fetch suggested users for the follows screen.
 * Keeps API concerns out of the presentational components.
 */
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

/**
 * Hook to fetch suggested feeds for the feeds screen.
 */
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

export const MobileOnboardingFlow = memo(function MobileOnboardingFlow({
  onComplete,
}: MobileOnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");

  // Pre-fetch data for later screens
  const { users: suggestedUsers, isLoading: usersLoading } =
    useSuggestedUsers();
  const { feeds: suggestedFeeds, isLoading: feedsLoading } =
    useSuggestedFeeds();

  // Resume from saved state on mount
  useEffect(() => {
    const state = onboardingService.getState();
    if (state.completed) {
      onComplete();
    } else if (state.currentStep > 0 && state.currentStep < STEPS.length) {
      setCurrentStep(STEPS[state.currentStep]);
    }
  }, [onComplete]);

  // Memoized initial state for topics screen
  const initialTopics = useMemo(
    () => onboardingService.getState().selectedTopics,
    [],
  );

  const initialPreferences = useMemo(
    () => onboardingService.getState().contentPreferences,
    [],
  );

  // ---- Welcome handlers ----
  const handleWelcomeContinue = useCallback(() => {
    onboardingService.updateState({ currentStep: 1 });
    setCurrentStep("topics");
  }, []);

  const handleWelcomeSkip = useCallback(() => {
    onboardingService.markCompleted();
    onComplete();
  }, [onComplete]);

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
      onboardingService.updateState({ contentPreferences: preferences });
      onboardingService.markCompleted();
      onComplete();
    },
    [onComplete],
  );

  const handlePreferencesBack = useCallback(() => {
    onboardingService.updateState({ currentStep: 3 });
    setCurrentStep("feeds");
  }, []);

  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case "welcome":
        return (
          <MobileWelcomeScreen
            onContinue={handleWelcomeContinue}
            onSkip={handleWelcomeSkip}
          />
        );

      case "topics":
        return (
          <MobileTopicsScreen
            initialSelected={initialTopics}
            onContinue={handleTopicsContinue}
            onBack={handleTopicsBack}
            onSkip={handleTopicsSkip}
          />
        );

      case "follows":
        return (
          <MobileFollowsScreen
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
          <MobileFeedsScreen
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
          <MobilePreferencesScreen
            initialPreferences={initialPreferences}
            onContinue={handlePreferencesContinue}
            onBack={handlePreferencesBack}
          />
        );

      default:
        return null;
    }
  };

  return <View style={styles.container}>{renderStep()}</View>;
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  } as ViewStyle,
});
