import { useMemo, useState, useEffect, useRef } from "react";
import { useConversations } from "./useMessages";
import { useAuth } from "../../contexts/AuthContext";
import { dmService, DmConversation, DmMessage } from "../../services/dm-service";

export interface MessageSearchResult {
  conversationId: string;
  conversation: DmConversation;
  matchType: "contact" | "message";
  matchedMessage?: {
    id: string;
    text: string;
    sentAt: string;
    senderDid: string;
  };
}

/**
 * Hook that provides debounced DM search across conversations.
 * Searches by contact name/handle and by message content.
 * When a search query has 2+ characters, fetches messages from
 * each conversation and returns matching results.
 */
export function useMessageSearch(query: string) {
  const { session } = useAuth();
  const { data: conversations } = useConversations();
  const [messageResults, setMessageResults] = useState<MessageSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef(false);

  // Contact-level matches (name, handle, last message) — immediate, no debounce needed
  const contactResults = useMemo<MessageSearchResult[]>(() => {
    if (!conversations || !query.trim() || query.trim().length < 2) return [];

    const search = query.toLowerCase();
    const results: MessageSearchResult[] = [];

    for (const convo of conversations) {
      const otherMember =
        convo.members.find((m) => m.did !== session?.did) || convo.members[0];
      const displayName = (otherMember?.displayName || "").toLowerCase();
      const handle = (otherMember?.handle || "").toLowerCase();

      if (displayName.includes(search) || handle.includes(search)) {
        results.push({
          conversationId: convo.id,
          conversation: convo,
          matchType: "contact",
        });
      }
    }

    return results;
  }, [conversations, query, session?.did]);

  // Deep message search — debounced, fetches messages from each conversation
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2 || !conversations || conversations.length === 0) {
      setMessageResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    abortRef.current = false;

    debounceRef.current = setTimeout(async () => {
      const search = trimmed.toLowerCase();
      const results: MessageSearchResult[] = [];
      // IDs of conversations already matched by contact search
      const contactMatchIds = new Set(contactResults.map((r) => r.conversationId));

      for (const convo of conversations) {
        if (abortRef.current) break;

        // Skip if already matched by contact name
        if (contactMatchIds.has(convo.id)) continue;

        // Check last message first (cheap)
        if (convo.lastMessage?.text?.toLowerCase().includes(search)) {
          results.push({
            conversationId: convo.id,
            conversation: convo,
            matchType: "message",
            matchedMessage: {
              id: convo.lastMessage.id,
              text: convo.lastMessage.text,
              sentAt: convo.lastMessage.sentAt,
              senderDid: convo.lastMessage.sender.did,
            },
          });
          continue;
        }

        // Fetch full messages for this conversation
        try {
          const data = await dmService.getConversation(convo.id);
          if (abortRef.current) break;

          const matched = data.messages.find((msg: DmMessage) =>
            msg.text?.toLowerCase().includes(search)
          );

          if (matched) {
            results.push({
              conversationId: convo.id,
              conversation: convo,
              matchType: "message",
              matchedMessage: {
                id: matched.id,
                text: matched.text,
                sentAt: matched.sentAt,
                senderDid: matched.sender.did,
              },
            });
          }
        } catch {
          // Skip conversations that fail to load
        }
      }

      if (!abortRef.current) {
        setMessageResults(results);
        setIsSearching(false);
      }
    }, 300);

    return () => {
      abortRef.current = true;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, conversations, contactResults]);

  // Merge contact results and message results, deduplicating
  const results = useMemo<MessageSearchResult[]>(() => {
    if (!query.trim() || query.trim().length < 2) return [];

    const seen = new Set<string>();
    const merged: MessageSearchResult[] = [];

    for (const r of contactResults) {
      if (!seen.has(r.conversationId)) {
        seen.add(r.conversationId);
        merged.push(r);
      }
    }

    for (const r of messageResults) {
      if (!seen.has(r.conversationId)) {
        seen.add(r.conversationId);
        merged.push(r);
      }
    }

    return merged;
  }, [contactResults, messageResults, query]);

  return {
    results,
    isSearching,
    hasQuery: query.trim().length >= 2,
  };
}
