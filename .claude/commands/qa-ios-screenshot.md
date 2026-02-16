---
description: Take a simulator screenshot and analyze it for visual issues
allowed-tools: Bash(xcrun simctl:*), Read
---

# iOS Screenshot Analysis

Quick command to capture and analyze the current iOS simulator state.

## Instructions

1. Take a screenshot:
   ```
   xcrun simctl io booted screenshot /tmp/qa-ios-screenshot.png
   ```

2. Read the screenshot image file to view it visually.

3. Analyze the screenshot for these visual issues:

### Layout Issues
- Content clipped on left/right edges (text cut off, avatars partially hidden)
- Content overflowing beyond screen width
- Overlapping elements
- Incorrect z-ordering

### Rendering Issues
- Gray placeholder circles where avatars should load
- Broken image embeds (gray rectangles with no content)
- Missing or malformed text (garbled characters, encoding issues)
- Incorrect colors or contrast

### Spacing & Alignment
- Inconsistent padding between post cards
- Misaligned action bar icons (reply, repost, like, share)
- Tab bar icons not centered
- Text baseline misalignment between display name and timestamp

### Interactive Elements
- Buttons that appear unresponsive (wrong styling)
- Missing tap targets
- Notification badges not rendering

### Screen Identification
Identify which screen is currently showing:
- **Home Feed**: Shows post cards with avatars, text, embeds, action bar. Tab bar at bottom with Home highlighted.
- **Search**: Search bar at top, trending/suggested content
- **Notifications**: List of notification cells with icons (heart, repost, follow, mention)
- **Profile**: Banner image, avatar, display name, stats (posts/followers/following), tab bar (Posts/Replies/Media/Likes)
- **Thread**: Root post at top with nested reply cards below
- **Login**: Form with handle/email input, password input, sign in button

4. Report findings with specific descriptions of what looks wrong and where on screen.
