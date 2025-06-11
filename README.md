# Bluesky Client

A feature-rich desktop client for Bluesky (AT Protocol) built with React, TypeScript, and Vite.

## ✨ Features

- 🔐 Secure authentication with session persistence
- 📱 Responsive design with dark theme
- 📊 Advanced analytics dashboard
- 🧵 Enhanced thread navigation
- 🚀 Performance optimized
- 🎨 Clean, modern UI matching Bluesky's design

## 🚀 Quick Start

```bash
# One-click setup (macOS)
./setup-local-mac.sh

# Or manual setup
npm install
npm run dev
```

Visit http://127.0.0.1:5173

**New to the project?** Check out [`QUICK_START.md`](QUICK_START.md) for a 2-minute orientation.

## 📁 Project Structure

```
BSKY/
├── src/          → Source code
├── docs/         → All documentation (organized)
├── scripts/      → Development scripts  
├── tests/        → Test files
│
├── README.md     → You are here
├── CLAUDE.md     → AI development guide
└── SESSION_NOTES.md → Current work status
```

## 📚 Documentation

All documentation is organized in the `docs/` directory:

- **Architecture** → `docs/architecture/`
- **Guides** → `docs/guides/`
- **Decisions** → `docs/decisions/`
- **Full Index** → [`docs/DIRECTORY_INDEX.md`](docs/DIRECTORY_INDEX.md)

## 🔧 Development

```bash
npm test          # Run tests
npm run build     # Build for production
npm run type-check # Check types
```

## 🤝 Contributing

1. Check `docs/handoff/` for comprehensive guides
2. Follow patterns in `docs/decisions/PATTERNS.md`
3. Test credentials go in `.env.local` (never commit!)

## 📄 License

MIT License - see LICENSE file for details

---

Built with ❤️ for the decentralized social web. For detailed documentation, see [`docs/handoff/README-HANDOFF.md`](docs/handoff/README-HANDOFF.md).