# CSS to Tailwind Migration Plan

## Migration Status: COMPLETED ✅

All CSS files have been successfully migrated to Tailwind utilities. The migration is complete.

## Overview

Migrate all custom CSS to Tailwind utilities while preserving 100% of current functionality, visual appearance, and user experience.

## Current State Analysis

### CSS Files Overview

- **src/index.css** - Main entry point, already imports Tailwind
- **src/styles/base-composer.css** - Basic composer styles
- **src/styles/bluesky-theme.css** - Core theme system with CSS variables
- **src/styles/bookmark-animation.css** - Bookmark button animations
- **src/styles/bookmarks.css** - Bookmarks feature UI
- **src/styles/composer.css** - Post composer interface
- **src/styles/conversations.css** - Conversation threads UI
- **src/styles/direct-messages.css** - Direct messaging interface
- **src/styles/feed-context.css** - Feed post context (replies, quotes)
- **src/styles/post-action-bar.css** - Post interaction buttons
- **src/styles/skydeck.css** - Column-based layout system
- **src/styles/timeline.css** - Timeline view for activity

## Phase 1: Foundation Setup

### 1.1 Tailwind Configuration Enhancement

- Extend tailwind.config.js to include all custom values from CSS variables
- Add custom animation definitions (fadeIn, slide, shimmer, bounce, ripple)
- Configure custom colors from bluesky-theme.css variables
- Set up component plugin for frequently used patterns

### 1.2 Theme System Preservation

- Keep CSS variables in index.css for dynamic theming
- Create Tailwind color palette that references CSS variables
- Maintain light/dark mode switching capability

## Phase 2: Component Migration (Priority Order)

### High Priority - Simple Conversions

#### 1. Timeline.css

- Remove duplicate grid utilities
- Convert layouts to Tailwind flex/grid
- Replace custom spacing with Tailwind utilities
- Keep line-clamp as Tailwind utility

#### 2. Base-composer.css

- Convert all styles to inline Tailwind classes
- Replace z-index values with Tailwind z-\* utilities
- Use Tailwind transition utilities

#### 3. Post-action-bar.css

- Convert layout to Tailwind flex utilities
- Use Tailwind hover: and active: modifiers
- Keep custom color values as Tailwind arbitrary values

### Medium Priority - Component Classes

#### 4. Bluesky-theme.css Components

- Create @apply directives for .bsky-button variants
- Convert .bsky-card to Tailwind component
- Transform .bsky-badge to reusable classes
- Migrate tab styles to Tailwind

#### 5. Bookmarks.css

- Convert container layouts to Tailwind
- Replace custom hover effects with Tailwind
- Use Tailwind for responsive grid layouts

#### 6. Direct-messages.css

- Convert split-pane layout to Tailwind grid
- Transform message bubbles to component classes
- Use Tailwind for responsive breakpoints

### Complex Priority - Custom Interactions

#### 7. Composer.css

- Convert form layouts to Tailwind
- Keep drag-drop visual feedback as custom CSS
- Transform media grid to Tailwind

#### 8. Conversations.css

- Convert base layouts to Tailwind
- Keep thread connector lines as custom CSS
- Use Tailwind for hover states

#### 9. Feed-context.css

- Convert container styles to Tailwind
- Keep gradient reply indicators custom
- Transform hover states to Tailwind

### Special Handling

#### 10. Bookmark-animation.css

- Keep as separate CSS file initially
- Consider converting to Tailwind keyframes plugin

#### 11. Skydeck.css

- Convert layouts to Tailwind
- Keep drag-drop animations custom
- Maintain custom scrollbar styles

## Phase 3: Implementation Strategy

### 3.1 File-by-File Approach

1. Work on one CSS file at a time
2. Find all components using that CSS file
3. Convert styles to Tailwind classes in components
4. Test functionality remains identical
5. Delete CSS file only after all references removed

### 3.2 Testing Protocol

- Visual regression testing for each component
- Test all hover/focus/active states
- Verify animations work correctly
- Check responsive behavior on all breakpoints
- Test theme switching (light/dark)

### 3.3 Tooling Setup

- Use Tailwind's @apply for repeated patterns
- Set up component classes in separate file
- Use tailwind-merge for conditional classes
- Configure VS Code Tailwind IntelliSense

## Phase 4: Cleanup

### 4.1 Remove Redundancies

- Delete CSS files after successful migration
- Remove CSS imports from index.css
- Clean up duplicate utility classes
- Optimize Tailwind config for used utilities only

### 4.2 Documentation

- Document custom Tailwind configurations
- Create component class reference
- Note any remaining custom CSS and why

## Migration Rules

### Preserve Exact Behavior

- Match pixel-perfect designs
- Keep all animations timing/easing
- Maintain all responsive breakpoints
- Preserve accessibility features

### When to Keep Custom CSS

- Complex animations (ripple effects)
- Canvas/SVG drawing (thread lines)
- Dynamic calculations
- Third-party library overrides

### Tailwind Best Practices

- Use semantic color names from theme
- Leverage Tailwind's built-in animations
- Use arbitrary values sparingly
- Group related utilities with component classes

## Risk Mitigation

### Gradual Migration

- Keep both systems working during transition
- Test each component thoroughly
- Have rollback plan for each file

### Performance Monitoring

- Check bundle size changes
- Monitor runtime performance
- Ensure no style recalculation issues

### Team Coordination

- Communicate changes clearly
- Update style guide documentation
- Train on Tailwind conventions

## Detailed CSS Analysis

### src/index.css

- Already imports Tailwind base, components, and utilities
- Sets up CSS custom properties from theme variables
- Global font and color settings
- Custom scrollbar styling
- Mobile-specific responsive rules
- Custom animation utility (fade-in)

### src/styles/bluesky-theme.css

- Extensive CSS custom properties for colors, shadows, and effects
- Light/dark theme support
- Custom component classes (buttons, cards, badges, tabs)
- Gradient backgrounds and text effects
- Glass morphism effects
- Custom animations (fadeIn, slide, shimmer)
- Responsive grid utilities (duplicates Tailwind)

### src/styles/bookmark-animation.css

- Button transition and active states
- Bounce animation on bookmark
- Fill animation for icon
- Transform and scale effects

### src/styles/bookmarks.css

- Container layouts with sticky headers
- Search input styling
- Empty/loading states
- List item hover effects
- Modal styling
- Post renderer styles
- Complex grid layouts for images

### src/styles/composer.css

- Form layouts and input styling
- Media upload previews and grid
- Drag-and-drop styles with visual feedback
- Status messages with icons
- Tone adjustment animations
- Responsive design rules

### src/styles/conversations.css

- Thread connectors and visual lines
- Depth indicators for nested replies
- Hover and selection states
- Smooth scrolling
- Highlight animations
- Mobile-responsive thread indentation

### src/styles/direct-messages.css

- Split-pane layout (conversation list + chat)
- Message bubbles with sender distinction
- Unread badges
- Input form styling
- Mobile responsive layout changes

### src/styles/feed-context.css

- Reply indicators with gradients
- Quote post containers
- Thread visual connectors
- Hover states for posts
- Focus styles for accessibility
- Menu button visibility toggles

### src/styles/post-action-bar.css

- Action button layouts
- Hover color changes per action type
- Active state colors
- Click animations and ripple effects
- Mobile responsive sizing
- Accessibility focus styles

### src/styles/skydeck.css

- Custom scrollbar styling
- Drag-and-drop visual feedback
- Column animations and transitions
- Drop zone indicators
- Scroll shadows for depth
- Ripple effects

### src/styles/timeline.css

- Event cards with animations
- Sticky day headers
- Avatar stacks
- Post preview styling
- Keyboard navigation focus states
- Grid utilities (duplicates Tailwind)
- Line-clamp utilities
