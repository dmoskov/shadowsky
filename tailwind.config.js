/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Dynamic theme colors using CSS variables
        bsky: {
          primary: {
            DEFAULT: "var(--bsky-primary)",
            dark: "var(--bsky-primary-dark)",
            light: "var(--bsky-primary-light)",
            10: "var(--bsky-primary-10)",
          },
          accent: "var(--bsky-accent)",
          bg: {
            primary: "var(--bsky-bg-primary)",
            secondary: "var(--bsky-bg-secondary)",
            tertiary: "var(--bsky-bg-tertiary)",
            hover: "var(--bsky-bg-hover)",
            active: "var(--bsky-bg-active)",
          },
          text: {
            primary: "var(--bsky-text-primary)",
            secondary: "var(--bsky-text-secondary)",
            tertiary: "var(--bsky-text-tertiary)",
            link: "var(--bsky-text-link)",
          },
          border: {
            primary: "var(--bsky-border-primary)",
            secondary: "var(--bsky-border-secondary)",
            light: "var(--bsky-border-light)",
          },
          // Notification colors
          like: "var(--bsky-like)",
          repost: "var(--bsky-repost)",
          follow: "var(--bsky-follow)",
          mention: "var(--bsky-mention)",
          reply: "var(--bsky-reply)",
          quote: "var(--bsky-quote)",
          // Status colors
          success: {
            DEFAULT: "var(--bsky-success)",
            10: "var(--bsky-success-10)",
          },
          warning: "var(--bsky-warning)",
          error: "var(--bsky-error)",
          info: "var(--bsky-info)",
        },
      },
      boxShadow: {
        "bsky-sm": "var(--bsky-shadow-sm)",
        "bsky-md": "var(--bsky-shadow-md)",
        "bsky-lg": "var(--bsky-shadow-lg)",
        "bsky-glow": "var(--bsky-glow)",
      },
      animation: {
        // Existing animations
        "fade-in": "fadeIn 0.3s ease-out",
        "fade-in-up": "fadeInUp 0.3s ease-out",
        pulse: "bskyPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        slide: "slide 2s linear infinite",
        shimmer: "shimmer 2s linear infinite",
        // Bookmark animations
        "bookmark-bounce": "bookmarkBounce 0.4s ease-out",
        "bookmark-fill": "bookmarkFill 0.3s ease-out forwards",
        // Ripple effect
        ripple: "ripple 0.6s ease-out",
        // Timeline animations
        "slide-in": "slideIn 0.3s ease-out",
        "slide-out": "slideOut 0.3s ease-out",
        // Composer animations
        "tone-pulse": "tonePulse 1s ease-in-out infinite",
        // Conversation animations
        highlight: "highlight 2s ease-out",
      },
      keyframes: {
        fadeIn: {
          from: {
            opacity: "0",
            transform: "translateY(-10px)",
          },
          to: {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        fadeInUp: {
          from: {
            opacity: "0",
            transform: "translateY(10px)",
          },
          to: {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        bskyPulse: {
          "0%, 100%": {
            opacity: "1",
          },
          "50%": {
            opacity: "0.5",
          },
        },
        slide: {
          "0%": {
            transform: "translateX(-100%)",
          },
          "100%": {
            transform: "translateX(200%)",
          },
        },
        shimmer: {
          "0%": {
            backgroundPosition: "-1000px 0",
          },
          "100%": {
            backgroundPosition: "1000px 0",
          },
        },
        bookmarkBounce: {
          "0%": {
            transform: "scale(1)",
          },
          "30%": {
            transform: "scale(1.3)",
          },
          "60%": {
            transform: "scale(0.9)",
          },
          "100%": {
            transform: "scale(1)",
          },
        },
        bookmarkFill: {
          "0%": {
            transform: "scale(1)",
          },
          "50%": {
            transform: "scale(1.2) rotate(-5deg)",
          },
          "100%": {
            transform: "scale(1) rotate(0deg)",
          },
        },
        ripple: {
          "0%": {
            transform: "scale(0)",
            opacity: "1",
          },
          "100%": {
            transform: "scale(4)",
            opacity: "0",
          },
        },
        slideIn: {
          from: {
            transform: "translateX(-100%)",
            opacity: "0",
          },
          to: {
            transform: "translateX(0)",
            opacity: "1",
          },
        },
        slideOut: {
          from: {
            transform: "translateX(0)",
            opacity: "1",
          },
          to: {
            transform: "translateX(100%)",
            opacity: "0",
          },
        },
        tonePulse: {
          "0%, 100%": {
            opacity: "0.6",
          },
          "50%": {
            opacity: "1",
          },
        },
        highlight: {
          "0%": {
            backgroundColor: "rgba(0, 133, 255, 0.2)",
          },
          "100%": {
            backgroundColor: "transparent",
          },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "bsky-gradient": "linear-gradient(135deg, var(--bsky-primary) 0%, var(--bsky-accent) 100%)",
        "bsky-gradient-text": "linear-gradient(135deg, var(--bsky-primary) 0%, var(--bsky-accent) 100%)",
        "shimmer-gradient":
          "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)",
      },
      backdropBlur: {
        xs: "2px",
      },
      transitionDuration: {
        400: "400ms",
      },
      zIndex: {
        60: "60",
        70: "70",
        80: "80",
        90: "90",
        100: "100",
        999: "999",
        1000: "1000",
        9999: "9999",
      },
      maxWidth: {
        "8xl": "88rem",
        "9xl": "96rem",
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.75rem" }],
      },
      spacing: {
        18: "4.5rem",
        88: "22rem",
        92: "23rem",
        100: "25rem",
        104: "26rem",
        108: "27rem",
        112: "28rem",
        116: "29rem",
        120: "30rem",
        124: "31rem",
        128: "32rem",
      },
      width: {
        'column': '400px', // Standard column width
      },
    },
  },
  plugins: [
    // Custom component classes plugin
    function ({ addComponents, theme }) {
      addComponents({
        // Glass morphism effect
        ".bsky-glass": {
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: "1px solid rgba(0, 0, 0, 0.1)",
        },
        ".dark .bsky-glass": {
          background: "rgba(17, 24, 39, 0.95)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
        },
        '[data-theme="dark"] .bsky-glass': {
          background: "rgba(17, 24, 39, 0.85)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
        },
        // Custom scrollbar
        ".bsky-scrollbar": {
          "&::-webkit-scrollbar": {
            width: "10px",
            height: "10px",
          },
          "&::-webkit-scrollbar-track": {
            background: "var(--bsky-bg-primary)",
            borderRadius: "5px",
          },
          "&::-webkit-scrollbar-thumb": {
            background: "var(--bsky-bg-tertiary)",
            borderRadius: "5px",
            border: "2px solid var(--bsky-bg-primary)",
          },
          "&::-webkit-scrollbar-thumb:hover": {
            background: "var(--bsky-bg-hover)",
          },
        },
        // Gradient text utility
        ".bsky-gradient-text": {
          background: "linear-gradient(135deg, var(--bsky-primary) 0%, var(--bsky-accent) 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        },
        // Hide scrollbar utilities
        ".scrollbar-hide": {
          msOverflowStyle: "none",
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": {
            display: "none",
          },
        },
      });
    },
  ],
};
