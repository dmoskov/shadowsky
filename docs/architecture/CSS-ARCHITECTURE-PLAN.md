# CSS Architecture Plan

## Overview

This document outlines a clean, scalable CSS architecture for the Bluesky client project.

## Current Issues

- 33 CSS files with overlapping responsibilities
- 6+ conflicting thread-related CSS files
- No clear naming conventions or organization
- Excessive use of !important declarations
- CSS selectors not matching actual React component structure

## Proposed Architecture

### Directory Structure

```
src/styles/
├── base/              # Foundation layer
│   ├── reset.css         # Normalize defaults
│   ├── variables.css     # CSS custom properties
│   └── typography.css    # Font system
│
├── design-system/     # Design tokens and system
│   ├── colors.css        # Color system and themes
│   ├── spacing.css       # Spacing scale
│   ├── shadows.css       # Elevation system
│   └── transitions.css   # Animation tokens
│
├── layout/            # Page layouts
│   ├── app-layout.css    # Main app structure
│   ├── containers.css    # Container utilities
│   └── grid.css          # Grid systems
│
├── components/        # Component-specific styles
│   ├── buttons.css       # Button components
│   ├── cards.css         # Card components
│   ├── forms.css         # Form elements
│   ├── modals.css        # Modal overlays
│   └── navigation.css    # Nav components
│
├── features/          # Feature-specific styles
│   ├── feed.css          # Feed page
│   ├── thread.css        # Thread view
│   ├── profile.css       # Profile pages
│   ├── search.css        # Search interface
│   ├── analytics.css     # Analytics dashboard
│   └── settings.css      # Settings pages
│
├── utilities/         # Utility classes
│   ├── animations.css    # Animation utilities
│   ├── responsive.css    # Breakpoint utilities
│   ├── states.css        # State classes (loading, error)
│   └── helpers.css       # Misc helpers
│
└── index.css          # Main entry point
```

### Import Order (index.css)

```css
/* 1. Base layer - resets and foundations */
@import "./base/reset.css";
@import "./base/variables.css";
@import "./base/typography.css";

/* 2. Design system - tokens and system values */
@import "./design-system/colors.css";
@import "./design-system/spacing.css";
@import "./design-system/shadows.css";
@import "./design-system/transitions.css";

/* 3. Layout - structural styles */
@import "./layout/app-layout.css";
@import "./layout/containers.css";
@import "./layout/grid.css";

/* 4. Components - reusable UI components */
@import "./components/buttons.css";
@import "./components/cards.css";
@import "./components/forms.css";
@import "./components/modals.css";
@import "./components/navigation.css";

/* 5. Features - page/feature specific */
@import "./features/feed.css";
@import "./features/thread.css";
@import "./features/profile.css";
@import "./features/search.css";
@import "./features/analytics.css";
@import "./features/settings.css";

/* 6. Utilities - helper classes */
@import "./utilities/animations.css";
@import "./utilities/responsive.css";
@import "./utilities/states.css";
@import "./utilities/helpers.css";
```

## Naming Conventions

### BEM-inspired Approach

```css
/* Block */
.post-card {
}

/* Element */
.post-card__header {
}
.post-card__content {
}
.post-card__footer {
}

/* Modifier */
.post-card--highlighted {
}
.post-card--compact {
}

/* State */
.post-card.is-loading {
}
.post-card.is-selected {
}
```

### Utility Classes

```css
/* Spacing */
.m-0, .m-1, .m-2, .m-3, .m-4
.p-0, .p-1, .p-2, .p-3, .p-4

/* Display */
.d-none, .d-block, .d-flex
.d-md-block, .d-lg-none

/* Text */
.text-primary, .text-secondary
.text-sm, .text-base, .text-lg
```

## Migration Strategy

### Phase 1: Consolidation (1-2 days)

1. Create new directory structure
2. Consolidate related CSS files
3. Remove duplicate rules
4. Fix conflicting selectors

### Phase 2: Refactoring (3-4 days)

1. Update selectors to match React components
2. Remove all !important declarations
3. Implement BEM naming where appropriate
4. Extract common patterns to utilities

### Phase 3: Optimization (1-2 days)

1. Remove unused CSS
2. Implement CSS modules for components
3. Add PostCSS for optimization
4. Document component styles

## Best Practices

### Do's

- Use CSS custom properties for theming
- Keep specificity low (max 2 levels)
- Use semantic class names
- Comment complex calculations
- Mobile-first responsive design

### Don'ts

- Avoid ID selectors for styling
- No inline styles in components
- No !important (except utilities)
- No deeply nested selectors (>3 levels)
- No magic numbers without variables

## Component Style Template

```css
/* components/example-component.css */

/* Component container */
.example-component {
  /* Layout */
  display: flex;
  padding: var(--spacing-3);

  /* Appearance */
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);

  /* Transitions */
  transition: background var(--transition-base);
}

/* Component elements */
.example-component__header {
  margin-bottom: var(--spacing-2);
}

.example-component__content {
  flex: 1;
}

/* Component states */
.example-component:hover {
  background: var(--color-bg-hover);
}

.example-component.is-active {
  border-color: var(--color-brand-primary);
}

/* Responsive */
@media (max-width: 768px) {
  .example-component {
    padding: var(--spacing-2);
  }
}
```

## Benefits

1. **Clear organization** - Easy to find and modify styles
2. **No conflicts** - Proper scoping prevents style clashes
3. **Reusability** - Utility classes and component patterns
4. **Performance** - Optimized file size and load order
5. **Maintainability** - Clear conventions and documentation
6. **Scalability** - Easy to add new features without breaking existing styles

## Next Steps

1. Get approval on architecture
2. Create migration checklist
3. Begin Phase 1 consolidation
4. Update component imports progressively
5. Document as we go
