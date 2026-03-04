import { Bug, ExternalLink, MessageCircle } from "lucide-react";
import React, { useState } from "react";
import { BugReportModal } from "../feedback/BugReportModal";

export const SupportSettings: React.FC = () => {
  const [isBugReportOpen, setIsBugReportOpen] = useState(false);
  const [lastReportId, setLastReportId] = useState<string | null>(null);

  const handleBugReportSubmitted = (referenceId: string) => {
    setLastReportId(referenceId);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2
          className="text-xl font-semibold"
          style={{ color: "var(--asph-text-primary)" }}
        >
          Help & Support
        </h2>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          Get help, report issues, or send feedback
        </p>
      </div>

      {/* Report Bug Section */}
      <div
        className="rounded-lg p-6"
        style={{
          backgroundColor: "var(--asph-bg-secondary)",
          border: "1px solid var(--asph-border-primary)",
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="rounded-full p-3"
            style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
          >
            <Bug
              className="h-6 w-6"
              style={{ color: "var(--asph-text-secondary)" }}
            />
          </div>
          <div className="flex-1">
            <h3
              className="text-lg font-medium"
              style={{ color: "var(--asph-text-primary)" }}
            >
              Report a Bug
            </h3>
            <p
              className="mt-1 text-sm"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              Found something that isn&apos;t working correctly? Let us know and
              we&apos;ll look into it. Bug reports automatically include
              diagnostic information to help us investigate.
            </p>
            <div className="mt-4 flex items-center gap-4">
              <button
                onClick={() => setIsBugReportOpen(true)}
                className="touch-target-sm flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
                style={{ backgroundColor: "var(--asph-primary)" }}
              >
                <Bug className="h-4 w-4" />
                Report Bug
              </button>
              {lastReportId && (
                <span
                  className="text-sm"
                  style={{ color: "var(--asph-text-tertiary)" }}
                >
                  Last report: {lastReportId}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Section */}
      <div
        className="rounded-lg p-6"
        style={{
          backgroundColor: "var(--asph-bg-secondary)",
          border: "1px solid var(--asph-border-primary)",
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="rounded-full p-3"
            style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
          >
            <MessageCircle
              className="h-6 w-6"
              style={{ color: "var(--asph-text-secondary)" }}
            />
          </div>
          <div className="flex-1">
            <h3
              className="text-lg font-medium"
              style={{ color: "var(--asph-text-primary)" }}
            >
              Send Feedback
            </h3>
            <p
              className="mt-1 text-sm"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              Have ideas for improving Asphodel? We&apos;d love to hear from
              you. Your feedback helps shape the future of the app.
            </p>
            <div className="mt-4">
              <a
                href="https://bsky.app/profile/shadowsky.io"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:opacity-80"
                style={{
                  backgroundColor: "var(--asph-bg-tertiary)",
                  color: "var(--asph-text-primary)",
                  border: "1px solid var(--asph-border-primary)",
                }}
              >
                <ExternalLink className="h-4 w-4" />
                Message us on Bluesky
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Resources Section */}
      <div
        className="rounded-lg p-6"
        style={{
          backgroundColor: "var(--asph-bg-secondary)",
          border: "1px solid var(--asph-border-primary)",
        }}
      >
        <h3
          className="mb-4 text-lg font-medium"
          style={{ color: "var(--asph-text-primary)" }}
        >
          Resources
        </h3>
        <div className="space-y-3">
          <a
            href="https://github.com/shadowsky-io/shadowsky"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:opacity-80"
            style={{
              backgroundColor: "var(--asph-bg-tertiary)",
              border: "1px solid var(--asph-border-secondary)",
            }}
          >
            <ExternalLink
              className="h-5 w-5"
              style={{ color: "var(--asph-text-tertiary)" }}
            />
            <div>
              <div
                className="text-sm font-medium"
                style={{ color: "var(--asph-text-primary)" }}
              >
                GitHub Repository
              </div>
              <div
                className="text-xs"
                style={{ color: "var(--asph-text-tertiary)" }}
              >
                View source code and contribute
              </div>
            </div>
          </a>
          <a
            href="https://shadowsky.io/changelog"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:opacity-80"
            style={{
              backgroundColor: "var(--asph-bg-tertiary)",
              border: "1px solid var(--asph-border-secondary)",
            }}
          >
            <ExternalLink
              className="h-5 w-5"
              style={{ color: "var(--asph-text-tertiary)" }}
            />
            <div>
              <div
                className="text-sm font-medium"
                style={{ color: "var(--asph-text-primary)" }}
              >
                Changelog
              </div>
              <div
                className="text-xs"
                style={{ color: "var(--asph-text-tertiary)" }}
              >
                See what&apos;s new in Asphodel
              </div>
            </div>
          </a>
        </div>
      </div>

      {/* Bug Report Modal */}
      <BugReportModal
        isOpen={isBugReportOpen}
        onClose={() => setIsBugReportOpen(false)}
        onReportSubmitted={handleBugReportSubmitted}
      />
    </div>
  );
};
