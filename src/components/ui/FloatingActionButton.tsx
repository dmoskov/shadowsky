import React, { useState, useEffect } from "react";
import { PenTool } from "lucide-react";
import { useNavigate } from "react-router";
import { useFeatureTracking } from "../../hooks/useAnalytics";

interface FloatingActionButtonProps {
  className?: string;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  className = ""
}) => {
  const navigate = useNavigate();
  const { trackFeatureAction } = useFeatureTracking("mobile_ui");
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          
          // Hide when scrolling down, show when scrolling up
          if (currentScrollY > lastScrollY && currentScrollY > 100) {
            setIsVisible(false);
          } else if (currentScrollY < lastScrollY) {
            setIsVisible(true);
          }
          
          setLastScrollY(currentScrollY);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  const handleClick = () => {
    trackFeatureAction("fab_compose_clicked");
    
    // Haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
    
    navigate("/compose");
  };

  return (
    <button
      onClick={handleClick}
      className={`fixed right-4 bottom-20 z-30 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-300 lg:hidden ${className}`}
      style={{
        backgroundColor: "var(--bsky-primary)",
        color: "white",
        transform: isVisible ? "scale(1) translateY(0)" : "scale(0.8) translateY(100px)",
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? "auto" : "none",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        marginBottom: "env(safe-area-inset-bottom)"
      }}
      aria-label="Compose new post"
    >
      <PenTool size={24} />
      
      {/* Ripple effect on tap */}
      <span 
        className="absolute inset-0 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)",
          transform: "scale(0)",
          opacity: 0,
          animation: "none"
        }}
      />
      
      <style>{`
        button:active span {
          animation: ripple 0.6s ease-out !important;
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
    </button>
  );
};