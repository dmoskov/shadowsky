import { debug } from "@bsky/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { dmService, type DmConversation } from "../services/dm-service";

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
    <div className="flex h-full overflow-hidden bg-bsky-bg-primary">
      {/* Conversations list */}
      <div
        className={`max-w-2/5 flex h-full w-80 min-w-60 flex-col border-r border-bsky-border-primary ${selectedConversation ? "hidden md:flex" : ""}`}
      >
        <div className="border-b border-bsky-border-primary p-4">
          <h2
            className="text-xl font-semibold"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            Messages
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto">
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
                  className={`cursor-pointer border-b border-bsky-border-primary p-4 transition-colors duration-200 hover:bg-bsky-bg-secondary ${selectedConversation === conversation.id ? "bg-bsky-bg-secondary" : ""}`}
                >
                  <div className="flex items-center">
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
                    <div className="ml-3 min-w-0 flex-1">
                      <div className="overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-bsky-text-primary">
                        {otherMember.displayName ||
                          otherMember.handle ||
                          "Unknown User"}
                      </div>
                      {otherMember.handle && (
                        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-sm text-bsky-text-secondary">
                          @{otherMember.handle}
                        </div>
                      )}
                      {conversation.lastMessage && (
                        <div className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-bsky-text-secondary">
                          {conversation.lastMessage.text}
                        </div>
                      )}
                    </div>
                    {conversation.unreadCount > 0 && (
                      <div className="min-w-5 rounded-full bg-bsky-primary px-2 py-0.5 text-center text-xs text-white">
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
      <div className="flex h-full flex-1 flex-col overflow-hidden">
        {selectedConversation && conversationData ? (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 border-b border-bsky-border-primary p-4">
              <button
                className="mr-4 inline-flex cursor-pointer items-center gap-2 border-none bg-transparent p-2 text-bsky-primary md:hidden"
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
            <div className="flex-1 overflow-y-auto p-4">
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
                        className={`mb-4 flex ${isOwnMessage ? "justify-end" : ""}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg p-2 px-4 ${isOwnMessage ? "bg-bsky-primary text-white" : "bg-bsky-bg-secondary text-bsky-text-primary"}`}
                        >
                          <div>{message.text}</div>
                          <div className="mt-1 text-xs opacity-70">
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
            <div className="border-t border-bsky-border-primary p-4">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 rounded-lg border border-bsky-border-primary bg-bsky-bg-secondary px-4 py-2 text-base text-bsky-text-primary focus:border-bsky-primary focus:shadow-sm focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={
                    !messageText.trim() || sendMessageMutation.isPending
                  }
                  className="cursor-pointer rounded-lg border-none bg-bsky-primary px-6 py-2 font-semibold text-white transition-colors duration-200 hover:bg-bsky-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
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
      </div>
    </div>
  );
};
