import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { isIPad } from "../hooks/useIsIPad";

export type DetailPanelContent =
  | { type: "thread"; handle: string; postId: string }
  | { type: "profile"; handle: string }
  | null;

interface IPadLayoutContextValue {
  /** Whether the current device is an iPad (multi-column active) */
  isMultiColumn: boolean;
  /** Content currently displayed in the detail panel */
  detailContent: DetailPanelContent;
  /** Show a thread in the detail panel */
  showThread: (handle: string, postId: string) => void;
  /** Show a profile in the detail panel */
  showProfile: (handle: string) => void;
  /** Close the detail panel */
  closeDetail: () => void;
}

const IPadLayoutContext = createContext<IPadLayoutContextValue>({
  isMultiColumn: false,
  detailContent: null,
  showThread: () => {},
  showProfile: () => {},
  closeDetail: () => {},
});

export function IPadLayoutProvider({ children }: { children: ReactNode }) {
  const isMultiColumn = isIPad;
  const [detailContent, setDetailContent] = useState<DetailPanelContent>(null);

  const showThread = useCallback((handle: string, postId: string) => {
    setDetailContent({ type: "thread", handle, postId });
  }, []);

  const showProfile = useCallback((handle: string) => {
    setDetailContent({ type: "profile", handle });
  }, []);

  const closeDetail = useCallback(() => {
    setDetailContent(null);
  }, []);

  return (
    <IPadLayoutContext.Provider
      value={{
        isMultiColumn,
        detailContent,
        showThread,
        showProfile,
        closeDetail,
      }}
    >
      {children}
    </IPadLayoutContext.Provider>
  );
}

export function useIPadLayout() {
  return useContext(IPadLayoutContext);
}
