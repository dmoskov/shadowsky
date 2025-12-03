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
        "highlight-flash": "highlightFlash 1s ease-out 2",
        // Entrance animations using token system
        "enter-fade": "enterFade var(--transition-normal) var(--ease-entrance)",
        "enter-slide-up":
          "enterSlideUp var(--transition-normal) var(--ease-entrance)",
        "enter-slide-down":
          "enterSlideDown var(--transition-normal) var(--ease-entrance)",
        "enter-scale": "enterScale var(--transition-normal) var(--ease-spring)",
        // Exit animations
        "exit-fade": "exitFade var(--transition-fast) var(--ease-exit)",
        "exit-slide-up": "exitSlideUp var(--transition-fast) var(--ease-exit)",
        "exit-slide-down":
          "exitSlideDown var(--transition-fast) var(--ease-exit)",
        "exit-scale": "exitScale var(--transition-fast) var(--ease-exit)",
        // Tactile feedback
        "press-scale": "pressScale var(--transition-fast) var(--ease-spring)",
        // Staggered list item (use with animation-delay)
        "list-item-enter":
          "listItemEnter var(--transition-normal) var(--ease-entrance) forwards",
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
        highlightFlash: {
          "0%": {
            boxShadow: "0 0 0 0 rgba(0, 133, 255, 0.8)",
            transform: "scale(1)",
          },
          "50%": {
            boxShadow: "0 0 20px 10px rgba(0, 133, 255, 0.3)",
            transform: "scale(1.01)",
          },
          "100%": {
            boxShadow: "0 0 0 0 rgba(0, 133, 255, 0)",
            transform: "scale(1)",
          },
        },
        // Entrance keyframes
        enterFade: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        enterSlideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        enterSlideDown: {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        enterScale: {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        // Exit keyframes
        exitFade: {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        exitSlideUp: {
          from: { opacity: "1", transform: "translateY(0)" },
          to: { opacity: "0", transform: "translateY(-8px)" },
        },
        exitSlideDown: {
          from: { opacity: "1", transform: "translateY(0)" },
          to: { opacity: "0", transform: "translateY(8px)" },
        },
        exitScale: {
          from: { opacity: "1", transform: "scale(1)" },
          to: { opacity: "0", transform: "scale(0.95)" },
        },
        // Tactile feedback
        pressScale: {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(0.97)" },
          "100%": { transform: "scale(1)" },
        },
        // Staggered list item entrance
        listItemEnter: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "bsky-gradient":
          "linear-gradient(135deg, var(--bsky-primary) 0%, var(--bsky-accent) 100%)",
        "bsky-gradient-text":
          "linear-gradient(135deg, var(--bsky-primary) 0%, var(--bsky-accent) 100%)",
        "shimmer-gradient":
          "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)",
      },
      backdropBlur: {
        xs: "2px",
      },
      transitionDuration: {
        fast: "var(--transition-fast)",
        normal: "var(--transition-normal)",
        slow: "var(--transition-slow)",
        slower: "var(--transition-slower)",
        400: "400ms",
      },
      transitionTimingFunction: {
        DEFAULT: "var(--ease-default)",
        out: "var(--ease-out)",
        in: "var(--ease-in)",
        spring: "var(--ease-spring)",
        bounce: "var(--ease-bounce)",
        entrance: "var(--ease-entrance)",
        exit: "var(--ease-exit)",
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
        column: "400px", // Standard column width
      },
    },
  },
  plugins: [
    // Animation utility classes plugin
    function ({ addUtilities }) {
      addUtilities({
        // Transition shorthand utilities with coordinated timing
        ".transition-fast": {
          transitionProperty:
            "color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter",
          transitionDuration: "var(--transition-fast)",
          transitionTimingFunction: "var(--ease-default)",
        },
        ".transition-normal": {
          transitionProperty:
            "color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter",
          transitionDuration: "var(--transition-normal)",
          transitionTimingFunction: "var(--ease-default)",
        },
        ".transition-slow": {
          transitionProperty:
            "color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter",
          transitionDuration: "var(--transition-slow)",
          transitionTimingFunction: "var(--ease-default)",
        },
        // Common interaction patterns
        ".hover-lift": {
          transition:
            "transform var(--transition-fast) var(--ease-out), box-shadow var(--transition-fast) var(--ease-out)",
          "&:hover": {
            transform: "translateY(-1px)",
            boxShadow: "var(--bsky-shadow-md)",
          },
        },
        ".hover-glow": {
          transition: "box-shadow var(--transition-normal) var(--ease-out)",
          "&:hover": {
            boxShadow: "var(--bsky-glow)",
          },
        },
        ".press-feedback": {
          transition: "transform var(--transition-fast) var(--ease-spring)",
          "&:active": {
            transform: "scale(0.98)",
          },
        },
        // Color transition utilities
        ".transition-colors-smooth": {
          transitionProperty:
            "color, background-color, border-color, text-decoration-color, fill, stroke",
          transitionDuration: "var(--transition-fast)",
          transitionTimingFunction: "var(--ease-default)",
        },
        // Opacity transition utilities
        ".transition-opacity-smooth": {
          transitionProperty: "opacity",
          transitionDuration: "var(--transition-fast)",
          transitionTimingFunction: "var(--ease-default)",
        },
        // Transform transition utilities
        ".transition-transform-smooth": {
          transitionProperty: "transform",
          transitionDuration: "var(--transition-normal)",
          transitionTimingFunction: "var(--ease-out)",
        },
        // Animation delay utilities for staggered animations
        ".delay-0": { animationDelay: "0ms" },
        ".delay-50": { animationDelay: "50ms" },
        ".delay-100": { animationDelay: "100ms" },
        ".delay-150": { animationDelay: "150ms" },
        ".delay-200": { animationDelay: "200ms" },
        ".delay-300": { animationDelay: "300ms" },
      });
    },
    // Custom component classes plugin
    function ({ addComponents }) {
      addComponents({
        // Glass morphism effect with subtle gradient overlay
        ".bsky-glass": {
          background:
            "linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.92) 100%)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(0, 0, 0, 0.08)",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.03)",
        },
        ".dark .bsky-glass": {
          background:
            "linear-gradient(180deg, rgba(17, 24, 39, 0.98) 0%, rgba(17, 24, 39, 0.92) 100%)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3)",
        },
        '[data-theme="dark"] .bsky-glass': {
          background:
            "linear-gradient(180deg, rgba(17, 24, 39, 0.88) 0%, rgba(17, 24, 39, 0.82) 100%)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3)",
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
          background:
            "linear-gradient(135deg, var(--bsky-primary) 0%, var(--bsky-accent) 100%)",
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
