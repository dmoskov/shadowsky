import { BskyAgent } from "@atproto/api";
import { withRetry } from "../utils/with-retry";

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
  embed?: DmMessageEmbed;
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

export interface DmMessageEmbed {
  $type: string;
  images?: {
    image: {
      ref: { $link: string };
      mimeType: string;
      size: number;
    };
    alt: string;
  }[];
}

export interface DmMessage {
  id: string;
  rev: string;
  text: string;
  sentAt: string;
  sender: {
    did: string;
  };
  embed?: DmMessageEmbed;
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

    return withRetry(async () => {
      try {
        const headers = await this.getAuthHeaders();

        const response = await fetch(
          "https://api.bsky.chat/xrpc/chat.bsky.convo.listConvos",
          {
            headers,
          }
        );

        if (!response.ok) {
          const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
          error.status = response.status;
          throw error;
        }

        const data = (await response.json()) as ApiListConvosResponse;

        return data.convos.map((convo: ApiConvo) => ({
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
            "This app password doesn't have permission to access direct messages. Please create a new app password with Direct Messages enabled."
          );
        }
        throw error;
      }
    });
  }

  async getConversation(conversationId: string): Promise<{
    conversation: DmConversation;
    messages: DmMessage[];
  }> {
    if (!this.agent) {
      throw new Error("Not authenticated");
    }

    return withRetry(async () => {
      try {
        const headers = await this.getAuthHeaders();

        const messagesResponse = await fetch(
          `https://api.bsky.chat/xrpc/chat.bsky.convo.getMessages?convoId=${conversationId}`,
          {
            headers,
          }
        );

        if (!messagesResponse.ok) {
          const error: any = new Error(
            `HTTP ${messagesResponse.status}: ${messagesResponse.statusText}`
          );
          error.status = messagesResponse.status;
          throw error;
        }

        const messagesData =
          (await messagesResponse.json()) as ApiGetMessagesResponse;

        const convoResponse = await fetch(
          `https://api.bsky.chat/xrpc/chat.bsky.convo.getConvo?convoId=${conversationId}`,
          {
            headers,
          }
        );

        if (!convoResponse.ok) {
          const error: any = new Error(
            `HTTP ${convoResponse.status}: ${convoResponse.statusText}`
          );
          error.status = convoResponse.status;
          throw error;
        }

        const convoData = (await convoResponse.json()) as ApiGetConvoResponse;
        const convo = convoData.convo;

        const messages = messagesData.messages
          .map((msg: ApiMessage) => ({
            id: msg.id,
            rev: msg.rev,
            text: msg.text,
            sentAt: msg.sentAt,
            sender: {
              did: msg.sender.did,
            },
            embed: msg.embed,
          }))
          .reverse(); // Reverse to show oldest first

        return {
          conversation: {
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
          },
          messages,
        };
      } catch (error: unknown) {
        console.error("Failed to get conversation:", error);
        const apiErr = error as ApiError;
        if (apiErr.status === 401 || apiErr.statusCode === 401) {
          throw new Error("Authentication required. Please sign in again.");
        }
        throw error;
      }
    });
  }

  async uploadBlob(uri: string): Promise<{ ref: { $link: string }; mimeType: string; size: number }> {
    if (!this.agent) {
      throw new Error("Not authenticated");
    }

    return withRetry(async () => {
      // Fetch the media file
      const response = await fetch(uri);
      const blob = await response.blob();

      // Convert blob to Uint8Array for upload
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      const uploadResponse = await this.agent!.uploadBlob(uint8Array, {
        encoding: blob.type,
      });

      return uploadResponse.data.blob;
    });
  }

  async sendMessage(
    conversationId: string,
    text: string,
    images?: { uri: string; alt: string }[]
  ): Promise<void> {
    if (!this.agent) {
      throw new Error("Not authenticated");
    }

    return withRetry(async () => {
      try {
        const headers = await this.getAuthHeaders();
        headers["Content-Type"] = "application/json";

        const message: any = {
          text,
        };

        // Upload images if provided
        if (images && images.length > 0) {
          const imageBlobs = await Promise.all(
            images.map(async (img) => {
              const blob = await this.uploadBlob(img.uri);
              return {
                image: blob,
                alt: img.alt || "",
              };
            })
          );

          message.embed = {
            $type: "chat.bsky.convo.defs#messageEmbed",
            images: imageBlobs,
          };
        }

        const response = await fetch(
          "https://api.bsky.chat/xrpc/chat.bsky.convo.sendMessage",
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              convoId: conversationId,
              message,
            }),
          }
        );

        if (!response.ok) {
          const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
          error.status = response.status;
          throw error;
        }
      } catch (error: unknown) {
        console.error("Failed to send message:", error);
        const apiErr = error as ApiError;
        if (apiErr.status === 401 || apiErr.statusCode === 401) {
          throw new Error("Authentication required. Please sign in again.");
        }
        throw error;
      }
    });
  }

  async updateRead(conversationId: string): Promise<void> {
    if (!this.agent) {
      throw new Error("Not authenticated");
    }

    try {
      const headers = await this.getAuthHeaders();
      headers["Content-Type"] = "application/json";

      const convoResponse = await fetch(
        `https://api.bsky.chat/xrpc/chat.bsky.convo.getConvo?convoId=${conversationId}`,
        {
          headers,
        }
      );

      if (!convoResponse.ok) {
        return;
      }

      const convoData = await convoResponse.json();
      const convo = convoData.convo;

      if (!convo.lastMessage || convo.unreadCount === 0) {
        return;
      }

      await fetch("https://api.bsky.chat/xrpc/chat.bsky.convo.updateRead", {
        method: "POST",
        headers,
        body: JSON.stringify({
          convoId: conversationId,
          messageId: convo.lastMessage.id,
        }),
      });
    } catch (error: unknown) {
      console.error("Failed to update read status:", error);
      // Don't throw - marking as read is not critical
    }
  }

  /**
   * Get or create a conversation with specified members
   * This will find an existing conversation or create a new one
   */
  async getConvoForMembers(memberDids: string[]): Promise<DmConversation> {
    if (!this.agent) {
      throw new Error("Not authenticated");
    }

    return withRetry(async () => {
      try {
        const headers = await this.getAuthHeaders();
        headers["Content-Type"] = "application/json";

        const response = await fetch(
          "https://api.bsky.chat/xrpc/chat.bsky.convo.getConvoForMembers",
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              members: memberDids,
            }),
          }
        );

        if (!response.ok) {
          const error: any = new Error(
            `HTTP ${response.status}: ${response.statusText}`
          );
          error.status = response.status;
          throw error;
        }

        const data = (await response.json()) as ApiGetConvoResponse;
        const convo = data.convo;

        return {
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
        };
      } catch (error: unknown) {
        console.error("Failed to get conversation for members:", error);
        const apiErr = error as ApiError;
        if (apiErr.status === 401 || apiErr.statusCode === 401) {
          throw new Error("Authentication required. Please sign in again.");
        }
        if (apiErr.status === 403 || apiErr.statusCode === 403) {
          throw new Error(
            "This app password doesn't have permission to access direct messages. Please create a new app password with Direct Messages enabled."
          );
        }
        throw error;
      }
    });
  }

  /**
   * Mute a conversation
   */
  async muteConversation(conversationId: string): Promise<void> {
    if (!this.agent) {
      throw new Error("Not authenticated");
    }

    return withRetry(async () => {
      try {
        const headers = await this.getAuthHeaders();
        headers["Content-Type"] = "application/json";

        const response = await fetch(
          "https://api.bsky.chat/xrpc/chat.bsky.convo.muteConvo",
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              convoId: conversationId,
            }),
          }
        );

        if (!response.ok) {
          const error: any = new Error(
            `HTTP ${response.status}: ${response.statusText}`
          );
          error.status = response.status;
          throw error;
        }
      } catch (error: unknown) {
        console.error("Failed to mute conversation:", error);
        const apiErr = error as ApiError;
        if (apiErr.status === 401 || apiErr.statusCode === 401) {
          throw new Error("Authentication required. Please sign in again.");
        }
        throw error;
      }
    });
  }

  /**
   * Unmute a conversation
   */
  async unmuteConversation(conversationId: string): Promise<void> {
    if (!this.agent) {
      throw new Error("Not authenticated");
    }

    return withRetry(async () => {
      try {
        const headers = await this.getAuthHeaders();
        headers["Content-Type"] = "application/json";

        const response = await fetch(
          "https://api.bsky.chat/xrpc/chat.bsky.convo.unmuteConvo",
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              convoId: conversationId,
            }),
          }
        );

        if (!response.ok) {
          const error: any = new Error(
            `HTTP ${response.status}: ${response.statusText}`
          );
          error.status = response.status;
          throw error;
        }
      } catch (error: unknown) {
        console.error("Failed to unmute conversation:", error);
        const apiErr = error as ApiError;
        if (apiErr.status === 401 || apiErr.statusCode === 401) {
          throw new Error("Authentication required. Please sign in again.");
        }
        throw error;
      }
    });
  }

  /**
   * Leave (delete) a conversation
   */
  async leaveConversation(conversationId: string): Promise<void> {
    if (!this.agent) {
      throw new Error("Not authenticated");
    }

    return withRetry(async () => {
      try {
        const headers = await this.getAuthHeaders();
        headers["Content-Type"] = "application/json";

        const response = await fetch(
          "https://api.bsky.chat/xrpc/chat.bsky.convo.leaveConvo",
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              convoId: conversationId,
            }),
          }
        );

        if (!response.ok) {
          const error: any = new Error(
            `HTTP ${response.status}: ${response.statusText}`
          );
          error.status = response.status;
          throw error;
        }
      } catch (error: unknown) {
        console.error("Failed to leave conversation:", error);
        const apiErr = error as ApiError;
        if (apiErr.status === 401 || apiErr.statusCode === 401) {
          throw new Error("Authentication required. Please sign in again.");
        }
        throw error;
      }
    });
  }
}

export const dmService = new DmService();
