import { ArrowRight, Sparkles } from "lucide-react";
import React from "react";
import butterflyIcon from "/butterfly-icon.svg";

interface WelcomeScreenProps {
  onContinue: () => void;
  onSkip: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onContinue,
  onSkip,
}) => {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 py-8"
      style={{ background: "var(--asph-bg-primary)" }}
    >
      <div className="w-full max-w-2xl text-center">
        {/* Logo and Welcome */}
        <div className="mb-8 flex flex-col items-center justify-center gap-4">
          <img
            src={butterflyIcon}
            alt="Asphodel Logo"
            className="h-24 w-24 rounded-xl shadow-lg"
          />
          <div>
            <h1 className="asph-gradient-text mb-2 text-4xl font-bold">
              Welcome to Asphodel
            </h1>
            <p
              className="text-lg"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              Your advanced Bluesky analytics & notifications companion
            </p>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="mb-8 space-y-4">
          <div
            className="asph-card mx-auto max-w-lg p-6 text-left"
            style={{ background: "var(--asph-bg-secondary)" }}
          >
            <div className="mb-4 flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: "var(--asph-primary-transparent)" }}
              >
                <Sparkles size={20} style={{ color: "var(--asph-primary)" }} />
              </div>
              <h2
                className="text-xl font-semibold"
                style={{ color: "var(--asph-text-primary)" }}
              >
                Let's personalize your experience
              </h2>
            </div>
            <p className="mb-4" style={{ color: "var(--asph-text-secondary)" }}>
              We'll help you set up Asphodel in just a few steps:
            </p>
            <ul
              className="space-y-2 text-sm"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              <li className="flex items-start gap-2">
                <span style={{ color: "var(--asph-primary)" }}>1.</span>
                <span>Choose topics and interests you care about</span>
              </li>
              <li className="flex items-start gap-2">
                <span style={{ color: "var(--asph-primary)" }}>2.</span>
                <span>Discover interesting feeds and accounts to follow</span>
              </li>
              <li className="flex items-start gap-2">
                <span style={{ color: "var(--asph-primary)" }}>3.</span>
                <span>Customize your content preferences</span>
              </li>
            </ul>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={onContinue}
            className="asph-button-primary flex items-center justify-center gap-2 px-8 py-4 text-lg font-semibold text-white"
          >
            Get Started
            <ArrowRight size={20} />
          </button>
          <button
            onClick={onSkip}
            className="rounded-xl px-8 py-4 text-lg font-medium transition-all hover:opacity-80"
            style={{
              color: "var(--asph-text-secondary)",
              border: "1px solid var(--asph-border-primary)",
            }}
          >
            Skip for now
          </button>
        </div>

        {/* Footer note */}
        <p
          className="mt-6 text-sm"
          style={{ color: "var(--asph-text-tertiary)" }}
        >
          You can always change these settings later in preferences
        </p>
      </div>
    </div>
  );
};
