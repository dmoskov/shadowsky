import type { KeyboardShortcut } from "../hooks/useKeyboardShortcuts";

/**
 * Global keyboard shortcuts configuration
 * Centralized configuration makes it easier to maintain and modify shortcuts
 */
export function getKeyboardShortcuts(
  navigate: (path: string) => void,
  session: { handle?: string } | null,
  setIsCommandPaletteOpen: (open: boolean) => void,
  setIsShortcutsHelpOpen: (open: boolean) => void,
): KeyboardShortcut[] {
  return [
    // Command palette
    {
      key: "k",
      meta: true,
      description: "Open command palette",
      category: "General",
      action: () => setIsCommandPaletteOpen(true),
    },
    // Help - Shift+? opens shortcuts help (/ without shift focuses search, handled in KeyboardShortcutsContext)
    {
      key: "?",
      shift: true,
      description: "Show keyboard shortcuts",
      category: "General",
      action: () => setIsShortcutsHelpOpen(true),
    },
    // Navigation shortcuts
    {
      key: "h",
      meta: true,
      description: "Go to home",
      category: "Navigation",
      action: () => navigate("/home"),
    },
    {
      key: "n",
      meta: true,
      description: "Go to notifications",
      category: "Navigation",
      action: () => navigate("/notifications"),
    },
    {
      key: "m",
      meta: true,
      description: "Go to messages",
      category: "Navigation",
      action: () => navigate("/messages"),
    },
    {
      key: "b",
      meta: true,
      description: "Go to bookmarks",
      category: "Navigation",
      action: () => navigate("/bookmarks"),
    },
    {
      key: "p",
      meta: true,
      description: "Go to profile",
      category: "Navigation",
      action: () => {
        if (session?.handle) {
          navigate(`/profile/${session.handle}`);
        }
      },
    },
    {
      key: "/",
      meta: true,
      description: "Go to search",
      category: "Navigation",
      action: () => navigate("/search"),
    },
    {
      key: ",",
      meta: true,
      description: "Open settings",
      category: "Navigation",
      action: () => navigate("/settings"),
    },
    // Single key shortcuts (vim-style)
    {
      key: "c",
      description: "Compose new post",
      category: "Actions",
      action: () => navigate("/compose"),
    },
  ];
}
