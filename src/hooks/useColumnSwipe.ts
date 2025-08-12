import { useSwipeable } from "react-swipeable";
import { useEffect, useRef } from "react";

interface UseColumnSwipeOptions {
  totalColumns: number;
  currentIndex: number;
  onIndexChange: (index: number) => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

export const useColumnSwipe = ({
  totalColumns,
  currentIndex,
  onIndexChange,
  containerRef,
}: UseColumnSwipeOptions) => {
  const isSwipingRef = useRef(false);

  const scrollToColumn = (index: number) => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const columnWidth = container.clientWidth;
    const scrollPosition = index * columnWidth;
    
    container.scrollTo({
      left: scrollPosition,
      behavior: "smooth",
    });
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (currentIndex < totalColumns - 1) {
        const newIndex = currentIndex + 1;
        onIndexChange(newIndex);
        scrollToColumn(newIndex);
      }
    },
    onSwipedRight: () => {
      if (currentIndex > 0) {
        const newIndex = currentIndex - 1;
        onIndexChange(newIndex);
        scrollToColumn(newIndex);
      }
    },
    onSwiping: () => {
      isSwipingRef.current = true;
    },
    onSwiped: () => {
      isSwipingRef.current = false;
    },
    trackMouse: false,
    delta: 50,
    preventScrollOnSwipe: true, // Prevent vertical scrolling during swipe
    swipeDuration: 500,
  });

  // Update scroll position when index changes externally
  useEffect(() => {
    scrollToColumn(currentIndex);
  }, [currentIndex]);

  // Only enable on mobile devices
  if (typeof window !== "undefined" && window.innerWidth >= 1024) {
    return { swipeHandlers: {}, isSwipingRef };
  }

  return { swipeHandlers, isSwipingRef };
};