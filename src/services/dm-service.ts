import type { BskyAgent } from "@atproto/api";
import { debug } from "@bsky/shared";

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

      const apiResponse = await fetch(
        "https://api.bsky.chat/xrpc/chat.bsky.convo.listConvos",
        {
          headers,
        },
      );

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        throw new Error(
          `Failed to list conversations: ${apiResponse.status} ${apiResponse.statusText}. ${errorText}`,
        );
      }

      const response = await apiResponse.json();

      return response.convos.map((convo: any) => ({
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
      }));
    } catch (error) {
      debug.error("Failed to list conversations:", error);
      throw error;
    }
  }

  async getConversation(
    conversationId: string,
  ): Promise<{ conversation: DmConversation; messages: DmMessage[] }> {
    if (!this.agent) {
      throw new Error("Not authenticated");
    }

    try {
      const headers = await this.getAuthHeaders();

      // First get the conversation details
      const convoResponse = await fetch(
        `https://api.bsky.chat/xrpc/chat.bsky.convo.getConvo?convoId=${encodeURIComponent(conversationId)}`,
        {
          headers,
        },
      );

      if (!convoResponse.ok) {
        throw new Error(
          `Failed to get conversation: ${convoResponse.statusText}`,
        );
      }

      const convoData = await convoResponse.json();

      // Then get the messages
      const messagesResponse = await fetch(
        `https://api.bsky.chat/xrpc/chat.bsky.convo.getMessages?convoId=${encodeURIComponent(conversationId)}`,
        {
          headers,
        },
      );

      if (!messagesResponse.ok) {
        throw new Error(
          `Failed to get messages: ${messagesResponse.statusText}`,
        );
      }

      const messagesData = await messagesResponse.json();

      const conversation: DmConversation = {
        id: convoData.convo.id,
        rev: convoData.convo.rev,
        members: convoData.convo.members.map((member: any) => ({
          did: member.did,
          handle: member.handle,
          displayName: member.displayName,
          avatar: member.avatar,
        })),
        muted: convoData.convo.muted || false,
        unreadCount: convoData.convo.unreadCount || 0,
      };

      const messages: DmMessage[] = (messagesData.messages || []).map(
        (msg: any) => ({
          id: msg.id,
          rev: msg.rev,
          text: msg.text,
          sentAt: msg.sentAt,
          sender: {
            did: msg.sender.did,
          },
        }),
      );

      return { conversation, messages };
    } catch (error) {
      debug.error("Failed to get conversation:", error);
      throw error;
    }
  }

  async getOrCreateConversation(memberDid: string): Promise<DmConversation> {
    if (!this.agent) {
      throw new Error("Not authenticated");
    }

    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        "https://api.bsky.chat/xrpc/chat.bsky.convo.getConvoForMembers",
        {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            members: [memberDid],
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Failed to get or create conversation: ${response.statusText}`,
        );
      }

      const data = await response.json();

      return {
        id: data.convo.id,
        rev: data.convo.rev,
        members: data.convo.members.map((member: any) => ({
          did: member.did,
          handle: member.handle,
          displayName: member.displayName,
          avatar: member.avatar,
        })),
        muted: data.convo.muted || false,
        unreadCount: data.convo.unreadCount || 0,
      };
    } catch (error) {
      debug.error("Failed to get or create conversation:", error);
      throw error;
    }
  }

  async sendMessage(conversationId: string, text: string): Promise<DmMessage> {
    if (!this.agent) {
      throw new Error("Not authenticated");
    }

    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        "https://api.bsky.chat/xrpc/chat.bsky.convo.sendMessage",
        {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            convoId: conversationId,
            message: {
              text: text,
              $type: "chat.bsky.convo.defs#messageInput",
            },
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        debug.error("Send message error response:", errorText);
        throw new Error(`Failed to send message: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        id: data.id,
        rev: data.rev,
        text: text,
        sentAt: new Date().toISOString(),
        sender: {
          did: this.agent.session?.did || "",
        },
      };
    } catch (error) {
      debug.error("Failed to send message:", error);
      throw error;
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
      const response = await fetch(
        "https://api.bsky.chat/xrpc/chat.bsky.convo.deleteMessageForSelf",
        {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            convoId: conversationId,
            messageId: messageId,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to delete message: ${response.statusText}`);
      }
    } catch (error) {
      debug.error("Failed to delete message:", error);
      throw error;
    }
  }

  async muteConversation(conversationId: string): Promise<void> {
    if (!this.agent) {
      throw new Error("Not authenticated");
    }

    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        "https://api.bsky.chat/xrpc/chat.bsky.convo.muteConvo",
        {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            convoId: conversationId,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to mute conversation: ${response.statusText}`);
      }
    } catch (error) {
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
      const response = await fetch(
        "https://api.bsky.chat/xrpc/chat.bsky.convo.unmuteConvo",
        {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            convoId: conversationId,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Failed to unmute conversation: ${response.statusText}`,
        );
      }
    } catch (error) {
      debug.error("Failed to unmute conversation:", error);
      throw error;
    }
  }

  async leaveConversation(conversationId: string): Promise<void> {
    if (!this.agent) {
      throw new Error("Not authenticated");
    }

    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        "https://api.bsky.chat/xrpc/chat.bsky.convo.leaveConvo",
        {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            convoId: conversationId,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to leave conversation: ${response.statusText}`);
      }
    } catch (error) {
      debug.error("Failed to leave conversation:", error);
      throw error;
    }
  }
}

export const dmService = new DmService();
