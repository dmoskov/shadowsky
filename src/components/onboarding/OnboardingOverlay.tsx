import {
  ArrowLeft,
  ArrowRight,
  Columns,
  Keyboard,
  Layers,
  Plus,
  Rss,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import type { UseOnboardingReturn } from "../../hooks/useOnboarding";

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  spotlight?: {
    selector: string;
    padding?: number;
  };
  position?: "center" | "top" | "bottom" | "left" | "right";
}

const onboardingSteps: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Welcome to ShadowSky!",
    description:
      "ShadowSky is a powerful multi-column interface for Bluesky. Let's take a quick tour to help you get started.",
    icon: <Layers className="h-8 w-8" />,
    position: "center",
  },
  {
    id: "columns",
    title: "Multi-Column Layout",
    description:
      "Your feed is organized into columns. Each column can show different content - your timeline, notifications, messages, bookmarks, or custom feeds. You can scroll each column independently.",
    icon: <Columns className="h-8 w-8" />,
    position: "center",
  },
  {
    id: "add-column",
    title: "Adding Columns",
    description:
      'Click the "+" button at the end of your columns to add new ones. Choose from different column types like Feed, Notifications, Messages, Bookmarks, or Search. You can have multiple columns of the same type.',
    icon: <Plus className="h-8 w-8" />,
    position: "center",
  },
  {
    id: "feeds",
    title: "Custom Feeds",
    description:
      "Each feed column can show different content. Click the feed selector at the top of a column to switch between Following, your saved feeds, or Discover new feeds to follow.",
    icon: <Rss className="h-8 w-8" />,
    position: "center",
  },
  {
    id: "shortcuts",
    title: "Keyboard Shortcuts",
    description:
      "Speed up your workflow with keyboard shortcuts:\n\n• J/K - Navigate between posts\n• C - Compose a new post\n• ? - Show all keyboard shortcuts\n• ⌘+K - Open command palette\n\nPress Shift+? anytime to see the full list.",
    icon: <Keyboard className="h-8 w-8" />,
    position: "center",
  },
];

interface OnboardingOverlayProps {
  onboarding: UseOnboardingReturn;
}

export const OnboardingOverlay: React.FC<OnboardingOverlayProps> = ({
  onboarding,
}) => {
  const {
    isOnboardingActive,
    currentStep,
    totalSteps,
    nextStep,
    previousStep,
    skipOnboarding,
    completeOnboarding,
  } = onboarding;

  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const containerRef = useFocusTrap<HTMLDivElement>(isOnboardingActive);

  const handleNext = useCallback(() => {
    if (isAnimating) return;

    if (currentStep === totalSteps - 1) {
      completeOnboarding();
    } else {
      setIsAnimating(true);
      setTimeout(() => {
        nextStep();
        setIsAnimating(false);
      }, 150);
    }
  }, [currentStep, totalSteps, completeOnboarding, nextStep, isAnimating]);

  const handlePrevious = useCallback(() => {
    if (isAnimating || currentStep === 0) return;

    setIsAnimating(true);
    setTimeout(() => {
      previousStep();
      setIsAnimating(false);
    }, 150);
  }, [currentStep, previousStep, isAnimating]);

  // Handle visibility with animation
  useEffect(() => {
    if (isOnboardingActive) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [isOnboardingActive]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOnboardingActive) {
        e.preventDefault();
        skipOnboarding();
      }
      if (e.key === "ArrowRight" && isOnboardingActive) {
        e.preventDefault();
        handleNext();
      }
      if (e.key === "ArrowLeft" && isOnboardingActive) {
        e.preventDefault();
        handlePrevious();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOnboardingActive, skipOnboarding, handleNext, handlePrevious]);

  if (!isOnboardingActive) return null;

  const step = onboardingSteps[currentStep];
  const isLastStep = currentStep === totalSteps - 1;
  const isFirstStep = currentStep === 0;

  const overlay = (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      style={{ backgroundColor: "rgba(0, 0, 0, 0.75)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      aria-describedby="onboarding-description"
    >
      <div
        ref={containerRef}
        className={`relative mx-4 w-full max-w-md transform transition-all duration-300 ${
          isVisible && !isAnimating
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-4 scale-95 opacity-0"
        }`}
        style={{
          backgroundColor: "var(--bsky-bg-primary)",
          border: "1px solid var(--bsky-border-primary)",
          borderRadius: "12px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        }}
      >
        {/* Close button */}
        <button
          onClick={skipOnboarding}
          className="absolute right-3 top-3 rounded-full p-2 transition-colors hover:bg-white hover:bg-opacity-10"
          aria-label="Skip tutorial"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          <X className="h-5 w-5" />
        </button>

        {/* Content */}
        <div className="p-6 pt-8">
          {/* Icon */}
          <div
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{
              backgroundColor: "var(--bsky-primary)",
              color: "white",
            }}
          >
            {step.icon}
          </div>

          {/* Title */}
          <h2
            id="onboarding-title"
            className="mb-2 text-xl font-bold"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            {step.title}
          </h2>

          {/* Description */}
          <p
            id="onboarding-description"
            className="whitespace-pre-line text-sm leading-relaxed"
            style={{ color: "var(--bsky-text-secondary)" }}
          >
            {step.description}
          </p>
        </div>

        {/* Progress and Navigation */}
        <div
          className="flex items-center justify-between border-t p-4"
          style={{ borderColor: "var(--bsky-border-primary)" }}
        >
          {/* Progress indicator */}
          <div className="flex items-center gap-2">
            {Array.from({ length: totalSteps }).map((_, index) => (
              <div
                key={index}
                className={`h-2 w-2 rounded-full transition-all duration-200 ${
                  index === currentStep ? "w-4" : ""
                }`}
                style={{
                  backgroundColor:
                    index === currentStep
                      ? "var(--bsky-primary)"
                      : index < currentStep
                        ? "var(--bsky-primary)"
                        : "var(--bsky-border-secondary)",
                  opacity: index <= currentStep ? 1 : 0.5,
                }}
              />
            ))}
            <span
              className="ml-2 text-xs"
              style={{ color: "var(--bsky-text-tertiary)" }}
            >
              {currentStep + 1} of {totalSteps}
            </span>
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <button
                onClick={handlePrevious}
                className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-white hover:bg-opacity-10"
                style={{ color: "var(--bsky-text-secondary)" }}
                disabled={isAnimating}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              style={{
                backgroundColor: "var(--bsky-primary)",
                color: "white",
              }}
              disabled={isAnimating}
            >
              {isLastStep ? "Get Started" : "Next"}
              {!isLastStep && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Skip link */}
        <div className="pb-4 text-center">
          <button
            onClick={skipOnboarding}
            className="text-xs transition-colors hover:underline"
            style={{ color: "var(--bsky-text-tertiary)" }}
          >
            Skip tutorial
          </button>
        </div>
      </div>
    </div>
  );

  // Use portal to render at document root level
  return createPortal(overlay, document.body);
};
