import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export const SwipeIndicator: React.FC = () => {
  const location = useLocation();
  const { session } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);

  const navigationOrder = [
    "/",
    "/search",
    "/notifications",
    "/timeline",
    "/bookmarks",
    "/conversations",
    "/compose",
    `/profile/${session?.handle || ""}`,
    "/analytics",
  ];

  const currentIndex = navigationOrder.findIndex(
    (path) => path === location.pathname,
  );

  useEffect(() => {
    // Show indicator briefly when page changes
    setIsVisible(true);
    const timer = setTimeout(() => {
      setIsVisible(false);
      setDirection(null);
    }, 300);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  // Only show on mobile and not on home route
  if (
    window.innerWidth >= 1024 || 
    location.pathname === "/" || 
    location.pathname === "/home"
  ) {
    return null;
  }

  const hasNext = currentIndex < navigationOrder.length - 1;
  const hasPrev = currentIndex > 0;

  return (
    <>
      {/* Left edge indicator (swipe right to go back) */}
      {hasPrev && (
        <div
          className={`fixed left-0 top-1/2 z-30 -translate-y-1/2 transition-opacity duration-300 lg:hidden ${
            isVisible && direction === "right" ? "opacity-100" : "opacity-0"
          }`}
        >
          <div
            className="h-24 w-1 rounded-r-full"
            style={{ backgroundColor: "var(--bsky-primary)" }}
          />
        </div>
      )}

      {/* Right edge indicator (swipe left to go forward) */}
      {hasNext && (
        <div
          className={`fixed right-0 top-1/2 z-30 -translate-y-1/2 transition-opacity duration-300 lg:hidden ${
            isVisible && direction === "left" ? "opacity-100" : "opacity-0"
          }`}
        >
          <div
            className="h-24 w-1 rounded-l-full"
            style={{ backgroundColor: "var(--bsky-primary)" }}
          />
        </div>
      )}

      {/* Page dots indicator */}
      <div className="fixed bottom-20 left-1/2 z-30 -translate-x-1/2 lg:hidden">
        <div className="flex space-x-1.5">
          {navigationOrder.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                index === currentIndex ? "w-4" : ""
              }`}
              style={{
                backgroundColor:
                  index === currentIndex
                    ? "var(--bsky-primary)"
                    : "var(--bsky-border-primary)",
              }}
            />
          ))}
        </div>
      </div>
    </>
  );
};
