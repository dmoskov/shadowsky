#!/bin/bash

# Automated screenshot capture for Bluesky client
SCREENSHOT_DIR="/tmp/bsky-screenshots"
mkdir -p "$SCREENSHOT_DIR"

echo "Starting automated screenshot capture..."

# Function to take screenshot
take_screenshot() {
    local name=$1
    local url=$2
    local wait_time=${3:-3}
    
    echo "Capturing: $name"
    
    # Navigate to URL
    osascript -e "tell application \"Google Chrome\"
        tell active tab of window 1
            set URL to \"$url\"
        end tell
    end tell"
    
    # Wait for page to load
    sleep $wait_time
    
    # Take screenshot
    screencapture -x "$SCREENSHOT_DIR/${name}.png"
    echo "Saved: $SCREENSHOT_DIR/${name}.png"
    
    sleep 1
}

# Open Chrome and start
open -a "Google Chrome" "http://127.0.0.1:5173/"
sleep 3

# Login screen
take_screenshot "01-login" "http://127.0.0.1:5173/" 2

# We need to login first - using AppleScript to fill form
echo "Logging in..."
osascript <<EOF
tell application "Google Chrome"
    tell active tab of window 1
        execute javascript "
            // Fill login form
            const handleInput = document.querySelector('input[type=\"text\"]');
            const passwordInput = document.querySelector('input[type=\"password\"]');
            const submitButton = document.querySelector('button[type=\"submit\"]');
            
            if (handleInput && passwordInput && submitButton) {
                handleInput.value = 'clood41.bsky.social';
                passwordInput.value = '5FFThQrGSYwz';
                handleInput.dispatchEvent(new Event('input', { bubbles: true }));
                passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
                setTimeout(() => submitButton.click(), 500);
            }
        "
    end tell
end tell
EOF

sleep 5

# Home feed
take_screenshot "02-home-feed" "http://127.0.0.1:5173/" 3

# Scroll feed
osascript -e 'tell application "Google Chrome" to tell active tab of window 1 to execute javascript "window.scrollBy(0, 500)"'
sleep 1
take_screenshot "03-feed-scrolled" "http://127.0.0.1:5173/" 1

# Click first post for thread view
osascript -e 'tell application "Google Chrome" to tell active tab of window 1 to execute javascript "document.querySelector(\".post-card\")?.click()"'
sleep 3
take_screenshot "04-thread-view" "current" 1

# Profile view
osascript -e 'tell application "Google Chrome" to tell active tab of window 1 to execute javascript "document.querySelector(\".post-author-name\")?.click()"'
sleep 3
take_screenshot "05-profile-view" "current" 1

# Back to home and open compose
take_screenshot "06-home-with-compose" "http://127.0.0.1:5173/" 3
osascript -e 'tell application "Google Chrome" to tell active tab of window 1 to execute javascript "document.querySelector(\".compose-fab\")?.click()"'
sleep 2
take_screenshot "07-compose-modal" "current" 1

# Close modal
osascript -e 'tell application "Google Chrome" to tell active tab of window 1 to execute javascript "document.querySelector(\".btn-icon[aria-label=\\\"Close\\\"\")?.click() || document.querySelector(\".modal-backdrop\")?.click()"'
sleep 1

# Search page
take_screenshot "08-search-page" "http://127.0.0.1:5173/search" 3

# Notifications
take_screenshot "09-notifications" "http://127.0.0.1:5173/notifications" 3

echo "Screenshot capture complete!"
echo "Screenshots saved to: $SCREENSHOT_DIR"
ls -la "$SCREENSHOT_DIR"