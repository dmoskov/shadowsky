import { useCallback, useEffect, useState } from "react";

const ONBOARDING_STORAGE_KEY = "shadowsky-onboarding-completed";
const ONBOARDING_STEP_KEY = "shadowsky-onboarding-step";

export interface OnboardingState {
  hasCompletedOnboarding: boolean;
  currentStep: number;
  totalSteps: number;
  isOnboardingActive: boolean;
}

export interface UseOnboardingReturn extends OnboardingState {
  startOnboarding: () => void;
  completeOnboarding: () => void;
  nextStep: () => void;
  previousStep: () => void;
  skipOnboarding: () => void;
  resetOnboarding: () => void;
  goToStep: (step: number) => void;
}

const TOTAL_STEPS = 5;

function getStoredOnboardingState(): {
  completed: boolean;
  currentStep: number;
} {
  try {
    const completed = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    const step = localStorage.getItem(ONBOARDING_STEP_KEY);
    return {
      completed: completed === "true",
      currentStep: step ? parseInt(step, 10) : 0,
    };
  } catch {
    return { completed: false, currentStep: 0 };
  }
}

function setStoredOnboardingCompleted(completed: boolean): void {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, String(completed));
    if (completed) {
      localStorage.removeItem(ONBOARDING_STEP_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

function setStoredCurrentStep(step: number): void {
  try {
    localStorage.setItem(ONBOARDING_STEP_KEY, String(step));
  } catch {
    // Ignore storage errors
  }
}

export function useOnboarding(): UseOnboardingReturn {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(() => {
    return getStoredOnboardingState().completed;
  });
  const [currentStep, setCurrentStep] = useState(() => {
    return getStoredOnboardingState().currentStep;
  });
  const [isOnboardingActive, setIsOnboardingActive] = useState(false);

  // Check if this is a first-time user on mount
  useEffect(() => {
    const { completed } = getStoredOnboardingState();
    if (!completed) {
      // First-time user - start onboarding automatically
      setIsOnboardingActive(true);
    }
  }, []);

  const startOnboarding = useCallback(() => {
    setCurrentStep(0);
    setStoredCurrentStep(0);
    setIsOnboardingActive(true);
  }, []);

  const completeOnboarding = useCallback(() => {
    setHasCompletedOnboarding(true);
    setStoredOnboardingCompleted(true);
    setIsOnboardingActive(false);
    setCurrentStep(0);
  }, []);

  const skipOnboarding = useCallback(() => {
    // Skipping also marks as completed to not show again
    setHasCompletedOnboarding(true);
    setStoredOnboardingCompleted(true);
    setIsOnboardingActive(false);
    setCurrentStep(0);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => {
      const next = Math.min(prev + 1, TOTAL_STEPS - 1);
      setStoredCurrentStep(next);
      return next;
    });
  }, []);

  const previousStep = useCallback(() => {
    setCurrentStep((prev) => {
      const next = Math.max(prev - 1, 0);
      setStoredCurrentStep(next);
      return next;
    });
  }, []);

  const goToStep = useCallback((step: number) => {
    const clampedStep = Math.max(0, Math.min(step, TOTAL_STEPS - 1));
    setCurrentStep(clampedStep);
    setStoredCurrentStep(clampedStep);
  }, []);

  const resetOnboarding = useCallback(() => {
    setHasCompletedOnboarding(false);
    setStoredOnboardingCompleted(false);
    setCurrentStep(0);
    setStoredCurrentStep(0);
  }, []);

  return {
    hasCompletedOnboarding,
    currentStep,
    totalSteps: TOTAL_STEPS,
    isOnboardingActive,
    startOnboarding,
    completeOnboarding,
    nextStep,
    previousStep,
    skipOnboarding,
    resetOnboarding,
    goToStep,
  };
}
