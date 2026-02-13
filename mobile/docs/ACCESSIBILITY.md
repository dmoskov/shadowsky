# Accessibility Guide

This document outlines the accessibility features implemented in the BSKY mobile app.

## Overview

The app follows Apple's iOS Human Interface Guidelines and Android's Material Design accessibility guidelines to ensure the app is usable by everyone, including users with disabilities.

## Features Implemented

### 1. Screen Reader Support (VoiceOver/TalkBack)

All interactive elements include proper accessibility labels and hints:

- **accessibilityLabel**: Describes what the element is
- **accessibilityHint**: Describes what happens when you interact with it
- **accessibilityRole**: Defines the type of element (button, text, image, etc.)
- **accessibilityState**: Indicates current state (disabled, selected, busy, etc.)

#### Examples:

```tsx
// Button component
<TouchableOpacity
  accessibilityRole="button"
  accessibilityLabel="Follow user"
  accessibilityHint="Double tap to follow this user"
  accessibilityState={{disabled: isPending, busy: isPending}}
>
```

### 2. Dynamic Type Support

The app supports Dynamic Type on iOS and Font Scale on Android, allowing users to adjust text size system-wide.

#### Usage:

```tsx
import {getTypographySize, typography} from '../utils/typography';

// In your styles
const styles = StyleSheet.create({
  text: {
    fontSize: getTypographySize('body'), // Automatically scales
  },
});
```

#### Available Typography Sizes:

- Headings: `h1`, `h2`, `h3`, `h4`, `h5`, `h6`
- Body: `body`, `bodyLarge`, `bodySmall`
- UI: `caption`, `button`, `label`
- Special: `tiny`

### 3. Reduced Motion Support

Users who enable "Reduce Motion" in system settings will experience fewer animations.

#### Usage:

```tsx
import {useReducedMotion} from '../hooks/useAccessibility';

function MyComponent() {
  const reduceMotion = useReducedMotion();

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn}
      exiting={reduceMotion ? undefined : FadeOut}
    >
      {/* content */}
    </Animated.View>
  );
}
```

### 4. Minimum Touch Targets

All interactive elements meet the minimum touch target size:
- iOS: 44x44 points (iOS Human Interface Guidelines)
- Android: 48x48 dp (Material Design)

Use the utility function:

```tsx
import {MIN_TOUCH_TARGET_SIZE} from '../utils/typography';

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TOUCH_TARGET_SIZE,
    minWidth: MIN_TOUCH_TARGET_SIZE,
  },
});
```

### 5. Semantic Structure

- Proper heading hierarchy
- Grouped related elements
- Clear navigation structure
- Error states use `accessibilityRole="alert"`

### 6. Alt Text for Images

All images include descriptive alt text:

```tsx
<Avatar
  uri={author.avatar}
  accessibilityLabel={`${author.displayName}'s avatar`}
/>
```

### 7. Keyboard Navigation Support

All interactive elements are keyboard accessible on devices with external keyboards.

## Component Accessibility

### Core Components

#### Button
- ✅ accessibilityRole="button"
- ✅ accessibilityLabel
- ✅ accessibilityHint (optional)
- ✅ accessibilityState (disabled, busy)
- ✅ Minimum touch target size

#### Avatar
- ✅ accessibilityRole="image"
- ✅ accessibilityLabel
- ✅ accessibilityIgnoresInvertColors (for images)

#### FollowButton
- ✅ accessibilityRole="button"
- ✅ Dynamic labels based on state
- ✅ accessibilityHint
- ✅ accessibilityState (disabled, busy)

### Feed Components

#### PostCard
- ✅ Main container with summary label
- ✅ Individual action buttons (like, repost, reply, bookmark, share)
- ✅ Profile navigation
- ✅ Menu actions (mute, block, report)
- ✅ State indicators (liked, bookmarked)

#### NotificationItem
- ✅ Descriptive labels including notification type
- ✅ Unread state indication
- ✅ Profile navigation

#### FeedList
- ✅ Scroll container with proper labels
- ✅ Refresh control
- ✅ Empty and error states

### UI Components

#### EmptyState
- ✅ accessibilityRole="text"
- ✅ Descriptive label

#### ErrorState
- ✅ accessibilityRole="alert"
- ✅ Retry button with hint

#### ImageCarousel
- ✅ Close button
- ✅ Alt text toggle
- ✅ Image navigation hints
- ✅ Image counter

## Testing Accessibility

### iOS VoiceOver

1. Enable VoiceOver: Settings > Accessibility > VoiceOver
2. Test navigation: Swipe right/left to navigate
3. Test actions: Double tap to activate
4. Test labels: Ensure all elements are properly announced

### Android TalkBack

1. Enable TalkBack: Settings > Accessibility > TalkBack
2. Test navigation: Swipe right/left to navigate
3. Test actions: Double tap to activate
4. Test labels: Ensure all elements are properly announced

### Dynamic Type Testing

#### iOS:
1. Settings > Display & Brightness > Text Size
2. Test with different text sizes
3. Verify text scales properly and doesn't get cut off

#### Android:
1. Settings > Display > Font size
2. Test with different font sizes
3. Verify text scales properly

### Reduced Motion Testing

#### iOS:
1. Settings > Accessibility > Motion > Reduce Motion
2. Verify animations are reduced/removed

#### Android:
1. Settings > Accessibility > Remove animations
2. Verify animations are reduced/removed

## Best Practices

### When Adding New Components

1. **Always add accessibility labels** to interactive elements
2. **Use appropriate accessibilityRole** (button, link, image, text, etc.)
3. **Add accessibilityHint** for non-obvious actions
4. **Set accessibilityState** for stateful components
5. **Ensure minimum touch target size** (44pt iOS, 48dp Android)
6. **Test with VoiceOver/TalkBack** before submitting

### Labels Should Be:

- **Concise**: "Follow user" not "This button allows you to follow the user"
- **Descriptive**: Include relevant state information
- **Localized**: Support multiple languages
- **Dynamic**: Update based on component state

### Hints Should Be:

- **Action-oriented**: Start with verbs like "Double tap to..."
- **Optional**: Only add if the action isn't obvious
- **Brief**: Keep under 10 words

## App Store Requirements

Apple requires apps to:
- ✅ Support VoiceOver
- ✅ Support Dynamic Type
- ✅ Have proper contrast ratios (4.5:1 for normal text, 3:1 for large text)
- ✅ Support reduced motion preferences
- ✅ Meet minimum touch target sizes

All requirements are met in this implementation.

## Resources

- [iOS Accessibility Guidelines](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Android Accessibility Guidelines](https://developer.android.com/guide/topics/ui/accessibility)
- [React Native Accessibility API](https://reactnative.dev/docs/accessibility)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
