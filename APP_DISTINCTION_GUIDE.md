# Application Distinction Guide

## CRITICAL: Two Separate Applications

This repository contains **TWO COMPLETELY SEPARATE APPLICATIONS** that must not be confused:

### 1. Main Bluesky Client (Root Application)
- **Location**: `/` (root directory)
- **Package Name**: `bsky-client`
- **Dev Port**: `5173`
- **Purpose**: Full-featured Bluesky social media client
- **Key Files**:
  - `/src/` - Main application source
  - `/package.json` - Root package.json
  - `/vite.config.ts` - Root Vite config
  - `/CLAUDE.md` - Main project documentation
  - `/ARCHITECTURE.md` - Main app architecture

### 2. Notifications Analytics App
- **Location**: `/notifications-app/`
- **Package Name**: `bsky-notifications-app`
- **Dev Port**: `5174`
- **Purpose**: Specialized notifications management and analytics
- **Key Files**:
  - `/notifications-app/src/` - Notifications app source
  - `/notifications-app/package.json` - Notifications package.json
  - `/notifications-app/vite.config.ts` - Notifications Vite config
  - `/notifications-app/README.md` - Notifications app documentation

## How to Identify Which App You're Working On

### 1. Check the File Path
```
/Users/moskov/Code/BSKY/src/...          → Main Client
/Users/moskov/Code/BSKY/notifications-app/src/... → Notifications App
```

### 2. Check the package.json
```json
// Main Client
{
  "name": "bsky-client",
  "scripts": {
    "dev": "vite", // Runs on port 5173
  }
}

// Notifications App
{
  "name": "bsky-notifications-app",
  "scripts": {
    "dev": "vite", // Runs on port 5174
  }
}
```

### 3. Check the Running Port
- `http://localhost:5173` → Main Client
- `http://localhost:5174` → Notifications App

### 4. Check the UI/Features
- **Main Client**: Timeline feed, post composer, full social features
- **Notifications App**: Dashboard, analytics, notification-specific features

## Key Differences

### Technology Stack
| Feature | Main Client | Notifications App |
|---------|------------|-------------------|
| React Version | 19.1.0 | 18.2.0 |
| Styling | CSS Modules + Design System | Tailwind CSS |
| Router | react-router-dom v7 | react-router-dom v6 |
| Port | 5173 | 5174 |
| Build Output | /dist | /notifications-app/dist |

### UI Structure
- **Main Client**: 
  - Timeline-focused
  - Post cards with embeds
  - Thread navigation
  - Custom CSS design system
  
- **Notifications App**:
  - Dashboard-focused
  - Analytics charts
  - Notification filters
  - Tailwind CSS utility classes

### Component Names
- **Main Client Components**:
  - `Feed.tsx`, `PostCard.tsx`, `Timeline.tsx`
  - Located in `/src/components/`
  
- **Notifications App Components**:
  - `Dashboard.tsx`, `NotificationsList.tsx`, `Analytics.tsx`
  - Located in `/notifications-app/src/components/`

## Development Commands

### For Main Client:
```bash
# From root directory
npm install
npm run dev      # Runs on http://localhost:5173
npm run build
```

### For Notifications App:
```bash
# From root directory
cd notifications-app
npm install
npm run dev      # Runs on http://localhost:5174
npm run build
```

## Common Mistakes to Avoid

1. **DON'T** edit `/src/components/` when working on notifications features
2. **DON'T** edit `/notifications-app/src/` when working on main client features
3. **DON'T** confuse the two different routing systems
4. **DON'T** mix styling approaches (CSS modules vs Tailwind)
5. **DON'T** assume both apps share the same dependencies or versions

## When Working on Features

### Before Starting:
1. Identify which app the feature belongs to
2. Navigate to the correct directory
3. Check you're editing the right files
4. Ensure the correct dev server is running

### Feature Examples:
- "Add post composer" → Main Client (`/src/`)
- "Add notification filters" → Notifications App (`/notifications-app/src/`)
- "Update timeline feed" → Main Client (`/src/`)
- "Add analytics charts" → Notifications App (`/notifications-app/src/`)

## Shared Code

Both apps share some common code through the shared package:
- **Location**: `/packages/shared/`
- **Import**: `@bsky/shared`
- **Contents**: Auth utilities, AT Protocol types, common hooks

When modifying shared code, remember it affects BOTH applications.

## Quick Reference Checklist

When you see a file path or component name, ask yourself:
- [ ] Does the path contain `/notifications-app/`? → It's the Notifications App
- [ ] Is the component about feeds/posts/threads? → It's the Main Client
- [ ] Is the component about analytics/dashboards? → It's the Notifications App
- [ ] What port is the dev server running on? → 5173 = Main, 5174 = Notifications

## Remember

**These are TWO SEPARATE APPLICATIONS** that happen to live in the same repository. They have:
- Different purposes
- Different UI designs
- Different technology choices
- Different file structures
- Different development servers
- Different build outputs

Always verify which application you're working on before making changes!