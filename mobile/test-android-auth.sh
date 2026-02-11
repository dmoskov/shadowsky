#!/bin/bash
# Android Authentication Flow Test Script
# Task: [1213223821955402] QA - Verify auth flow end-to-end on Android emulator

set -e

echo "=============================================="
echo "  Android Authentication Flow Testing"
echo "  ShadowSky Mobile v0.7.0"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
  echo -e "${RED}Error: Node.js not found${NC}"
  echo "Please install Node.js from https://nodejs.org/"
  exit 1
fi

echo -e "${GREEN}✓${NC} Node.js installed"

# Check if Android SDK is available
if ! command -v adb &> /dev/null; then
  echo -e "${RED}Error: Android SDK not found${NC}"
  echo "Please install Android Studio and set up Android SDK."
  echo "Add Android SDK platform-tools to your PATH:"
  echo "  export ANDROID_HOME=\$HOME/Library/Android/sdk"
  echo "  export PATH=\$PATH:\$ANDROID_HOME/emulator:\$ANDROID_HOME/platform-tools"
  exit 1
fi

echo -e "${GREEN}✓${NC} Android SDK installed"

# Check if emulator command is available
if ! command -v emulator &> /dev/null; then
  echo -e "${YELLOW}Warning: emulator command not found in PATH${NC}"
  echo "You may need to add it manually:"
  echo "  export PATH=\$PATH:\$ANDROID_HOME/emulator"
  echo ""
  echo "Continuing anyway... You can start the emulator manually from Android Studio."
  EMULATOR_AVAILABLE=false
else
  echo -e "${GREEN}✓${NC} Android emulator command available"
  EMULATOR_AVAILABLE=true
fi
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

# Check for running emulators
RUNNING_DEVICES=$(adb devices | grep -v "List" | grep "device$" | wc -l)

if [ "$RUNNING_DEVICES" -eq 0 ]; then
  echo -e "${YELLOW}No Android emulator is currently running.${NC}"
  echo ""

  if [ "$EMULATOR_AVAILABLE" = true ]; then
    # List available AVDs
    echo "Available Android Virtual Devices (AVDs):"
    emulator -list-avds
    echo ""

    # Get first available AVD
    FIRST_AVD=$(emulator -list-avds | head -n 1)

    if [ -z "$FIRST_AVD" ]; then
      echo -e "${RED}No AVDs found.${NC}"
      echo "Please create an Android Virtual Device in Android Studio:"
      echo "  Tools → Device Manager → Create Device"
      echo ""
      echo "Recommended configuration:"
      echo "  - Device: Pixel 6 or similar"
      echo "  - System Image: Android 13 (API 33) or higher"
      echo "  - Enable 'Play Store' if available"
      exit 1
    fi

    echo "Starting emulator: $FIRST_AVD"
    echo "This may take 30-60 seconds..."
    emulator -avd "$FIRST_AVD" &
    EMULATOR_PID=$!

    # Wait for emulator to boot
    echo "Waiting for emulator to boot..."
    adb wait-for-device

    # Wait for boot to complete
    while [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]; do
      echo "Still booting..."
      sleep 2
    done

    echo -e "${GREEN}✓${NC} Emulator is ready"
  else
    echo "Please start an Android emulator manually:"
    echo "  1. Open Android Studio"
    echo "  2. Go to Tools → Device Manager"
    echo "  3. Click 'Play' button next to an AVD"
    echo ""
    echo "Press Enter once the emulator is running..."
    read -r

    # Check again
    RUNNING_DEVICES=$(adb devices | grep -v "List" | grep "device$" | wc -l)
    if [ "$RUNNING_DEVICES" -eq 0 ]; then
      echo -e "${RED}Error: No devices detected${NC}"
      exit 1
    fi
  fi
else
  echo -e "${GREEN}✓${NC} Android emulator is already running"
  adb devices
fi
echo ""

echo "=============================================="
echo "  Starting Expo Development Server"
echo "=============================================="
echo ""
echo "The app will launch on the Android emulator."
echo "Press 'a' if it doesn't launch automatically."
echo ""
echo -e "${YELLOW}Note: First launch may take 1-2 minutes to build.${NC}"
echo ""

# Clear previous build artifacts (optional)
if [ -d ".expo" ]; then
  rm -rf .expo
fi

# Start Expo
echo "Running: npx expo start --android"
echo ""
npx expo start --android &
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
echo "   [ ] Open React Native Debugger (Ctrl+M in emulator → 'Debug')"
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
echo "   [ ] Press back button until app closes (or use app switcher)"
echo "   [ ] Relaunch app from emulator"
echo "   [ ] App should open directly to home tab (not login)"
echo "   [ ] Session should be automatically resumed"
echo ""
echo "9. APP STATE CHANGE TEST"
echo "   [ ] Log in with valid credentials"
echo "   [ ] Press Home button to background app"
echo "   [ ] Wait 3 seconds"
echo "   [ ] Open app again from app drawer"
echo "   [ ] App should check session validity"
echo "   [ ] User should remain logged in"
echo ""
echo "10. HARDWARE BACK BUTTON TEST"
echo "   [ ] On LandingScreen, press back button"
echo "   [ ] App should exit (or show 'Press back again to exit')"
echo "   [ ] After login, press back button on home screen"
echo "   [ ] Should NOT log out, behavior depends on navigation config"
echo ""
echo "=============================================="
echo "  Debugging Tips"
echo "=============================================="
echo ""
echo "To open React Native Debugger:"
echo "  1. Press Ctrl+M (or shake device) in the Android emulator"
echo "  2. Tap 'Debug' from the menu"
echo "  3. A Chrome browser window will open"
echo ""
echo "To inspect AsyncStorage:"
echo "  In the debugger console, run:"
echo "    AsyncStorage.getAllKeys().then(console.log)"
echo "    AsyncStorage.getItem('@shadowsky/auth_session').then(console.log)"
echo ""
echo "To reload the app:"
echo "  Press 'R' twice (double-tap R) in the Android emulator"
echo "  Or press Ctrl+M → 'Reload'"
echo ""
echo "To clear all data (test fresh install):"
echo "  Run: adb shell pm clear com.shadowsky.mobile"
echo "  Then: Press 'a' in Expo terminal to reinstall"
echo ""
echo "To view logs:"
echo "  Run in another terminal: adb logcat | grep ReactNativeJS"
echo ""
echo "=============================================="
echo ""
echo -e "${GREEN}Expo dev server is running (PID: $EXPO_PID)${NC}"
echo "Press Ctrl+C to stop the server when testing is complete."
echo ""
echo "Waiting for testing to complete..."

# Wait for user to finish testing
wait $EXPO_PID
