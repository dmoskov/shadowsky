import React, { useEffect, useRef, useState } from "react";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

/**
 * Accessible tooltip component
 * Shows helpful information on hover with keyboard support
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  delay = 500,
  className = "",
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const timeoutRef = useRef<number>();
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const showTooltip = () => {
    timeoutRef.current = window.setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  // Update tooltip position when it becomes visible
  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      // Calculate position (centered above the trigger)
      let left =
        triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
      let top = triggerRect.top - tooltipRect.height - 8;

      // Adjust if tooltip goes off-screen horizontally
      if (left < 8) {
        left = 8;
      } else if (left + tooltipRect.width > window.innerWidth - 8) {
        left = window.innerWidth - tooltipRect.width - 8;
      }

      // If tooltip goes off-screen vertically, show below instead
      if (top < 8) {
        top = triggerRect.bottom + 8;
      }

      setPosition({ top, left });
    }
  }, [isVisible]);

  return (
    <>
      <div
        ref={triggerRef}
        className={`inline-flex ${className}`}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        aria-describedby={isVisible ? "tooltip" : undefined}
      >
        {children}
      </div>
      {isVisible && (
        <div
          ref={tooltipRef}
          id="tooltip"
          role="tooltip"
          className="fixed z-50 max-w-xs rounded-lg px-3 py-2 text-sm font-medium shadow-lg"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            backgroundColor: "var(--asph-text-primary)",
            color: "var(--asph-bg-secondary)",
            pointerEvents: "none",
          }}
        >
          {content}
          {/* Arrow */}
          <div
            className="absolute"
            style={{
              bottom: "-4px",
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "4px solid transparent",
              borderRight: "4px solid transparent",
              borderTop: "4px solid var(--asph-text-primary)",
            }}
          />
        </div>
      )}
    </>
  );
};
