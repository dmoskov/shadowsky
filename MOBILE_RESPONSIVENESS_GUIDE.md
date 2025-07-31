# Mobile Responsiveness Guide for BSKY

This guide documents the essential practices and rules to maintain proper mobile responsiveness and prevent viewport zooming/overflow issues.

## Critical Viewport Rules

### 1. Viewport Meta Tag
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0" />
```

**DO NOT:**
- Use `maximum-scale=1.0` - This prevents users from zooming
- Use `user-scalable=no` - This completely disables zoom and hurts accessibility
- Use both together - This causes browsers to force zoom at narrow viewports

**DO:**
- Use `minimum-scale=1.0` - This prevents zoom-out while allowing zoom-in
- Allow users to zoom for accessibility

### 2. Global Overflow Prevention

**Essential CSS in `index.css`:**
```css
html {
  overflow-x: hidden;
}

body {
  margin: 0;
  overflow-x: hidden;
  width: 100%;
  position: relative;
  /* DO NOT add min-width - it causes horizontal scroll */
}
```

**Main container in `App.tsx`:**
```jsx
<main className="flex-1 lg:ml-64 mt-16 h-[calc(100vh-4rem)] overflow-x-hidden">
```

## Component-Level Best Practices

### 1. Responsive Padding
Always use responsive padding that reduces on mobile:
```jsx
// ❌ BAD - Same padding on all screen sizes
<div className="px-6">

// ✅ GOOD - Reduced padding on mobile
<div className="px-3 sm:px-6">

// ✅ BETTER - More granular control
<div className="px-3 sm:px-4 md:px-6">
```

### 2. Fixed Width Elements
Avoid fixed pixel widths without responsive alternatives:
```jsx
// ❌ BAD - Fixed width that might overflow
<div className="w-64">

// ✅ GOOD - Responsive width with maximum
<div className="w-full max-w-[16rem]">

// ✅ BETTER - With viewport constraint
<div className="w-64 max-w-[80vw]">
```

### 3. Absolute Positioning
Make absolute positioning responsive:
```jsx
// ❌ BAD - Fixed position that pushes content off-screen
<div className="absolute left-[7.5rem]">

// ✅ GOOD - Responsive positioning
<div className="absolute left-[5rem] sm:left-[7.5rem]">
```

### 4. Text Overflow
Ensure text wraps properly on mobile:
```css
/* Global rule for mobile in index.css */
@media (max-width: 640px) {
  p, span, div {
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
}
```

For specific elements:
```jsx
// ❌ BAD - Forces text to stay on one line
<span className="whitespace-nowrap">

// ✅ GOOD - Allows text to wrap
<span className="truncate"> // or just remove whitespace-nowrap
```

### 5. Large Spacing Values
Reduce large spacing on mobile:
```jsx
// ❌ BAD - Excessive padding on mobile
<div className="p-12">

// ✅ GOOD - Responsive padding
<div className="p-6 sm:p-12">

// ❌ BAD - Large gaps that consume mobile width
<div className="gap-12">

// ✅ GOOD - Responsive gaps
<div className="gap-6 sm:gap-12">
```

## Testing Checklist

### Critical Viewport Widths to Test:
- **280px** - Galaxy Fold (folded)
- **320px** - iPhone SE, older small phones
- **360px** - Many Android devices
- **375px** - iPhone 12/13/14/15 Mini
- **390px** - iPhone 12/13/14/15 Pro
- **400px** - Common breakpoint
- **414px** - iPhone Plus models
- **430px** - iPhone Pro Max models

### Testing Process:
1. Open Chrome/Firefox DevTools (F12)
2. Toggle device mode
3. Test each width listed above
4. Drag to resize smoothly between 280-430px
5. Check for:
   - Horizontal scrollbars
   - Content cut off on the right
   - Forced zoom (content appears smaller than expected)
   - Overlapping elements

## Common Problem Areas

### 1. Thread/Comment Indentation
```jsx
// Calculate responsive indentation based on viewport
const isMobile = window.innerWidth < 640
if (isMobile) {
  // Use percentage-based or smaller values
  return Math.min(32, window.innerWidth * 0.08)
}
```

### 2. Sidebar on Mobile
```jsx
// Ensure sidebar doesn't exceed viewport width
<aside className="w-64 max-w-[80vw]">
```

### 3. Images and Media
```jsx
// Always constrain images
<img className="w-full max-w-full object-cover" />

// For video players
<div className="w-full max-w-full overflow-hidden">
  <video className="w-full" />
</div>
```

### 4. Modal and Overlay Widths
```jsx
// Ensure modals fit on mobile
<div className="w-full max-w-lg mx-auto px-4">
```

## Pre-Commit Checklist

Before committing any UI changes:

1. **Test at 320px, 375px, and 400px minimum**
2. **Check all overflow-x properties are in place**
3. **Verify no min-width on body**
4. **Ensure viewport meta tag is correct**
5. **Test text wrapping with long content**
6. **Verify padding reduces on mobile**
7. **Check that all fixed widths have max-width constraints**

## Component-Specific Notes

### NotificationsFeed
- Uses `px-3 sm:px-6` for responsive padding
- Max width container: `max-w-4xl mx-auto`
- Sticky header must not overflow

### Home
- Feed selector uses `overflow-x-auto` for horizontal scroll
- Container uses `px-3 sm:px-4` padding
- Removed `whitespace-nowrap` from feed buttons

### ThreadViewer
- Dynamic indentation based on viewport width
- Special handling for mobile vs desktop
- Uses percentage-based calculations on mobile

### VisualTimeline
- Absolute positioned elements use responsive classes
- Timeline line position: `left-[5rem] sm:left-[7.5rem]`
- Reduced padding values on mobile

## Debug Tips

If you see horizontal scroll or zoom issues:

1. **In DevTools Console:**
   ```javascript
   // Find elements causing overflow
   Array.from(document.querySelectorAll('*')).filter(el => 
     el.scrollWidth > el.clientWidth
   )
   ```

2. **Add temporary CSS:**
   ```css
   * {
     outline: 1px solid red !important;
   }
   ```
   This helps visualize which elements are overflowing

3. **Check computed styles:**
   - Look for elements with fixed widths
   - Check for large padding/margin values
   - Verify min-width properties

## Remember: Mobile First!

When adding new features:
1. Design for 320px width first
2. Add complexity for larger screens
3. Test at multiple breakpoints
4. Always include overflow protection
5. Use responsive spacing utilities

By following these guidelines, the app will maintain proper mobile responsiveness and avoid the frustrating zoom/overflow issues on narrow viewports.