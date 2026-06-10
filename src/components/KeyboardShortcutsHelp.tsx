import { Command } from "lucide-react";
import React from "react";
import {
  Modal,
  ModalBody,
  ModalClose,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "./ui/Modal";

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
      { keys: ["M"], description: "More options menu (when focused)" },
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
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="4xl"
      labelledBy="shortcuts-title"
      className="border border-asph-border-primary bg-asph-bg-primary"
    >
      <ModalHeader className="px-6 py-4">
        <div className="flex items-center gap-3">
          <Command
            size={24}
            style={{ color: "var(--asph-primary)" }}
            aria-hidden="true"
          />
          <ModalTitle id="shortcuts-title">Keyboard Shortcuts</ModalTitle>
        </div>
        <ModalClose
          className="touch-target-icon"
          aria-label="Close keyboard shortcuts help"
        />
      </ModalHeader>

      <ModalBody className="grid gap-6 p-6 md:grid-cols-2">
        {SHORTCUT_GROUPS.map((group) => (
          <div key={group.category}>
            <h3
              className="mb-3 text-sm font-semibold uppercase tracking-wide"
              style={{ color: "var(--asph-text-tertiary)" }}
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
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    {shortcut.description}
                  </span>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((key, keyIndex) => (
                      <React.Fragment key={keyIndex}>
                        {key === "then" ? (
                          <span
                            className="px-1 text-xs"
                            style={{ color: "var(--asph-text-tertiary)" }}
                          >
                            then
                          </span>
                        ) : (
                          <>
                            <kbd
                              className="min-w-[2rem] rounded px-2 py-1 text-center text-xs font-medium"
                              style={{
                                backgroundColor: "var(--asph-bg-secondary)",
                                color: "var(--asph-text-primary)",
                                border: "1px solid var(--asph-border-primary)",
                              }}
                            >
                              {key}
                            </kbd>
                            {keyIndex < shortcut.keys.length - 1 &&
                              shortcut.keys[keyIndex + 1] !== "then" && (
                                <span
                                  className="text-xs"
                                  style={{
                                    color: "var(--asph-text-tertiary)",
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
      </ModalBody>

      <ModalFooter className="justify-center bg-asph-bg-primary px-6 py-4 text-center text-xs text-asph-text-tertiary">
        <p>
          Press{" "}
          <kbd className="rounded border border-asph-border-secondary px-1.5 py-0.5">
            Esc
          </kbd>{" "}
          to close this dialog
        </p>
      </ModalFooter>
    </Modal>
  );
};
