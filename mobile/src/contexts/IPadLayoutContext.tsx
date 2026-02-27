import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";
import { useWindowDimensions } from "react-native";
import { isIPad } from "../hooks/useIsIPad";

/**
 * Layout breakpoints for iPad multi-column layout.
 *
 * When the app runs in Split View / Slide Over the window width shrinks.
 * We use the *current* window width (not the static screen width) so the
 * layout adapts in real time:
 *
 *  - < 600 px  → phone layout  (tab bar, no sidebar)
 *  - 600–1000  → compact iPad  (sidebar + content, no detail panel)
 *  - > 1000    → full iPad     (sidebar + content + detail panel)
 */
const MULTI_COLUMN_MIN_WIDTH = 600;
const DETAIL_PANEL_MIN_WINDOW_WIDTH = 1000;

export type DetailPanelContent =
  | { type: "thread"; handle: string; postId: string }
  | { type: "profile"; handle: string }
  | { type: "compose"; replyTo?: any; quoteTo?: any }
  | { type: "settings" }
  | { type: "list-detail"; listUri: string }
  | { type: "analytics" }
  | { type: "messages"; conversationId?: string }
  | null;

interface IPadLayoutContextValue {
  /** Whether the current window is wide enough for multi-column (sidebar visible) */
  isMultiColumn: boolean;
  /** Whether the window is wide enough to also show the detail panel */
  canShowDetailPanel: boolean;
  /** Current window width (updates on Split View / rotation) */
  windowWidth: number;
  /** Current window height */
  windowHeight: number;
  /** Content currently displayed in the detail panel */
  detailContent: DetailPanelContent;
  /** Show a thread in the detail panel */
  showThread: (handle: string, postId: string) => void;
  /** Show a profile in the detail panel */
  showProfile: (handle: string) => void;
  /** Show the compose screen in the detail panel */
  showCompose: (params?: { replyTo?: any; quoteTo?: any }) => void;
  /** Show settings in the detail panel */
  showSettings: () => void;
  /** Show a list detail in the detail panel */
  showListDetail: (listUri: string) => void;
  /** Show analytics in the detail panel */
  showAnalytics: () => void;
  /** Show messages in the detail panel */
  showMessages: (conversationId?: string) => void;
  /** Close the detail panel */
  closeDetail: () => void;
}

const IPadLayoutContext = createContext<IPadLayoutContextValue>({
  isMultiColumn: false,
  canShowDetailPanel: false,
  windowWidth: 0,
  windowHeight: 0,
  detailContent: null,
  showThread: () => {},
  showProfile: () => {},
  showCompose: () => {},
  showSettings: () => {},
  showListDetail: () => {},
  showAnalytics: () => {},
  showMessages: () => {},
  closeDetail: () => {},
});

export function IPadLayoutProvider({ children }: { children: ReactNode }) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // On iPad, adapt layout to current window width (handles Split View / rotation).
  // On iPhone, always use phone layout regardless of width.
  const isMultiColumn = isIPad && windowWidth >= MULTI_COLUMN_MIN_WIDTH;
  const canShowDetailPanel = isIPad && windowWidth >= DETAIL_PANEL_MIN_WINDOW_WIDTH;

  const [detailContent, setDetailContent] = useState<DetailPanelContent>(null);

  const showThread = useCallback((handle: string, postId: string) => {
    setDetailContent({ type: "thread", handle, postId });
  }, []);

  const showProfile = useCallback((handle: string) => {
    setDetailContent({ type: "profile", handle });
  }, []);

  const showCompose = useCallback((params?: { replyTo?: any; quoteTo?: any }) => {
    setDetailContent({ type: "compose", replyTo: params?.replyTo, quoteTo: params?.quoteTo });
  }, []);

  const showSettings = useCallback(() => {
    setDetailContent({ type: "settings" });
  }, []);

  const showListDetail = useCallback((listUri: string) => {
    setDetailContent({ type: "list-detail", listUri });
  }, []);

  const showAnalytics = useCallback(() => {
    setDetailContent({ type: "analytics" });
  }, []);

  const showMessages = useCallback((conversationId?: string) => {
    setDetailContent({ type: "messages", conversationId });
  }, []);

  const closeDetail = useCallback(() => {
    setDetailContent(null);
  }, []);

  const value = useMemo(
    () => ({
      isMultiColumn,
      canShowDetailPanel,
      windowWidth,
      windowHeight,
      detailContent,
      showThread,
      showProfile,
      showCompose,
      showSettings,
      showListDetail,
      showAnalytics,
      showMessages,
      closeDetail,
    }),
    [isMultiColumn, canShowDetailPanel, windowWidth, windowHeight, detailContent, showThread, showProfile, showCompose, showSettings, showListDetail, showAnalytics, showMessages, closeDetail],
  );

  return (
    <IPadLayoutContext.Provider value={value}>
      {children}
    </IPadLayoutContext.Provider>
  );
}

export function useIPadLayout() {
  return useContext(IPadLayoutContext);
}
