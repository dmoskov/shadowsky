export type NotificationReason =
  | "like"
  | "repost"
  | "follow"
  | "mention"
  | "reply"
  | "quote"
  | "starterpack-joined"
  | "verified"
  | "unverified"
  | "like-via-repost"
  | "repost-via-repost";

export interface NotificationMetrics {
  totalNotifications: number;
  unreadCount: number;
  todayCount: number;
  weekCount: number;
  monthCount: number;
  reasonBreakdown: Record<NotificationReason, number>;
  hourlyActivity: number[];
  topInteractors: Array<{
    handle: string;
    displayName?: string;
    count: number;
  }>;
}
