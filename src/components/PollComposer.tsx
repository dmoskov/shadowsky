import { Clock, Minus, Plus, X } from "lucide-react";
import { useState } from "react";

export interface PollOption {
  id: string;
  text: string;
}

export interface PollData {
  options: PollOption[];
  durationHours: number;
}

export interface PollComposerProps {
  poll: PollData | null;
  onChange: (poll: PollData | null) => void;
  onRemove: () => void;
}

const DURATION_OPTIONS = [
  { value: 1, label: "1 hour" },
  { value: 6, label: "6 hours" },
  { value: 12, label: "12 hours" },
  { value: 24, label: "1 day" },
  { value: 48, label: "2 days" },
  { value: 72, label: "3 days" },
  { value: 168, label: "7 days" },
];

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;
const MAX_OPTION_LENGTH = 50;

function generateOptionId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function createEmptyPoll(): PollData {
  return {
    options: [
      { id: generateOptionId(), text: "" },
      { id: generateOptionId(), text: "" },
    ],
    durationHours: 24,
  };
}

export function PollComposer({ poll, onChange, onRemove }: PollComposerProps) {
  const [showDurationDropdown, setShowDurationDropdown] = useState(false);

  if (!poll) return null;

  const handleOptionChange = (id: string, text: string) => {
    if (text.length > MAX_OPTION_LENGTH) return;
    const newOptions = poll.options.map((opt) =>
      opt.id === id ? { ...opt, text } : opt,
    );
    onChange({ ...poll, options: newOptions });
  };

  const handleAddOption = () => {
    if (poll.options.length >= MAX_OPTIONS) return;
    const newOptions = [...poll.options, { id: generateOptionId(), text: "" }];
    onChange({ ...poll, options: newOptions });
  };

  const handleRemoveOption = (id: string) => {
    if (poll.options.length <= MIN_OPTIONS) return;
    const newOptions = poll.options.filter((opt) => opt.id !== id);
    onChange({ ...poll, options: newOptions });
  };

  const handleDurationChange = (durationHours: number) => {
    onChange({ ...poll, durationHours });
    setShowDurationDropdown(false);
  };

  const getDurationLabel = (hours: number): string => {
    const option = DURATION_OPTIONS.find((opt) => opt.value === hours);
    return option?.label || `${hours} hours`;
  };

  const isValid = poll.options.every((opt) => opt.text.trim().length > 0);

  return (
    <div
      className="mt-3 rounded-lg border p-3"
      style={{
        backgroundColor: "var(--bsky-bg-secondary)",
        borderColor: "var(--bsky-border-primary)",
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span
          className="text-sm font-medium"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          Create a Poll
        </span>
        <button
          onClick={onRemove}
          className="rounded-full p-1 transition-colors hover:bg-red-100 dark:hover:bg-red-900/30"
          title="Remove poll"
        >
          <X size={16} className="text-red-500" />
        </button>
      </div>

      <div className="space-y-2">
        {poll.options.map((option, index) => (
          <div key={option.id} className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={option.text}
                onChange={(e) => handleOptionChange(option.id, e.target.value)}
                placeholder={`Option ${index + 1}`}
                maxLength={MAX_OPTION_LENGTH}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{
                  backgroundColor: "var(--bsky-bg-primary)",
                  borderColor: "var(--bsky-border-primary)",
                  color: "var(--bsky-text-primary)",
                }}
              />
              <span
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs"
                style={{ color: "var(--bsky-text-tertiary)" }}
              >
                {option.text.length}/{MAX_OPTION_LENGTH}
              </span>
            </div>
            {poll.options.length > MIN_OPTIONS && (
              <button
                onClick={() => handleRemoveOption(option.id)}
                className="rounded-full p-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                title="Remove option"
              >
                <Minus
                  size={16}
                  style={{ color: "var(--bsky-text-secondary)" }}
                />
              </button>
            )}
          </div>
        ))}
      </div>

      {poll.options.length < MAX_OPTIONS && (
        <button
          onClick={handleAddOption}
          className="mt-2 flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600"
        >
          <Plus size={14} />
          <span>Add option</span>
        </button>
      )}

      <div
        className="mt-4 flex items-center justify-between border-t pt-3"
        style={{ borderColor: "var(--bsky-border-primary)" }}
      >
        <div className="relative">
          <button
            onClick={() => setShowDurationDropdown(!showDurationDropdown)}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
            style={{
              borderColor: "var(--bsky-border-primary)",
              color: "var(--bsky-text-secondary)",
            }}
          >
            <Clock size={14} />
            <span>{getDurationLabel(poll.durationHours)}</span>
          </button>

          {showDurationDropdown && (
            <div
              className="absolute bottom-full left-0 z-10 mb-1 min-w-[120px] rounded-lg border py-1 shadow-lg"
              style={{
                backgroundColor: "var(--bsky-bg-primary)",
                borderColor: "var(--bsky-border-primary)",
              }}
            >
              {DURATION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleDurationChange(option.value)}
                  className={`w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${
                    poll.durationHours === option.value
                      ? "font-medium text-blue-500"
                      : ""
                  }`}
                  style={{
                    color:
                      poll.durationHours === option.value
                        ? undefined
                        : "var(--bsky-text-primary)",
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {!isValid && (
          <span className="text-xs text-orange-500">
            Fill in all options to post
          </span>
        )}
      </div>
    </div>
  );
}

export function isPollValid(poll: PollData | null): boolean {
  if (!poll) return true;
  return poll.options.every((opt) => opt.text.trim().length > 0);
}
