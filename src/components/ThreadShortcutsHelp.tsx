import { Keyboard, X } from "lucide-react";
import React from "react";
import type { ThreadShortcut } from "../hooks/useThreadKeyboardShortcuts";

interface ThreadShortcutsHelpProps {
  shortcuts: ThreadShortcut[];
  isOpen: boolean;
  onClose: () => void;
  compact?: boolean;
}

/**
 * Component to display thread keyboard shortcuts
 * Can render as a full panel or compact inline hints
 */
export const ThreadShortcutsHelp: React.FC<ThreadShortcutsHelpProps> = ({
  shortcuts,
  isOpen,
  onClose,
  compact = false,
}) => {
  const enabledShortcuts = shortcuts.filter((s) => s.enabled);

  if (compact) {
    // Compact inline hint display
    return (
      <div
        className="flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs"
        style={{
          backgroundColor: "var(--bsky-bg-tertiary)",
          color: "var(--bsky-text-secondary)",
          border: "1px solid var(--bsky-border-primary)",
        }}
        role="region"
        aria-label="Keyboard shortcuts"
      >
        <Keyboard size={14} aria-hidden="true" />
        <span className="font-medium">Shortcuts:</span>
        {enabledShortcuts.slice(0, 5).map((shortcut) => (
          <span key={shortcut.key} className="flex items-center gap-1">
            <kbd
              className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-xs dark:bg-gray-700"
              aria-label={`Press ${shortcut.key}`}
            >
              {shortcut.key}
            </kbd>
            <span>{shortcut.label}</span>
          </span>
        ))}
        {enabledShortcuts.length > 5 && (
          <button
            onClick={onClose}
            className="text-blue-500 hover:underline"
            aria-label="Show all shortcuts"
          >
            +{enabledShortcuts.length - 5} more
          </button>
        )}
        <button
          onClick={onClose}
          className="ml-auto text-blue-500 hover:underline"
          aria-label={isOpen ? "Hide shortcuts panel" : "Show shortcuts panel"}
        >
          {isOpen ? "Hide" : "? for all"}
        </button>
      </div>
    );
  }

  if (!isOpen) return null;

  // Full panel display
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="relative z-10 w-full max-w-md rounded-lg p-6 shadow-2xl"
        style={{
          backgroundColor: "var(--bsky-bg-primary)",
          border: "1px solid var(--bsky-border-primary)",
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard
              size={20}
              style={{ color: "var(--bsky-primary)" }}
              aria-hidden="true"
            />
            <h2
              id="shortcuts-title"
              className="text-lg font-semibold"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              Thread Navigation Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
            style={{ color: "var(--bsky-text-secondary)" }}
            aria-label="Close shortcuts panel"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3" role="list" aria-label="Available shortcuts">
          {/* Navigation section */}
          <div>
            <h3
              className="mb-2 text-xs font-medium uppercase tracking-wide"
              style={{ color: "var(--bsky-text-tertiary)" }}
            >
              Navigation
            </h3>
            <div className="space-y-1.5" role="list">
              {enabledShortcuts
                .filter((s) =>
                  ["s", "b", "o", "p", "[", "]", "j", "k"].includes(s.key),
                )
                .map((shortcut) => (
                  <ShortcutRow key={shortcut.key} shortcut={shortcut} />
                ))}
            </div>
          </div>

          {/* Filter section */}
          <div>
            <h3
              className="mb-2 text-xs font-medium uppercase tracking-wide"
              style={{ color: "var(--bsky-text-tertiary)" }}
            >
              Filter
            </h3>
            <div className="space-y-1.5" role="list">
              {enabledShortcuts
                .filter((s) => ["u"].includes(s.key))
                .map((shortcut) => (
                  <ShortcutRow key={shortcut.key} shortcut={shortcut} />
                ))}
            </div>
          </div>

          {/* Actions section */}
          <div>
            <h3
              className="mb-2 text-xs font-medium uppercase tracking-wide"
              style={{ color: "var(--bsky-text-tertiary)" }}
            >
              Actions
            </h3>
            <div className="space-y-1.5" role="list">
              {enabledShortcuts
                .filter((s) => ["r", "?"].includes(s.key))
                .map((shortcut) => (
                  <ShortcutRow key={shortcut.key} shortcut={shortcut} />
                ))}
            </div>
          </div>
        </div>

        <div
          className="mt-4 text-center text-xs"
          style={{ color: "var(--bsky-text-tertiary)" }}
        >
          Press{" "}
          <kbd className="rounded bg-gray-200 px-1.5 py-0.5 font-mono dark:bg-gray-700">
            ?
          </kbd>{" "}
          to toggle this panel
        </div>
      </div>
    </div>
  );
};

interface ShortcutRowProps {
  shortcut: ThreadShortcut;
}

const ShortcutRow: React.FC<ShortcutRowProps> = ({ shortcut }) => (
  <div
    className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
    role="listitem"
  >
    <span style={{ color: "var(--bsky-text-primary)" }}>
      {shortcut.description}
    </span>
    <kbd
      className="rounded px-2 py-1 font-mono text-sm"
      style={{
        backgroundColor: "var(--bsky-bg-secondary)",
        color: "var(--bsky-text-secondary)",
        border: "1px solid var(--bsky-border-primary)",
      }}
      aria-label={`Press ${shortcut.key}`}
    >
      {shortcut.key}
    </kbd>
  </div>
);

/**
 * Compact inline shortcut hint bar for the thread UI
 */
export const ThreadShortcutsHintBar: React.FC<{
  onShowHelp: () => void;
  showAuthorOnly?: boolean;
  authorHandle?: string;
}> = ({ onShowHelp, showAuthorOnly, authorHandle }) => {
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-3 py-2 text-xs"
      style={{
        backgroundColor: "var(--bsky-bg-tertiary)",
        color: "var(--bsky-text-secondary)",
        border: "1px solid var(--bsky-border-primary)",
      }}
      role="region"
      aria-label="Thread keyboard shortcuts"
    >
      <div className="flex items-center gap-1.5">
        <Keyboard size={12} aria-hidden="true" />
        <span className="font-medium">Shortcuts:</span>
      </div>

      <ShortcutHint keyName="s" label="Summary" />
      <ShortcutHint keyName="b" label="Branch" />
      <ShortcutHint keyName="o" label="Original" />
      {authorHandle && (
        <ShortcutHint
          keyName="u"
          label={showAuthorOnly ? "All posts" : `@${authorHandle}'s posts`}
          active={showAuthorOnly}
        />
      )}

      <button
        onClick={onShowHelp}
        className="ml-auto flex items-center gap-1 transition-colors hover:text-blue-500"
        aria-label="Show all keyboard shortcuts"
      >
        <kbd
          className="rounded bg-gray-200 px-1.5 py-0.5 font-mono dark:bg-gray-700"
          aria-hidden="true"
        >
          ?
        </kbd>
        <span>All shortcuts</span>
      </button>
    </div>
  );
};

const ShortcutHint: React.FC<{
  keyName: string;
  label: string;
  active?: boolean;
}> = ({ keyName, label, active }) => (
  <span
    className={`flex items-center gap-1 ${active ? "font-medium text-blue-500" : ""}`}
  >
    <kbd
      className={`rounded px-1.5 py-0.5 font-mono ${
        active ? "bg-blue-500 text-white" : "bg-gray-200 dark:bg-gray-700"
      }`}
      aria-label={`Press ${keyName}`}
    >
      {keyName}
    </kbd>
    <span>{label}</span>
  </span>
);
