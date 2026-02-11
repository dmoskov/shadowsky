#!/bin/bash
# iOS Authentication Flow Test Script
# Task: [1213223821955402] QA - Verify auth flow end-to-end on iOS simulator

set -e

echo "=============================================="
echo "  iOS Authentication Flow Testing"
echo "  ShadowSky Mobile v0.7.0"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
  echo -e "${RED}Error: iOS simulator requires macOS${NC}"
  echo "Please run this script on a macOS machine with Xcode installed."
  exit 1
fi

# Check if Xcode is installed
if ! command -v xcodebuild &> /dev/null; then
  echo -e "${RED}Error: Xcode not found${NC}"
  echo "Please install Xcode from the App Store."
  exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
  echo -e "${RED}Error: Node.js not found${NC}"
  echo "Please install Node.js from https://nodejs.org/"
  exit 1
fi

echo -e "${GREEN}✓${NC} macOS detected"
echo -e "${GREEN}✓${NC} Xcode installed"
echo -e "${GREEN}✓${NC} Node.js installed"
echo ""

# Navigate to mobile directory
cd "$(dirname "$0")"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}Dependencies not found. Installing...${NC}"
  npm install
  echo -e "${GREEN}✓${NC} Dependencies installed"
else
  echo -e "${GREEN}✓${NC} Dependencies found"
fi
echo ""

# Check for running simulators
RUNNING_SIMULATORS=$(xcrun simctl list devices | grep "Booted" | wc -l)

if [ "$RUNNING_SIMULATORS" -eq 0 ]; then
  echo "No iOS simulator is currently running."
  echo "Starting iOS simulator..."
  open -a Simulator
  echo "Waiting for simulator to boot..."
  sleep 8
else
  echo -e "${GREEN}✓${NC} iOS simulator is already running"
fi
echo ""

# Get list of available simulators
echo "Available iOS simulators:"
xcrun simctl list devices iOS | grep -v "unavailable" | grep "(" | head -5
echo ""

echo "=============================================="
echo "  Starting Expo Development Server"
echo "=============================================="
echo ""
echo "The app will launch on the iOS simulator."
echo "Press 'i' if it doesn't launch automatically."
echo ""
echo -e "${YELLOW}Note: First launch may take 1-2 minutes to build.${NC}"
echo ""

# Clear previous build artifacts (optional)
if [ -d ".expo" ]; then
  rm -rf .expo
fi

# Start Expo
echo "Running: npx expo start --ios"
echo ""
npx expo start --ios &
EXPO_PID=$!

# Wait a bit for the server to start
sleep 3

echo ""
echo "=============================================="
echo "  Manual Test Checklist"
echo "=============================================="
echo ""
echo "Once the app launches, perform these tests:"
echo ""
echo "1. FRESH INSTALL TEST"
echo "   [ ] App shows LandingScreen (not home screen)"
echo "   [ ] Title 'ShadowSky' is visible"
echo "   [ ] 'Handle or Email' and 'App Password' fields present"
echo "   [ ] 'Sign In' button is present"
echo ""
echo "2. VALID LOGIN TEST"
echo "   [ ] Enter valid handle (e.g., yourhandle.bsky.social)"
echo "   [ ] Enter valid app password"
echo "   [ ] Tap 'Sign In' button"
echo "   [ ] Loading indicator appears"
echo "   [ ] App redirects to home tab"
echo "   [ ] Can see home timeline"
echo "   [ ] Bottom tabs are visible (Home, Notifications, Search, Profile)"
echo ""
echo "3. INVALID LOGIN TEST"
echo "   [ ] Sign out first (if logged in)"
echo "   [ ] Enter invalid handle"
echo "   [ ] Enter invalid password"
echo "   [ ] Tap 'Sign In' button"
echo "   [ ] Alert appears: 'Sign In Failed'"
echo "   [ ] Message: 'Invalid credentials...'"
echo "   [ ] After dismissing alert, still on login screen"
echo ""
echo "4. EMPTY FIELDS VALIDATION"
echo "   [ ] Clear both fields"
echo "   [ ] Tap 'Sign In' button"
echo "   [ ] Alert appears: 'Error'"
echo "   [ ] Message: 'Please enter both handle and app password'"
echo ""
echo "5. AUTH STATE VERIFICATION"
echo "   [ ] Log in with valid credentials"
echo "   [ ] Open React Native Debugger (⌘+D in simulator → 'Debug')"
echo "   [ ] In console, check: AsyncStorage.getItem('@shadowsky/auth_session')"
echo "   [ ] Should show session data"
echo ""
echo "6. SIGN OUT TEST"
echo "   [ ] Navigate to Profile tab"
echo "   [ ] Find and tap 'Sign Out' button"
echo "   [ ] App immediately redirects to LandingScreen"
echo "   [ ] Cannot navigate back to authenticated routes"
echo ""
echo "7. ASYNC STORAGE CLEANUP"
echo "   [ ] After signing out, open React Native Debugger"
echo "   [ ] Check: AsyncStorage.getItem('@shadowsky/auth_session')"
echo "   [ ] Should return null"
echo "   [ ] Check: AsyncStorage.getItem('@shadowsky/active_account')"
echo "   [ ] Should return null"
echo ""
echo "8. SESSION PERSISTENCE"
echo "   [ ] Log in with valid credentials"
echo "   [ ] Verify on home screen"
echo "   [ ] Force quit app (swipe up in app switcher)"
echo "   [ ] Relaunch app from simulator home screen"
echo "   [ ] App should open directly to home tab (not login)"
echo "   [ ] Session should be automatically resumed"
echo ""
echo "9. APP STATE CHANGE TEST"
echo "   [ ] Log in with valid credentials"
echo "   [ ] Press Home button (⌘+H) to background app"
echo "   [ ] Wait 3 seconds"
echo "   [ ] Open app again"
echo "   [ ] App should check session validity"
echo "   [ ] User should remain logged in"
echo ""
echo "=============================================="
echo "  Debugging Tips"
echo "=============================================="
echo ""
echo "To open React Native Debugger:"
echo "  1. Press ⌘+D in the iOS simulator"
echo "  2. Tap 'Debug' from the menu"
echo "  3. A Chrome/Safari window will open"
echo ""
echo "To inspect AsyncStorage:"
echo "  In the debugger console, run:"
echo "    AsyncStorage.getAllKeys().then(console.log)"
echo "    AsyncStorage.getItem('@shadowsky/auth_session').then(console.log)"
echo ""
echo "To reload the app:"
echo "  Press ⌘+R in the iOS simulator"
echo ""
echo "To clear all data (test fresh install):"
echo "  1. In simulator, long-press app icon"
echo "  2. Choose 'Remove App'"
echo "  3. Press 'i' in Expo terminal to reinstall"
echo ""
echo "=============================================="
echo ""
echo -e "${GREEN}Expo dev server is running (PID: $EXPO_PID)${NC}"
echo "Press Ctrl+C to stop the server when testing is complete."
echo ""
echo "Waiting for testing to complete..."

# Wait for user to finish testing
wait $EXPO_PID
