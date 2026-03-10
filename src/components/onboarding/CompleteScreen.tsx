import { ArrowRight, PartyPopper } from "lucide-react";
import React from "react";

interface CompleteScreenProps {
  followedCount: number;
  feedCount: number;
  onGoHome: () => void;
}

export const CompleteScreen: React.FC<CompleteScreenProps> = ({
  followedCount,
  feedCount,
  onGoHome,
}) => {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 py-8"
      style={{ background: "var(--asph-bg-primary)" }}
    >
      <div className="w-full max-w-2xl text-center">
        {/* Celebration Icon */}
        <div className="mb-6 flex justify-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--asph-primary-transparent)" }}
          >
            <PartyPopper size={40} style={{ color: "var(--asph-primary)" }} />
          </div>
        </div>

        {/* Title */}
        <h1 className="asph-gradient-text mb-3 text-4xl font-bold">
          You're all set!
        </h1>
        <p
          className="mb-8 text-lg"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          Your Asphodel experience is ready to go
        </p>

        {/* Summary */}
        {(followedCount > 0 || feedCount > 0) && (
          <div
            className="asph-card mx-auto mb-8 max-w-md p-6"
            style={{ background: "var(--asph-bg-secondary)" }}
          >
            <h2
              className="mb-4 text-lg font-semibold"
              style={{ color: "var(--asph-text-primary)" }}
            >
              Here's what we set up
            </h2>
            <ul
              className="space-y-2 text-sm"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              {followedCount > 0 && (
                <li className="flex items-center gap-2">
                  <span style={{ color: "var(--asph-success)" }}>&#10003;</span>
                  <span>
                    Following {followedCount}{" "}
                    {followedCount === 1 ? "account" : "accounts"}
                  </span>
                </li>
              )}
              {feedCount > 0 && (
                <li className="flex items-center gap-2">
                  <span style={{ color: "var(--asph-success)" }}>&#10003;</span>
                  <span>
                    {feedCount} custom {feedCount === 1 ? "feed" : "feeds"}{" "}
                    added
                  </span>
                </li>
              )}
            </ul>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={onGoHome}
          className="touch-target-sm asph-button-primary inline-flex items-center justify-center gap-2 px-10 py-4 text-lg font-semibold text-white"
        >
          Go to your feed
          <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
};
