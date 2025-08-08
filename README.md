# ShadowSky - Advanced Bluesky Client

A full-featured Bluesky client with TweetDeck-style multi-column interface, advanced analytics, and real-time updates. Built with React, TypeScript, and Vite.

## Features

- **SkyDeck Multi-Column Interface**
  - TweetDeck-style layout with customizable columns
  - Drag-and-drop column reordering
  - Support for notifications, timeline, messages, conversations, and custom feeds
  - Keyboard navigation (arrow keys, h/l for column switching)
  - Responsive design with automatic single-column on mobile

- **Advanced Notifications Management**
  - Real-time notifications feed with auto-refresh
  - Full conversation threading and context
  - Inline reply composer in thread views
  - Notification aggregation by type (likes, replies, mentions, follows)
  - Search and filter capabilities

- **Direct Messages** (In Progress)
  - Full messaging functionality
  - Real-time message updates
  - Conversation list and individual chats
  - Requires app password with DM permissions

- **Bookmarks System**
  - Save posts for later reading
  - Search within bookmarks
  - Export/import bookmark collections as JSON
  - Local storage persistence with IndexedDB

- **Feed Discovery & Management**
  - Browse suggested and popular feeds
  - Add/remove custom feeds
  - Search for new feeds
  - Custom feed columns in SkyDeck

- **Analytics Dashboard**
  - Engagement metrics and trends visualization
  - Top accounts interaction analysis
  - Activity patterns over time
  - Custom date range filtering
  - Storage usage monitoring

- **Rich Media Support**
  - Image galleries with full-screen viewer
  - Video upload and playback
  - GIF search integration (requires Giphy API)
  - Automatic alt text generation (requires Anthropic API)

- **Real-time Updates** (In Progress)
  - WebSocket connection via Jetstream
  - Live notifications for posts, likes, reposts, and follows
  - Auto-refresh capabilities

- **Performance Optimized**
  - IndexedDB caching for instant loads
  - Smart prefetching of related posts
  - Rate-limited API calls
  - Background data synchronization
  - 4 weeks of notifications cached locally

- **Modern UI & UX**
  - Dark/light theme support
  - Responsive design with Tailwind CSS
  - Advanced keyboard navigation (j/k, h/l, space, arrows)
  - Cross-subdomain authentication
  - Progressive Web App capabilities

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Bluesky account

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5174`

### Configuration

1. Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Optional: Add API keys for enhanced features:
   - **Google Analytics**: Add your measurement ID for analytics
   - **Giphy API**: Required for GIF search in the composer
   - **Anthropic API**: Required for automatic alt text generation

The app works without these API keys, but some features will be disabled.

## Key Highlights

### SkyDeck - Multi-Column Dashboard

- Create your personalized dashboard with multiple columns
- Mix and match notifications, timeline, messages, and custom feeds
- Drag columns to reorder them
- Navigate between columns with keyboard shortcuts
- Responsive design adapts to your screen size

### Advanced Composer

- Create multi-post threads with auto-numbering
- Reply inline without leaving thread views
- Save drafts and manage them
- Schedule posts for later
- Upload images and videos
- Auto-generate alt text for accessibility

### Powerful Analytics

- Track engagement patterns and trends
- Identify your top interacting accounts
- Analyze conversation threads and depth
- Monitor notification patterns over time
- View storage usage and health metrics

### Performance & Offline Support

- 4 weeks of notifications cached locally
- Instant conversation loading from cache
- Minimal API calls through smart caching
- Progressive data loading
- Works offline with cached data

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run build:prod` - Build for production (skip TypeScript check)

### Architecture

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **State**: React Query + Context API
- **Storage**: IndexedDB + LocalStorage fallback
- **API**: AT Protocol via @atproto/api

## Deployment

The app can be deployed to any static hosting service (Vercel, Netlify, AWS Amplify, etc.):

```bash
# Build for production
npm run build

# The 'dist' folder contains the static files ready for deployment
```

### Environment Variables

For production deployments, ensure you set the environment variables in your hosting platform:

- `VITE_GA_MEASUREMENT_ID` (optional)
- `VITE_GIPHY_API_KEY` (optional)
- `VITE_ANTHROPIC_API_KEY` (optional)

## Contributing

This project is not currently accepting contributions from the community. While the source code is available under the MIT license, I am maintaining this project with a small group of selected collaborators.

Feel free to:

- Fork the project for your own use
- Report issues
- Share feedback and suggestions

## License

MIT - See [LICENSE](LICENSE) file for details
