export interface HelpArticle {
  id: string;
  title: string;
  category: string;
  summary: string;
  content: string;
  keywords: string[];
}

export interface HelpCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export const helpCategories: HelpCategory[] = [
  {
    id: "getting-started",
    name: "Getting Started",
    icon: "Rocket",
    description: "Learn the basics of Asphodel",
  },
  {
    id: "features",
    name: "Features",
    icon: "Layout",
    description: "Explore Asphodel's powerful features",
  },
  {
    id: "keyboard-shortcuts",
    name: "Keyboard Shortcuts",
    icon: "Keyboard",
    description: "Navigate faster with keyboard shortcuts",
  },
  {
    id: "troubleshooting",
    name: "Troubleshooting",
    icon: "Wrench",
    description: "Solutions to common issues",
  },
  {
    id: "privacy-security",
    name: "Privacy & Security",
    icon: "Shield",
    description: "Keep your account safe",
  },
];

export const helpArticles: HelpArticle[] = [
  // Getting Started
  {
    id: "what-is-shadowsky",
    title: "What is Asphodel?",
    category: "getting-started",
    summary:
      "Asphodel is a powerful alternative client for Bluesky with advanced features.",
    content: `
# What is Asphodel?

Asphodel is an advanced alternative client for the Bluesky social network. It provides a multi-column interface similar to TweetDeck, allowing you to view multiple feeds, notifications, and conversations simultaneously.

## Key Features

- **Multi-column layout**: View your timeline, notifications, messages, and custom feeds side by side
- **AI-powered features**: Smart post suggestions, content summarization, and more
- **Advanced search**: Find posts, users, and content easily
- **Keyboard navigation**: Navigate the app entirely with your keyboard
- **Offline support**: Continue reading even when offline
- **Customizable appearance**: Dark mode, themes, and layout options

## Getting Started

1. Sign in with your Bluesky account using OAuth
2. Customize your columns to show the feeds you want
3. Explore the settings to personalize your experience

Asphodel uses your existing Bluesky account - no separate registration required.
    `,
    keywords: [
      "shadowsky",
      "bluesky",
      "client",
      "introduction",
      "overview",
      "about",
    ],
  },
  {
    id: "signing-in",
    title: "How to Sign In",
    category: "getting-started",
    summary: "Sign in securely with your Bluesky account using OAuth.",
    content: `
# How to Sign In

Asphodel uses secure OAuth authentication to connect with your Bluesky account. Your password is never stored by Asphodel.

## Steps to Sign In

1. Click the **Sign In** button on the landing page
2. Enter your Bluesky handle (e.g., @yourname.bsky.social)
3. You'll be redirected to Bluesky's official login page
4. Enter your Bluesky password on the official page
5. Authorize Asphodel to access your account
6. You'll be redirected back to Asphodel, logged in

## Security Notes

- Asphodel never sees or stores your password
- You can revoke access at any time from Bluesky's settings
- Your session is stored locally and encrypted
- Multiple accounts are supported

## Troubleshooting

If you have issues signing in:
- Make sure you're using your full handle (including .bsky.social)
- Check that your Bluesky account is active
- Try clearing your browser cache
- Disable browser extensions that might block OAuth
    `,
    keywords: [
      "sign in",
      "login",
      "authentication",
      "oauth",
      "account",
      "connect",
    ],
  },
  {
    id: "columns-overview",
    title: "Understanding Columns",
    category: "getting-started",
    summary: "Learn how to use the multi-column layout to organize your feeds.",
    content: `
# Understanding Columns

Asphodel's multi-column layout lets you view multiple feeds simultaneously, similar to TweetDeck.

## Default Columns

When you first sign in, you'll see columns for:
- **Home**: Your main timeline
- **Notifications**: Likes, reposts, follows, and mentions
- **Messages**: Direct message conversations

## Adding Columns

Click the **+** button to add new columns:
- Custom feeds (Following, What's Hot, etc.)
- Specific user timelines
- Search results
- List timelines

## Managing Columns

- **Reorder**: Drag columns to rearrange them
- **Resize**: Adjust column widths in Settings > Appearance
- **Remove**: Click the X on a column header to remove it
- **Refresh**: Pull down or click the refresh icon

## Column Settings

Each column has its own settings:
- Auto-refresh interval
- Notification sounds
- Content filters
- Display density
    `,
    keywords: [
      "columns",
      "layout",
      "tweetdeck",
      "multi-column",
      "feeds",
      "organize",
    ],
  },

  // Features
  {
    id: "ai-features",
    title: "AI Features",
    category: "features",
    summary:
      "Use AI to enhance your posting and reading experience with smart suggestions.",
    content: `
# AI Features

Asphodel includes optional AI-powered features to enhance your experience. All AI features require an Anthropic API key.

## Available AI Features

### Smart Compose
- **Writing suggestions**: Get help improving your posts
- **Tone adjustment**: Make posts more casual or professional
- **Hashtag suggestions**: Find relevant hashtags
- **Alt text generation**: Automatic descriptions for images

### Content Features
- **Thread summarization**: Quickly understand long threads
- **Translation**: Translate posts to your language
- **Content warnings**: AI-suggested content warnings

## Setup

1. Go to Settings > Composer & AI
2. Enter your Anthropic API key
3. Enable the AI features you want

## Privacy

- AI features are processed locally when possible
- Your API key is stored only in your browser
- No post content is stored by Asphodel
- You can disable AI features at any time
    `,
    keywords: [
      "ai",
      "artificial intelligence",
      "suggestions",
      "compose",
      "smart",
      "anthropic",
    ],
  },
  {
    id: "bookmarks",
    title: "Bookmarks",
    category: "features",
    summary: "Save posts to read later with the bookmark feature.",
    content: `
# Bookmarks

Save posts you want to read later or reference again with bookmarks.

## How to Bookmark

- Click the bookmark icon on any post
- Use the keyboard shortcut **B** when a post is focused
- Bookmarks are private - only you can see them

## Viewing Bookmarks

Access your bookmarks from:
- The sidebar navigation
- Keyboard shortcut **⌘+B** (or **Ctrl+B** on Windows)

## Bookmark Storage

Asphodel offers two storage options:

### Local Storage (Default)
- Stored in your browser
- Fast access
- Not synced between devices

### AT Protocol Storage
- Synced across all your devices
- Stored on your PDS
- Persists if you clear browser data

Change storage in Settings > Data & Storage.

## Managing Bookmarks

- Search through your bookmarks
- Remove bookmarks by clicking the icon again
- Export bookmarks for backup
    `,
    keywords: ["bookmarks", "save", "later", "favorite", "read later", "sync"],
  },
  {
    id: "direct-messages",
    title: "Direct Messages",
    category: "features",
    summary:
      "Send private messages to other Bluesky users through the DM feature.",
    content: `
# Direct Messages

Send and receive private messages with other Bluesky users.

## Starting a Conversation

1. Go to Messages from the sidebar
2. Click the compose button
3. Search for a user to message
4. Type your message and send

## Message Features

- **Read receipts**: See when messages are read
- **Typing indicators**: Know when someone is typing
- **Media sharing**: Send images in messages
- **Message requests**: Control who can message you

## Managing Conversations

- Archive conversations to hide them
- Mute notifications for specific conversations
- Delete conversations (only from your side)
- Report problematic messages

## Privacy Settings

Control who can message you:
- **Everyone**: Anyone can start a conversation
- **Followers only**: Only people you follow can message you
- **Nobody**: Disable incoming messages

Configure in Settings > Privacy & Safety.
    `,
    keywords: ["messages", "dm", "direct messages", "chat", "conversation"],
  },
  {
    id: "scheduled-posts",
    title: "Scheduled Posts",
    category: "features",
    summary: "Schedule posts to be published at a specific time.",
    content: `
# Scheduled Posts

Plan your posts ahead of time by scheduling them for later publication.

## Creating a Scheduled Post

1. Open the composer (press **C** or click Compose)
2. Write your post as usual
3. Click the clock/schedule icon
4. Select the date and time
5. Click Schedule

## Managing Scheduled Posts

View and manage scheduled posts from:
- Sidebar > Scheduled Posts
- See all pending posts
- Edit scheduled posts before they're published
- Cancel scheduled posts
- Reschedule posts

## Important Notes

- Posts are published from your device
- Your browser/tab must be open at the scheduled time
- If offline, posts will be sent when you reconnect
- Time zone is based on your device settings

## Best Practices

- Double-check the scheduled time
- Consider your audience's time zone
- Keep scheduled posts reasonable in number
- Review posts before their scheduled time
    `,
    keywords: ["schedule", "scheduled", "posts", "timing", "plan", "later"],
  },

  // Keyboard Shortcuts
  {
    id: "keyboard-shortcuts-overview",
    title: "Keyboard Shortcuts Overview",
    category: "keyboard-shortcuts",
    summary: "Master Asphodel with comprehensive keyboard shortcuts.",
    content: `
# Keyboard Shortcuts

Navigate Asphodel efficiently using keyboard shortcuts. Press **?** (Shift + /) to see all shortcuts anytime.

## Navigation

| Shortcut | Action |
|----------|--------|
| ⌘ + H | Go to Home |
| ⌘ + N | Go to Notifications |
| ⌘ + M | Go to Messages |
| ⌘ + B | Go to Bookmarks |
| ⌘ + P | Go to Profile |
| ⌘ + / | Go to Search |
| ⌘ + , | Open Settings |
| ⌘ + K | Open Command Palette |

## Vim-Style Navigation

| Shortcut | Action |
|----------|--------|
| G then H | Go to Home |
| G then N | Go to Notifications |
| G then M | Go to Messages |
| G then B | Go to Bookmarks |
| G then P | Go to Profile |
| G then S | Go to Search |

## Timeline Navigation

| Shortcut | Action |
|----------|--------|
| J or ↓ | Next post |
| K or ↑ | Previous post |
| Home | First post |
| End | Last post |
| Page Up | Jump up 5 posts |
| Page Down | Jump down 5 posts |
| Space | Scroll down |
| Shift + Space | Scroll up |

## Post Actions (when focused)

| Shortcut | Action |
|----------|--------|
| C | Compose new post |
| R | Reply |
| L | Like |
| T | Repost |
| S | Share |
| B | Bookmark |
| O or Enter | Open post |

## General

| Shortcut | Action |
|----------|--------|
| / | Focus search |
| ? | Show shortcuts help |
| Esc | Close modal/clear selection |
    `,
    keywords: [
      "keyboard",
      "shortcuts",
      "keys",
      "hotkeys",
      "navigation",
      "commands",
    ],
  },

  // Troubleshooting
  {
    id: "posts-not-loading",
    title: "Posts Not Loading",
    category: "troubleshooting",
    summary: "What to do when posts aren't loading or the timeline is empty.",
    content: `
# Posts Not Loading

If your timeline or posts aren't loading, try these solutions:

## Quick Fixes

1. **Refresh the page**: Press F5 or ⌘+R
2. **Check your internet connection**: Make sure you're online
3. **Wait a moment**: Bluesky servers might be busy
4. **Pull to refresh**: On mobile, pull down on the timeline

## Clear Cache

If the quick fixes don't work:

1. Go to Settings > Data & Storage
2. Click "Clear API Cache"
3. Refresh the page

## Check Bluesky Status

Sometimes the issue is on Bluesky's end:
- Check [status.bsky.app](https://status.bsky.app) for outages
- Check social media for reports from other users

## Browser Issues

- Try a different browser
- Disable browser extensions
- Clear browser cache and cookies
- Make sure JavaScript is enabled

## Still Not Working?

- Sign out and sign back in
- Check if the issue affects specific feeds only
- Report the issue if it persists
    `,
    keywords: [
      "not loading",
      "empty",
      "blank",
      "error",
      "posts",
      "timeline",
      "stuck",
    ],
  },
  {
    id: "notification-issues",
    title: "Notification Issues",
    category: "troubleshooting",
    summary: "Fix problems with notifications not appearing or updating.",
    content: `
# Notification Issues

Having trouble with notifications? Here's how to fix common issues.

## Notifications Not Updating

1. Check notification permissions in your browser
2. Go to Settings > Notifications
3. Make sure notifications are enabled
4. Try refreshing the notifications column

## No Push Notifications

Push notifications require:
- Browser notification permission
- HTTPS connection (automatic)
- Service worker support

To enable:
1. Click the notification icon in your browser's address bar
2. Allow notifications for Asphodel
3. Enable push notifications in Settings > Notifications

## Missing Notifications

Some notifications might be filtered:
- Check content moderation settings
- Ensure you haven't muted the user
- Check if the post was deleted

## Notification Badge Not Clearing

If the unread count seems wrong:
1. Open the Notifications page
2. Scroll through to mark as read
3. Refresh if needed
4. Clear cache if the issue persists
    `,
    keywords: ["notifications", "push", "alerts", "badge", "unread", "missing"],
  },
  {
    id: "storage-issues",
    title: "Storage & Data Issues",
    category: "troubleshooting",
    summary: "Resolve problems with data storage, sync, and persistence.",
    content: `
# Storage & Data Issues

Asphodel stores data locally for offline access and performance. Here's how to manage storage issues.

## Data Not Syncing

If your data isn't syncing across devices:
1. Check your internet connection
2. Verify you're signed in with the same account
3. Enable AT Protocol storage for cross-device sync
4. Wait a few moments for sync to complete

## Storage Full

If you see storage warnings:
1. Go to Settings > Media Cache
2. Clear the media cache
3. Go to Settings > Data & Storage
4. Clear unused data

## Data Lost After Browser Clear

To prevent data loss:
- Enable AT Protocol storage for important data
- Export your data periodically
- Use a browser profile for Asphodel

## IndexedDB Errors

If you see database errors:
1. Close all Asphodel tabs
2. Clear site data for Asphodel
3. Sign back in
4. Contact support if errors persist

## Corrupted Data

If the app behaves strangely:
1. Open browser dev tools (F12)
2. Go to Application > Storage
3. Click "Clear site data"
4. Sign back in
    `,
    keywords: ["storage", "data", "sync", "cache", "indexeddb", "lost"],
  },

  // Privacy & Security
  {
    id: "privacy-overview",
    title: "Privacy in Asphodel",
    category: "privacy-security",
    summary: "Understand how Asphodel handles your data and protects privacy.",
    content: `
# Privacy in Asphodel

Asphodel is designed with privacy in mind. Here's how we protect your data.

## What We Don't Collect

- We don't track your browsing activity
- We don't store your password
- We don't sell or share your data
- We don't use third-party analytics

## What's Stored Locally

The following data is stored in your browser:
- Your session token (encrypted)
- Your preferences and settings
- Cached posts for offline viewing
- Your bookmarks (unless using AT Protocol storage)

## What's Stored Externally

If you enable AT Protocol storage:
- Bookmarks are stored on your PDS
- Drafts can be synced across devices
- This data follows Bluesky's privacy policy

## Security Features

- OAuth authentication (your password never touches Asphodel)
- All connections use HTTPS
- Session tokens are stored securely
- Automatic session timeout options

## Your Rights

You can at any time:
- Export all your local data
- Delete all stored data
- Revoke Asphodel's access to your Bluesky account
- Request information about stored data
    `,
    keywords: [
      "privacy",
      "data",
      "security",
      "tracking",
      "collection",
      "stored",
    ],
  },
  {
    id: "content-moderation",
    title: "Content Moderation",
    category: "privacy-security",
    summary: "Configure content filters and moderation settings.",
    content: `
# Content Moderation

Asphodel provides tools to control what content you see.

## Content Warnings

Configure how content warnings are handled:
- **Show**: Display content immediately
- **Warn**: Show with a click-through warning
- **Hide**: Completely hide the content

Categories include:
- Adult content (NSFW)
- Violence and graphic content
- Spam and misleading content

## Moderation Labels

Bluesky's moderation system uses labels:
- Community-applied labels
- Automated moderation
- Third-party label services

You can subscribe to different label services in Settings.

## Personal Filters

Create your own filters:
- Mute specific words or phrases
- Mute specific users
- Block users entirely
- Filter by content type

## Mute vs Block

**Muting**:
- Hides their posts from your timeline
- They can still see and interact with you
- They don't know they're muted

**Blocking**:
- Prevents all interaction
- They can't see your posts
- They know they're blocked

Access moderation settings in Settings > Content Moderation.
    `,
    keywords: [
      "moderation",
      "filter",
      "block",
      "mute",
      "nsfw",
      "content warning",
    ],
  },
  {
    id: "managing-sessions",
    title: "Managing Sessions",
    category: "privacy-security",
    summary: "Control your active sessions and manage account security.",
    content: `
# Managing Sessions

Keep your account secure by managing your active sessions.

## Active Sessions

Asphodel stores your session locally. To see active sessions:
1. Go to Settings > Account
2. View your current session information

## Signing Out

To sign out:
1. Click your avatar or go to Settings
2. Click "Sign Out"
3. Your local data will be cleared

## Multiple Accounts

Asphodel supports multiple Bluesky accounts:
1. Click your avatar
2. Click "Add Account"
3. Sign in with another account
4. Switch between accounts from the avatar menu

## Revoking Access

To completely revoke Asphodel's access:
1. Sign out of Asphodel
2. Go to Bluesky's official app
3. Go to Settings > App Passwords or Connected Apps
4. Revoke Asphodel's access

## Security Best Practices

- Sign out on shared devices
- Use strong passwords for your Bluesky account
- Enable two-factor authentication on Bluesky
- Regularly review connected applications
    `,
    keywords: [
      "sessions",
      "sign out",
      "logout",
      "security",
      "multiple accounts",
    ],
  },
];

// Search function for help articles
export function searchHelpArticles(query: string): HelpArticle[] {
  if (!query.trim()) {
    return helpArticles;
  }

  const searchTerms = query.toLowerCase().split(/\s+/);

  return helpArticles
    .map((article) => {
      let score = 0;
      const titleLower = article.title.toLowerCase();
      const summaryLower = article.summary.toLowerCase();
      const contentLower = article.content.toLowerCase();
      const keywordsLower = article.keywords.map((k) => k.toLowerCase());

      for (const term of searchTerms) {
        // Title match (highest priority)
        if (titleLower.includes(term)) {
          score += 10;
        }
        // Keyword match (high priority)
        if (keywordsLower.some((k) => k.includes(term))) {
          score += 8;
        }
        // Summary match (medium priority)
        if (summaryLower.includes(term)) {
          score += 5;
        }
        // Content match (lower priority)
        if (contentLower.includes(term)) {
          score += 2;
        }
      }

      return { article, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ article }) => article);
}

// Get articles by category
export function getArticlesByCategory(categoryId: string): HelpArticle[] {
  return helpArticles.filter((article) => article.category === categoryId);
}

// Get article by ID
export function getArticleById(articleId: string): HelpArticle | undefined {
  return helpArticles.find((article) => article.id === articleId);
}
