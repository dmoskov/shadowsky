# ShadowSky - Advanced Bluesky Client

A full-featured Bluesky client with TweetDeck-style multi-column interface, advanced analytics, and real-time updates. Built with React, TypeScript, and Vite.

## 🏗️ Architecture Overview

### Core Technologies

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Query + Context API
- **Storage**: Dual storage system (Local + AT Protocol)
- **API**: AT Protocol via @atproto/api
- **Build**: Vite + Wireit

### Key Design Principles

- **Progressive Enhancement**: Works offline with cached data
- **Privacy First**: User controls where data is stored
- **Performance Optimized**: Smart caching and prefetching
- **Responsive Design**: Adapts from mobile to multi-column desktop

## 📂 Project Structure

```
src/
├── components/         # React components
│   ├── settings/      # Settings UI components
│   └── providers/     # Context providers
├── contexts/          # React contexts (Auth, Theme, Moderation, etc.)
├── hooks/             # Custom React hooks
├── services/          # Core business logic
│   ├── atproto/      # AT Protocol integration
│   ├── storage/      # Storage backends
│   └── bookmark-backends/  # Bookmark storage implementations
├── pages/            # Route pages
├── utils/            # Utility functions
└── types/            # TypeScript type definitions
```

## 🔐 Authentication & Session Management

The app uses AT Protocol authentication with support for:

- Standard login with identifier (handle/email) and password
- App passwords for enhanced security
- 2FA support via auth factor tokens
- Session persistence and auto-refresh
- Cross-subdomain authentication

### Auth Flow

1. User logs in via `AuthContext`
2. Session stored in localStorage
3. Auto-refresh on 401 errors
4. Services initialized after successful auth

## 💾 Storage System

ShadowSky features a sophisticated dual storage system that lets users choose where their data is stored.

### Storage Types

#### Local Storage

- **Speed**: Instant access, no network calls
- **Privacy**: Data never leaves your device
- **Offline**: Full functionality without internet
- **Limitations**: Device-specific, no sync

#### AT Protocol Storage

- **Sync**: Access data from any device
- **Backup**: Data stored on your PDS
- **Social**: Some data can be public (bookmarks)
- **Requirements**: Network connection

### Data Types & Storage

| Data Type   | Local Storage Key                      | AT Protocol Collection      | Storage Options       |
| ----------- | -------------------------------------- | --------------------------- | --------------------- |
| Bookmarks   | `shadowsky-bookmarks-{uri}`            | `com.shadowsky.bookmarks`   | Local or AT Protocol  |
| Columns     | `skyDeckColumns` / `shadowsky_columns` | `com.shadowsky.columns`     | Local or AT Protocol  |
| Drafts      | `bsky_thread_drafts`                   | `com.shadowsky.drafts`      | Local or AT Protocol  |
| Preferences | `shadowsky_app_preferences`            | `com.shadowsky.preferences` | AT Protocol (primary) |

### Storage Architecture

```
┌─────────────────────┐
│   User Interface    │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  Service Wrappers   │ (bookmark-service-wrapper, etc.)
│  - Handle init      │
│  - Storage switch   │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│   Core Services     │ (bookmark-service-v2, column-service, etc.)
│  - Business logic   │
│  - Caching          │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  Storage Backends   │
├─────────────────────┤
│ LocalStorageBackend │ ←→ Browser localStorage
├─────────────────────┤
│ SingletonBackend    │ ←→ AT Protocol (via agent)
└─────────────────────┘
```

### Storage Preferences

User preferences are stored in AT Protocol as `com.shadowsky.preferences`:

```typescript
{
  bookmarkStorageType: "local" | "custom",
  columnStorageType: "local" | "atproto",
  draftStorageType: "local" | "custom"
}
```

**Note**: "custom" and "atproto" both mean AT Protocol storage. The naming difference is for backward compatibility.

### Data Migration

The app handles seamless migration between storage types:

1. User changes storage preference in Settings
2. Service detects change and migrates existing data
3. Old storage is cleared after successful migration
4. User notified of completion

## 🎨 Features

### SkyDeck - Multi-Column Dashboard

The flagship feature providing a TweetDeck-like experience:

- **Column Types**: Notifications, Timeline, Messages, Feeds, Bookmarks, Conversations
- **Customization**: Add, remove, reorder columns via drag-and-drop
- **Navigation**:
  - Desktop: Arrow keys, h/l for column switching
  - Mobile: Swipe gestures, single column view
- **Feed Integration**: Add any Bluesky feed as a column
- **Responsive**: Automatically adjusts columns based on viewport

### Advanced Notifications

- **Real-time Updates**: WebSocket via Jetstream (when available)
- **Conversation Threading**: Full context with parent posts
- **Aggregation**: Groups likes, reposts, follows by type
- **Search & Filter**: Find specific notifications
- **Caching**: 4 weeks of notifications stored locally

### Bookmarks System

- **Flexible Storage**: Choose between local or AT Protocol
- **Search**: Full-text search within bookmarks
- **Export/Import**: JSON format for portability
- **Performance**: Instant access with IndexedDB

### Direct Messages

- **Full Chat**: Send and receive messages
- **Real-time**: Updates via polling
- **Conversation List**: See all your chats
- **Requirements**: App password with DM scope

### Analytics Dashboard

- **Engagement Metrics**: Track likes, reposts, replies
- **Top Accounts**: See who interacts most
- **Activity Patterns**: Visualize posting times
- **Storage Health**: Monitor cache usage

### Composer

- **Multi-post Threads**: Create numbered threads
- **Draft System**: Save and manage drafts
- **Rich Media**: Images, videos, GIFs
- **Alt Text**: Manual or AI-generated
- **Scheduling**: Queue posts for later

## ⚙️ Configuration

### Environment Variables

Create a `.env` file:

```bash
# Optional: Analytics
VITE_GA_MEASUREMENT_ID=your-ga-id

# Optional: GIF search
VITE_GIPHY_API_KEY=your-giphy-key

# Optional: AI alt text
VITE_ANTHROPIC_API_KEY=your-anthropic-key
```

### Debug Mode

Enable detailed logging in browser console:

```javascript
window.enableDebug();
```

### Settings Storage

Settings are stored in a hierarchical system:

1. **AT Protocol** (primary): User preferences synced across devices
2. **LocalStorage** (fallback): When AT Protocol unavailable
3. **Memory** (temporary): Session-specific overrides

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Bluesky account

### Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/shadowsky.git
cd shadowsky

# Install dependencies
npm install

# Start development server
npm run dev

# In a separate terminal, start the API server (required for AI features)
npm run dev:api
```

The app will be available at `http://localhost:5174`

**Note**: The API server (`npm run dev:api`) is required for:
- AI-generated alt text for images
- GIF to MP4 conversion
- Image proxy for CORS handling

If you don't need these features, you can skip running the API server.

### Development Scripts

```bash
# Development
npm run dev              # Start dev server (frontend)
npm run dev:api          # Start API server (backend for AI features)
npm run test:unit:watch  # Run tests in watch mode

# Quality checks
npm run test:format      # Check code formatting
npm run test:lint        # Run ESLint
npm run test:types       # TypeScript type checking
npm run test             # Run all checks

# Fixes
npm run fix:format       # Auto-fix formatting
npm run fix:lint         # Auto-fix linting issues
npm run fix              # Run all fixes

# Production
npm run build            # Build for production
npm run preview          # Preview production build
```

### Git Workflow

The project includes a push script at `scripts/push.sh` that runs pre-push checks:

```bash
# Basic usage
./scripts/push.sh

# Push to specific branch
./scripts/push.sh origin feature-branch
```

## 🔧 Advanced Configuration

### Custom PDS Support

Users can connect to custom PDS instances:

1. Enter PDS URL during login
2. App validates and stores PDS preference
3. All API calls routed to custom PDS

### Moderation

Integrated moderation features:

- Muted words and tags
- Hidden posts (local only)
- Bluesky moderation lists
- Custom filtering rules

### Performance Tuning

The app uses several optimization strategies:

- **IndexedDB**: For large data sets (notifications, posts)
- **React Query**: Smart caching and background updates
- **Virtualization**: Efficient rendering of long lists
- **Prefetching**: Anticipate user actions
- **Compression**: Image optimization before upload

## 🐛 Troubleshooting

### Common Issues

1. **Storage Errors**
   - Clear browser data and re-login
   - Check IndexedDB quota in browser settings
   - Try switching storage type in settings

2. **Sync Issues**
   - Verify network connection
   - Check AT Protocol service status
   - Force refresh with Ctrl+Shift+R

3. **Performance**
   - Enable debug mode to see timing info
   - Check storage usage in Analytics
   - Clear old cached data

### Debug Tools

- **Debug Console**: Built-in component for testing
- **Storage Viewer**: See all stored data in settings
- **Rate Limit Status**: Monitor API usage
- **Error Tracking**: Automatic error reporting

## 📝 Contributing

While this project is maintained by a small team, we welcome:

- Bug reports and feature requests
- Documentation improvements
- Community forks and adaptations

Please read the contribution guidelines before submitting PRs.

## 📄 License

MIT - See [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- Built on AT Protocol and Bluesky's open ecosystem
- Inspired by TweetDeck's multi-column interface
- Community feedback and testing

---

For more information, visit the [documentation](https://docs.shadowsky.app) or join our [Discord community](https://discord.gg/shadowsky).
