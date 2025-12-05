import type { BskyAgent } from "@atproto/api";
import { debug } from "@bsky/shared";
import { API_RETRY_OPTIONS, fetchWithRetry } from "../utils/retry";

/**
 * Raw API response types for DM service
 */
interface ApiConvoMember {
  did: string;
  handle?: string;
  displayName?: string;
  avatar?: string;
}

interface ApiMessage {
  id: string;
  rev: string;
  text: string;
  sentAt: string;
  sender: {
    did: string;
  };
  facets?: ApiMessageFacet[];
}

interface ApiMessageFacet {
  $type: string;
}

interface ApiConvo {
  id: string;
  rev: string;
  members: ApiConvoMember[];
  muted?: boolean;
  unreadCount?: number;
  lastMessage?: ApiMessage;
}

interface ApiListConvosResponse {
  convos: ApiConvo[];
  cursor?: string;
}

interface ApiGetMessagesResponse {
  messages: ApiMessage[];
  cursor?: string;
}

interface ApiGetConvoResponse {
  convo: ApiConvo;
}

interface ApiError extends Error {
  status?: number;
  statusCode?: number;
}

export interface DmConversation {
  id: string;
  rev: string;
  members: {
    did: string;
    handle?: string;
    displayName?: string;
    avatar?: string;
  }[];
  muted: boolean;
  unreadCount: number;
  lastMessage?: {
    id: string;
    rev: string;
    text: string;
    sentAt: string;
    sender: {
      did: string;
    };
  };
}

export interface DmMessage {
  id: string;
  rev: string;
  text: string;
  sentAt: string;
  sender: {
    did: string;
  };
  reactions?: {
    [emoji: string]: {
      count: number;
      users: string[];
    };
  };
}

class DmService {
  private agent: BskyAgent | null = null;

  setAgent(agent: BskyAgent | null) {
    this.agent = agent;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    if (!this.agent) {
      throw new Error("Not authenticated");
    }

    // The session contains the access token
    const session = this.agent.session;
    if (!session?.accessJwt) {
      throw new Error("No access token available");
    }

    return {
      Authorization: `Bearer ${session.accessJwt}`,
    };
  }

  async listConversations(): Promise<DmConversation[]> {
    if (!this.agent) {
      throw new Error("Not authenticated");
    }

    try {
      // Always use direct HTTP request to the chat API
      // The chat API is separate from the user's PDS
      const headers = await this.getAuthHeaders();

      const apiResponse = await fetchWithRetry(
        "https://api.bsky.chat/xrpc/chat.bsky.convo.listConvos",
        {
          headers,
        },
        API_RETRY_OPTIONS,
      );

      const response = (await apiResponse.json()) as ApiListConvosResponse;

      return response.convos.map((convo: ApiConvo) => ({
        id: convo.id,
        rev: convo.rev,
        members: convo.members.map((member: ApiConvoMember) => ({
          did: member.did,
          handle: member.handle,
          displayName: member.displayName,
          avatar: member.avatar,
        })),
        muted: convo.muted || false,
        unreadCount: convo.unreadCount || 0,
        lastMessage: convo.lastMessage
          ? {
              id: convo.lastMessage.id,
              rev: convo.lastMessage.rev,
              text: convo.lastMessage.text,
              sentAt: convo.lastMessage.sentAt,
              sender: {
                did: convo.lastMessage.sender.did,
              },
            }
          : undefined,
      }));
    } catch (error: unknown) {
      const apiErr = error as ApiError;
      if (apiErr.status === 401 || apiErr.statusCode === 401) {
        throw new Error("Authentication required. Please sign in again.");
      }
      if (apiErr.status === 403 || apiErr.statusCode === 403) {
        throw new Error(
          "This app password doesn't have permission to access direct messages. Please create a new app password with Direct Messages enabled.",
        );
      }
      throw error;
    }
  }

  async getConversation(conversationId: string): Promise<{
    conversation: DmConversation;
    messages: DmMessage[];
  }> {
    if (!this.agent) {
      throw new Error("Not authenticated");
    }

    try {
      const headers = await this.getAuthHeaders();

      const messagesResponse = await fetchWithRetry(
        `https://api.bsky.chat/xrpc/chat.bsky.convo.getMessages?convoId=${conversationId}`,
        {
          headers,
        },
        API_RETRY_OPTIONS,
      );

      const messagesData = await messagesResponse.json();

      // Also get the conversation details
      const convoResponse = await fetchWithRetry(
        `https://api.bsky.chat/xrpc/chat.bsky.convo.getConvo?convoId=${conversationId}`,
        {
          headers,
        },
        API_RETRY_OPTIONS,
      );

      const convoData = await convoResponse.json();
      const convo = convoData.convo;

      const messages = messagesData.messages
        .map((msg: any) => ({
          id: msg.id,
          rev: msg.rev,
          text: msg.text,
          sentAt: msg.sentAt,
          sender: {
            did: msg.sender.did,
          },
          reactions: msg.facets?.reduce((acc: any, facet: any) => {
            if (facet.$type === "chat.bsky.convo.defs#messageFacet") {
              // Handle reactions if they exist
            }
            return acc;
          }, {}),
        }))
        .reverse(); // Reverse to show oldest first

      return {
        conversation: {
          id: convo.id,
          rev: convo.rev,
          members: convo.members.map((member: any) => ({
            did: member.did,
            handle: member.handle,
            displayName: member.displayName,
            avatar: member.avatar,
          })),
          muted: convo.muted || false,
          unreadCount: convo.unreadCount || 0,
          lastMessage: convo.lastMessage
            ? {
                id: convo.lastMessage.id,
                rev: convo.lastMessage.rev,
                text: convo.lastMessage.text,
                sentAt: convo.lastMessage.sentAt,
                sender: {
                  did: convo.lastMessage.sender.did,
                },
              }
            : undefined,
        },
        messages,
      };
    } catch (error: any) {
      debug.error("Failed to get conversation:", error);
      if (error.status === 401 || error.statusCode === 401) {
        throw new Error("Authentication required. Please sign in again.");
      }
      throw error;
    }
  }

  async sendMessage(conversationId: string, text: string): Promise<void> {
    if (!this.agent) {
      throw new Error("Not authenticated");
    }

    try {
      const headers = await this.getAuthHeaders();
      headers["Content-Type"] = "application/json";

      await fetchWithRetry(
        "https://api.bsky.chat/xrpc/chat.bsky.convo.sendMessage",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            convoId: conversationId,
            message: {
              text,
            },
          }),
        },
        API_RETRY_OPTIONS,
      );
    } catch (error: any) {
      debug.error("Failed to send message:", error);
      if (error.status === 401 || error.statusCode === 401) {
        throw new Error("Authentication required. Please sign in again.");
      }
      throw error;
    }
  }

  async updateRead(conversationId: string): Promise<void> {
    if (!this.agent) {
      throw new Error("Not authenticated");
    }

    try {
      const headers = await this.getAuthHeaders();
      headers["Content-Type"] = "application/json";

      // First get the conversation to get the latest message ID
      const convoResponse = await fetchWithRetry(
        `https://api.bsky.chat/xrpc/chat.bsky.convo.getConvo?convoId=${conversationId}`,
        {
          headers,
        },
        API_RETRY_OPTIONS,
      );

      const convoData = await convoResponse.json();
      const convo = convoData.convo;

      // If there's no last message or no unread count, nothing to update
      if (!convo.lastMessage || convo.unreadCount === 0) {
        return;
      }

      // Update read status
      await fetchWithRetry(
        "https://api.bsky.chat/xrpc/chat.bsky.convo.updateRead",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            convoId: conversationId,
            messageId: convo.lastMessage.id,
          }),
        },
        API_RETRY_OPTIONS,
      );
    } catch (error: any) {
      debug.error("Failed to update read status:", error);
      // Don't throw - marking as read is not critical
    }
  }

  async deleteMessage(
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    if (!this.agent) {
      throw new Error("Not authenticated");
    }

    try {
      const headers = await this.getAuthHeaders();
      headers["Content-Type"] = "application/json";

      await fetchWithRetry(
        "https://api.bsky.chat/xrpc/chat.bsky.convo.deleteMessage",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            convoId: conversationId,
            messageId,
          }),
        },
        API_RETRY_OPTIONS,
      );
    } catch (error: any) {
      debug.error("Failed to delete message:", error);
      if (error.status === 401 || error.statusCode === 401) {
        throw new Error("Authentication required. Please sign in again.");
      }
      throw error;
    }
  }

  async muteConversation(conversationId: string): Promise<void> {
    if (!this.agent) {
      throw new Error("Not authenticated");
    }

    try {
      const headers = await this.getAuthHeaders();
      headers["Content-Type"] = "application/json";

      await fetchWithRetry(
        "https://api.bsky.chat/xrpc/chat.bsky.convo.muteConvo",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            convoId: conversationId,
          }),
        },
        API_RETRY_OPTIONS,
      );
    } catch (error: any) {
      debug.error("Failed to mute conversation:", error);
      throw error;
    }
  }

  async unmuteConversation(conversationId: string): Promise<void> {
    if (!this.agent) {
      throw new Error("Not authenticated");
    }

    try {
      const headers = await this.getAuthHeaders();
      headers["Content-Type"] = "application/json";

      await fetchWithRetry(
        "https://api.bsky.chat/xrpc/chat.bsky.convo.unmuteConvo",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            convoId: conversationId,
          }),
        },
        API_RETRY_OPTIONS,
      );
    } catch (error: any) {
      debug.error("Failed to unmute conversation:", error);
      throw error;
    }
  }

  async addReaction(
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    // Note: This is a placeholder - the actual API endpoint may differ
    debug.warn(
      "addReaction is not yet implemented in Bluesky chat API",
      conversationId,
      messageId,
      emoji,
    );
  }

  async removeReaction(
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    // Note: This is a placeholder - the actual API endpoint may differ
    debug.warn(
      "removeReaction is not yet implemented in Bluesky chat API",
      conversationId,
      messageId,
      emoji,
    );
  }
}

export const dmService = new DmService();
