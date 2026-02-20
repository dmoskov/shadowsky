/**
 * Hook to sync data to home screen widgets when it changes in the foreground.
 *
 * Subscribes to React Query cache updates for notifications, trending topics,
 * and DM conversations, and pushes the data to WidgetKit via the native bridge.
 */

import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import {
  syncNotificationWidget,
  syncTrendingWidget,
  syncDMWidget,
  syncWidgetUserHandle,
  clearAllWidgetData,
} from "../services/widget-data-service";
import { useAuth } from "../contexts/AuthContext";
import { useLowPowerMode } from "./useLowPowerMode";

export function useWidgetSync() {
  if (Platform.OS !== "ios") return;

  const queryClient = useQueryClient();
  const { session } = useAuth();
  const prevSessionRef = useRef(session);
  const isLowPower = useLowPowerMode();

  // Sync user handle on sign in, clear on sign out
  useEffect(() => {
    if (session?.handle) {
      syncWidgetUserHandle(session.handle);
    } else if (prevSessionRef.current && !session) {
      clearAllWidgetData();
    }
    prevSessionRef.current = session;
  }, [session]);

  // Subscribe to query cache changes and sync to widgets.
  // In Low Power Mode, only sync notification count (essential for badge);
  // skip trending and DM widget updates to reduce processing.
  useEffect(() => {
    if (!session) return;

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (!event || event.type !== "updated") return;
      const query = event.query;
      const queryKey = query.queryKey;

      if (!queryKey || !Array.isArray(queryKey)) return;

      // Sync unread count to notification widget
      if (queryKey[0] === "unreadCount" && query.state.data != null) {
        const unreadCount = query.state.data as number;
        // Also get latest notification data if available
        const notifQuery = queryClient.getQueryData<{
          pages: Array<{ notifications: any[] }>;
        }>(["notifications"]);
        const notifications = notifQuery?.pages?.[0]?.notifications;
        syncNotificationWidget(unreadCount, notifications);
      }

      // Sync notifications list to widget (for preview text)
      if (queryKey[0] === "notifications" && query.state.data != null) {
        const data = query.state.data as {
          pages: Array<{ notifications: any[] }>;
        };
        const notifications = data?.pages?.[0]?.notifications;
        const unreadCount =
          (queryClient.getQueryData<number>(["unreadCount"]) as number) || 0;
        if (notifications) {
          syncNotificationWidget(unreadCount, notifications);
        }
      }

      // Skip non-essential widget syncs in Low Power Mode
      if (isLowPower) return;

      // Sync trending topics to widget
      if (queryKey[0] === "trendingTopics" && query.state.data != null) {
        const data = query.state.data as {
          topics: Array<{ topic: string }>;
          suggested: Array<{ topic: string }>;
        };
        if (data) {
          const topics = [
            ...(data.topics || []).map((t) => ({
              topic: t.topic,
              status: "stable",
            })),
            ...(data.suggested || []).map((t) => ({
              topic: t.topic,
              status: "rising",
            })),
          ];
          syncTrendingWidget(topics);
        }
      }

      // Sync DM conversations to widget
      if (queryKey[0] === "dm-conversations" && query.state.data != null) {
        const conversations = query.state.data as Array<{
          id: string;
          members: Array<{
            did: string;
            handle?: string;
            displayName?: string;
          }>;
          lastMessage?: { text: string; sentAt: string };
          unreadCount: number;
        }>;
        if (conversations) {
          syncDMWidget(conversations, session?.did);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [queryClient, session, isLowPower]);
}
