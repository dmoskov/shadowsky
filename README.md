# ShadowSky - Bluesky Notifications Analytics

A powerful Bluesky notifications dashboard and analytics app built with React, TypeScript, and Vite.

## Features

- **Advanced Notifications Management**
  - Real-time notifications feed
  - Conversation threading and analysis
  - Notification aggregation by type
  - Visual timeline of activity

- **Analytics Dashboard**
  - Engagement metrics and trends
  - Top accounts interaction analysis
  - Post performance tracking
  - Custom time range filtering

- **Performance Optimized**
  - IndexedDB caching for instant loads
  - Smart prefetching of related posts
  - Rate-limited API calls
  - Background data synchronization

- **Modern UI**
  - Dark/light theme support
  - Responsive design with Tailwind CSS
  - Real-time updates
  - Keyboard shortcuts

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

The app works out of the box with no configuration needed. Simply log in with your Bluesky credentials.

## Key Features

### Notifications Analytics
- Track engagement patterns
- Identify top interacting accounts
- Analyze conversation threads
- Monitor notification trends over time

### Composer Integration
- Thread-aware posting
- Auto-numbering for threads
- Image upload support
- Draft management

### Performance
- 4 weeks of notifications cached locally
- Instant conversation loading
- Minimal API calls through smart caching
- Progressive data loading

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run deploy` - Deploy to GitHub Pages

### Architecture

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **State**: React Query + Context API
- **Storage**: IndexedDB + LocalStorage fallback
- **API**: AT Protocol via @atproto/api

## Deployment

The app can be deployed to any static hosting service:

```bash
# Build for production
npm run build

# Deploy to GitHub Pages
npm run deploy
```

## License

MIT
