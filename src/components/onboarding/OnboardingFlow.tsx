import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useViewTransitionNavigate } from "../../hooks/useViewTransitionNavigate";
import { onboardingService } from "../../services/onboarding-service";
import { FeedsScreen } from "./FeedsScreen";
import { FollowsScreen } from "./FollowsScreen";
import { PreferencesScreen } from "./PreferencesScreen";
import { TopicsScreen } from "./TopicsScreen";
import { WelcomeScreen } from "./WelcomeScreen";

type OnboardingStep =
  | "welcome"
  | "topics"
  | "follows"
  | "feeds"
  | "preferences";

interface OnboardingFlowProps {
  onComplete?: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onComplete,
}) => {
  const { agent } = useAuth();
  const navigate = useViewTransitionNavigate();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");

  // Initialize onboarding service with agent
  useEffect(() => {
    if (agent) {
      onboardingService.setAgent(agent);
    }
  }, [agent]);

  // Load saved state on mount
  useEffect(() => {
    const state = onboardingService.getState();
    if (state.completed) {
      // If already completed, skip to home
      navigate("/home");
    } else if (state.currentStep > 0) {
      // Resume from saved step
      const steps: OnboardingStep[] = [
        "welcome",
        "topics",
        "follows",
        "feeds",
        "preferences",
      ];
      if (state.currentStep < steps.length) {
        setCurrentStep(steps[state.currentStep]);
      }
    }
  }, [navigate]);

  const handleWelcomeContinue = () => {
    onboardingService.updateState({ currentStep: 1 });
    setCurrentStep("topics");
  };

  const handleWelcomeSkip = () => {
    // Skip entire onboarding
    onboardingService.markCompleted();
    if (onComplete) {
      onComplete();
    } else {
      navigate("/home");
    }
  };

  const handleTopicsContinue = (selectedTopics: string[]) => {
    onboardingService.updateState({
      currentStep: 2,
      selectedTopics,
    });
    setCurrentStep("follows");
  };

  const handleTopicsBack = () => {
    onboardingService.updateState({ currentStep: 0 });
    setCurrentStep("welcome");
  };

  const handleTopicsSkip = () => {
    onboardingService.updateState({ currentStep: 2 });
    onboardingService.markStepSkipped("topics");
    setCurrentStep("follows");
  };

  const handleFollowsContinue = (followedDids: string[]) => {
    onboardingService.updateState({
      currentStep: 3,
      followedUsers: followedDids,
    });
    setCurrentStep("feeds");
  };

  const handleFollowsBack = () => {
    onboardingService.updateState({ currentStep: 1 });
    setCurrentStep("topics");
  };

  const handleFollowsSkip = () => {
    onboardingService.updateState({ currentStep: 3 });
    onboardingService.markStepSkipped("follows");
    setCurrentStep("feeds");
  };

  const handleFeedsContinue = (savedFeeds: string[]) => {
    onboardingService.updateState({
      currentStep: 4,
      selectedFeeds: savedFeeds,
    });
    setCurrentStep("preferences");
  };

  const handleFeedsBack = () => {
    onboardingService.updateState({ currentStep: 2 });
    setCurrentStep("follows");
  };

  const handleFeedsSkip = () => {
    onboardingService.updateState({ currentStep: 4 });
    onboardingService.markStepSkipped("feeds");
    setCurrentStep("preferences");
  };

  const handlePreferencesContinue = (preferences: {
    hideReposts: boolean;
    hideReplies: boolean;
    showAdultContent: boolean;
  }) => {
    onboardingService.updateState({
      contentPreferences: preferences,
    });
    onboardingService.markCompleted();

    if (onComplete) {
      onComplete();
    } else {
      navigate("/home");
    }
  };

  const handlePreferencesBack = () => {
    onboardingService.updateState({ currentStep: 3 });
    setCurrentStep("feeds");
  };

  // Render current step
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
          initialSelected={onboardingService.getState().selectedTopics}
          onContinue={handleTopicsContinue}
          onBack={handleTopicsBack}
          onSkip={handleTopicsSkip}
        />
      );

    case "follows":
      return (
        <FollowsScreen
          onContinue={handleFollowsContinue}
          onBack={handleFollowsBack}
          onSkip={handleFollowsSkip}
        />
      );

    case "feeds":
      return (
        <FeedsScreen
          onContinue={handleFeedsContinue}
          onBack={handleFeedsBack}
          onSkip={handleFeedsSkip}
        />
      );

    case "preferences":
      return (
        <PreferencesScreen
          initialPreferences={onboardingService.getState().contentPreferences}
          onContinue={handlePreferencesContinue}
          onBack={handlePreferencesBack}
        />
      );

    default:
      return null;
  }
};
