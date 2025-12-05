import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

interface AriaLiveContextType {
  announce: (message: string, priority?: "polite" | "assertive") => void;
  announceNewPost: (authorName: string) => void;
  announceNotification: (count: number) => void;
  announcePostAction: (
    action:
      | "liked"
      | "unliked"
      | "reposted"
      | "unreposted"
      | "bookmarked"
      | "unbookmarked",
  ) => void;
}

const AriaLiveContext = createContext<AriaLiveContextType | undefined>(
  undefined,
);

interface AriaLiveProviderProps {
  children: ReactNode;
}

export function AriaLiveProvider({ children }: AriaLiveProviderProps) {
  const [politeMessage, setPoliteMessage] = useState("");
  const [assertiveMessage, setAssertiveMessage] = useState("");

  const announce = useCallback(
    (message: string, priority: "polite" | "assertive" = "polite") => {
      if (priority === "assertive") {
        setAssertiveMessage("");
        setTimeout(() => setAssertiveMessage(message), 100);
      } else {
        setPoliteMessage("");
        setTimeout(() => setPoliteMessage(message), 100);
      }
    },
    [],
  );

  const announceNewPost = useCallback(
    (authorName: string) => {
      announce(`New post from ${authorName}`);
    },
    [announce],
  );

  const announceNotification = useCallback(
    (count: number) => {
      if (count === 1) {
        announce("1 new notification", "assertive");
      } else if (count > 1) {
        announce(`${count} new notifications`, "assertive");
      }
    },
    [announce],
  );

  const announcePostAction = useCallback(
    (
      action:
        | "liked"
        | "unliked"
        | "reposted"
        | "unreposted"
        | "bookmarked"
        | "unbookmarked",
    ) => {
      const messages = {
        liked: "Post liked",
        unliked: "Post unliked",
        reposted: "Post reposted",
        unreposted: "Repost removed",
        bookmarked: "Post bookmarked",
        unbookmarked: "Bookmark removed",
      };
      announce(messages[action]);
    },
    [announce],
  );

  return (
    <AriaLiveContext.Provider
      value={{
        announce,
        announceNewPost,
        announceNotification,
        announcePostAction,
      }}
    >
      {children}
      {/* Polite live region - for non-urgent updates */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeMessage}
      </div>
      {/* Assertive live region - for urgent updates like notifications */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveMessage}
      </div>
    </AriaLiveContext.Provider>
  );
}

export function useAriaLive() {
  const context = useContext(AriaLiveContext);
  if (!context) {
    throw new Error("useAriaLive must be used within an AriaLiveProvider");
  }
  return context;
}

/**
 * Hook that can be used outside of the provider (returns no-op functions)
 */
export function useAriaLiveSafe() {
  const context = useContext(AriaLiveContext);
  return (
    context || {
      announce: () => {},
      announceNewPost: () => {},
      announceNotification: () => {},
      announcePostAction: () => {},
    }
  );
}
