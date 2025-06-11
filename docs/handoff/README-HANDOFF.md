# Bluesky Desktop Client

A modern, feature-rich desktop client for Bluesky (AT Protocol) built with React, TypeScript, and Vite. This project provides a clean, performant alternative to the official Bluesky web client with additional features and improvements.

![Bluesky Client Screenshot](docs/images/app-screenshot.png)

## 🌟 Key Features

### Core Functionality
- **Full AT Protocol Integration**: Complete support for posts, replies, reposts, likes, and follows
- **Real-time Feed**: Infinite scrolling timeline with optimistic updates
- **Thread Navigation**: Sophisticated thread viewing with visual hierarchy and connection lines
- **Rich Media Support**: Images, links, quote posts, and embedded content
- **Search & Discovery**: Full-text search across posts and users
- **Notifications**: Real-time notifications with priority filtering

### Enhanced Features
- **Analytics Dashboard**: Track engagement, follower growth, and content performance
- **Keyboard Navigation**: Comprehensive keyboard shortcuts for power users
- **Dark Mode**: Beautiful dark theme optimized for extended use
- **Mobile Responsive**: Fully responsive design that works on all devices
- **Performance Optimized**: Fast loading, efficient caching, and smooth animations

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- A Bluesky account
- macOS (for full feature support)

### Installation

1. **Clone and install dependencies:**
```bash
git clone <repository-url>
cd BSKY
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env.local
# Edit .env.local with your test account credentials (optional)
```

3. **Start the development server:**
```bash
npm run dev
```

4. **Open in browser:**
Navigate to `http://127.0.0.1:5173` (not localhost for Safari compatibility)

### Production Build
```bash
npm run build
npm run preview
```

## 🏗️ Architecture

### Technology Stack
- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite for lightning-fast development
- **Styling**: Tailwind CSS with custom design system
- **State Management**: TanStack Query for server state, React Context for auth
- **AT Protocol SDK**: Official @atproto/api client
- **Analytics Storage**: IndexedDB for client-side persistence
- **Testing**: Vitest + React Testing Library + Playwright

### Project Structure
```
BSKY/
├── src/
│   ├── components/     # React components organized by feature
│   ├── services/       # AT Protocol service layer
│   ├── hooks/          # Custom React hooks
│   ├── contexts/       # React contexts (auth, theme)
│   ├── styles/         # CSS modules and design tokens
│   ├── lib/            # Utilities and helpers
│   └── types/          # TypeScript type definitions
├── docs/               # Documentation
├── scripts/            # Development and build scripts
└── tests/              # Test suites
```

## 🎯 What's Been Accomplished

### Completed Features
- ✅ Full authentication flow with session persistence
- ✅ Timeline feed with infinite scrolling
- ✅ Post creation with reply support
- ✅ Like and repost functionality
- ✅ Thread viewing with visual hierarchy
- ✅ User profiles with post history
- ✅ Real-time notifications
- ✅ Search functionality
- ✅ Analytics dashboard with charts
- ✅ Keyboard shortcuts
- ✅ Mobile responsive design

### Recent Improvements
- 🔧 Unified background colors across all views
- 🔧 Fixed-width responsive layout (600px max)
- 🔧 Filtered timeline to show only top-level posts
- 🔧 Thread navigation always shows full context
- 🔧 Quote posts with improved styling
- 🔧 Performance tracking and optimization

### Known Limitations
- Analytics data is client-side only (IndexedDB)
- No push notifications (requires service worker)
- Limited offline support
- No multi-account switching (yet)

## 🔐 Security Notes

### Test Credentials
- Never commit real credentials to the repository
- Use environment variables for all sensitive data
- Test credentials should only be in `.env.local`
- See `.env.example` for required variables

### API Keys
- No API keys are stored in the codebase
- Authentication uses AT Protocol's session tokens
- All sensitive operations go through the secure service layer

## 🛠️ Development

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run test         # Run unit tests
npm run test:e2e     # Run end-to-end tests
npm run lint         # Lint code
npm run type-check   # Check TypeScript types
```

### Testing
The project includes comprehensive test coverage:
- Unit tests for utilities and hooks
- Integration tests for service layer
- E2E tests for critical user flows
- Visual regression tests

### Code Quality
- TypeScript for type safety
- ESLint for code quality
- Prettier for formatting
- Pre-commit hooks for consistency

## 📚 Documentation

### For Developers
- [Architecture Overview](docs/ARCHITECTURE.md)
- [Component Guide](docs/COMPONENTS.md)
- [Testing Strategy](docs/TESTING.md)
- [Performance Guide](docs/PERFORMANCE.md)

### For Contributors
- [Contributing Guide](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Development Process](docs/DEVELOPMENT_PROCESS.md)

## 🚧 Roadmap

### Next Features
- [ ] Multi-account support
- [ ] Offline mode with sync
- [ ] Advanced filtering options
- [ ] Custom feed algorithms
- [ ] Plugin system
- [ ] Desktop app (Electron)

### Technical Improvements
- [ ] Server-side analytics storage
- [ ] WebSocket for real-time updates
- [ ] Service worker for offline support
- [ ] Automated visual regression tests

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:
- Setting up your development environment
- Understanding the codebase
- Submitting pull requests
- Reporting issues

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- The Bluesky team for the AT Protocol
- The React and TypeScript communities
- All contributors who have helped improve this client

---

Built with ❤️ for the decentralized social web