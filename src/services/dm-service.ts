import type { BskyAgent } from '@atproto/api'
import { debug } from '@bsky/shared'

export interface DmConversation {
  id: string
  rev: string
  members: {
    did: string
    handle?: string
    displayName?: string
    avatar?: string
  }[]
  muted: boolean
  unreadCount: number
  lastMessage?: {
    id: string
    rev: string
    text: string
    sentAt: string
    sender: {
      did: string
    }
  }
}

export interface DmMessage {
  id: string
  rev: string
  text: string
  sentAt: string
  sender: {
    did: string
  }
}

class DmService {
  private agent: BskyAgent | null = null
  private chatProxy: any = null

  setAgent(agent: BskyAgent | null) {
    this.agent = agent
    if (agent) {
      // The chat proxy is accessed through withProxy method on the agent
      // This requires the app password to have chat access permissions
      this.chatProxy = (agent as any).withProxy('chat_proxy', 'did:web:api.bsky.chat') || 
                      (agent as any).api?.chat?.bsky ||
                      null
    } else {
      this.chatProxy = null
    }
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    if (!this.agent) {
      throw new Error('Not authenticated')
    }

    // The session contains the access token
    const session = this.agent.session
    if (!session?.accessJwt) {
      throw new Error('No access token available')
    }

    return {
      'Authorization': `Bearer ${session.accessJwt}`
    }
  }

  async listConversations(): Promise<DmConversation[]> {
    if (!this.agent || !this.chatProxy) {
      throw new Error('Chat API not available. Make sure your app password has chat permissions.')
    }

    try {
      // Try different methods to access the chat API
      let response
      
      // Method 1: Direct chat proxy access
      if (this.chatProxy.convo?.listConvos) {
        response = await this.chatProxy.convo.listConvos()
      }
      // Method 2: Through API namespace
      else if ((this.agent as any).api?.chat?.bsky?.convo?.listConvos) {
        response = await (this.agent as any).api.chat.bsky.convo.listConvos()
      }
      // Method 3: HTTP request fallback
      else {
        const headers = await this.getAuthHeaders()
        const apiResponse = await fetch('https://api.bsky.chat/xrpc/chat.bsky.convo.listConvos', {
          headers
        })
        
        if (!apiResponse.ok) {
          throw new Error(`Failed to list conversations: ${apiResponse.statusText}`)
        }
        
        response = { data: await apiResponse.json() }
      }
      
      return response.data.convos.map((convo: any) => ({
        id: convo.id,
        rev: convo.rev,
        members: convo.members.map((member: any) => ({
          did: member.did,
          handle: member.handle,
          displayName: member.displayName,
          avatar: member.avatar
        })),
        muted: convo.muted || false,
        unreadCount: convo.unreadCount || 0,
        lastMessage: convo.lastMessage ? {
          id: convo.lastMessage.id,
          rev: convo.lastMessage.rev,
          text: convo.lastMessage.text,
          sentAt: convo.lastMessage.sentAt,
          sender: {
            did: convo.lastMessage.sender.did
          }
        } : undefined
      }))
    } catch (error) {
      debug.error('Failed to list conversations:', error)
      throw error
    }
  }

  async getConversation(conversationId: string): Promise<{ conversation: DmConversation; messages: DmMessage[] }> {
    if (!this.agent) {
      throw new Error('Not authenticated')
    }

    try {
      const headers = await this.agent.createAuthHeaders()
      const response = await fetch(`https://api.bsky.chat/xrpc/chat.bsky.convo.getConvo?convoId=${encodeURIComponent(conversationId)}`, {
        headers
      })
      
      if (!response.ok) {
        throw new Error(`Failed to get conversation: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      const conversation: DmConversation = {
        id: data.convo.id,
        rev: data.convo.rev,
        members: data.convo.members.map((member: any) => ({
          did: member.did,
          handle: member.handle,
          displayName: member.displayName,
          avatar: member.avatar
        })),
        muted: data.convo.muted || false,
        unreadCount: data.convo.unreadCount || 0
      }

      const messages: DmMessage[] = data.messages.map((msg: any) => ({
        id: msg.id,
        rev: msg.rev,
        text: msg.text,
        sentAt: msg.sentAt,
        sender: {
          did: msg.sender.did
        }
      }))

      return { conversation, messages }
    } catch (error) {
      debug.error('Failed to get conversation:', error)
      throw error
    }
  }

  async getOrCreateConversation(memberDid: string): Promise<DmConversation> {
    if (!this.agent) {
      throw new Error('Not authenticated')
    }

    try {
      const headers = await this.agent.createAuthHeaders()
      const response = await fetch('https://api.bsky.chat/xrpc/chat.bsky.convo.getConvoForMembers', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          members: [memberDid]
        })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to get or create conversation: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      return {
        id: data.convo.id,
        rev: data.convo.rev,
        members: data.convo.members.map((member: any) => ({
          did: member.did,
          handle: member.handle,
          displayName: member.displayName,
          avatar: member.avatar
        })),
        muted: data.convo.muted || false,
        unreadCount: data.convo.unreadCount || 0
      }
    } catch (error) {
      debug.error('Failed to get or create conversation:', error)
      throw error
    }
  }

  async sendMessage(conversationId: string, text: string): Promise<DmMessage> {
    if (!this.agent) {
      throw new Error('Not authenticated')
    }

    try {
      const headers = await this.agent.createAuthHeaders()
      const response = await fetch('https://api.bsky.chat/xrpc/chat.bsky.convo.sendMessage', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          convoId: conversationId,
          message: {
            text: text,
            $type: 'chat.bsky.convo.defs#messageInput'
          }
        })
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        debug.error('Send message error response:', errorText)
        throw new Error(`Failed to send message: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      return {
        id: data.id,
        rev: data.rev,
        text: text,
        sentAt: new Date().toISOString(),
        sender: {
          did: this.agent.session?.did || ''
        }
      }
    } catch (error) {
      debug.error('Failed to send message:', error)
      throw error
    }
  }

  async deleteMessage(conversationId: string, messageId: string): Promise<void> {
    if (!this.agent) {
      throw new Error('Not authenticated')
    }

    try {
      const headers = await this.agent.createAuthHeaders()
      const response = await fetch('https://api.bsky.chat/xrpc/chat.bsky.convo.deleteMessageForSelf', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          convoId: conversationId,
          messageId: messageId
        })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to delete message: ${response.statusText}`)
      }
    } catch (error) {
      debug.error('Failed to delete message:', error)
      throw error
    }
  }

  async muteConversation(conversationId: string): Promise<void> {
    if (!this.agent) {
      throw new Error('Not authenticated')
    }

    try {
      const headers = await this.agent.createAuthHeaders()
      const response = await fetch('https://api.bsky.chat/xrpc/chat.bsky.convo.muteConvo', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          convoId: conversationId
        })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to mute conversation: ${response.statusText}`)
      }
    } catch (error) {
      debug.error('Failed to mute conversation:', error)
      throw error
    }
  }

  async unmuteConversation(conversationId: string): Promise<void> {
    if (!this.agent) {
      throw new Error('Not authenticated')
    }

    try {
      const headers = await this.agent.createAuthHeaders()
      const response = await fetch('https://api.bsky.chat/xrpc/chat.bsky.convo.unmuteConvo', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          convoId: conversationId
        })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to unmute conversation: ${response.statusText}`)
      }
    } catch (error) {
      debug.error('Failed to unmute conversation:', error)
      throw error
    }
  }

  async leaveConversation(conversationId: string): Promise<void> {
    if (!this.agent) {
      throw new Error('Not authenticated')
    }

    try {
      const headers = await this.agent.createAuthHeaders()
      const response = await fetch('https://api.bsky.chat/xrpc/chat.bsky.convo.leaveConvo', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          convoId: conversationId
        })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to leave conversation: ${response.statusText}`)
      }
    } catch (error) {
      debug.error('Failed to leave conversation:', error)
      throw error
    }
  }
}

export const dmService = new DmService()