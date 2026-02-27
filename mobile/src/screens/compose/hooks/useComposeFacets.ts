import { useCallback, useEffect, useState } from "react";
import { useSearchActors } from "../../../hooks/api/useProfile";

export function useComposeFacets(
  text: string,
  setText: (text: string) => void,
) {
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartPos, setMentionStartPos] = useState<number | null>(null);
  const [debouncedMentionQuery, setDebouncedMentionQuery] = useState("");

  // Debounce mention query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedMentionQuery(mentionQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [mentionQuery]);

  // Search for actors with debounced query
  const { data: searchResults, isLoading: isSearching } = useSearchActors(
    debouncedMentionQuery,
  );

  // Detect @ mentions in text
  const detectMention = useCallback(
    (newText: string, cursorPosition?: number) => {
      const position = cursorPosition ?? newText.length;

      let atIndex = -1;
      for (let i = position - 1; i >= 0; i--) {
        const char = newText[i];
        if (char === "@") {
          atIndex = i;
          break;
        }
        if (char === " " || char === "\n") {
          break;
        }
      }

      if (atIndex !== -1) {
        const beforeAt = atIndex === 0 ? "" : newText[atIndex - 1];
        const isValidStart =
          atIndex === 0 || beforeAt === " " || beforeAt === "\n";

        if (isValidStart) {
          const textAfterAt = newText.substring(atIndex + 1, position);
          if (!textAfterAt.includes(" ") && !textAfterAt.includes("\n")) {
            setMentionQuery(textAfterAt);
            setMentionStartPos(atIndex);
            return;
          }
        }
      }

      setMentionQuery("");
      setMentionStartPos(null);
    },
    [],
  );

  // Handle text change and detect mentions
  const handleTextChange = useCallback(
    (newText: string) => {
      setText(newText);
      detectMention(newText);
    },
    [detectMention, setText],
  );

  // Handle mention selection
  const handleSelectMention = useCallback(
    (handle: string) => {
      if (mentionStartPos !== null) {
        const beforeMention = text.substring(0, mentionStartPos);
        const afterMention = text.substring(
          mentionStartPos + mentionQuery.length + 1,
        );
        const newText = `${beforeMention}@${handle} ${afterMention}`;
        setText(newText);

        setMentionQuery("");
        setMentionStartPos(null);
      }
    },
    [text, mentionQuery, mentionStartPos, setText],
  );

  return {
    mentionQuery,
    searchResults: searchResults || [],
    isSearching,
    handleTextChange,
    handleSelectMention,
  };
}
