import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { useTheme } from "../contexts/ThemeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [isAnimating, setIsAnimating] = useState(false);

  const handleToggle = () => {
    setIsAnimating(true);
    toggleTheme();
    setTimeout(() => setIsAnimating(false), 500);
  };

  return (
    <button
      onClick={handleToggle}
      className="ios-press rounded-lg p-2 transition-all hover:bg-gray-200/50 dark:hover:bg-white/10"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      <span
        className="inline-block"
        style={{
          transition: "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
          transform: isAnimating
            ? "rotate(180deg) scale(1.1)"
            : "rotate(0deg) scale(1)",
        }}
      >
        {theme === "dark" ? (
          <Sun
            size={20}
            style={{ color: "var(--asph-text-primary)" }}
            aria-hidden="true"
          />
        ) : (
          <Moon
            size={20}
            style={{ color: "var(--asph-text-primary)" }}
            aria-hidden="true"
          />
        )}
      </span>
    </button>
  );
}
