import React, { useState, useEffect, useRef } from 'react'
import { MessageSquare, Send, Search, ArrowLeft, Users, User, Clock, MoreVertical, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChatBskyConvoDefs } from '@atproto/api'
import { formatDistanceToNow } from 'date-fns'

type Conversation = ChatBskyConvoDefs.ConvoView

export const Conversations: React.FC = () => {
  const { agent } = useAuth()
  const queryClient = useQueryClient()
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [messageText, setMessageText] = useState('')
  const messageEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Fetch conversations list
  const { data: conversations, isLoading: loadingConvos, error: convosError } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      if (!agent) throw new Error('No authenticated agent')
      
      try {
        const response = await agent.api.chat.bsky.convo.listConvos({})
        return response.data.convos
      } catch (error: any) {
        // If chat API is not available, return empty array
        if (error?.status === 400 || error?.status === 501) {
          return []
        }
        throw error
      }
    },
    enabled: !!agent,
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Fetch messages for selected conversation
  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ['conversation-messages', selectedConvo],
    queryFn: async () => {
      if (!agent || !selectedConvo) throw new Error('No agent or conversation selected')
      
      try {
        const response = await agent.api.chat.bsky.convo.getMessages({
          convoId: selectedConvo,
          limit: 50,
        })
        return response.data.messages
      } catch (error: any) {
        if (error?.status === 400 || error?.status === 501) {
          return []
        }
        throw error
      }
    },
    enabled: !!agent && !!selectedConvo,
    refetchInterval: 5000, // Refresh every 5 seconds when in a conversation
  })

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ convoId, text }: { convoId: string; text: string }) => {
      if (!agent) throw new Error('No authenticated agent')
      
      return agent.api.chat.bsky.convo.sendMessage({
        convoId,
        message: {
          text,
        },
      })
    },
    onSuccess: () => {
      setMessageText('')
      queryClient.invalidateQueries({ queryKey: ['conversation-messages', selectedConvo] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      
      // Scroll to bottom
      setTimeout(() => {
        messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    },
    onError: (error: any) => {
      console.error('Failed to send message:', error)
    },
  })

  // Handle sending message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageText.trim() || !selectedConvo) return

    sendMessageMutation.mutate({
      convoId: selectedConvo,
      text: messageText.trim(),
    })
  }

  // Filter conversations based on search
  const filteredConversations = conversations?.filter(convo => {
    if (!searchQuery) return true
    
    const members = convo.members.filter(m => m.did !== agent?.did)
    return members.some(member => 
      member.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.handle?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }) || []

  // Get other members in conversation
  const getOtherMembers = (convo: Conversation) => {
    return convo.members.filter(m => m.did !== agent?.did)
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [messageText])

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages?.length) {
      messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Show loading state
  if (loadingConvos) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bsky-bg-primary)' }}>
        <div className="text-center">
          <Loader2 size={32} className="animate-spin mb-4 mx-auto" style={{ color: 'var(--bsky-primary)' }} />
          <p style={{ color: 'var(--bsky-text-secondary)' }}>Loading conversations...</p>
        </div>
      </div>
    )
  }

  // Show error or empty state
  if (convosError || conversations?.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bsky-bg-primary)' }}>
        <div className="text-center max-w-md">
          <MessageSquare size={64} className="mx-auto mb-4" style={{ color: 'var(--bsky-text-tertiary)' }} />
          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--bsky-text-primary)' }}>No Conversations Yet</h2>
          <p style={{ color: 'var(--bsky-text-secondary)' }}>
            {convosError ? 'Conversations are not available at this time.' : 'Start a conversation to see it here.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]" style={{ background: 'var(--bsky-bg-primary)' }}>
      {/* Left Panel - Conversations List */}
      <div className={`${selectedConvo ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-96`} 
           style={{ borderRight: '1px solid var(--bsky-border-primary)' }}>
        {/* Search Header */}
        <div className="p-4" style={{ borderBottom: '1px solid var(--bsky-border-primary)' }}>
          <h1 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--bsky-text-primary)' }}>
            <MessageSquare size={24} />
            Conversations
          </h1>
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2" 
                   style={{ color: 'var(--bsky-text-tertiary)' }} />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bsky-input"
              style={{ 
                background: 'var(--bsky-bg-secondary)',
                border: '1px solid var(--bsky-border-primary)',
                color: 'var(--bsky-text-primary)'
              }}
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((convo) => {
            const otherMembers = getOtherMembers(convo)
            const isSelected = selectedConvo === convo.id
            const lastMessage = convo.lastMessage?.text || 'No messages yet'
            const isGroup = otherMembers.length > 1

            return (
              <button
                key={convo.id}
                onClick={() => setSelectedConvo(convo.id)}
                className={`w-full text-left p-4 transition-all hover:bg-opacity-10 hover:bg-blue-500 ${
                  isSelected ? 'bg-opacity-10 bg-blue-500' : ''
                }`}
                style={{ borderBottom: '1px solid var(--bsky-border-primary)' }}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="relative">
                    {isGroup ? (
                      <div className="w-12 h-12 rounded-full flex items-center justify-center"
                           style={{ background: 'var(--bsky-bg-secondary)' }}>
                        <Users size={24} style={{ color: 'var(--bsky-text-tertiary)' }} />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-full bsky-gradient flex items-center justify-center text-white font-medium">
                        {otherMembers[0]?.displayName?.[0] || otherMembers[0]?.handle?.[0] || 'U'}
                      </div>
                    )}
                    {convo.unreadCount > 0 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs text-white font-medium"
                           style={{ background: 'var(--bsky-primary)' }}>
                        {convo.unreadCount}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-medium truncate" style={{ color: 'var(--bsky-text-primary)' }}>
                        {isGroup 
                          ? `${otherMembers.map(m => m.displayName || m.handle).join(', ')}`
                          : (otherMembers[0]?.displayName || otherMembers[0]?.handle || 'Unknown')
                        }
                      </h3>
                      <span className="text-xs" style={{ color: 'var(--bsky-text-tertiary)' }}>
                        {convo.lastMessage?.sentAt 
                          ? formatDistanceToNow(new Date(convo.lastMessage.sentAt), { addSuffix: true })
                          : ''
                        }
                      </span>
                    </div>
                    <p className="text-sm truncate" style={{ color: 'var(--bsky-text-secondary)' }}>{lastMessage}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right Panel - Conversation View */}
      {selectedConvo && (
        <div className="flex-1 flex flex-col">
          {/* Conversation Header */}
          <div className="p-4 flex items-center justify-between" 
               style={{ borderBottom: '1px solid var(--bsky-border-primary)' }}>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedConvo(null)}
                className="md:hidden p-2 rounded-lg hover:bg-opacity-10 hover:bg-blue-500 transition-all"
              >
                <ArrowLeft size={20} style={{ color: 'var(--bsky-text-secondary)' }} />
              </button>
              
              {(() => {
                const convo = conversations?.find(c => c.id === selectedConvo)
                const otherMembers = convo ? getOtherMembers(convo) : []
                const isGroup = otherMembers.length > 1

                return (
                  <>
                    <div className="w-10 h-10 rounded-full bsky-gradient flex items-center justify-center text-white font-medium">
                      {isGroup ? (
                        <Users size={20} />
                      ) : (
                        otherMembers[0]?.displayName?.[0] || otherMembers[0]?.handle?.[0] || 'U'
                      )}
                    </div>
                    <div>
                      <h2 className="font-semibold" style={{ color: 'var(--bsky-text-primary)' }}>
                        {isGroup 
                          ? `${otherMembers.map(m => m.displayName || m.handle).join(', ')}`
                          : (otherMembers[0]?.displayName || otherMembers[0]?.handle || 'Unknown')
                        }
                      </h2>
                      {!isGroup && otherMembers[0]?.handle && (
                        <p className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>@{otherMembers[0].handle}</p>
                      )}
                    </div>
                  </>
                )
              })()}
            </div>

            <button className="p-2 rounded-lg hover:bg-opacity-10 hover:bg-blue-500 transition-all">
              <MoreVertical size={20} style={{ color: 'var(--bsky-text-secondary)' }} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loadingMessages ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 size={24} className="animate-spin" style={{ color: 'var(--bsky-text-tertiary)' }} />
              </div>
            ) : (
              <>
                {messages?.map((message) => {
                  const isMe = message.sender?.did === agent?.did

                  return (
                    <div
                      key={message.id}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[70%] ${isMe ? 'order-2' : 'order-1'}`}>
                        <div className={`rounded-2xl px-4 py-2 ${
                          isMe 
                            ? 'text-white' 
                            : ''
                        }`}
                        style={{
                          background: isMe ? 'var(--bsky-primary)' : 'var(--bsky-bg-secondary)',
                          color: isMe ? 'white' : 'var(--bsky-text-primary)'
                        }}>
                          <p className="break-words">{message.text}</p>
                        </div>
                        <div className={`text-xs mt-1 ${isMe ? 'text-right' : 'text-left'}`}
                             style={{ color: 'var(--bsky-text-tertiary)' }}>
                          {formatDistanceToNow(new Date(message.sentAt), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messageEndRef} />
              </>
            )}
          </div>

          {/* Message Composer */}
          <form onSubmit={handleSendMessage} className="p-4" 
                style={{ borderTop: '1px solid var(--bsky-border-primary)' }}>
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage(e)
                  }
                }}
                placeholder="Type a message..."
                className="flex-1 resize-none max-h-32 px-4 py-2 rounded-lg bsky-input"
                style={{ 
                  background: 'var(--bsky-bg-secondary)',
                  border: '1px solid var(--bsky-border-primary)',
                  color: 'var(--bsky-text-primary)'
                }}
                rows={1}
              />
              <button
                type="submit"
                disabled={!messageText.trim() || sendMessageMutation.isPending}
                className="p-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'var(--bsky-primary)' }}
              >
                {sendMessageMutation.isPending ? (
                  <Loader2 size={20} className="animate-spin text-white" />
                ) : (
                  <Send size={20} className="text-white" />
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Empty state when no conversation selected (desktop only) */}
      {!selectedConvo && (
        <div className="hidden md:flex flex-1 items-center justify-center">
          <div className="text-center">
            <MessageSquare size={64} className="mx-auto mb-4" style={{ color: 'var(--bsky-text-tertiary)' }} />
            <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--bsky-text-primary)' }}>Select a conversation</h2>
            <p style={{ color: 'var(--bsky-text-secondary)' }}>Choose a conversation from the left to start messaging</p>
          </div>
        </div>
      )}
    </div>
  )
}