# Tailwind CSS Migration Progress

## Overview
This document tracks the progress of migrating the Bluesky client from CSS/inline styles to Tailwind CSS v4.

## Migration Status

### ✅ Completed Components (12)

1. **PostCard** - Fully migrated with all variants
2. **PostHeader** - Author info, timestamps, menu
3. **PostContent** - Text content, formatting
4. **PostEngagementBar** - Like, repost, reply buttons
5. **Feed** - Container and layout
6. **Login** - Form styling and layout
7. **Header** - Navigation bar with scroll effects
8. **Sidebar** - Navigation menu and compose button
9. **Notifications** - List view with icons and interactions
10. **Profile** - User info, stats, tabs, feed
11. **Search** - Search input, suggestions, results
12. **ComposeModal** - Post composition with reply context

### 🚧 Pending Components

#### Thread Components
- ThreadView
- ThreadBranchDiagram
- ThreadNavigation
- ThreadLine
- ThreadIndicator
- ParentPost

#### UI Components
- Toast
- Tooltip
- EmptyStates
- ErrorStates
- SkeletonLoaders
- ScrollProgress

#### Mobile Components
- MobileNav
- MobileMenu
- MobileTabBar

#### Analytics Components
- Analytics dashboard
- Various chart components

#### Other Components
- Settings
- FollowersModal
- KeyboardShortcutsModal

### 📁 CSS Files to Remove (After Full Migration)
- `/src/styles/post-card.css`
- `/src/styles/feed.css`
- `/src/styles/header.css`
- `/src/styles/sidebar.css`
- `/src/styles/notifications.css`
- `/src/styles/profile.css`
- `/src/styles/search.css`
- `/src/styles/compose.css`

## Technical Details

### Tailwind v4 Integration
- Using stable v4.1.8 (not alpha)
- Separate import file to avoid conflicts
- PostCSS configuration working correctly
- Prettier plugin for class sorting

### Development Tools
- **VS Code IntelliSense**: Configured for conflicting class detection
- **Prettier**: Automatic class sorting with tailwind plugin
- **ESLint**: Waiting for v4 compatible plugin

### Key Patterns Established

1. **Color System**
   - Background: `bg-gray-900`, `bg-gray-800`
   - Borders: `border-gray-800`, `border-gray-700`
   - Text: `text-gray-100` (primary), `text-gray-400` (secondary)
   - Interactive: `hover:bg-gray-800`, `hover:bg-gray-700`

2. **Layout**
   - Containers: `max-w-4xl mx-auto`
   - Cards: `bg-gray-900 border border-gray-800 rounded-lg`
   - Spacing: Consistent use of `p-4`, `gap-3`, etc.

3. **Interactions**
   - Buttons: `px-4 py-2 rounded-lg transition-colors`
   - Hover states: `hover:bg-gray-800`
   - Disabled: `disabled:opacity-50 disabled:cursor-not-allowed`

## Next Steps

1. Continue with thread components (high complexity)
2. Migrate UI utility components
3. Complete mobile-specific components
4. Remove old CSS files
5. Create team documentation for Tailwind patterns