import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSwipeable } from "react-swipeable";
import { useAuth } from "../contexts/AuthContext";

export const useSwipeNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(
    null,
  );

  // Define the navigation order for swiping
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

  // Clear swipe direction after navigation
  useEffect(() => {
    setSwipeDirection(null);
  }, [location.pathname]);

  const handleSwipeLeft = () => {
    // Swipe left goes to next page
    if (currentIndex < navigationOrder.length - 1) {
      setSwipeDirection("left");
      navigate(navigationOrder[currentIndex + 1]);
    }
  };

  const handleSwipeRight = () => {
    // Swipe right goes to previous page
    if (currentIndex > 0) {
      setSwipeDirection("right");
      navigate(navigationOrder[currentIndex - 1]);
    }
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: handleSwipeLeft,
    onSwipedRight: handleSwipeRight,
    trackMouse: false, // Only track touch events, not mouse
    delta: 50, // Minimum distance for a swipe
    preventScrollOnSwipe: false, // Allow vertical scrolling
    swipeDuration: 500, // Maximum time for a swipe
  });

  // Only enable on mobile devices
  if (typeof window !== "undefined" && window.innerWidth >= 1024) {
    return {};
  }

  return swipeHandlers;
};
