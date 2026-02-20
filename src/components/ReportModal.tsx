import { AlertTriangle, CheckCircle, Flag, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useModeration } from "../contexts/ModerationContext";
import {
  type ReportReasonType,
  moderationHistoryDB,
} from "../services/moderation-history-db";
import { rateLimitedReport, reportRateLimiter } from "../services/rate-limiter";

export type ReportType = "post" | "account";

export interface ReportCategory {
  id: string;
  label: string;
  description: string;
  reasonType: string;
}

const REPORT_CATEGORIES: ReportCategory[] = [
  {
    id: "spam",
    label: "Spam",
    description: "Unwanted commercial content or repetitive posts",
    reasonType: "com.atproto.moderation.defs#reasonSpam",
  },
  {
    id: "harassment",
    label: "Harassment & Abuse",
    description: "Targeted abuse, bullying, or threats",
    reasonType: "com.atproto.moderation.defs#reasonViolation",
  },
  {
    id: "hate",
    label: "Hate Speech",
    description: "Content promoting hatred based on identity",
    reasonType: "com.atproto.moderation.defs#reasonViolation",
  },
  {
    id: "violence",
    label: "Violence or Harm",
    description: "Graphic violence, self-harm, or dangerous content",
    reasonType: "com.atproto.moderation.defs#reasonViolation",
  },
  {
    id: "sexual",
    label: "Sexual Content",
    description: "Unwanted sexual content or exploitation",
    reasonType: "com.atproto.moderation.defs#reasonViolation",
  },
  {
    id: "impersonation",
    label: "Impersonation",
    description: "Pretending to be someone else",
    reasonType: "com.atproto.moderation.defs#reasonMisleading",
  },
  {
    id: "misleading",
    label: "Misleading Information",
    description: "False information or deceptive content",
    reasonType: "com.atproto.moderation.defs#reasonMisleading",
  },
  {
    id: "other",
    label: "Other",
    description: "Other violations of community guidelines",
    reasonType: "com.atproto.moderation.defs#reasonOther",
  },
];

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: ReportType;
  subjectUri: string;
  subjectCid?: string;
  subjectDid?: string;
  subjectHandle?: string;
  subjectDisplayName?: string;
  subjectText?: string; // For posts, a snippet of content
  onReportSubmitted?: () => void;
}

export function ReportModal({
  isOpen,
  onClose,
  reportType,
  subjectUri,
  subjectCid,
  subjectDid,
  subjectHandle,
  subjectDisplayName,
  subjectText,
  onReportSubmitted,
}: ReportModalProps) {
  const { agent } = useAuth();
  const { blockUser } = useModeration();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [additionalContext, setAdditionalContext] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBlockOption, setShowBlockOption] = useState(false);

  const handleSubmit = async () => {
    if (!selectedCategory || !agent) return;

    // Check rate limit before attempting submission
    const stats = reportRateLimiter.getStats();
    if (stats.availableTokens < 1) {
      const minutesUntilRefill = Math.ceil(
        (1 - stats.availableTokens) / (10 / 3600 / 60),
      );
      setError(
        `Rate limit exceeded. You can submit up to 10 reports per hour. Please try again in ${minutesUntilRefill} minute${minutesUntilRefill !== 1 ? "s" : ""}.`,
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await rateLimitedReport(async () => {
        const category = REPORT_CATEGORIES.find(
          (c) => c.id === selectedCategory,
        );
        if (!category) throw new Error("Invalid category selected");

        const reasonText = additionalContext.trim()
          ? `${category.label}: ${additionalContext.trim()}`
          : category.label;

        if (reportType === "post") {
          if (!subjectCid) {
            throw new Error("Post CID is required for reporting posts");
          }

          await agent.createModerationReport({
            reasonType: category.reasonType,
            subject: {
              $type: "com.atproto.repo.strongRef",
              uri: subjectUri,
              cid: subjectCid,
            },
            reason: reasonText,
          });
        } else {
          if (!subjectDid) {
            throw new Error("User DID is required for reporting accounts");
          }

          await agent.createModerationReport({
            reasonType: category.reasonType,
            subject: {
              $type: "com.atproto.admin.defs#repoRef",
              did: subjectDid,
            },
            reason: reasonText,
          });
        }
      });

      // Record report to history
      try {
        await moderationHistoryDB.init();
        const category = REPORT_CATEGORIES.find(
          (c) => c.id === selectedCategory,
        );
        await moderationHistoryDB.recordReport({
          subjectUri,
          subjectType: reportType === "post" ? "post" : "account",
          subjectDid,
          subjectHandle,
          subjectDisplayName,
          subjectText: subjectText?.substring(0, 200), // Truncate for storage
          reason: (category?.id || "other") as ReportReasonType,
          reasonText: additionalContext.trim() || undefined,
          createdAt: Date.now(),
        });
      } catch (historyErr) {
        // Don't fail the report if history recording fails
        console.warn("Failed to record report to history:", historyErr);
      }

      setIsSubmitted(true);
      setShowBlockOption(reportType === "account");

      if (onReportSubmitted) {
        onReportSubmitted();
      }
    } catch (err) {
      console.error("Failed to submit report:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to submit report. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBlock = async () => {
    if (!agent || !subjectDid) return;

    try {
      if (!agent.session?.did) {
        throw new Error("No session available");
      }

      const response = await agent.app.bsky.graph.block.create(
        { repo: agent.session.did },
        {
          subject: subjectDid,
          createdAt: new Date().toISOString(),
        },
      );

      // Record block to history
      try {
        await moderationHistoryDB.init();
        await moderationHistoryDB.recordBlock({
          id: response.uri,
          subjectDid,
          subjectHandle,
          subjectDisplayName,
          createdAt: Date.now(),
        });
      } catch (historyErr) {
        // Don't fail the block if history recording fails
        console.warn("Failed to record block to history:", historyErr);
      }

      blockUser(subjectDid);
      handleClose();
    } catch (err) {
      console.error("Failed to block user:", err);
      setError("Failed to block user. Please try again.");
    }
  };

  const handleClose = () => {
    setSelectedCategory(null);
    setAdditionalContext("");
    setIsSubmitting(false);
    setIsSubmitted(false);
    setError(null);
    setShowBlockOption(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div
        className="modal-container modal-auto-height modal-lg bg-white dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        {isSubmitted ? (
          <>
            {/* Success State */}
            <div className="flex items-start gap-3 p-6">
              <CheckCircle className="mt-1 h-6 w-6 flex-shrink-0 text-green-600 dark:text-green-400" />
              <div className="flex-1">
                <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Report Submitted
                </h3>
                <p className="text-asph-text-secondary">
                  Thank you for helping keep our community safe. We'll review
                  this report and take appropriate action.
                </p>
              </div>
              <button
                onClick={handleClose}
                className="touch-target-icon rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Block Option */}
            {showBlockOption && subjectHandle && (
              <div className="border-t border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800">
                <h4 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Block @{subjectHandle}?
                </h4>
                <p className="mb-4 text-sm text-asph-text-secondary">
                  Blocking will prevent this user from seeing your posts and
                  interacting with you.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={handleClose}
                    className="rounded-md px-4 py-2 text-sm font-medium text-asph-text-secondary hover:bg-gray-200 dark:hover:bg-gray-700"
                  >
                    Skip
                  </button>
                  <button
                    onClick={handleBlock}
                    className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                  >
                    Block User
                  </button>
                </div>
              </div>
            )}

            {/* Close Button */}
            {!showBlockOption && (
              <div className="flex justify-end gap-3 border-t bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
                <button
                  onClick={handleClose}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  Close
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start gap-3 p-6">
              <Flag className="mt-1 h-6 w-6 flex-shrink-0 text-red-600 dark:text-red-400" />
              <div className="flex-1">
                <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Report {reportType === "post" ? "Post" : "Account"}
                </h3>
                <p className="text-sm text-asph-text-secondary">
                  {reportType === "post"
                    ? "Help us understand what's wrong with this post"
                    : `Report @${subjectHandle || "this account"} for violating community guidelines`}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="touch-target-icon rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Category Selection */}
            <div className="asph-scrollbar max-h-96 overflow-y-auto border-t border-gray-200 dark:border-gray-700">
              {REPORT_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`flex w-full items-start gap-3 border-b border-gray-200 p-4 text-left transition-colors dark:border-gray-700 ${
                    selectedCategory === category.id
                      ? "bg-blue-50 dark:bg-blue-900/20"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <div
                    className={`mt-1 h-5 w-5 flex-shrink-0 rounded-full border-2 ${
                      selectedCategory === category.id
                        ? "border-blue-600 bg-blue-600 dark:border-blue-500 dark:bg-blue-500"
                        : "border-gray-300 dark:border-gray-600"
                    } flex items-center justify-center`}
                  >
                    {selectedCategory === category.id && (
                      <div className="h-2 w-2 rounded-full bg-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {category.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-asph-text-secondary">
                      {category.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {/* Additional Context */}
            {selectedCategory && (
              <div className="border-t border-gray-200 p-6 dark:border-gray-700">
                <label
                  htmlFor="additional-context"
                  className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100"
                >
                  Additional context (optional)
                </label>
                <textarea
                  id="additional-context"
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  placeholder="Provide any additional details that might help with this report..."
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                  rows={4}
                  maxLength={300}
                />
                <p className="mt-1 text-xs text-asph-text-tertiary">
                  {additionalContext.length}/300 characters
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="border-t border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-900/20">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 border-t bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="rounded-md px-4 py-2 text-sm font-medium text-asph-text-secondary hover:bg-gray-200 disabled:opacity-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selectedCategory || isSubmitting}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-500 dark:hover:bg-red-600"
              >
                {isSubmitting ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
