import {
  ArrowRight,
  Bell,
  Bookmark,
  Command,
  Hash,
  Home,
  LogOut,
  MessageSquare,
  Moon,
  PenTool,
  Search,
  Settings,
  Sun,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useDelayedValue } from "../hooks/useTiming";
import { useViewTransitionNavigate } from "../hooks/useViewTransitionNavigate";

interface Command {
  id: string;
  name: string;
  description?: string;
  icon: React.ElementType;
  shortcut?: string;
  action: () => void;
  section: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
}) => {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDelayedValue(query, 150);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useFocusTrap<HTMLDivElement>(isOpen);

  const navigate = useViewTransitionNavigate();
  const { logout, session } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const commands = useMemo<Command[]>(
    () => [
      // Navigation
      {
        id: "home",
        name: "Go to Home",
        icon: Home,
        shortcut: "⌘H",
        section: "Navigation",
        action: () => {
          navigate("/home");
          onClose();
        },
      },
      {
        id: "notifications",
        name: "Go to Notifications",
        icon: Bell,
        shortcut: "⌘N",
        section: "Navigation",
        action: () => {
          navigate("/notifications");
          onClose();
        },
      },
      {
        id: "messages",
        name: "Go to Messages",
        icon: MessageSquare,
        shortcut: "⌘M",
        section: "Navigation",
        action: () => {
          navigate("/messages");
          onClose();
        },
      },
      {
        id: "bookmarks",
        name: "Go to Bookmarks",
        icon: Bookmark,
        shortcut: "⌘B",
        section: "Navigation",
        action: () => {
          navigate("/bookmarks");
          onClose();
        },
      },
      {
        id: "profile",
        name: "Go to Profile",
        description: session?.handle ? `@${session.handle}` : undefined,
        icon: User,
        shortcut: "⌘P",
        section: "Navigation",
        action: () => {
          if (session?.handle) {
            navigate(`/profile/${session.handle}`);
            onClose();
          }
        },
      },
      {
        id: "search",
        name: "Search",
        icon: Search,
        shortcut: "⌘/",
        section: "Navigation",
        action: () => {
          navigate("/search");
          onClose();
        },
      },

      // Actions
      {
        id: "compose",
        name: "New Post",
        icon: PenTool,
        shortcut: "C",
        section: "Actions",
        action: () => {
          navigate("/compose");
          onClose();
        },
      },
      {
        id: "theme",
        name: theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode",
        icon: theme === "dark" ? Sun : Moon,
        section: "Actions",
        action: () => {
          toggleTheme();
        },
      },

      // Settings
      {
        id: "settings",
        name: "Settings",
        icon: Settings,
        shortcut: "⌘,",
        section: "Settings",
        action: () => {
          navigate("/settings");
          onClose();
        },
      },
      {
        id: "logout",
        name: "Sign Out",
        icon: LogOut,
        section: "Settings",
        action: () => {
          logout();
          onClose();
        },
      },

      // Quick searches
      {
        id: "search-trending",
        name: "Search Trending",
        icon: TrendingUp,
        section: "Quick Search",
        action: () => {
          navigate("/search?tab=trending");
          onClose();
        },
      },
      {
        id: "search-people",
        name: "Search People",
        icon: Users,
        section: "Quick Search",
        action: () => {
          navigate("/search?tab=people");
          onClose();
        },
      },
      {
        id: "search-feeds",
        name: "Discover Feeds",
        icon: Hash,
        section: "Quick Search",
        action: () => {
          navigate("/home?showFeeds=true");
          onClose();
        },
      },
    ],
    [navigate, onClose, logout, session, theme, toggleTheme],
  );

  const filteredCommands = useMemo(() => {
    if (!debouncedQuery) return commands;

    const lowerQuery = debouncedQuery.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(lowerQuery) ||
        cmd.description?.toLowerCase().includes(lowerQuery) ||
        cmd.section.toLowerCase().includes(lowerQuery),
    );
  }, [commands, debouncedQuery]);

  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    filteredCommands.forEach((cmd) => {
      if (!groups[cmd.section]) {
        groups[cmd.section] = [];
      }
      groups[cmd.section].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [debouncedQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const items = listRef.current.querySelectorAll("[data-command-item]");
      items[selectedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      <div
        className="animate-command-palette-backdrop-in fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="animate-command-palette-in relative z-10 w-full max-w-2xl rounded-lg shadow-2xl"
        style={{
          backgroundColor: "var(--asph-bg-primary)",
          border: "1px solid var(--asph-border-primary)",
        }}
      >
        <div
          className="flex items-center gap-3 border-b px-4 py-3"
          style={{ borderColor: "var(--asph-border-primary)" }}
        >
          <Search
            size={20}
            style={{ color: "var(--asph-text-secondary)" }}
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            aria-label="Search commands"
            className="flex-1 bg-transparent text-base outline-none placeholder:text-asph-text-tertiary"
            style={{ color: "var(--asph-text-primary)" }}
          />
          <kbd
            className="rounded px-2 py-1 text-xs font-medium"
            style={{
              backgroundColor: "var(--asph-bg-secondary)",
              color: "var(--asph-text-secondary)",
              border: "1px solid var(--asph-border-primary)",
            }}
          >
            ESC
          </kbd>
        </div>

        <div
          ref={listRef}
          className="asph-scrollbar max-h-96 overflow-y-auto py-2"
          style={{ borderTop: "1px solid var(--asph-border-primary)" }}
        >
          {filteredCommands.length === 0 ? (
            <div
              className="px-4 py-8 text-center text-sm"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              No commands found
            </div>
          ) : (
            Object.entries(groupedCommands).map(
              ([section, sectionCommands]) => (
                <div key={section}>
                  <div
                    className="px-4 py-2 text-xs font-medium uppercase"
                    style={{ color: "var(--asph-text-tertiary)" }}
                  >
                    {section}
                  </div>
                  {sectionCommands.map((cmd) => {
                    const isSelected = flatIndex === selectedIndex;
                    const currentIndex = flatIndex;
                    flatIndex++;

                    return (
                      <div
                        key={cmd.id}
                        data-command-item
                        className={`ios-press-light flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors ${
                          isSelected ? "bg-opacity-10" : ""
                        }`}
                        style={{
                          backgroundColor: isSelected
                            ? "var(--asph-primary)"
                            : "transparent",
                          color: isSelected
                            ? "var(--asph-text-primary)"
                            : "var(--asph-text-secondary)",
                        }}
                        onClick={() => {
                          cmd.action();
                        }}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                      >
                        <cmd.icon size={18} />
                        <div className="flex-1">
                          <div className="font-medium">{cmd.name}</div>
                          {cmd.description && (
                            <div
                              className="text-xs"
                              style={{ color: "var(--asph-text-tertiary)" }}
                            >
                              {cmd.description}
                            </div>
                          )}
                        </div>
                        {cmd.shortcut && (
                          <kbd
                            className="rounded px-2 py-1 text-xs font-medium"
                            style={{
                              backgroundColor: "var(--asph-bg-secondary)",
                              color: "var(--asph-text-secondary)",
                              border: "1px solid var(--asph-border-primary)",
                            }}
                          >
                            {cmd.shortcut}
                          </kbd>
                        )}
                        {isSelected && <ArrowRight size={16} />}
                      </div>
                    );
                  })}
                </div>
              ),
            )
          )}
        </div>

        <div
          className="flex items-center justify-between border-t px-4 py-2 text-xs"
          style={{
            borderColor: "var(--asph-border-primary)",
            color: "var(--asph-text-tertiary)",
          }}
        >
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Command size={12} />
              <span>to open</span>
            </span>
            <span>↑↓ to navigate</span>
            <span>↵ to select</span>
          </div>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
};
