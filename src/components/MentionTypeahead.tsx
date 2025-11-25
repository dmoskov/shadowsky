import { useQuery } from "@tanstack/react-query";
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import { atProtoClient } from "../services/atproto";

interface MentionSuggestion {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

interface MentionTypeaheadProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  rows?: number;
  maxLength?: number;
  autoFocus?: boolean;
  onFocus?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
}

export interface MentionTypeaheadHandle {
  focus: () => void;
  blur: () => void;
  setSelectionRange: (start: number, end: number) => void;
  selectionStart: number;
  selectionEnd: number;
}

// Detect if cursor is inside a mention (after @)
function getMentionContext(
  text: string,
  cursorPos: number,
): { mentionText: string; startPos: number } | null {
  // Look backwards from cursor to find @
  let start = cursorPos - 1;
  while (start >= 0) {
    const char = text[start];
    // Stop at whitespace or start of text
    if (/\s/.test(char)) {
      break;
    }
    // Found @
    if (char === "@") {
      const mentionText = text.slice(start + 1, cursorPos);
      // Only valid if it looks like a handle (no spaces, reasonable characters)
      if (/^[a-zA-Z0-9._-]*$/.test(mentionText)) {
        return { mentionText, startPos: start };
      }
      break;
    }
    start--;
  }
  return null;
}

// Custom hook for debouncing
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export const MentionTypeahead = forwardRef<
  MentionTypeaheadHandle,
  MentionTypeaheadProps
>(
  (
    {
      value,
      onChange,
      onKeyDown,
      placeholder,
      className,
      style,
      disabled,
      rows,
      maxLength,
      autoFocus,
      onFocus,
      onBlur,
      onPaste,
    },
    ref,
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);

    const [mentionQuery, setMentionQuery] = useState("");
    const [mentionStartPos, setMentionStartPos] = useState<number | null>(null);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [dropdownPosition, setDropdownPosition] = useState({
      top: 0,
      left: 0,
    });

    const debouncedQuery = useDebounce(mentionQuery, 100);

    // Expose textarea methods to parent
    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
      blur: () => textareaRef.current?.blur(),
      setSelectionRange: (start: number, end: number) =>
        textareaRef.current?.setSelectionRange(start, end),
      get selectionStart() {
        return textareaRef.current?.selectionStart ?? 0;
      },
      get selectionEnd() {
        return textareaRef.current?.selectionEnd ?? 0;
      },
    }));

    // Query for user suggestions
    const { data: suggestions = [], isLoading } = useQuery<MentionSuggestion[]>(
      {
        queryKey: ["mentionTypeahead", debouncedQuery],
        queryFn: async () => {
          if (!debouncedQuery || debouncedQuery.length < 1) return [];

          try {
            const response =
              await atProtoClient.agent.app.bsky.actor.searchActorsTypeahead({
                q: debouncedQuery,
                limit: 8,
              });

            return response.data.actors.map((actor) => ({
              did: actor.did,
              handle: actor.handle,
              displayName: actor.displayName,
              avatar: actor.avatar,
            }));
          } catch (error) {
            console.error("Error searching users:", error);
            return [];
          }
        },
        enabled:
          !!debouncedQuery && debouncedQuery.length >= 1 && showSuggestions,
      },
    );

    // Calculate dropdown position based on cursor (viewport coordinates for portal)
    const updateDropdownPosition = () => {
      if (!textareaRef.current) return;

      const textarea = textareaRef.current;
      const textareaRect = textarea.getBoundingClientRect();
      const computed = window.getComputedStyle(textarea);
      const lineHeight = parseInt(computed.lineHeight) || 20;

      // Position below the textarea's first line
      let top = textareaRect.top + lineHeight + 8 + window.scrollY;
      let left = textareaRect.left + window.scrollX;

      // Ensure dropdown doesn't go off screen
      const dropdownWidth = 280;
      const dropdownHeight = 240;

      if (left + dropdownWidth > window.innerWidth) {
        left = Math.max(10, window.innerWidth - dropdownWidth - 10);
      }

      if (top + dropdownHeight > window.innerHeight + window.scrollY) {
        // Show above the textarea instead
        top = textareaRect.top - dropdownHeight - 8 + window.scrollY;
      }

      setDropdownPosition({ top, left });
    };

    // Handle text changes
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      onChange(newValue);

      // Check for mention context
      const cursorPos = e.target.selectionStart;
      const context = getMentionContext(newValue, cursorPos);

      if (context) {
        setMentionQuery(context.mentionText);
        setMentionStartPos(context.startPos);
        setShowSuggestions(true);
        setSelectedIndex(0);
        // Defer position calculation to after render
        requestAnimationFrame(updateDropdownPosition);
      } else {
        setShowSuggestions(false);
        setMentionQuery("");
        setMentionStartPos(null);
      }
    };

    // Handle selection and keyboard navigation
    const handleKeyDownInternal = (
      e: React.KeyboardEvent<HTMLTextAreaElement>,
    ) => {
      if (showSuggestions && suggestions.length > 0) {
        switch (e.key) {
          case "ArrowDown":
            e.preventDefault();
            setSelectedIndex((prev) =>
              prev < suggestions.length - 1 ? prev + 1 : 0,
            );
            return;
          case "ArrowUp":
            e.preventDefault();
            setSelectedIndex((prev) =>
              prev > 0 ? prev - 1 : suggestions.length - 1,
            );
            return;
          case "Enter":
          case "Tab":
            e.preventDefault();
            selectSuggestion(suggestions[selectedIndex]);
            return;
          case "Escape":
            e.preventDefault();
            setShowSuggestions(false);
            return;
        }
      }

      // Pass to parent handler
      onKeyDown?.(e);
    };

    // Insert selected mention
    const selectSuggestion = (suggestion: MentionSuggestion) => {
      if (mentionStartPos === null) return;

      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursorPos = textarea.selectionStart;

      // Replace @query with @handle
      const before = value.slice(0, mentionStartPos);
      const after = value.slice(cursorPos);
      const newText = `${before}@${suggestion.handle} ${after}`;

      onChange(newText);
      setShowSuggestions(false);
      setMentionQuery("");
      setMentionStartPos(null);

      // Move cursor after the mention
      const newCursorPos = mentionStartPos + suggestion.handle.length + 2; // +2 for @ and space
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      });
    };

    // Close suggestions when clicking outside
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
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Scroll selected item into view
    useEffect(() => {
      if (showSuggestions && suggestionsRef.current) {
        const selected = suggestionsRef.current.querySelector(
          `[data-index="${selectedIndex}"]`,
        );
        selected?.scrollIntoView({ block: "nearest" });
      }
    }, [selectedIndex, showSuggestions]);

    return (
      <div ref={containerRef} className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDownInternal}
          onFocus={onFocus}
          onBlur={onBlur}
          onPaste={onPaste}
          placeholder={placeholder}
          className={className}
          style={style}
          disabled={disabled}
          rows={rows}
          autoFocus={autoFocus}
          maxLength={maxLength}
        />

        {/* Suggestions dropdown - rendered via portal to avoid overflow clipping */}
        {showSuggestions &&
          (suggestions.length > 0 || isLoading) &&
          ReactDOM.createPortal(
            <div
              ref={suggestionsRef}
              className="fixed z-[9999] max-h-[240px] w-[280px] overflow-y-auto rounded-lg border shadow-lg"
              style={{
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                backgroundColor: "var(--bsky-bg-primary)",
                borderColor: "var(--bsky-border-primary)",
              }}
            >
              {isLoading && suggestions.length === 0 && (
                <div
                  className="flex items-center justify-center px-3 py-4"
                  style={{ color: "var(--bsky-text-secondary)" }}
                >
                  <span className="text-sm">Searching...</span>
                </div>
              )}
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.did}
                  data-index={index}
                  onClick={() => selectSuggestion(suggestion)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors"
                  style={{
                    backgroundColor:
                      index === selectedIndex
                        ? "var(--bsky-bg-secondary)"
                        : "transparent",
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  {suggestion.avatar ? (
                    <img
                      src={suggestion.avatar}
                      alt=""
                      className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: "var(--bsky-bg-tertiary)" }}
                    >
                      <span
                        className="text-sm font-medium"
                        style={{ color: "var(--bsky-text-secondary)" }}
                      >
                        {suggestion.handle[0]?.toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {suggestion.displayName && (
                      <div
                        className="truncate text-sm font-medium"
                        style={{ color: "var(--bsky-text-primary)" }}
                      >
                        {suggestion.displayName}
                      </div>
                    )}
                    <div
                      className="truncate text-xs"
                      style={{ color: "var(--bsky-text-secondary)" }}
                    >
                      @{suggestion.handle}
                    </div>
                  </div>
                </button>
              ))}
            </div>,
            document.body,
          )}
      </div>
    );
  },
);

MentionTypeahead.displayName = "MentionTypeahead";
