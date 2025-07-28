import { ChatBskyConvoDefs } from '@atproto/api'
import { debug } from '@bsky/shared'

type Conversation = ChatBskyConvoDefs.ConvoView
type Message = ChatBskyConvoDefs.MessageView

interface ConversationCache {
  conversations: Conversation[]
  timestamp: number
}

interface MessageCache {
  messages: Message[]
  timestamp: number
}

const CONVERSATION_CACHE_KEY = 'bsky_conversations_cache'
const MESSAGE_CACHE_PREFIX = 'bsky_messages_'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export class ConversationCacheManager {
  /**
   * Save conversations to local storage
   */
  static saveConversations(conversations: Conversation[]): void {
    try {
      const cache: ConversationCache = {
        conversations,
        timestamp: Date.now()
      }
      localStorage.setItem(CONVERSATION_CACHE_KEY, JSON.stringify(cache))
    } catch (error) {
      debug.error('Failed to cache conversations:', error)
    }
  }
  
  /**
   * Load conversations from local storage
   */
  static loadConversations(): Conversation[] | null {
    try {
      const cached = localStorage.getItem(CONVERSATION_CACHE_KEY)
      if (!cached) return null
      
      const cache: ConversationCache = JSON.parse(cached)
      
      // Check if cache is expired
      if (Date.now() - cache.timestamp > CACHE_DURATION) {
        localStorage.removeItem(CONVERSATION_CACHE_KEY)
        return null
      }
      
      return cache.conversations
    } catch (error) {
      debug.error('Failed to load cached conversations:', error)
      return null
    }
  }
  
  /**
   * Save messages for a specific conversation
   */
  static saveMessages(convoId: string, messages: Message[]): void {
    try {
      const cache: MessageCache = {
        messages,
        timestamp: Date.now()
      }
      localStorage.setItem(MESSAGE_CACHE_PREFIX + convoId, JSON.stringify(cache))
    } catch (error) {
      debug.error('Failed to cache messages:', error)
    }
  }
  
  /**
   * Load messages for a specific conversation
   */
  static loadMessages(convoId: string): Message[] | null {
    try {
      const cached = localStorage.getItem(MESSAGE_CACHE_PREFIX + convoId)
      if (!cached) return null
      
      const cache: MessageCache = JSON.parse(cached)
      
      // Check if cache is expired
      if (Date.now() - cache.timestamp > CACHE_DURATION) {
        localStorage.removeItem(MESSAGE_CACHE_PREFIX + convoId)
        return null
      }
      
      return cache.messages
    } catch (error) {
      debug.error('Failed to load cached messages:', error)
      return null
    }
  }
  
  /**
   * Clear all conversation caches
   */
  static clearCache(): void {
    try {
      // Remove conversations cache
      localStorage.removeItem(CONVERSATION_CACHE_KEY)
      
      // Remove all message caches
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith(MESSAGE_CACHE_PREFIX)) {
          localStorage.removeItem(key)
        }
      })
    } catch (error) {
      debug.error('Failed to clear conversation cache:', error)
    }
  }
  
  /**
   * Update a single conversation in the cache
   */
  static updateConversation(updatedConvo: Conversation): void {
    const conversations = this.loadConversations()
    if (!conversations) return
    
    const index = conversations.findIndex(c => c.id === updatedConvo.id)
    if (index !== -1) {
      conversations[index] = updatedConvo
      this.saveConversations(conversations)
    }
  }
}