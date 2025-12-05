/**
 * ComposerAIFeatures - Level 3 (Advanced) Component
 * Expandable section - tone adjustment, thread optimization, writing feedback
 */

import {
  CheckCircle,
  FileText,
  Loader,
  MessageSquare,
  Sparkles,
  Undo,
  Wand2,
  X,
} from "lucide-react";
import React from "react";
import type {
  StyleMatchedWritingFeedback,
  ThreadOptimizationResult,
  ToneOption,
} from "../../services/anthropic";
import {
  NUMBERING_FORMATS,
  type NumberingFormatType,
  TONE_OPTIONS,
} from "./types";

interface ComposerAIFeaturesProps {
  text: string;
  onTextChange: (text: string) => void;

  // Tone adjustment
  showToneOptions: boolean;
  onToggleToneOptions: () => void;
  selectedTone: ToneOption | null;
  isAdjustingTone: boolean;
  tonePreview: string | null;
  showTonePreview: boolean;
  onToneAdjustment: (tone: ToneOption) => void;
  onApplyTone: () => void;
  onCancelTone: () => void;

  // Thread optimization
  threadOptimizationResult: ThreadOptimizationResult | null;
  showThreadPreview: boolean;
  onApplyThreadOptimization: () => void;
  onCancelThreadOptimization: () => void;
  onNumberingFormatChange: (format: NumberingFormatType) => void;

  // Writing feedback
  showWritingFeedback: boolean;
  writingFeedback: StyleMatchedWritingFeedback | null;
  isLoadingFeedback: boolean;
  onRequestFeedback: () => void;
  onCloseFeedback: () => void;
  onApplyCorrected: () => void;
  onApplyEnhanced: () => void;
}

export const ComposerAIFeatures: React.FC<ComposerAIFeaturesProps> = ({
  text,
  onTextChange: _onTextChange,
  showToneOptions,
  onToggleToneOptions,
  selectedTone,
  isAdjustingTone,
  tonePreview,
  showTonePreview,
  onToneAdjustment,
  onApplyTone,
  onCancelTone,
  threadOptimizationResult,
  showThreadPreview,
  onApplyThreadOptimization,
  onCancelThreadOptimization,
  onNumberingFormatChange: _onNumberingFormatChange,
  showWritingFeedback,
  writingFeedback,
  isLoadingFeedback: _isLoadingFeedback,
  onRequestFeedback: _onRequestFeedback,
  onCloseFeedback,
  onApplyCorrected,
  onApplyEnhanced,
}) => {
  // Props declared in interface for consistency with parent - may be used in future enhancements
  void _onTextChange;
  void _onNumberingFormatChange;
  void _isLoadingFeedback;
  void _onRequestFeedback;
  return (
    <>
      {/* Tone Options Modal */}
      {showToneOptions && (
        <ToneOptionsModal
          isAdjustingTone={isAdjustingTone}
          selectedTone={selectedTone}
          onSelectTone={onToneAdjustment}
          onClose={onToggleToneOptions}
        />
      )}

      {/* Tone Preview Modal */}
      {showTonePreview && tonePreview && (
        <TonePreviewModal
          originalText={text}
          adjustedText={tonePreview}
          selectedTone={selectedTone}
          onApply={onApplyTone}
          onCancel={onCancelTone}
        />
      )}

      {/* Thread Optimization Preview Modal */}
      {showThreadPreview && threadOptimizationResult && (
        <ThreadOptimizationModal
          result={threadOptimizationResult}
          onApply={onApplyThreadOptimization}
          onCancel={onCancelThreadOptimization}
        />
      )}

      {/* Writing Feedback Modal */}
      {showWritingFeedback && writingFeedback && (
        <WritingFeedbackModal
          originalText={text}
          feedback={writingFeedback}
          onApplyCorrected={onApplyCorrected}
          onApplyEnhanced={onApplyEnhanced}
          onClose={onCloseFeedback}
        />
      )}
    </>
  );
};

// Tone Options Modal
interface ToneOptionsModalProps {
  isAdjustingTone: boolean;
  selectedTone: ToneOption | null;
  onSelectTone: (tone: ToneOption) => void;
  onClose: () => void;
}

const ToneOptionsModal: React.FC<ToneOptionsModalProps> = ({
  isAdjustingTone,
  selectedTone,
  onSelectTone,
  onClose,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      onClick={onClose}
    >
      <div
        className="bsky-card w-full max-w-md p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "80vh", overflowY: "auto" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3
            className="flex items-center gap-2 text-lg font-semibold"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            <Wand2 size={20} />
            Choose a Tone
          </h3>
          <button
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-2">
          {TONE_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`w-full rounded-lg border p-3 text-left transition-all hover:shadow-md ${
                isAdjustingTone
                  ? "cursor-not-allowed opacity-50"
                  : "hover:border-blue-400"
              }`}
              style={{
                borderColor: "var(--bsky-border-primary)",
                background: "var(--bsky-bg-secondary)",
              }}
              onClick={() => onSelectTone(option.value)}
              disabled={isAdjustingTone}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{option.icon}</span>
                <div className="flex-1">
                  <div
                    className="font-medium"
                    style={{ color: "var(--bsky-text-primary)" }}
                  >
                    {option.label}
                  </div>
                  <div
                    className="text-sm"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  >
                    {option.description}
                  </div>
                </div>
                {isAdjustingTone && selectedTone === option.value && (
                  <Loader
                    size={16}
                    className="animate-spin"
                    style={{ color: "var(--bsky-primary)" }}
                  />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// Tone Preview Modal
interface TonePreviewModalProps {
  originalText: string;
  adjustedText: string;
  selectedTone: ToneOption | null;
  onApply: () => void;
  onCancel: () => void;
}

const TonePreviewModal: React.FC<TonePreviewModalProps> = ({
  originalText,
  adjustedText,
  selectedTone,
  onApply,
  onCancel,
}) => {
  const toneConfig = TONE_OPTIONS.find((t) => t.value === selectedTone);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.5)" }}
    >
      <div
        className="bsky-card w-full max-w-2xl p-6 shadow-xl"
        style={{ maxHeight: "80vh", overflowY: "auto" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3
            className="flex items-center gap-2 text-lg font-semibold"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            <Wand2 size={20} />
            Tone Adjusted - {toneConfig?.label}
            <span className="ml-2 text-2xl">{toneConfig?.icon}</span>
          </h3>
          <button
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={onCancel}
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <h4
              className="mb-2 text-sm font-medium"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              Original:
            </h4>
            <div
              className="rounded-lg p-3"
              style={{
                background: "var(--bsky-bg-secondary)",
                color: "var(--bsky-text-primary)",
              }}
            >
              {originalText}
            </div>
          </div>

          <div>
            <h4
              className="mb-2 text-sm font-medium"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              Adjusted:
            </h4>
            <div
              className="rounded-lg border-2 p-3"
              style={{
                background: "var(--bsky-bg-secondary)",
                color: "var(--bsky-text-primary)",
                borderColor: "var(--bsky-primary)",
              }}
            >
              {adjustedText}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            className="bsky-button-secondary px-4 py-2"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="bsky-button-primary flex items-center gap-2 px-4 py-2"
            onClick={onApply}
          >
            <CheckCircle size={16} />
            Use This Version
          </button>
        </div>
      </div>
    </div>
  );
};

// Thread Optimization Modal
interface ThreadOptimizationModalProps {
  result: ThreadOptimizationResult;
  onApply: () => void;
  onCancel: () => void;
}

const ThreadOptimizationModal: React.FC<ThreadOptimizationModalProps> = ({
  result,
  onApply,
  onCancel,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.5)" }}
    >
      <div
        className="bsky-card w-full max-w-3xl p-6 shadow-xl"
        style={{ maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3
            className="flex items-center gap-2 text-lg font-semibold"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            <Sparkles size={20} />
            Thread Optimization - {result.totalPosts} Posts
          </h3>
          <button
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={onCancel}
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-4">
          <p
            className="text-sm"
            style={{ color: "var(--bsky-text-secondary)" }}
          >
            {result.summary}
          </p>
          <p
            className="mt-2 text-xs"
            style={{ color: "var(--bsky-text-tertiary)" }}
          >
            Suggested format:{" "}
            {result.suggestedFormat === "simple"
              ? "1/n"
              : result.suggestedFormat === "brackets"
                ? "[1/n]"
                : result.suggestedFormat === "thread"
                  ? "🧵 1/n"
                  : result.suggestedFormat === "dots"
                    ? "1•n"
                    : "None"}
          </p>
        </div>

        <div className="space-y-3">
          {result.segments.map((segment, index) => {
            const format = NUMBERING_FORMATS.find(
              (f) => f.id === result.suggestedFormat,
            );
            const numbering =
              format && format.id !== "none"
                ? format.format(index + 1, result.totalPosts) + " "
                : "";

            return (
              <div
                key={index}
                className="rounded-lg border p-4"
                style={{
                  background: "var(--bsky-bg-secondary)",
                  borderColor: segment.isStandalone
                    ? "var(--bsky-primary)"
                    : "var(--bsky-border-primary)",
                }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className="text-xs font-medium"
                    style={{ color: "var(--bsky-text-tertiary)" }}
                  >
                    Post {index + 1} • {numbering}
                    {segment.text.length} characters
                  </span>
                  {segment.isStandalone && (
                    <span
                      className="rounded-full px-2 py-0.5 text-xs"
                      style={{
                        background: "var(--bsky-primary)",
                        color: "white",
                      }}
                    >
                      Can stand alone
                    </span>
                  )}
                </div>
                <p
                  className="whitespace-pre-wrap"
                  style={{ color: "var(--bsky-text-primary)" }}
                >
                  {numbering}
                  {segment.text}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            className="bsky-button-secondary px-4 py-2"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="bsky-button-primary flex items-center gap-2 px-4 py-2"
            onClick={onApply}
          >
            <CheckCircle size={16} />
            Apply Optimization
          </button>
        </div>
      </div>
    </div>
  );
};

// Writing Feedback Modal
interface WritingFeedbackModalProps {
  originalText: string;
  feedback: StyleMatchedWritingFeedback;
  onApplyCorrected: () => void;
  onApplyEnhanced: () => void;
  onClose: () => void;
}

const WritingFeedbackModal: React.FC<WritingFeedbackModalProps> = ({
  originalText,
  feedback,
  onApplyCorrected,
  onApplyEnhanced,
  onClose,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.5)" }}
    >
      <div
        className="bsky-card w-full max-w-2xl p-6 shadow-xl"
        style={{ maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3
            className="flex items-center gap-2 text-lg font-semibold"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            <MessageSquare size={20} />
            Writing Feedback
          </h3>
          <button
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Assessment */}
          <div
            className={`rounded-lg border p-4 ${
              !feedback.assessment.hasIssues
                ? "border-green-500 bg-green-50 dark:bg-green-900 dark:bg-opacity-20"
                : "border-yellow-500 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20"
            }`}
          >
            <h4 className="mb-2 flex items-center gap-2 font-semibold">
              {!feedback.assessment.hasIssues ? (
                <CheckCircle size={16} className="text-green-600" />
              ) : (
                <MessageSquare size={16} className="text-yellow-600" />
              )}
              Quality Assessment
            </h4>
            <p className="text-sm">{feedback.assessment.summary}</p>
          </div>

          {/* Original Version */}
          <div
            className="rounded-lg border p-4"
            style={{
              backgroundColor: "var(--bsky-bg-secondary)",
              borderColor: "var(--bsky-border-primary)",
            }}
          >
            <h4 className="mb-3 flex items-center gap-2 font-semibold">
              <FileText size={16} />
              Original Version
            </h4>
            <p className="rounded bg-gray-50 p-3 text-sm dark:bg-gray-900">
              {originalText}
            </p>
          </div>

          {/* Corrected Version */}
          <div
            className="rounded-lg border p-4"
            style={{
              backgroundColor: "var(--bsky-bg-secondary)",
              borderColor: "var(--bsky-border-primary)",
            }}
          >
            <h4 className="mb-3 flex items-center justify-between font-semibold">
              <span className="flex items-center gap-2">
                <FileText size={16} />
                Corrected Version
              </span>
              <button
                className="bsky-button-secondary flex items-center gap-1 px-3 py-1 text-sm"
                onClick={onApplyCorrected}
              >
                <Undo size={14} />
                Use This
              </button>
            </h4>
            <p className="mb-3 rounded bg-gray-50 p-3 text-sm dark:bg-gray-900">
              {feedback.correctedVersion.text}
            </p>
            {feedback.correctedVersion.changes.length > 0 && (
              <div className="text-xs text-gray-500">
                <p className="font-medium">Corrections made:</p>
                <ul className="list-disc space-y-0.5 pl-5">
                  {feedback.correctedVersion.changes.map((change, i) => (
                    <li key={i}>{change}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Enhanced Version */}
          <div
            className="rounded-lg border p-4"
            style={{
              backgroundColor: "var(--bsky-bg-secondary)",
              borderColor: "var(--bsky-border-primary)",
            }}
          >
            <h4 className="mb-3 flex items-center justify-between font-semibold">
              <span className="flex items-center gap-2">
                <Sparkles size={16} />
                Enhanced Version
              </span>
              <button
                className="bsky-button-primary flex items-center gap-1 px-3 py-1 text-sm"
                onClick={onApplyEnhanced}
              >
                <Undo size={14} />
                Use This
              </button>
            </h4>
            <p className="mb-3 rounded bg-gray-50 p-3 text-sm dark:bg-gray-900">
              {feedback.enhancedVersion.text}
            </p>
            {feedback.enhancedVersion.improvements.length > 0 && (
              <div className="text-xs text-gray-500">
                <p className="font-medium">Improvements:</p>
                <ul className="list-disc space-y-0.5 pl-5">
                  {feedback.enhancedVersion.improvements.map(
                    (improvement, i) => (
                      <li key={i}>{improvement}</li>
                    ),
                  )}
                </ul>
              </div>
            )}
          </div>

          {/* Style Analysis */}
          {feedback.styleAnalysis.userStyleSummary &&
            !feedback.styleAnalysis.userStyleSummary.includes(
              "requires additional implementation",
            ) && (
              <div
                className="rounded-lg border p-4"
                style={{
                  backgroundColor: "var(--bsky-bg-secondary)",
                  borderColor: "var(--bsky-border-primary)",
                }}
              >
                <h4 className="mb-3 flex items-center gap-2 font-semibold">
                  <MessageSquare size={16} />
                  Your Writing Style
                </h4>
                <p className="mb-2 text-sm italic">
                  {feedback.styleAnalysis.userStyleSummary}
                </p>
                <p className="mb-2 text-sm">
                  {feedback.styleAnalysis.matchesStyle
                    ? "✅ This post matches your typical style"
                    : "⚡ This post differs from your usual style"}
                </p>
                {feedback.styleAnalysis.styleNotes.length > 0 && (
                  <ul className="list-disc space-y-0.5 pl-5 text-xs text-gray-500">
                    {feedback.styleAnalysis.styleNotes.map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
        </div>

        <div className="mt-6 flex justify-end">
          <button className="bsky-button-primary px-6 py-2" onClick={onClose}>
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComposerAIFeatures;
