#!/bin/bash
# Open URL in Chrome for better development experience

URL="${1:-http://localhost:5173/}"

# Check if Chrome is installed
if [ -d "/Applications/Google Chrome.app" ]; then
    open -a "Google Chrome" "$URL"
else
    echo "Google Chrome not found. Opening in default browser..."
    open "$URL"
fi