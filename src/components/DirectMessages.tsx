import { debug } from "@bsky/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useDMQueue } from "../hooks/useDMQueue";
import { useMinDuration } from "../hooks/useTiming";
import { getDmSearchDB } from "../services/dm-search-db";
import { dmService, type DmConversation } from "../services/dm-service";
import { DMMessage } from "./DMMessage";
import { DmSearch } from "./DmSearch";
import {
  ConversationListSkeleton,
  MessageListSkeleton,
} from "./ui/SkeletonLoader";

export const DirectMessages: React.FC = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(null);
  const [messageText, setMessageText] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const [isTabVisible, setIsTabVisible] = useState<boolean>(!document.hidden);
  const [showSearch, setShowSearch] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const [indexedSenders, setIndexedSenders] = useState<
    Array<{ did: string; handle?: string; displayName?: string }>
  >([]);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Track user activity
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Check if user is inactive (no activity for 2 minutes)
  const isUserInactive = useCallback(() => {
    return Date.now() - lastActivityRef.current > 2 * 60 * 1000; // 2 minutes
  }, []);

  // Calculate polling interval based on activity and visibility
  const getPollingInterval = useCallback(() => {
    if (!isTabVisible) {
      return false; // Don't poll when tab is hidden
    }
    if (isUserInactive()) {
      return 30000; // 30 seconds when inactive
    }
    return 5000; // 5 seconds when active
  }, [isTabVisible, isUserInactive]);

  // Set up visibility change handler
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Set up activity tracking
  useEffect(() => {
    const events = ["mousedown", "keydown", "touchstart", "scroll"];

    events.forEach((event) => {
      window.addEventListener(event, updateActivity, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, updateActivity);
      });
    };
  }, [updateActivity]);

  // Fetch conversations list with dynamic polling
  const {
    data: conversations,
    isLoading: loadingConversationsRaw,
    error: conversationsError,
  } = useQuery({
    queryKey: ["dm-conversations"],
    queryFn: () => dmService.listConversations(),
    refetchInterval: getPollingInterval,
    enabled: isTabVisible,
    retry: 1,
  });

  // Apply minimum duration to prevent loading flash
  const loadingConversations = useMinDuration(loadingConversationsRaw, 300);

  // Handle errors - only set error if there's an actual error, not just undefined data
  useEffect(() => {
    if (conversationsError) {
      setChatError(
        `Error loading conversations: ${conversationsError.message || "Unknown error"}. This usually means your app password needs chat permissions.`,
      );
    } else {
      setChatError(null);
    }
  }, [conversationsError]);

  // Fetch messages for selected conversation with smart polling
  const { data: conversationData, isLoading: loadingMessagesRaw } = useQuery({
    queryKey: ["dm-conversation", selectedConversation],
    queryFn: () =>
      selectedConversation
        ? dmService.getConversation(selectedConversation)
        : null,
    enabled: !!selectedConversation && isTabVisible,
    refetchInterval: selectedConversation ? getPollingInterval : false,
  });

  // Apply minimum duration to prevent loading flash
  const loadingMessages = useMinDuration(loadingMessagesRaw, 300);

  // Index messages when conversation data changes (real-time indexing)
  useEffect(() => {
    const indexMessages = async () => {
      if (!conversationData?.messages || !selectedConversation) return;

      try {
        const db = await getDmSearchDB();
        const messagesToIndex = conversationData.messages.map((msg) => {
          // Get sender info from conversation members
          const sender = conversationData.conversation.members.find(
            (m) => m.did === msg.sender.did,
          );
          return {
            id: msg.id,
            conversationId: selectedConversation,
            text: msg.text,
            senderDid: msg.sender.did,
            senderHandle: sender?.handle,
            senderDisplayName: sender?.displayName,
            sentAt: msg.sentAt,
          };
        });

        await db.indexMessages(messagesToIndex);

        // Update indexed senders
        const senders = await db.getIndexedSenders();
        setIndexedSenders(senders);
      } catch (error) {
        debug.error("Failed to index DM messages:", error);
      }
    };

    indexMessages();
  }, [conversationData?.messages, selectedConversation]);

  // Load indexed senders on mount
  useEffect(() => {
    const loadSenders = async () => {
      try {
        const db = await getDmSearchDB();
        const senders = await db.getIndexedSenders();
        setIndexedSenders(senders);
      } catch (error) {
        debug.error("Failed to load indexed senders:", error);
      }
    };

    loadSenders();
  }, []);

  // Use optimistic DM queue
  const {
    getOptimisticMessages,
    sendMessage: sendOptimisticMessage,
    retryMessage,
    isInitialized: isQueueInitialized,
  } = useDMQueue();

  // Track if we're currently sending
  const [isSending, setIsSending] = useState(false);

  // Get combined messages (server + optimistic)
  const combinedMessages = useMemo(() => {
    if (!conversationData?.messages || !selectedConversation) return [];
    return getOptimisticMessages(conversationData.messages, selectedConversation);
  }, [conversationData?.messages, selectedConversation, getOptimisticMessages]);

  // Scroll to bottom when messages change (unless highlighted)
  useEffect(() => {
    if (!highlightedMessageId) {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [combinedMessages, highlightedMessageId]);

  // Mark conversation as read when selected
  useEffect(() => {
    if (
      selectedConversation &&
      conversationData?.conversation?.unreadCount &&
      conversationData.conversation.unreadCount > 0
    ) {
      // Small delay to ensure messages are visible
      const timer = setTimeout(() => {
        dmService.updateRead(selectedConversation).then(() => {
          // Invalidate the conversations list to update unread counts
          queryClient.invalidateQueries({ queryKey: ["dm-conversations"] });
        });
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [
    selectedConversation,
    conversationData?.conversation.unreadCount,
    queryClient,
  ]);

  // Handle search result click - jump to message
  const handleSearchResultClick = useCallback(
    (messageId: string, conversationId: string) => {
      // If different conversation, switch to it first
      if (conversationId !== selectedConversation) {
        setSelectedConversation(conversationId);
      }

      // Highlight the message
      setHighlightedMessageId(messageId);

      // Close search panel on mobile
      if (window.innerWidth < 768) {
        setShowSearch(false);
      }

      // Scroll to the message after a short delay to allow rendering
      setTimeout(() => {
        const messageElement = messageRefs.current.get(messageId);
        if (messageElement) {
          messageElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }, 100);

      // Clear highlight after 3 seconds
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 3000);
    },
    [selectedConversation],
  );

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConversation || !messageText.trim() || isSending) return;

    const text = messageText.trim();
    setMessageText(""); // Clear input immediately for optimistic feel
    setIsSending(true);

    try {
      await sendOptimisticMessage(selectedConversation, text);
      // Invalidate queries after a delay to pick up server confirmation
      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: ["dm-conversation", selectedConversation],
        });
        queryClient.invalidateQueries({ queryKey: ["dm-conversations"] });
      }, 2000);
    } catch (error) {
      debug.error("Failed to queue message:", error);
      // Restore the message text if queuing failed
      setMessageText(text);
    } finally {
      setIsSending(false);
    }
  };

  const getOtherMember = (conversation: DmConversation) => {
    return (
      conversation.members.find((member) => member.did !== session?.did) ||
      conversation.members[0]
    );
  };

  // Register message ref for scroll-to functionality
  const setMessageRef = useCallback(
    (messageId: string, element: HTMLDivElement | null) => {
      if (element) {
        messageRefs.current.set(messageId, element);
      } else {
        messageRefs.current.delete(messageId);
      }
    },
    [],
  );

  return (
    <div
      className="flex h-[calc(100vh-8rem)] w-full overflow-hidden bg-bsky-bg-primary lg:h-[calc(100vh-4rem)]"
      role="main"
      aria-label="Direct Messages"
    >
      {/* Conversations list */}
      <nav
        className={`flex h-full flex-col overflow-hidden border-r border-bsky-border-primary ${selectedConversation ? "hidden md:flex" : "flex"}`}
        style={{
          width: selectedConversation ? "320px" : "100%",
          maxWidth: selectedConversation ? "320px" : "100%",
        }}
        aria-label="Conversations"
      >
        <div className="flex items-center justify-between border-b border-bsky-border-primary p-4">
          <h1
            className="text-xl font-semibold"
            style={{ color: "var(--bsky-text-primary)" }}
            id="messages-heading"
          >
            Messages
          </h1>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`rounded-lg p-2 transition-colors ${
              showSearch
                ? "bg-bsky-primary text-white"
                : "text-bsky-text-secondary hover:bg-bsky-bg-secondary"
            }`}
            aria-label={showSearch ? "Close search" : "Search messages"}
            title="Search messages"
          >
            {showSearch ? (
              <X className="h-5 w-5" />
            ) : (
              <Search className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Search panel */}
        {showSearch && (
          <div className="h-80 border-b border-bsky-border-primary">
            <DmSearch
              conversationId={selectedConversation || undefined}
              onResultClick={handleSearchResultClick}
              senders={indexedSenders}
            />
          </div>
        )}

        <div
          className="flex-1 overflow-y-auto overflow-x-hidden"
          role="list"
          aria-label="Conversation list"
        >
          {chatError ? (
            <div className="p-4">
              <div
                className="relative rounded-lg border border-amber-400 bg-amber-50 p-4 text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200"
                role="alert"
                aria-live="polite"
              >
                <h3 className="mb-2 font-bold">
                  App Password Required for DMs
                </h3>
                <p className="mb-3 text-sm">
                  Direct Messages require an app password with chat permissions.
                </p>
                <div className="space-y-2 text-sm">
                  <p className="font-semibold">To enable DMs:</p>
                  <ol className="ml-4 list-decimal space-y-1">
                    <li>
                      Go to{" "}
                      <a
                        href="https://bsky.app/settings/app-passwords"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:opacity-80"
                      >
                        Settings → App Passwords
                      </a>{" "}
                      on Bluesky
                    </li>
                    <li>
                      Create a new app password with "Direct Messages" enabled
                    </li>
                    <li>
                      Log out of shadowsky (click your profile → Settings → Log
                      out)
                    </li>
                    <li>
                      Log back in using your handle and the new app password
                    </li>
                  </ol>
                  <p className="mt-3 text-xs opacity-75">
                    Note: Regular passwords don't have access to the chat API
                    for security reasons.
                  </p>
                </div>
              </div>
            </div>
          ) : loadingConversations ? (
            <ConversationListSkeleton
              count={5}
              aria-label="Loading conversations"
            />
          ) : !conversations || conversations.length === 0 ? (
            <div
              className="p-4 text-center"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              No conversations yet
            </div>
          ) : (
            conversations.map((conversation: DmConversation) => {
              const otherMember = getOtherMember(conversation);
              return (
                <button
                  key={conversation.id}
                  onClick={() => setSelectedConversation(conversation.id)}
                  className={`w-full cursor-pointer overflow-hidden border-b border-bsky-border-primary p-4 text-left transition-colors duration-200 hover:bg-bsky-bg-secondary ${selectedConversation === conversation.id ? "bg-bsky-bg-secondary" : ""}`}
                  role="listitem"
                  aria-label={`Conversation with ${otherMember.displayName || otherMember.handle || "Unknown User"}${conversation.unreadCount > 0 ? `, ${conversation.unreadCount} unread messages` : ""}`}
                  aria-current={
                    selectedConversation === conversation.id
                      ? "true"
                      : undefined
                  }
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex-shrink-0">
                      {otherMember.avatar ? (
                        <img
                          src={otherMember.avatar}
                          alt={otherMember.handle || otherMember.did}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-300">
                          <span className="text-lg text-gray-600">
                            {(otherMember.displayName ||
                              otherMember.handle ||
                              "U")[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-1 break-words font-semibold text-bsky-text-primary">
                        {otherMember.displayName ||
                          otherMember.handle ||
                          "Unknown User"}
                      </div>
                      {otherMember.handle && (
                        <div className="line-clamp-1 break-words text-sm text-bsky-text-secondary">
                          @{otherMember.handle}
                        </div>
                      )}
                      {conversation.lastMessage && (
                        <div className="mt-1 line-clamp-1 break-words text-sm text-bsky-text-secondary">
                          {conversation.lastMessage.text}
                        </div>
                      )}
                    </div>
                    {conversation.unreadCount > 0 && (
                      <div
                        className="flex-shrink-0 rounded-full bg-bsky-primary px-2 py-0.5 text-center text-xs text-white"
                        aria-hidden="true"
                      >
                        {conversation.unreadCount}
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </nav>

      {/* Chat view */}
      <section
        className="flex h-full flex-1 flex-col overflow-hidden"
        aria-label={
          selectedConversation && conversationData
            ? `Chat with ${getOtherMember(conversationData.conversation).displayName || getOtherMember(conversationData.conversation).handle || "Unknown User"}`
            : "Select a conversation"
        }
      >
        {selectedConversation && conversationData ? (
          <>
            {/* Chat header */}
            <header className="flex items-center gap-3 border-b border-bsky-border-primary p-4">
              <button
                className="mr-4 inline-flex cursor-pointer items-center gap-2 border-none bg-transparent p-2 text-bsky-primary md:hidden"
                onClick={() => setSelectedConversation(null)}
                aria-label="Back to conversations list"
              >
                ← Back
              </button>
              {getOtherMember(conversationData.conversation).avatar ? (
                <img
                  src={getOtherMember(conversationData.conversation).avatar}
                  alt={
                    getOtherMember(conversationData.conversation).handle || ""
                  }
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-300">
                  <span className="text-lg text-gray-600">
                    {(getOtherMember(conversationData.conversation)
                      .displayName ||
                      getOtherMember(conversationData.conversation).handle ||
                      "U")[0].toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1">
                <div
                  className="font-semibold"
                  style={{ color: "var(--bsky-text-primary)" }}
                >
                  {getOtherMember(conversationData.conversation).displayName ||
                    getOtherMember(conversationData.conversation).handle ||
                    "Unknown User"}
                </div>
                {getOtherMember(conversationData.conversation).handle && (
                  <div
                    className="text-sm"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  >
                    @{getOtherMember(conversationData.conversation).handle}
                  </div>
                )}
              </div>
              {/* Search button in chat header for mobile */}
              <button
                onClick={() => setShowSearch(!showSearch)}
                className={`rounded-lg p-2 transition-colors md:hidden ${
                  showSearch
                    ? "bg-bsky-primary text-white"
                    : "text-bsky-text-secondary hover:bg-bsky-bg-secondary"
                }`}
                aria-label={showSearch ? "Close search" : "Search messages"}
              >
                {showSearch ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Search className="h-5 w-5" />
                )}
              </button>
            </header>

            {/* Mobile search panel */}
            {showSearch && (
              <div className="h-64 border-b border-bsky-border-primary md:hidden">
                <DmSearch
                  conversationId={selectedConversation}
                  onResultClick={handleSearchResultClick}
                  senders={indexedSenders}
                />
              </div>
            )}

            {/* Messages */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-4"
              role="log"
              aria-label="Message history"
              aria-live="polite"
            >
              {loadingMessages && !isQueueInitialized ? (
                <MessageListSkeleton count={5} aria-label="Loading messages" />
              ) : combinedMessages.length === 0 ? (
                <div
                  className="text-center"
                  style={{ color: "var(--bsky-text-secondary)" }}
                >
                  No messages yet. Start the conversation!
                </div>
              ) : (
                <>
                  {combinedMessages.map((message) => {
                    const isOwnMessage = message.sender.did === session?.did;
                    const isHighlighted = highlightedMessageId === message.id;
                    const messageKey = message._localId || message.id;
                    return (
                      <DMMessage
                        key={messageKey}
                        ref={(el) => setMessageRef(message.id, el)}
                        messageId={message.id}
                        text={message.text}
                        sentAt={message.sentAt}
                        isOwnMessage={isOwnMessage}
                        isHighlighted={isHighlighted}
                        conversationId={selectedConversation}
                        reactions={message.reactions}
                        localId={message._localId}
                        status={message._status}
                        retryCount={message._retryCount}
                        lastError={message._lastError}
                        isOptimistic={message._isOptimistic}
                        onRetry={retryMessage}
                      />
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Message input */}
            <div className="border-t border-bsky-border-primary p-4">
              <form
                onSubmit={handleSendMessage}
                className="flex gap-2"
                aria-label="Send message"
              >
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 rounded-lg border border-bsky-border-primary bg-bsky-bg-secondary px-4 py-2 text-base text-bsky-text-primary focus-visible:border-bsky-primary focus-visible:shadow-sm focus-visible:outline-none"
                  aria-label="Message text"
                />
                <button
                  type="submit"
                  disabled={!messageText.trim() || isSending}
                  className="cursor-pointer rounded-lg border-none bg-bsky-primary px-6 py-2 font-semibold text-white transition-colors duration-200 hover:bg-bsky-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={isSending ? "Sending message..." : "Send message"}
                >
                  Send
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-bsky-text-secondary">
            <div className="text-center">
              <h3 className="mb-2 text-xl font-semibold">Your Messages</h3>
              <p>Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
