#!/bin/bash

echo "Opening Chrome to test like button..."
echo "Make sure you're already logged in to the Bluesky client."
echo ""
echo "Once the page loads:"
echo "1. Open Developer Tools (Cmd+Option+I)"
echo "2. Go to the Console tab"
echo "3. Click a like button"
echo "4. Check the console for debug messages"
echo ""

# Open Chrome with dev tools
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --new-window \
  --auto-open-devtools-for-tabs \
  "http://127.0.0.1:5173/" \
  2>/dev/null &

echo "Chrome opened. Check the console for messages when clicking the like button."