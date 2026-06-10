import {
  CheckCircle2,
  ChevronDown,
  Globe,
  Lock,
  MessageSquare,
  Quote,
  Shield,
  UserCheck,
} from "lucide-react";
import React, { useState } from "react";

export type ReplyPermission = "everyone" | "following" | "mentioned" | "none";

interface ReplyOption {
  id: ReplyPermission;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const replyOptions: ReplyOption[] = [
  {
    id: "everyone",
    label: "Everyone",
    description: "Anyone can reply",
    icon: <Globe size={18} />,
  },
  {
    id: "following",
    label: "People you follow",
    description: "Only accounts you follow can reply",
    icon: <UserCheck size={18} />,
  },
  {
    id: "mentioned",
    label: "People you mention",
    description: "Only accounts mentioned in this post can reply",
    icon: <MessageSquare size={18} />,
  },
  {
    id: "none",
    label: "No one",
    description: "No one can reply to this post",
    icon: <Shield size={18} />,
  },
];

interface ReplyControlsProps {
  value: ReplyPermission;
  onChange: (value: ReplyPermission) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function ReplyControls({
  value,
  onChange,
  disabled,
  compact,
}: ReplyControlsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption =
    replyOptions.find((opt) => opt.id === value) || replyOptions[0];

  if (compact) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className="touch-target-sm flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-asph-bg-hover disabled:opacity-50"
          style={{
            borderColor: "var(--asph-border-primary)",
            backgroundColor: "var(--asph-bg-secondary)",
            color: "var(--asph-text-primary)",
          }}
        >
          {selectedOption.icon}
          <span>{selectedOption.label}</span>
          <ChevronDown
            size={16}
            className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        {isOpen && !disabled && (
          <div
            className="absolute bottom-full left-0 z-[70] mb-2 w-64 rounded-lg border shadow-lg"
            style={{
              backgroundColor: "var(--asph-bg-primary)",
              borderColor: "var(--asph-border-primary)",
            }}
          >
            <div className="p-2">
              {replyOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onChange(option.id);
                    setIsOpen(false);
                  }}
                  className={`touch-target flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-asph-bg-hover ${
                    option.id === value ? "bg-blue-50 dark:bg-blue-900/20" : ""
                  }`}
                >
                  <div
                    className="mt-0.5"
                    style={{
                      color:
                        option.id === value
                          ? "var(--asph-primary)"
                          : "var(--asph-text-secondary)",
                    }}
                  >
                    {option.icon}
                  </div>
                  <div className="flex-1">
                    <div
                      className="font-medium"
                      style={{ color: "var(--asph-text-primary)" }}
                    >
                      {option.label}
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: "var(--asph-text-secondary)" }}
                    >
                      {option.description}
                    </div>
                  </div>
                  {option.id === value && (
                    <CheckCircle2
                      size={18}
                      style={{ color: "var(--asph-primary)" }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label
        className="text-sm font-medium"
        style={{ color: "var(--asph-text-primary)" }}
      >
        Who can reply?
      </label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {replyOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            disabled={disabled}
            className={`touch-target flex flex-col items-center gap-2 rounded-lg border p-3 transition-all ${
              option.id === value
                ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                : "hover:bg-asph-bg-hover"
            } disabled:opacity-50`}
            style={{
              borderColor:
                option.id === value
                  ? "var(--asph-primary)"
                  : "var(--asph-border-primary)",
              backgroundColor:
                option.id === value ? undefined : "var(--asph-bg-secondary)",
            }}
          >
            <div
              style={{
                color:
                  option.id === value
                    ? "var(--asph-primary)"
                    : "var(--asph-text-secondary)",
              }}
            >
              {option.icon}
            </div>
            <span
              className="text-xs font-medium"
              style={{ color: "var(--asph-text-primary)" }}
            >
              {option.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Helper component to display reply restrictions on posts
interface ReplyRestrictionsDisplayProps {
  permission: ReplyPermission;
  className?: string;
}

export function ReplyRestrictionsDisplay({
  permission,
  className = "",
}: ReplyRestrictionsDisplayProps) {
  if (permission === "everyone") return null;

  const option = replyOptions.find((opt) => opt.id === permission);
  if (!option) return null;

  return (
    <div
      className={`flex items-center gap-1.5 text-xs ${className}`}
      style={{ color: "var(--asph-text-secondary)" }}
    >
      {option.icon}
      <span>{option.label} can reply</span>
    </div>
  );
}

// Toggle for disabling quoting/embedding on a post
interface QuoteControlProps {
  disabled?: boolean;
  quotingDisabled: boolean;
  onChange: (disabled: boolean) => void;
}

export function QuoteControl({
  disabled,
  quotingDisabled,
  onChange,
}: QuoteControlProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!quotingDisabled)}
      disabled={disabled}
      className={`touch-target flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-asph-bg-hover disabled:opacity-50 ${
        quotingDisabled ? "bg-amber-50 dark:bg-amber-900/20" : ""
      }`}
      style={{
        borderColor: quotingDisabled
          ? "var(--asph-warning)"
          : "var(--asph-border-primary)",
        backgroundColor: quotingDisabled
          ? undefined
          : "var(--asph-bg-secondary)",
        color: "var(--asph-text-primary)",
      }}
      title={
        quotingDisabled
          ? "Quoting is disabled for this post"
          : "Allow others to quote this post"
      }
    >
      <Quote
        size={18}
        style={{
          color: quotingDisabled
            ? "var(--asph-warning)"
            : "var(--asph-text-secondary)",
        }}
      />
      <span>{quotingDisabled ? "Quoting off" : "Quoting on"}</span>
    </button>
  );
}

// Visual indicator for gated posts shown in feed/thread views
interface GateIndicatorProps {
  replyDisabled?: boolean;
  embeddingDisabled?: boolean;
  threadgate?: { uri?: string; record?: Record<string, unknown> };
  className?: string;
}

export function GateIndicator({
  replyDisabled,
  embeddingDisabled,
  threadgate,
  className = "",
}: GateIndicatorProps) {
  const hasReplyGate = replyDisabled || !!threadgate;
  const hasEmbedGate = embeddingDisabled;

  if (!hasReplyGate && !hasEmbedGate) return null;

  // Parse threadgate record for display
  let replyLabel = "Replies restricted";
  if (threadgate?.record) {
    const record = threadgate.record as {
      allow?: Array<{ $type: string }>;
    };
    if (!record.allow || record.allow.length === 0) {
      replyLabel = "Replies disabled";
    } else {
      const rules = record.allow
        .map((r) => {
          if (r.$type === "app.bsky.feed.threadgate#followingRule")
            return "following";
          if (r.$type === "app.bsky.feed.threadgate#mentionRule")
            return "mentioned";
          if (r.$type === "app.bsky.feed.threadgate#listRule") return "list";
          return null;
        })
        .filter(Boolean);
      if (rules.length > 0) {
        replyLabel = `Replies: ${rules.join(", ")} only`;
      }
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {hasReplyGate && (
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
          style={{
            backgroundColor: "var(--asph-bg-secondary)",
            color: "var(--asph-text-secondary)",
            border: "1px solid var(--asph-border-primary)",
          }}
          title={replyLabel}
        >
          <Lock size={10} />
          <span>{replyLabel}</span>
        </span>
      )}
      {hasEmbedGate && (
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
          style={{
            backgroundColor: "var(--asph-bg-secondary)",
            color: "var(--asph-text-secondary)",
            border: "1px solid var(--asph-border-primary)",
          }}
          title="Quoting disabled"
        >
          <Quote size={10} />
          <span>Quoting disabled</span>
        </span>
      )}
    </div>
  );
}
