---
description: Full QA pass of the iOS app - screenshot analysis, code review, and layout audit
allowed-tools: Bash(xcrun simctl:*), Bash(npx expo:*), Read, Glob, Grep, Task, TodoWrite
---

# iOS QA Pass

Run a comprehensive QA pass on the iOS app. This includes visual screenshot analysis, code-level review of all native SwiftUI modules, and a layout pattern audit.

## Prerequisites

- iOS Simulator must be booted with the app running
- Booted device: !`xcrun simctl list devices booted 2>/dev/null | head -3`

## Step 1: Visual Screenshot Analysis

1. Take a screenshot of the current simulator state:
   ```
   xcrun simctl io booted screenshot /tmp/qa-ios-current.png
   ```
2. Read the screenshot image and analyze for visual issues:
   - Content clipping (text cut off, avatars invisible)
   - Layout overflow (content extending beyond screen bounds)
   - Missing images or broken placeholders
   - Incorrect spacing or alignment
   - Tab bar rendering issues
   - Status bar overlap with content

## Step 2: Native SwiftUI Module Review

Review each native iOS module for issues. Read the key files and check for problems.

### Module Paths

| Module | Key Files |
|--------|-----------|
| Feed List | `mobile/modules/native-feed-list/ios/FeedListView.swift`, `PostCardView.swift`, `FeedListModule.swift` |
| Thread View | `mobile/modules/native-thread-view/ios/ThreadView.swift`, `ThreadPostCard.swift` |
| Notifications | `mobile/modules/native-notifications-list/ios/NotificationListView.swift`, `NotificationCellView.swift` |
| Profile | `mobile/modules/native-profile-view/ios/ProfileView.swift`, `ProfileHeaderView.swift` |
| Embeds | `mobile/modules/expo-swiftui-feed/ios/Sources/ExpoSwiftUIFeed/PostEmbed.swift`, `ImageEmbed.swift`, `VideoEmbed.swift`, `ExternalLinkEmbed.swift`, `QuoteEmbed.swift` |
| Rich Text | `mobile/modules/rich-text-view/ios/RichTextView.swift` |

### Code Review Checklist

For each module, check:
- [ ] No `.fixedSize(horizontal: false, vertical: true)` inside ScrollView/LazyVStack (causes width overflow)
- [ ] No `UIScreen.main.bounds` for layout calculations (use GeometryReader instead)
- [ ] UIViewRepresentable views have `setContentCompressionResistancePriority(.defaultLow, for: .horizontal)`
- [ ] Text views in scrollable containers use `.frame(maxWidth: .infinity, alignment: .leading)` not `.fixedSize`
- [ ] AsyncImage has proper placeholder and failure states
- [ ] Event handlers are properly wired (onPress, onLike, onRepost, etc.)
- [ ] NotificationCenter observers are properly cleaned up in `stopObserving()`/`deinit`
- [ ] No retain cycles in closures (use `[weak self]`)

## Step 3: Layout Pattern Audit

Run the `/qa-ios-layout` command to grep for known dangerous patterns across all Swift files.

## Step 4: Build Verification

Run the `/qa-ios-build` command to verify the project compiles with no errors.

## Step 5: Report

Summarize findings:
1. **Visual issues** found in screenshots
2. **Code issues** found during module review
3. **Layout pattern violations** found by audit
4. **Build status** (pass/fail with error count)

For each issue, include:
- File path and line number
- Description of the problem
- Suggested fix
- Severity (critical / warning / info)

## Known Bug Patterns (Historical)

These bugs have been found and fixed before. Watch for regressions:

1. **RichTextView UITextView width overflow** — `WrappingRichText: UIViewRepresentable` wrapping UITextView can report unbounded intrinsic content width, causing parent views in ScrollView to overflow. Fix: `setContentCompressionResistancePriority(.defaultLow, for: .horizontal)`

2. **`.fixedSize` in scrollable containers** — `.fixedSize(horizontal: false, vertical: true)` tells SwiftUI to use the view's "ideal" width, which for UITextView is the full unwrapped text width. Fix: use `.frame(maxWidth: .infinity, alignment: .leading)` instead.

3. **Triple image layout overflow** — `UIScreen.main.bounds.width * 0.66` ignores parent padding, causing images to overflow container. Fix: use `GeometryReader` for relative width.

4. **Access control** — Expo native modules that share types across module boundaries need `public` access modifiers on structs, properties, and initializers.
