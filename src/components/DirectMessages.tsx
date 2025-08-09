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
    <div className="flex h-full bg-bsky-bg-primary overflow-hidden">
      {/* Conversations list */}
      <div
        className={`w-80 min-w-60 max-w-2/5 border-r border-bsky-border-primary flex flex-col h-full ${selectedConversation ? "hidden md:flex" : ""}`}
      >
        <div className="p-4 border-b border-bsky-border-primary">
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
                  className={`p-4 border-b border-bsky-border-primary cursor-pointer transition-colors duration-200 hover:bg-bsky-bg-secondary ${selectedConversation === conversation.id ? "bg-bsky-bg-secondary" : ""}`}
                >
                  <div className="flex items-center">
                    {otherMember.avatar ? (
                      <img
                        src={otherMember.avatar}
                        alt={otherMember.handle || otherMember.did}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-300">
                        <span className="text-lg text-gray-600">
                          {(otherMember.displayName ||
                            otherMember.handle ||
                            "U")[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0 ml-3">
                      <div className="font-semibold text-bsky-text-primary whitespace-nowrap overflow-hidden text-ellipsis">
                        {otherMember.displayName ||
                          otherMember.handle ||
                          "Unknown User"}
                      </div>
                      {otherMember.handle && (
                        <div className="text-sm text-bsky-text-secondary whitespace-nowrap overflow-hidden text-ellipsis">
                          @{otherMember.handle}
                        </div>
                      )}
                      {conversation.lastMessage && (
                        <div className="text-sm text-bsky-text-secondary whitespace-nowrap overflow-hidden text-ellipsis mt-1">
                          {conversation.lastMessage.text}
                        </div>
                      )}
                    </div>
                    {conversation.unreadCount > 0 && (
                      <div className="bg-bsky-primary text-white text-xs rounded-full py-0.5 px-2 min-w-5 text-center">
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
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {selectedConversation && conversationData ? (
          <>
            {/* Chat header */}
            <div className="p-4 border-b border-bsky-border-primary flex items-center gap-3">
              <button
                className="inline-flex items-center gap-2 p-2 mr-4 bg-transparent border-none text-bsky-primary cursor-pointer md:hidden"
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
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-300">
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
                        <div className={`max-w-[70%] rounded-lg p-2 px-4 ${isOwnMessage ? "bg-bsky-primary text-white" : "bg-bsky-bg-secondary text-bsky-text-primary"}`}>
                          <div>{message.text}</div>
                          <div className="text-xs mt-1 opacity-70">
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
            <div className="p-4 border-t border-bsky-border-primary">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 py-2 px-4 rounded-lg border border-bsky-border-primary bg-bsky-bg-secondary text-bsky-text-primary text-base focus:outline-none focus:border-bsky-primary focus:shadow-sm"
                />
                <button
                  type="submit"
                  disabled={
                    !messageText.trim() || sendMessageMutation.isPending
                  }
                  className="py-2 px-6 bg-bsky-primary text-white border-none rounded-lg font-semibold cursor-pointer transition-colors duration-200 hover:bg-bsky-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-bsky-text-secondary">
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
