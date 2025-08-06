import { debug } from '@bsky/shared'

interface JetstreamEvent {
  did: string
  time_us: number
  kind: 'commit' | 'identity' | 'account'
  commit?: {
    rev: string
    operation: 'create' | 'update' | 'delete'
    collection: string
    rkey: string
    record: any
    cid: string
  }
}

interface JetstreamOptions {
  collections?: string[]
  onNotification?: (event: JetstreamEvent) => void
  onPost?: (event: JetstreamEvent) => void
  onLike?: (event: JetstreamEvent) => void
  onRepost?: (event: JetstreamEvent) => void
  onFollow?: (event: JetstreamEvent) => void
}

export class JetstreamService {
  private ws: WebSocket | null = null
  private reconnectTimeout: NodeJS.Timeout | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private userDid: string | null = null

  constructor(private options: JetstreamOptions = {}) {}

  connect(userDid: string) {
    this.userDid = userDid
    this.reconnectAttempts = 0
    this.doConnect()
  }

  private doConnect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return
    }

    const collections = this.options.collections || [
      'app.bsky.notification',
      'app.bsky.feed.post',
      'app.bsky.feed.like',
      'app.bsky.feed.repost',
      'app.bsky.graph.follow'
    ]

    const params = new URLSearchParams({
      wantedCollections: collections.join(',')
    })

    const url = `wss://jetstream1.us-east.bsky.network/subscribe?${params}`
    
    debug.log('🔌 Connecting to Jetstream:', url)
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      debug.log('✅ Jetstream connected')
      this.reconnectAttempts = 0
    }

    this.ws.onmessage = (event) => {
      try {
        const data: JetstreamEvent = JSON.parse(event.data)
        
        // Only process events for the current user
        if (!this.isRelevantToUser(data)) {
          return
        }

        debug.log('📨 Jetstream event:', data.commit?.collection, data)

        // Route to appropriate handler
        switch (data.commit?.collection) {
          case 'app.bsky.notification':
            this.options.onNotification?.(data)
            break
          case 'app.bsky.feed.post':
            this.options.onPost?.(data)
            break
          case 'app.bsky.feed.like':
            this.options.onLike?.(data)
            break
          case 'app.bsky.feed.repost':
            this.options.onRepost?.(data)
            break
          case 'app.bsky.graph.follow':
            this.options.onFollow?.(data)
            break
        }
      } catch (error) {
        debug.error('Failed to parse Jetstream message:', error)
      }
    }

    this.ws.onerror = (error) => {
      debug.error('❌ Jetstream error:', error)
    }

    this.ws.onclose = () => {
      debug.log('🔌 Jetstream disconnected')
      this.scheduleReconnect()
    }
  }

  private isRelevantToUser(event: JetstreamEvent): boolean {
    if (!this.userDid || !event.commit) return false

    // Check if this event is about the current user
    if (event.did === this.userDid) return true

    // Check if this is a notification, like, or follow targeting the user
    const record = event.commit.record
    if (record?.subject?.uri?.includes(this.userDid)) return true
    if (record?.subject?.did === this.userDid) return true

    return false
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      debug.error('Max reconnection attempts reached')
      return
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
    this.reconnectAttempts++

    debug.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)

    this.reconnectTimeout = setTimeout(() => {
      this.doConnect()
    }, delay)
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}