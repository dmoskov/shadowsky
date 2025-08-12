import { useSwipeable } from "react-swipeable";

interface UseModalSwipeBackOptions {
  onClose: () => void;
  enabled?: boolean;
}

export const useModalSwipeBack = ({
  onClose,
  enabled = true,
}: UseModalSwipeBackOptions) => {
  const swipeHandlers = useSwipeable({
    onSwipedRight: () => {
      if (enabled) {
        onClose();
      }
    },
    trackMouse: false,
    delta: 80, // Slightly higher threshold for modal closing
    preventScrollOnSwipe: false,
    swipeDuration: 500,
  });

  // Only enable on mobile devices
  if (typeof window !== "undefined" && window.innerWidth >= 1024) {
    return {};
  }

  return enabled ? swipeHandlers : {};
};
