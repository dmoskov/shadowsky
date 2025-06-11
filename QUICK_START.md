# 🚀 Bluesky Client - Quick Start Guide

Welcome! This is a custom Bluesky client with extra features. Here's how to get started:

## 📁 Where Things Are

```
BSKY/
├── src/              → Source code (React components, services, hooks)
├── docs/             → All documentation (organized by topic)
├── scripts/          → Development scripts
├── tests/            → Test files
├── tools/            → Development tools
│
├── README.md         → Project overview
├── CLAUDE.md         → AI development instructions
├── SESSION_NOTES.md  → Current work status
└── setup-local-mac.sh → One-click setup script
```

## 🏃 Get Started in 2 Minutes

1. **Setup** (first time only):
   ```bash
   ./setup-local-mac.sh
   ```

2. **Install & Run**:
   ```bash
   npm install
   npm run dev
   ```

3. **Open Browser**:
   Visit http://127.0.0.1:5173

## 📚 Key Documentation

- **New to the project?** → Read `docs/handoff/README-HANDOFF.md`
- **Using Claude Code?** → Read `docs/handoff/CLAUDE-HANDOFF.md`
- **Architecture questions?** → Check `docs/architecture/`
- **Implementation guides?** → Check `docs/guides/`

## 🔐 Test Credentials

Create `.env.local`:
```
VITE_TEST_IDENTIFIER=your-test-account@email.com
VITE_TEST_PASSWORD=your-test-password
```

## 🛠️ Common Tasks

- **Run tests**: `npm test`
- **Check types**: `npm run type-check`
- **View analytics**: Login → Click user icon → Analytics

## 📊 Project Status

- ✅ Core features working (feed, threads, analytics)
- ✅ Security audit complete
- ✅ Documentation organized
- 🚧 11/25 features complete

---

Questions? Check `docs/DIRECTORY_INDEX.md` for the full documentation map!