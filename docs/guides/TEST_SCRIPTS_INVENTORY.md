# Test Scripts Inventory

This document provides a comprehensive overview of all test scripts in the Bluesky client project.

## Overview

The project contains 11 test scripts located in the `/scripts` directory. These scripts are used for various testing purposes including development error checking, browser automation testing, functionality testing, and diagnostics.

## Test Scripts

### 1. check-dev-errors.js

- **Location**: `/scripts/check-dev-errors.js`
- **Purpose**: Monitors Vite development server output for common errors and provides developer-friendly suggestions
- **Authentication**: No
- **Key Features**:
  - Monitors `/tmp/vite-output.log` for error patterns
  - Detects missing imports, JSX errors, module not found errors
  - Detects TypeScript errors and CSS import issues
  - Provides actionable error messages
  - Exits with error code if issues found
- **Special Capabilities**:
  - Pattern-based error detection
  - Severity classification (error/warning)

### 2. debug-notification-badge.cjs

- **Location**: `/scripts/debug-notification-badge.cjs`
- **Purpose**: Debug and inspect notification badge rendering and styling
- **Authentication**: Yes (hardcoded credentials)
- **Key Features**:
  - Uses Playwright for browser automation
  - Logs in automatically using stored credentials
  - Inspects notification badge CSS properties
  - Captures computed styles and CSS variables
  - Takes screenshots of notification area
  - Keeps browser open for manual inspection
- **Special Capabilities**:
  - CSS introspection
  - Visual debugging with screenshots
  - Style computation analysis

### 3. dev-server.sh

- **Location**: `/scripts/dev-server.sh`
- **Purpose**: Robust development server management with health checking
- **Authentication**: No
- **Key Features**:
  - Start/stop/restart Vite dev server
  - Check server health and status
  - Monitor for recent errors in logs
  - Follow log output in real-time
  - PID-based process management
- **Special Capabilities**:
  - Process lifecycle management
  - Health monitoring
  - Error detection in running server

### 4. diagnose-app.js

- **Location**: `/scripts/diagnose-app.js`
- **Purpose**: Comprehensive diagnostic tool for troubleshooting app loading issues
- **Authentication**: No
- **Key Features**:
  - Uses Playwright to load the app
  - Collects console messages, page errors, and network failures
  - Checks React root element and content
  - Verifies component presence (login form, inputs, buttons)
  - Takes diagnostic screenshots
  - Analyzes root element styles
  - Provides detailed diagnosis summary
- **Special Capabilities**:
  - Multi-level diagnostics
  - Error aggregation from multiple sources
  - Visual state capture
  - Blank page detection

### 5. open-chrome.sh

- **Location**: `/scripts/open-chrome.sh`
- **Purpose**: Opens the app in Chrome browser for better development experience
- **Authentication**: No
- **Key Features**:
  - Opens specified URL in Chrome (defaults to localhost:5173)
  - Falls back to default browser if Chrome not found
  - Simple utility script for consistent browser launching
- **Special Capabilities**:
  - Browser detection
  - Fallback handling

### 6. test-app.mjs

- **Location**: `/scripts/test-app.mjs`
- **Purpose**: End-to-end testing of basic app functionality including login and feed display
- **Authentication**: Yes (hardcoded test credentials)
- **Key Features**:
  - Automated login flow testing
  - Feed loading verification
  - Post counting and display checking
  - Parent post and thread detection
  - Hover effect testing
  - Screenshot capture of feed state
  - Error state handling
- **Special Capabilities**:
  - Full user flow automation
  - Visual regression testing capability
  - Thread structure analysis

### 7. test-browser.mjs

- **Location**: `/scripts/test-browser.mjs`
- **Purpose**: Basic browser connectivity and app mounting test
- **Authentication**: No
- **Key Features**:
  - Tests browser access to dev server
  - Logs console messages and network failures
  - Checks React app mounting
  - Verifies presence of login form or feed
  - Takes diagnostic screenshots
  - Keeps browser open for manual inspection
- **Special Capabilities**:
  - Low-level connectivity testing
  - React mounting verification
  - Extended observation period

### 8. test-likes.mjs

- **Location**: `/scripts/test-likes.mjs`
- **Purpose**: Tests like and repost functionality including state changes and count updates
- **Authentication**: Yes (hardcoded test credentials)
- **Key Features**:
  - Automated login if needed
  - Tests like button toggle functionality
  - Verifies like count changes
  - Tests repost functionality
  - Captures before/after states
  - Takes screenshots of interaction results
- **Special Capabilities**:
  - State change verification
  - Count validation
  - Interaction testing

### 9. test-search.js

- **Location**: `/scripts/test-search.js`
- **Purpose**: Manual test instructions for search functionality
- **Authentication**: Yes (manual)
- **Key Features**:
  - Provides step-by-step manual testing instructions
  - Tests search with specific query ("non-farm payrolls")
  - Covers both Posts and Users tabs
  - Includes console error checking guidance
- **Special Capabilities**:
  - Human-readable test procedure
  - No automation (manual only)

### 10. test-thread-lines.mjs

- **Location**: `/scripts/test-thread-lines.mjs`
- **Purpose**: Debug and test thread line visual indicators in reply posts
- **Authentication**: Yes (hardcoded test credentials)
- **Key Features**:
  - Analyzes posts with "is-reply" class
  - Checks for thread line pseudo-elements
  - Inspects CSS rules for thread styling
  - Identifies problematic posts with incorrect thread lines
  - Takes screenshots for visual debugging
- **Special Capabilities**:
  - CSS pseudo-element inspection
  - Style rule analysis
  - Visual thread debugging

### 11. test-threads.mjs

- **Location**: `/scripts/test-threads.mjs`
- **Purpose**: Tests thread display and interaction, includes following accounts to populate feed
- **Authentication**: Yes (hardcoded test credentials)
- **Key Features**:
  - Searches for and follows accounts
  - Refreshes feed to get new content
  - Analyzes parent posts in threads
  - Checks for [No text] placeholders
  - Tests hover interactions
  - Captures UI state screenshots
- **Special Capabilities**:
  - Account following automation
  - Feed population
  - Thread structure analysis
  - Interaction testing

## Test Infrastructure

### Authentication

- Most test scripts use hardcoded credentials for the test account: `bskyclienttest.bsky.social`
- Password is embedded in scripts (security consideration for production use)

### Browser Automation

- Uses Playwright for browser automation
- Consistent viewport: 1280x720
- Most tests run with visible browser (headless: false) for debugging
- DevTools often enabled for inspection

### Screenshot Management

- Screenshots saved to `/test-screenshots/` directory
- Naming conventions include timestamps and test purpose
- Used for visual regression and debugging

### Error Detection

- Multiple approaches: console logging, error element detection, network monitoring
- Comprehensive error aggregation in diagnostic scripts

## Usage Patterns

### Development Workflow Testing

```bash
# Check for dev errors
node ./scripts/check-dev-errors.js

# Manage dev server
./scripts/dev-server.sh start
./scripts/dev-server.sh status
```

### Functionality Testing

```bash
# Test basic app functionality
node scripts/test-app.mjs

# Test specific features
node scripts/test-likes.mjs
node scripts/test-threads.mjs
```

### Debugging

```bash
# Diagnose app issues
node scripts/diagnose-app.js

# Debug specific UI elements
node scripts/debug-notification-badge.cjs
node scripts/test-thread-lines.mjs
```

## Notes

1. **Security**: Test credentials are hardcoded - not suitable for production
2. **Dependencies**: Requires Playwright for browser automation tests
3. **Environment**: Tests assume local dev server running on port 5173
4. **Browser**: Chrome preferred, some scripts test with 127.0.0.1 instead of localhost
5. **Maintenance**: Test scripts may need updates when UI changes
