/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Dynamic theme colors using CSS variables
        asph: {
          primary: {
            DEFAULT: "var(--asph-primary)",
            dark: "var(--asph-primary-dark)",
            light: "var(--asph-primary-light)",
            10: "var(--asph-primary-10)",
          },
          accent: "var(--asph-accent)",
          bg: {
            primary: "var(--asph-bg-primary)",
            secondary: "var(--asph-bg-secondary)",
            tertiary: "var(--asph-bg-tertiary)",
            hover: "var(--asph-bg-hover)",
            active: "var(--asph-bg-active)",
          },
          text: {
            primary: "var(--asph-text-primary)",
            secondary: "var(--asph-text-secondary)",
            tertiary: "var(--asph-text-tertiary)",
            link: "var(--asph-text-link)",
          },
          border: {
            primary: "var(--asph-border-primary)",
            secondary: "var(--asph-border-secondary)",
            light: "var(--asph-border-light)",
          },
          // Notification colors
          like: "var(--asph-like)",
          repost: "var(--asph-repost)",
          follow: "var(--asph-follow)",
          mention: "var(--asph-mention)",
          reply: "var(--asph-reply)",
          quote: "var(--asph-quote)",
          // Status colors
          success: {
            DEFAULT: "var(--asph-success)",
            10: "var(--asph-success-10)",
          },
          warning: "var(--asph-warning)",
          error: "var(--asph-error)",
          info: "var(--asph-info)",
        },
      },
      boxShadow: {
        "asph-sm": "var(--asph-shadow-sm)",
        "asph-md": "var(--asph-shadow-md)",
        "asph-lg": "var(--asph-shadow-lg)",
        "asph-xl": "var(--asph-shadow-xl)",
        "asph-glow": "var(--asph-glow)",
        "asph-inner": "var(--asph-shadow-inner)",
        "asph-ring": "var(--asph-shadow-ring)",
        "asph-ring-primary": "var(--asph-shadow-ring-primary)",
      },
      letterSpacing: {
        "asph-tight": "var(--asph-letter-spacing-tight)",
        "asph-heading": "var(--asph-letter-spacing-heading)",
        "asph-wide": "var(--asph-letter-spacing-wide)",
      },
      fontSize: {
        // Shared type scale, named after iOS Dynamic Type styles (see
        // packages/tokens/tokens.mjs); identical vocabulary to mobile's
        // src/utils/typography.ts
        "asph-large-title": ["var(--asph-font-large-title)", "1.2"],
        "asph-title1": ["var(--asph-font-title1)", "1.25"],
        "asph-title2": ["var(--asph-font-title2)", "1.3"],
        "asph-title3": ["var(--asph-font-title3)", "1.3"],
        "asph-headline": ["var(--asph-font-headline)", "1.4"],
        "asph-body": ["var(--asph-font-body)", "1.5"],
        "asph-callout": ["var(--asph-font-callout)", "1.45"],
        "asph-subheadline": ["var(--asph-font-subheadline)", "1.45"],
        "asph-footnote": ["var(--asph-font-footnote)", "1.4"],
        "asph-caption1": ["var(--asph-font-caption1)", "1.35"],
        "asph-caption2": ["var(--asph-font-caption2)", "1.35"],
      },
      animation: {
        // Existing animations
        "fade-in": "fadeIn 0.3s ease-out",
        "fade-in-up": "fadeInUp 0.3s ease-out",
        pulse: "asphPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
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
        // Spring animations for interactive elements
        "spring-scale":
          "springScale var(--transition-normal) var(--ease-spring-soft)",
        "spring-pop": "springPop 300ms var(--ease-spring-medium)",
        "spring-bounce-in":
          "springBounceIn 400ms var(--ease-spring-soft) forwards",
        // Toggle spring animation
        "toggle-spring": "toggleSpring 250ms var(--ease-spring-soft)",
        // Button press spring
        "button-spring": "buttonSpring 200ms var(--ease-spring-snappy)",
        // Card hover spring
        "card-lift": "cardLift 200ms var(--ease-spring-soft) forwards",
        // Chart bar grow (composited scaleY, replaces height animation)
        "grow-up": "growUp 500ms var(--ease-spring-soft) forwards",
      },
      keyframes: {
        growUp: {
          from: { transform: "scaleY(0)" },
          to: { transform: "scaleY(1)" },
        },
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
        asphPulse: {
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
            backgroundColor: "rgba(255, 107, 157, 0.2)",
          },
          "100%": {
            backgroundColor: "transparent",
          },
        },
        highlightFlash: {
          "0%": {
            boxShadow: "0 0 0 0 rgba(255, 107, 157, 0.8)",
            transform: "scale(1)",
          },
          "50%": {
            boxShadow: "0 0 20px 10px rgba(255, 107, 157, 0.3)",
            transform: "scale(1.01)",
          },
          "100%": {
            boxShadow: "0 0 0 0 rgba(255, 107, 157, 0)",
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
        // Spring animations for interactive elements
        springScale: {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.05)" },
          "100%": { transform: "scale(1)" },
        },
        springPop: {
          "0%": { transform: "scale(0.95)", opacity: "0.8" },
          "40%": { transform: "scale(1.03)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        springBounceIn: {
          "0%": { transform: "scale(0)", opacity: "0" },
          "50%": { transform: "scale(1.08)" },
          "75%": { transform: "scale(0.97)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        // Toggle switch spring
        toggleSpring: {
          "0%": { transform: "translateX(0)" },
          "60%": { transform: "translateX(calc(100% + 2px))" },
          "80%": { transform: "translateX(calc(100% - 1px))" },
          "100%": { transform: "translateX(100%)" },
        },
        // Button press spring
        buttonSpring: {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(0.95)" },
          "70%": { transform: "scale(1.02)" },
          "100%": { transform: "scale(1)" },
        },
        // Card lift spring
        cardLift: {
          "0%": {
            transform: "translateY(0) scale(1)",
            boxShadow: "var(--asph-shadow-sm)",
          },
          "100%": {
            transform: "translateY(-2px) scale(1.01)",
            boxShadow: "var(--asph-shadow-md)",
          },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "asph-gradient":
          "linear-gradient(135deg, var(--asph-primary) 0%, var(--asph-accent) 100%)",
        "asph-gradient-text":
          "linear-gradient(135deg, var(--asph-primary) 0%, var(--asph-accent) 100%)",
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
        // Enhanced spring curves
        "spring-soft": "var(--ease-spring-soft)",
        "spring-medium": "var(--ease-spring-medium)",
        "spring-snappy": "var(--ease-spring-snappy)",
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
            boxShadow: "var(--asph-shadow-md)",
          },
        },
        ".hover-glow": {
          transition: "box-shadow var(--transition-normal) var(--ease-out)",
          "&:hover": {
            boxShadow: "var(--asph-glow)",
          },
        },
        ".press-feedback": {
          transition: "transform var(--transition-fast) var(--ease-spring)",
          "&:active": {
            transform: "scale(0.98)",
          },
        },
        // Spring interaction utilities for buttons
        ".spring-press": {
          transition:
            "transform var(--transition-fast) var(--ease-spring-soft)",
          "@media (prefers-reduced-motion: no-preference)": {
            "&:active": {
              transform: "scale(0.96)",
            },
          },
        },
        ".spring-hover": {
          transition:
            "transform var(--transition-fast) var(--ease-spring-soft), box-shadow var(--transition-fast) var(--ease-out)",
          "@media (prefers-reduced-motion: no-preference)": {
            "&:hover": {
              transform: "scale(1.03)",
            },
            "&:active": {
              transform: "scale(0.98)",
            },
          },
        },
        // Spring scale for icon buttons
        ".spring-icon": {
          transition:
            "transform var(--transition-fast) var(--ease-spring-snappy), color var(--transition-fast) var(--ease-default)",
          "@media (prefers-reduced-motion: no-preference)": {
            "&:hover": {
              transform: "scale(1.15)",
            },
            "&:active": {
              transform: "scale(0.92)",
            },
          },
        },
        // Spring toggle animation
        ".spring-toggle": {
          transition:
            "transform 250ms var(--ease-spring-soft), background-color var(--transition-fast) var(--ease-default)",
        },
        // Card spring lift on hover
        ".spring-card": {
          transition:
            "transform var(--transition-normal) var(--ease-spring-soft), box-shadow var(--transition-normal) var(--ease-out)",
          "@media (prefers-reduced-motion: no-preference)": {
            "&:hover": {
              transform: "translateY(-2px) scale(1.005)",
              boxShadow: "var(--asph-shadow-md)",
            },
          },
        },
        // Subtle spring for list items
        ".spring-list-item": {
          transition:
            "transform var(--transition-fast) var(--ease-spring-soft), background-color var(--transition-fast) var(--ease-default)",
          "@media (prefers-reduced-motion: no-preference)": {
            "&:active": {
              transform: "scale(0.995)",
            },
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
        // Glass morphism effect with refined blur and subtle noise texture
        ".asph-glass": {
          background:
            "linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.88) 100%)",
          backdropFilter: "blur(16px) saturate(1.8)",
          WebkitBackdropFilter: "blur(16px) saturate(1.8)",
          border: "1px solid rgba(0, 0, 0, 0.06)",
          boxShadow:
            "0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
        },
        ".dark .asph-glass": {
          background:
            "linear-gradient(180deg, rgba(17, 24, 39, 0.92) 0%, rgba(17, 24, 39, 0.85) 100%)",
          backdropFilter: "blur(16px) saturate(1.5)",
          WebkitBackdropFilter: "blur(16px) saturate(1.5)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow:
            "0 1px 3px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
        },
        '[data-theme="dark"] .asph-glass': {
          background:
            "linear-gradient(180deg, rgba(17, 24, 39, 0.88) 0%, rgba(17, 24, 39, 0.82) 100%)",
          backdropFilter: "blur(16px) saturate(1.5)",
          WebkitBackdropFilter: "blur(16px) saturate(1.5)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow:
            "0 1px 3px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
        },
        // Custom scrollbar.
        // No longer required: src/index.css themes scrollbars globally, so a new
        // scroll container gets this for free. Kept because it is still @applied
        // in tailwind-components.css and used by ~33 components; adding it to new
        // markup is harmless but pointless.
        ".asph-scrollbar": {
          "&::-webkit-scrollbar": {
            width: "10px",
            height: "10px",
          },
          "&::-webkit-scrollbar-track": {
            background: "var(--asph-bg-primary)",
            borderRadius: "5px",
          },
          "&::-webkit-scrollbar-thumb": {
            background: "var(--asph-bg-tertiary)",
            borderRadius: "5px",
            border: "2px solid var(--asph-bg-primary)",
          },
          "&::-webkit-scrollbar-thumb:hover": {
            background: "var(--asph-bg-hover)",
          },
        },
        // Gradient text utility
        ".asph-gradient-text": {
          background:
            "linear-gradient(135deg, var(--asph-primary) 0%, var(--asph-accent) 100%)",
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
