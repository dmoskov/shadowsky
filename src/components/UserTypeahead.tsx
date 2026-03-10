import React, { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { User, X, Loader2 } from "lucide-react";

interface UserTypeaheadProps {
  onSelectUser: (handle: string) => void;
  placeholder?: string;
}

interface ActorSuggestion {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

export const UserTypeahead: React.FC<UserTypeaheadProps> = ({
  onSelectUser,
  placeholder = "Add user...",
}) => {
  const { agent } = useAuth();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ActorSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Search for users
  const searchUsers = useCallback(
    async (term: string) => {
      if (!agent || term.length < 2) {
        setSuggestions([]);
        return;
      }
      setIsLoading(true);
      try {
        const response = await agent.app.bsky.actor.searchActorsTypeahead({
          term: term.replace(/^@/, ""),
          limit: 6,
        });
        setSuggestions(
          (response.data.actors || []).map((a) => ({
            did: a.did,
            handle: a.handle,
            displayName: a.displayName,
            avatar: a.avatar,
          })),
        );
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    },
    [agent],
  );

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      searchUsers(query);
      setShowSuggestions(true);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, searchUsers]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (handle: string) => {
    onSelectUser(handle.replace(/^@/, ""));
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        handleSelect(suggestions[selectedIndex].handle);
      } else if (query.trim()) {
        handleSelect(query.trim());
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(-1);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="min-h-[44px] w-full rounded-md border px-3 py-2 pr-8 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
          style={{
            backgroundColor: "var(--asph-bg-secondary)",
            borderColor: "var(--asph-border-primary)",
            color: "var(--asph-text-primary)",
            // @ts-expect-error CSS custom property
            "--tw-ring-color": "var(--asph-primary)",
          }}
          autoComplete="off"
          spellCheck={false}
        />
        {isLoading && (
          <Loader2
            size={14}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin"
            style={{ color: "var(--asph-text-tertiary)" }}
          />
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border shadow-lg"
          style={{
            backgroundColor: "var(--asph-bg-primary)",
            borderColor: "var(--asph-border-primary)",
          }}
        >
          {suggestions.map((actor, index) => (
            <button
              key={actor.did}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent blur before click registers
                handleSelect(actor.handle);
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors"
              style={{
                backgroundColor:
                  index === selectedIndex
                    ? "var(--asph-bg-secondary)"
                    : "transparent",
              }}
            >
              {actor.avatar ? (
                <img
                  src={actor.avatar}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full"
                  style={{ backgroundColor: "var(--asph-bg-secondary)" }}
                >
                  <User size={14} style={{ color: "var(--asph-text-tertiary)" }} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div
                  className="truncate text-xs font-medium"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  {actor.displayName || actor.handle}
                </div>
                <div
                  className="truncate text-[11px]"
                  style={{ color: "var(--asph-text-tertiary)" }}
                >
                  @{actor.handle}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
