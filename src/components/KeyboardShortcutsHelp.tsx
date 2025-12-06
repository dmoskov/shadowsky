import { Command, X } from "lucide-react";
import React from "react";
import { useFeatureTracking } from "../hooks/useAnalytics";
import { useFocusTrap } from "../hooks/useFocusTrap";

interface ShortcutGroup {
  category: string;
  shortcuts: Array<{
    keys: string[];
    description: string;
  }>;
}

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    category: "Navigation",
    shortcuts: [
      { keys: ["⌘", "K"], description: "Open command palette" },
      { keys: ["⌘", "H"], description: "Go to home" },
      { keys: ["⌘", "N"], description: "Go to notifications" },
      { keys: ["⌘", "M"], description: "Go to messages" },
      { keys: ["⌘", "B"], description: "Go to bookmarks" },
      { keys: ["⌘", "P"], description: "Go to profile" },
      { keys: ["⌘", "/"], description: "Go to search" },
      { keys: ["⌘", ","], description: "Open settings" },
      { keys: ["G", "then", "H"], description: "Go to home (vim-style)" },
      { keys: ["G", "then", "N"], description: "Go to notifications" },
      { keys: ["G", "then", "M"], description: "Go to messages" },
      { keys: ["G", "then", "B"], description: "Go to bookmarks" },
      { keys: ["G", "then", "P"], description: "Go to profile" },
      { keys: ["G", "then", "S"], description: "Go to search" },
    ],
  },
  {
    category: "Post Actions",
    shortcuts: [
      { keys: ["C"], description: "Compose new post" },
      { keys: ["R"], description: "Reply to post (when focused)" },
      { keys: ["L"], description: "Like post (when focused)" },
      { keys: ["T"], description: "Repost (when focused)" },
      { keys: ["S"], description: "Share post (when focused)" },
      { keys: ["B"], description: "Bookmark post (when focused)" },
      { keys: ["O"], description: "Open post details (when focused)" },
      { keys: ["Enter"], description: "Open post details (when focused)" },
    ],
  },
  {
    category: "Timeline Navigation",
    shortcuts: [
      { keys: ["J"], description: "Next post" },
      { keys: ["K"], description: "Previous post" },
      { keys: ["↓"], description: "Next post (alternative)" },
      { keys: ["↑"], description: "Previous post (alternative)" },
      { keys: ["Home"], description: "First post" },
      { keys: ["End"], description: "Last post" },
      { keys: ["Page Up"], description: "Jump up 5 posts" },
      { keys: ["Page Down"], description: "Jump down 5 posts" },
      { keys: ["Space"], description: "Scroll down" },
      { keys: ["Shift", "Space"], description: "Scroll up" },
      { keys: ["Esc"], description: "Clear selection" },
    ],
  },
  {
    category: "Composer",
    shortcuts: [
      { keys: ["⌘", "Enter"], description: "Post" },
      { keys: ["Esc"], description: "Close composer" },
      { keys: ["⌘", "S"], description: "Save draft" },
    ],
  },
  {
    category: "Modals & Dialogs",
    shortcuts: [
      { keys: ["Esc"], description: "Close modal/dialog" },
      { keys: ["Tab"], description: "Next element" },
      { keys: ["Shift", "Tab"], description: "Previous element" },
    ],
  },
  {
    category: "General",
    shortcuts: [
      { keys: ["?"], description: "Show keyboard shortcuts" },
      { keys: ["/"], description: "Focus search input" },
    ],
  },
];

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  isOpen,
  onClose,
}) => {
  const containerRef = useFocusTrap<HTMLDivElement>(isOpen);
  const { trackFeatureAction } = useFeatureTracking("keyboard_shortcuts_help");

  React.useEffect(() => {
    if (isOpen) {
      trackFeatureAction("shortcuts_help_opened");
    }
  }, [isOpen, trackFeatureAction]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="modal-container modal-auto-height modal-4xl z-10 border border-bsky-border-primary bg-bsky-bg-primary"
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between border-b px-6 py-4"
          style={{
            borderColor: "var(--bsky-border-primary)",
            backgroundColor: "var(--bsky-bg-primary)",
          }}
        >
          <div className="flex items-center gap-3">
            <Command
              size={24}
              style={{ color: "var(--bsky-primary)" }}
              aria-hidden="true"
            />
            <h2
              id="shortcuts-title"
              className="text-xl font-semibold"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close keyboard shortcuts help"
            className="rounded-full p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X size={20} style={{ color: "var(--bsky-text-secondary)" }} />
          </button>
        </div>

        {/* Content */}
        <div className="grid gap-6 p-6 md:grid-cols-2">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.category}>
              <h3
                className="mb-3 text-sm font-semibold uppercase tracking-wide"
                style={{ color: "var(--bsky-text-tertiary)" }}
              >
                {group.category}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut, index) => (
                  <div
                    key={`${group.category}-${index}`}
                    className="flex items-center justify-between gap-4"
                  >
                    <span
                      className="text-sm"
                      style={{ color: "var(--bsky-text-secondary)" }}
                    >
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <React.Fragment key={keyIndex}>
                          {key === "then" ? (
                            <span
                              className="px-1 text-xs"
                              style={{ color: "var(--bsky-text-tertiary)" }}
                            >
                              then
                            </span>
                          ) : (
                            <>
                              <kbd
                                className="min-w-[2rem] rounded px-2 py-1 text-center text-xs font-medium"
                                style={{
                                  backgroundColor: "var(--bsky-bg-secondary)",
                                  color: "var(--bsky-text-primary)",
                                  border:
                                    "1px solid var(--bsky-border-primary)",
                                }}
                              >
                                {key}
                              </kbd>
                              {keyIndex < shortcut.keys.length - 1 &&
                                shortcut.keys[keyIndex + 1] !== "then" && (
                                  <span
                                    className="text-xs"
                                    style={{
                                      color: "var(--bsky-text-tertiary)",
                                    }}
                                  >
                                    +
                                  </span>
                                )}
                            </>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="border-t px-6 py-4 text-center text-xs"
          style={{
            borderColor: "var(--bsky-border-primary)",
            color: "var(--bsky-text-tertiary)",
          }}
        >
          <p>
            Press{" "}
            <kbd className="rounded border border-gray-300 px-1.5 py-0.5 dark:border-gray-600">
              Esc
            </kbd>{" "}
            to close this dialog
          </p>
        </div>
      </div>
    </div>
  );
};
