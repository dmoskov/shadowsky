import { debug } from "@bsky/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { dmService, type DmConversation } from "../services/dm-service";
import "../styles/direct-messages.css";

export const DirectMessages: React.FC = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(null);
  const [messageText, setMessageText] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations list
  const { data: conversations, isLoading: loadingConversations } = useQuery({
    queryKey: ["dm-conversations"],
    queryFn: () => dmService.listConversations(),
    refetchInterval: 30000, // Refresh every 30 seconds
    refetchIntervalInBackground: true,
    retry: 1,
  });

  // Handle errors
  useEffect(() => {
    if (conversations === undefined && !loadingConversations) {
      setChatError(
        'Your app password needs chat permissions. Please create a new app password with "Direct Messages" access enabled.',
      );
    }
  }, [conversations, loadingConversations]);

  // Fetch messages for selected conversation
  const {
    data: conversationData,
    isLoading: loadingMessages,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: ["dm-conversation", selectedConversation],
    queryFn: () =>
      selectedConversation
        ? dmService.getConversation(selectedConversation)
        : null,
    enabled: !!selectedConversation,
    refetchInterval: 5000, // Refresh every 5 seconds
    refetchIntervalInBackground: true,
  });

  // Refetch messages when a new message is sent
  useEffect(() => {
    if (selectedConversation && conversationData) {
      // Set up a more aggressive polling when conversation is active
      const interval = setInterval(() => {
        refetchMessages();
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [selectedConversation, conversationData, refetchMessages]);

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

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationData?.messages]);

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

  return (
    <div className="dm-container h-full">
      {/* Conversations list */}
      <div
        className={`dm-conversations-list ${selectedConversation ? "has-selection" : ""}`}
      >
        <div className="dm-conversations-header">
          <h2
            className="text-xl font-semibold"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            Messages
          </h2>
        </div>

        <div className="dm-conversations-scroll">
          {chatError ? (
            <div className="p-4">
              <div
                className="relative rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700 dark:border-red-700 dark:bg-red-900 dark:text-red-200"
                role="alert"
              >
                <strong className="font-bold">Chat Access Required</strong>
                <span className="block sm:inline"> {chatError}</span>
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
                  className={`dm-conversation-item ${selectedConversation === conversation.id ? "active" : ""}`}
                >
                  <div className="flex items-center">
                    {otherMember.avatar ? (
                      <img
                        src={otherMember.avatar}
                        alt={otherMember.handle || otherMember.did}
                        className="dm-conversation-avatar"
                      />
                    ) : (
                      <div className="dm-conversation-avatar flex items-center justify-center bg-gray-300">
                        <span className="text-lg text-gray-600">
                          {(otherMember.displayName ||
                            otherMember.handle ||
                            "U")[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="dm-conversation-info">
                      <div className="dm-conversation-name">
                        {otherMember.displayName ||
                          otherMember.handle ||
                          "Unknown User"}
                      </div>
                      {otherMember.handle && (
                        <div className="dm-conversation-handle">
                          @{otherMember.handle}
                        </div>
                      )}
                      {conversation.lastMessage && (
                        <div className="dm-conversation-preview">
                          {conversation.lastMessage.text}
                        </div>
                      )}
                    </div>
                    {conversation.unreadCount > 0 && (
                      <div className="dm-unread-badge">
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

      {/* Chat view */}
      <div className="dm-chat-container">
        {selectedConversation && conversationData ? (
          <>
            {/* Chat header */}
            <div className="dm-chat-header">
              <button
                className="dm-back-button md:hidden"
                onClick={() => setSelectedConversation(null)}
              >
                ← Back
              </button>
              {getOtherMember(conversationData.conversation).avatar ? (
                <img
                  src={getOtherMember(conversationData.conversation).avatar}
                  alt={
                    getOtherMember(conversationData.conversation).handle || ""
                  }
                  className="dm-conversation-avatar"
                />
              ) : (
                <div className="dm-conversation-avatar flex items-center justify-center bg-gray-300">
                  <span className="text-lg text-gray-600">
                    {(getOtherMember(conversationData.conversation)
                      .displayName ||
                      getOtherMember(conversationData.conversation).handle ||
                      "U")[0].toUpperCase()}
                  </span>
                </div>
              )}
              <div>
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
            </div>

            {/* Messages */}
            <div className="dm-messages-container">
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
                    return (
                      <div
                        key={message.id}
                        className={`dm-message ${isOwnMessage ? "own" : ""}`}
                      >
                        <div className="dm-message-bubble">
                          <div>{message.text}</div>
                          <div className="dm-message-time">
                            {formatDistanceToNow(new Date(message.sentAt), {
                              addSuffix: true,
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Message input */}
            <div className="dm-input-container">
              <form onSubmit={handleSendMessage} className="dm-input-form">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a message..."
                  className="dm-input"
                />
                <button
                  type="submit"
                  disabled={
                    !messageText.trim() || sendMessageMutation.isPending
                  }
                  className="dm-send-button"
                >
                  Send
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="dm-empty-state">
            <div className="text-center">
              <h3 className="mb-2 text-xl font-semibold">Your Messages</h3>
              <p>Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
