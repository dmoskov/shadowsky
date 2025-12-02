import { useCallback, useEffect, useState } from "react";

export interface ThreadNavigationActions {
  jumpToSummary?: () => void;
  jumpToNextBranch?: () => void;
  jumpToOriginalPost?: () => void;
  toggleAuthorOnlyView?: () => void;
  jumpToParent?: () => void;
  jumpToPrevSibling?: () => void;
  jumpToNextSibling?: () => void;
  navigateUp?: () => void;
  navigateDown?: () => void;
  focusReply?: () => void;
}

export interface ThreadKeyboardShortcutsConfig {
  enabled?: boolean;
  actions: ThreadNavigationActions;
  authorDid?: string;
}

export interface ThreadShortcut {
  key: string;
  label: string;
  description: string;
  action?: () => void;
  enabled: boolean;
}

/**
 * Hook to manage thread-specific keyboard shortcuts
 * Provides enhanced navigation for thread viewing experience
 */
export function useThreadKeyboardShortcuts(
  config: ThreadKeyboardShortcutsConfig,
) {
  const { enabled = true, actions, authorDid } = config;
  const [showAuthorOnly, setShowAuthorOnly] = useState(false);
  const [showHelpPanel, setShowHelpPanel] = useState(false);

  // Toggle author-only view
  const handleToggleAuthorOnly = useCallback(() => {
    setShowAuthorOnly((prev) => !prev);
    actions.toggleAuthorOnlyView?.();
  }, [actions]);

  // Build shortcuts list for display
  const shortcuts: ThreadShortcut[] = [
    {
      key: "s",
      label: "Summary",
      description: "Jump to thread summary/root",
      action: actions.jumpToSummary,
      enabled: !!actions.jumpToSummary,
    },
    {
      key: "b",
      label: "Branch",
      description: "Jump to next branch point",
      action: actions.jumpToNextBranch,
      enabled: !!actions.jumpToNextBranch,
    },
    {
      key: "o",
      label: "Original",
      description: "Jump to original post",
      action: actions.jumpToOriginalPost,
      enabled: !!actions.jumpToOriginalPost,
    },
    {
      key: "u",
      label: "Author",
      description: authorDid
        ? showAuthorOnly
          ? "Show all posts"
          : "Show author's posts only"
        : "Filter to thread author's posts",
      action: handleToggleAuthorOnly,
      enabled: !!authorDid && !!actions.toggleAuthorOnlyView,
    },
    {
      key: "p",
      label: "Parent",
      description: "Jump to parent post",
      action: actions.jumpToParent,
      enabled: !!actions.jumpToParent,
    },
    {
      key: "[",
      label: "Prev Branch",
      description: "Jump to previous sibling",
      action: actions.jumpToPrevSibling,
      enabled: !!actions.jumpToPrevSibling,
    },
    {
      key: "]",
      label: "Next Branch",
      description: "Jump to next sibling",
      action: actions.jumpToNextSibling,
      enabled: !!actions.jumpToNextSibling,
    },
    {
      key: "j",
      label: "Down",
      description: "Navigate to next post",
      action: actions.navigateDown,
      enabled: !!actions.navigateDown,
    },
    {
      key: "k",
      label: "Up",
      description: "Navigate to previous post",
      action: actions.navigateUp,
      enabled: !!actions.navigateUp,
    },
    {
      key: "r",
      label: "Reply",
      description: "Focus reply composer",
      action: actions.focusReply,
      enabled: !!actions.focusReply,
    },
    {
      key: "?",
      label: "Help",
      description: "Toggle shortcuts help",
      action: () => setShowHelpPanel((prev) => !prev),
      enabled: true,
    },
  ];

  // Keyboard event handler
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if in editable context
      const activeElement = document.activeElement as HTMLElement | null;
      const isEditable =
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        activeElement?.isContentEditable;

      if (isEditable) return;

      // Skip if modifier keys are pressed (except Shift for ?)
      if (event.ctrlKey || event.altKey || event.metaKey) return;

      const key = event.key.toLowerCase();
      let handled = false;

      switch (key) {
        case "s":
          // Jump to summary/root
          if (actions.jumpToSummary) {
            actions.jumpToSummary();
            handled = true;
          }
          break;

        case "b":
          // Jump to next branch point
          if (actions.jumpToNextBranch) {
            actions.jumpToNextBranch();
            handled = true;
          }
          break;

        case "o":
          // Jump to original post
          if (actions.jumpToOriginalPost) {
            actions.jumpToOriginalPost();
            handled = true;
          }
          break;

        case "u":
          // Toggle author-only view
          if (authorDid && actions.toggleAuthorOnlyView) {
            handleToggleAuthorOnly();
            handled = true;
          }
          break;

        case "p":
          // Jump to parent
          if (actions.jumpToParent) {
            actions.jumpToParent();
            handled = true;
          }
          break;

        case "[":
          // Previous sibling
          if (actions.jumpToPrevSibling) {
            actions.jumpToPrevSibling();
            handled = true;
          }
          break;

        case "]":
          // Next sibling
          if (actions.jumpToNextSibling) {
            actions.jumpToNextSibling();
            handled = true;
          }
          break;

        case "r":
          // Focus reply
          if (actions.focusReply) {
            actions.focusReply();
            handled = true;
          }
          break;

        case "?":
          // Toggle help panel
          setShowHelpPanel((prev) => !prev);
          handled = true;
          break;
      }

      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, actions, authorDid, handleToggleAuthorOnly]);

  return {
    shortcuts,
    showAuthorOnly,
    setShowAuthorOnly,
    showHelpPanel,
    setShowHelpPanel,
    enabledShortcuts: shortcuts.filter((s) => s.enabled),
  };
}
