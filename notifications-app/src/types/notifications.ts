export type NotificationReason = 'like' | 'repost' | 'follow' | 'mention' | 'reply' | 'quote'

export interface NotificationMetrics {
  totalNotifications: number
  unreadCount: number
  todayCount: number
  weekCount: number
  monthCount: number
  reasonBreakdown: Record<NotificationReason, number>
  hourlyActivity: number[]
  topInteractors: Array<{
    handle: string
    displayName?: string
    count: number
  }>
}