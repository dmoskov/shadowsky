import { PenTool } from "lucide-react";
import React from "react";
import { usePrefersReducedMotion } from "../../contexts/AccessibilityContext";
import { useScrollVisibility } from "../../hooks/useRAFScroll";
import { useViewTransitionNavigate } from "../../hooks/useViewTransitionNavigate";

interface FloatingActionButtonProps {
  className?: string;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  className = "",
}) => {
  const navigate = useViewTransitionNavigate();
  const prefersReducedMotion = usePrefersReducedMotion();

  // Use RAF-batched scroll visibility hook
  const isVisible = useScrollVisibility({
    hideOnScrollDown: true,
    showOnScrollUp: true,
    showThreshold: 100,
  });

  const handleClick = () => {
    // Haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }

    navigate("/compose");
  };

  // For reduced motion: use instant visibility change without transform/scale
  const getTransformStyle = () => {
    if (prefersReducedMotion) {
      return isVisible ? "none" : "translateY(100px)";
    }
    return isVisible
      ? "scale(1) translateY(0)"
      : "scale(0.8) translateY(100px)";
  };

  return (
    <button
      onClick={handleClick}
      className={`ios-press fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full shadow-lg lg:hidden ${prefersReducedMotion ? "" : "transition-all duration-300"} ${className}`}
      style={{
        backgroundColor: "var(--asph-primary)",
        color: "white",
        transform: getTransformStyle(),
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? "auto" : "none",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        marginBottom: "env(safe-area-inset-bottom)",
        transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
      aria-label="Compose new post"
    >
      <PenTool size={24} />

      {/* Ripple effect on tap - disabled for reduced motion */}
      {!prefersReducedMotion && (
        <>
          <span
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)",
              transform: "scale(0)",
              opacity: 0,
              animation: "none",
            }}
          />

          <style>{`
            @media (prefers-reduced-motion: no-preference) {
              button:active span {
                animation: ripple 0.6s ease-out !important;
              }
            }

            @keyframes ripple {
              0% {
                transform: scale(0);
                opacity: 1;
              }
              100% {
                transform: scale(1.5);
                opacity: 0;
              }
            }
          `}</style>
        </>
      )}
    </button>
  );
};
