import { debug } from "@bsky/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Search, X } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getDmSearchDB } from "../services/dm-search-db";
import { dmService, type DmConversation } from "../services/dm-service";
import { DmSearch } from "./DmSearch";
import { MessageReactions } from "./MessageReactions";
import { ProfileHoverCard } from "./ui/ProfileHoverCard";

export const DirectMessagesColumn: React.FC = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(null);
  const [messageText, setMessageText] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
  // Cleanup and re-add listeners when selectedConversation changes to prevent accumulation
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
  }, [updateActivity, selectedConversation]);

  // Fetch conversations list with dynamic polling
  const {
    data: conversations,
    isLoading: loadingConversations,
    error: conversationsError,
  } = useQuery({
    queryKey: ["dm-conversations"],
    queryFn: () => dmService.listConversations(),
    refetchInterval: getPollingInterval,
    enabled: isTabVisible,
    retry: 1,
  });

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
  const { data: conversationData, isLoading: loadingMessages } = useQuery({
    queryKey: ["dm-conversation", selectedConversation],
    queryFn: () =>
      selectedConversation
        ? dmService.getConversation(selectedConversation)
        : null,
    enabled: !!selectedConversation && isTabVisible,
    refetchInterval: selectedConversation ? getPollingInterval : false,
  });

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

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: ({
      conversationId,
      text,
    }: {
      conversationId: string;
      text: string;
    }) => dmService.sendMessage(conversationId, text),
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({
        queryKey: ["dm-conversation", selectedConversation],
      });
      queryClient.invalidateQueries({ queryKey: ["dm-conversations"] });
    },
    onError: (error) => {
      debug.error("Failed to send message:", error);
    },
  });

  // Scroll to bottom when messages change (unless highlighted)
  useEffect(() => {
    if (!highlightedMessageId) {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [conversationData?.messages, highlightedMessageId]);

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

      // Close search panel
      setShowSearch(false);

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

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConversation || !messageText.trim()) return;

    sendMessageMutation.mutate({
      conversationId: selectedConversation,
      text: messageText.trim(),
    });
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

  // In column mode, show either conversations list OR chat view
  if (!selectedConversation) {
    // Show conversations list
    return (
      <div className="flex h-full flex-col overflow-hidden bg-bsky-bg-primary">
        <div className="flex items-center justify-between border-b border-bsky-border-primary p-4">
          <h2
            className="text-xl font-semibold"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            Messages
          </h2>
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
              onResultClick={handleSearchResultClick}
              senders={indexedSenders}
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {chatError ? (
            <div className="p-4">
              <div
                className="relative rounded-lg border border-amber-400 bg-amber-50 p-4 text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200"
                role="alert"
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
            <div
              className="p-4 text-center"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              Loading conversations...
            </div>
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
                <div
                  key={conversation.id}
                  onClick={() => setSelectedConversation(conversation.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setSelectedConversation(conversation.id);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  className={`cursor-pointer overflow-hidden border-b border-bsky-border-primary p-4 transition-colors duration-200 hover:bg-bsky-bg-secondary focus:outline-none focus:ring-2 focus:ring-bsky-primary`}
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
                      <div className="flex-shrink-0 rounded-full bg-bsky-primary px-2 py-0.5 text-center text-xs text-white">
                        {conversation.unreadCount}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // Show chat view
  if (!conversationData) {
    return (
      <div className="flex h-full items-center justify-center bg-bsky-bg-primary">
        <div className="text-center text-bsky-text-secondary">
          <p>Loading conversation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bsky-bg-primary">
      {/* Chat header */}
      <div className="flex items-center gap-3 border-b border-bsky-border-primary p-4">
        <button
          className="inline-flex cursor-pointer items-center gap-2 border-none bg-transparent p-2 text-bsky-primary"
          onClick={() => setSelectedConversation(null)}
        >
          ← Back
        </button>
        {(() => {
          const member = getOtherMember(conversationData.conversation);
          const memberHandle = member.handle;
          return memberHandle ? (
            <ProfileHoverCard handle={memberHandle}>
              {member.avatar ? (
                <img
                  src={member.avatar}
                  alt={memberHandle}
                  className="h-10 w-10 cursor-pointer rounded-full object-cover transition-opacity hover:opacity-80"
                />
              ) : (
                <div className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-gray-300 transition-opacity hover:opacity-80">
                  <span className="text-lg text-gray-600">
                    {(member.displayName ||
                      memberHandle ||
                      "U")[0].toUpperCase()}
                  </span>
                </div>
              )}
            </ProfileHoverCard>
          ) : member.avatar ? (
            <img
              src={member.avatar}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-300">
              <span className="text-lg text-gray-600">
                {(member.displayName || "U")[0].toUpperCase()}
              </span>
            </div>
          );
        })()}
        {(() => {
          const member = getOtherMember(conversationData.conversation);
          const memberHandle = member.handle;
          return (
            <div className="flex-1">
              {memberHandle ? (
                <ProfileHoverCard handle={memberHandle}>
                  <div
                    className="cursor-pointer font-semibold hover:underline"
                    style={{ color: "var(--bsky-text-primary)" }}
                  >
                    {member.displayName || memberHandle || "Unknown User"}
                  </div>
                </ProfileHoverCard>
              ) : (
                <div
                  className="font-semibold"
                  style={{ color: "var(--bsky-text-primary)" }}
                >
                  {member.displayName || "Unknown User"}
                </div>
              )}
              {memberHandle && (
                <ProfileHoverCard handle={memberHandle}>
                  <div
                    className="cursor-pointer text-sm hover:underline"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  >
                    @{memberHandle}
                  </div>
                </ProfileHoverCard>
              )}
            </div>
          );
        })()}
        {/* Search button in chat header */}
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
        <div className="h-64 border-b border-bsky-border-primary">
          <DmSearch
            conversationId={selectedConversation}
            onResultClick={handleSearchResultClick}
            senders={indexedSenders}
          />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
        {loadingMessages ? (
          <div
            className="text-center"
            style={{ color: "var(--bsky-text-secondary)" }}
          >
            Loading messages...
          </div>
        ) : conversationData.messages.length === 0 ? (
          <div
            className="text-center"
            style={{ color: "var(--bsky-text-secondary)" }}
          >
            No messages yet. Start the conversation!
          </div>
        ) : (
          <>
            {conversationData.messages.map((message) => {
              const isOwnMessage = message.sender.did === session?.did;
              const isHighlighted = highlightedMessageId === message.id;
              return (
                <div
                  key={message.id}
                  ref={(el) => setMessageRef(message.id, el)}
                  className={`mb-4 flex transition-all duration-500 ${isOwnMessage ? "justify-end" : ""} ${
                    isHighlighted
                      ? "rounded-lg bg-yellow-100 p-2 ring-2 ring-yellow-400 dark:bg-yellow-900/30 dark:ring-yellow-600"
                      : ""
                  }`}
                  data-message-id={message.id}
                >
                  <div className="max-w-[70%]">
                    <div
                      className={`rounded-lg p-2 px-4 ${isOwnMessage ? "bg-bsky-primary text-white" : "bg-bsky-bg-secondary text-bsky-text-primary"}`}
                    >
                      <div className="break-words">{message.text}</div>
                      <div className="mt-1 text-xs opacity-70">
                        {formatDistanceToNow(new Date(message.sentAt), {
                          addSuffix: true,
                        })}
                      </div>
                    </div>
                    <MessageReactions
                      conversationId={selectedConversation}
                      messageId={message.id}
                      reactions={message.reactions}
                      isOwnMessage={isOwnMessage}
                    />
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message input */}
      <div className="border-t border-bsky-border-primary p-4">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Type a message..."
            className="min-w-0 flex-1 rounded-lg border border-bsky-border-primary bg-bsky-bg-secondary px-4 py-2 text-base text-bsky-text-primary focus:border-bsky-primary focus:shadow-sm focus:outline-none"
          />
          <button
            type="submit"
            disabled={!messageText.trim() || sendMessageMutation.isPending}
            className="flex-shrink-0 cursor-pointer rounded-lg border-none bg-bsky-primary px-4 py-2 font-semibold text-white transition-colors duration-200 hover:bg-bsky-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};
