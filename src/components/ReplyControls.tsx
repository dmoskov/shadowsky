import {
  CheckCircle2,
  ChevronDown,
  Globe,
  MessageSquare,
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
          className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-gray-800"
          style={{
            borderColor: "var(--bsky-border-primary)",
            backgroundColor: "var(--bsky-bg-secondary)",
            color: "var(--bsky-text-primary)",
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
            className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-lg border shadow-lg"
            style={{
              backgroundColor: "var(--bsky-bg-primary)",
              borderColor: "var(--bsky-border-primary)",
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
                  className={`flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    option.id === value ? "bg-blue-50 dark:bg-blue-900/20" : ""
                  }`}
                >
                  <div
                    className="mt-0.5"
                    style={{
                      color:
                        option.id === value
                          ? "var(--bsky-primary)"
                          : "var(--bsky-text-secondary)",
                    }}
                  >
                    {option.icon}
                  </div>
                  <div className="flex-1">
                    <div
                      className="font-medium"
                      style={{ color: "var(--bsky-text-primary)" }}
                    >
                      {option.label}
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: "var(--bsky-text-secondary)" }}
                    >
                      {option.description}
                    </div>
                  </div>
                  {option.id === value && (
                    <CheckCircle2
                      size={18}
                      style={{ color: "var(--bsky-primary)" }}
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
        style={{ color: "var(--bsky-text-primary)" }}
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
            className={`flex flex-col items-center gap-2 rounded-lg border p-3 transition-all ${
              option.id === value
                ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                : "hover:bg-gray-50 dark:hover:bg-gray-800"
            } disabled:opacity-50`}
            style={{
              borderColor:
                option.id === value
                  ? "var(--bsky-primary)"
                  : "var(--bsky-border-primary)",
              backgroundColor:
                option.id === value ? undefined : "var(--bsky-bg-secondary)",
            }}
          >
            <div
              style={{
                color:
                  option.id === value
                    ? "var(--bsky-primary)"
                    : "var(--bsky-text-secondary)",
              }}
            >
              {option.icon}
            </div>
            <span
              className="text-xs font-medium"
              style={{ color: "var(--bsky-text-primary)" }}
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
      style={{ color: "var(--bsky-text-secondary)" }}
    >
      {option.icon}
      <span>{option.label} can reply</span>
    </div>
  );
}
